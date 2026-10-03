"""Evaluation feature service — AI call orchestration, scoring, and diagnosis.

Per the strictly layered architecture (*SoT: router → service → repository*),
this module holds **all** evaluation rules and makes **no** SQL calls of its
own: it loads rows and writes results through
:mod:`app.features.evaluation.repository`, builds the PII-free prompt via
:mod:`app.ai.prompts`, obtains a swappable client via
:mod:`app.ai.chatbot_client`, parses/validates the AI response via
:mod:`app.features.evaluation.schemas`, and computes the score and diagnosis in
our own code via :mod:`app.features.evaluation.scoring` — never the AI.

The entry point is :func:`evaluate`, run once per learner assessment (triggered
via ``BackgroundTasks`` on submit, or synchronously via the teacher retry
endpoint). The design shows ``evaluate`` as ``async``; a plain ``def`` is used
here because the only callers are a background task and a synchronous retry
route, and nothing inside awaits — keeping it synchronous is simpler and the AI
client's ``complete`` is itself synchronous.

Pipeline (design.md — "Algorithmic Pseudocode / Evaluation pipeline"):

1. Load the assessment and its answers (sorted by id).
2. Classify blanks: code sets ``ai_verdict='missed'`` for each blank answer and
   never sends it to the AI (Requirements 6.3, 6.6).
3. If every answer is blank, skip the AI call entirely and finalize scoring
   (Requirement 6.6).
4. Build a PII-free prompt from the passage and the non-blank answers only — no
   names, LRNs, or classroom names (Requirement 6.2).
5. Call the AI with a ~15s timeout and retry once on an invalid response; log
   token usage and latency to the console per attempt (Requirement 6.7).
6. On persistent failure, set ``evaluation_error``, leave ``diagnosis`` null,
   and write no non-blank AI verdicts (Requirement 6.5).
7. On success, store each non-blank verdict with verbatim-or-null evidence
   (Requirement 6.3), write ``evaluation``/``recommendation``/
   ``evaluated_by='ai'``, then finalize the score and diagnosis from the final
   verdicts (Requirements 6.1, 6.4).

See design.md ("Key Functions with Formal Specifications",
"Algorithmic Pseudocode") and requirements 6.1-6.7.
"""

from __future__ import annotations

import time
from typing import Optional, Sequence

from psycopg import Connection
from psycopg.rows import DictRow

from app.ai.chatbot_client import build_ai_client
from app.ai.prompts import build_evaluation_prompt
from app.constants import VERDICT_MISSED
from app.features.evaluation import repository as repo
from app.features.evaluation.schemas import ParsedAIResponse, try_parse_and_validate
from app.features.evaluation.scoring import (
    compute_diagnosis,
    compute_score,
    final_verdict,
)

# Maximum attempts at the AI call: the initial try plus one retry on an invalid
# response (Requirement 6.5 — "invalid after one retry").
_MAX_AI_ATTEMPTS = 2

# Short, learner-facing message stamped when evaluation cannot complete
# automatically after the retry (Requirement 6.5).
_EVALUATION_FAILED_MESSAGE = "Couldn't check automatically"


def is_blank(answer_text: Optional[str]) -> bool:
    """Return ``True`` when ``answer_text`` is a Blank_Answer.

    A Blank_Answer is one whose text is ``None``, empty, or only whitespace
    (*SoT: Glossary*). Blank answers are scored as ``missed`` in code and are
    never sent to the AI (Requirements 6.3, 6.6).
    """
    return answer_text is None or answer_text.strip() == ""


def evaluate(db: Connection[DictRow], assessment_id: int) -> None:
    """Run the full evaluation pipeline for one completed assessment.

    Precondition: the assessment exists and is ``status='completed'`` with saved
    answers.

    Postconditions (success): each non-blank answer has an ``ai_verdict`` and
    verbatim-or-null ``evidence``; each blank answer has ``ai_verdict='missed'``;
    the assessment has ``evaluation``, ``recommendation``, ``evaluated_by='ai'``,
    ``comprehension_score`` and ``diagnosis`` set, and ``evaluation_error``
    cleared.

    Postconditions (failure after one retry): ``evaluation_error`` is set,
    ``diagnosis`` is left null, and no non-blank AI verdicts are written. Blank
    answers keep the ``missed`` verdict assigned in step 2, which the design
    writes first; only non-blank AI verdicts are withheld on failure.

    Invariants: the AI prompt never contains names, LRNs, or classroom names
    (Requirement 6.2); the AI's ``order`` field is a 1-based position over the
    non-blank answers sorted by ``id`` (not a DB column).
    """
    assessment = repo.load_assessment(db, assessment_id)
    if assessment is None:
        # Defensive: the caller guarantees the assessment exists, but if it was
        # removed between submit and the background run there is nothing to do.
        return

    answers = repo.load_answers_sorted_by_id(db, assessment_id)

    # --- Step 2: classify blanks. Code sets 'missed'; never sent to the AI. ---
    non_blank: list[DictRow] = []
    for answer in answers:
        if is_blank(answer["answer_text"]):
            repo.set_ai_verdict(db, answer["id"], VERDICT_MISSED, None)
        else:
            non_blank.append(answer)

    # --- Step 3: everything blank -> skip the AI call entirely (Req 6.6). ---
    if not non_blank:
        _finalize_scoring(db, assessment_id)
        return

    # --- Step 4: build the PII-free prompt (passage + non-blank answers). ---
    # Only the four non-PII question fields are included (Requirement 6.2).
    payload = [
        {
            "question_text": a["question_text"],
            "skill": a["skill"],
            "expected_ideas": a["expected_ideas"],
            "answer_text": a["answer_text"],
        }
        for a in non_blank
    ]
    prompt = build_evaluation_prompt(assessment["passage_text"], payload)

    # --- Step 5: call the AI, retry once on invalid; log tokens + latency. ---
    client = build_ai_client()
    parsed: Optional[ParsedAIResponse] = None
    for attempt in range(1, _MAX_AI_ATTEMPTS + 1):
        # The stub has no real network timeout, but a real provider's client
        # (ChatbotClient, built with timeout=15.0s) applies a ~15s timeout to
        # this call; a timeout surfaces as an invalid/no response and is retried
        # exactly like any other invalid response (Requirement 6.5).
        start = time.monotonic()
        raw = client.complete(prompt)
        latency_s = time.monotonic() - start

        # The stub exposes no token counts; log a placeholder until the real
        # provider supplies usage (Requirement 6.7). When the provider is
        # announced this is the single place that reads real token usage.
        tokens_used = "n/a (stub)"
        print(
            f"[evaluation] assessment={assessment_id} attempt={attempt} "
            f"tokens={tokens_used} latency={latency_s:.3f}s"
        )

        parsed = try_parse_and_validate(raw, expected_count=len(non_blank))
        if parsed is not None:
            break

    # --- Step 6: still invalid after the retry -> record failure, stop. ---
    if parsed is None:
        # Leave diagnosis null and write NO non-blank AI verdicts (Req 6.5).
        # The blank 'missed' verdicts from step 2 remain, per the design which
        # writes blanks first.
        repo.set_evaluation_error(db, assessment_id, _EVALUATION_FAILED_MESSAGE)
        return

    # --- Step 7: valid response. Store verdicts with verbatim-or-null evidence. ---
    passage_text = assessment["passage_text"]
    for entry, answer in zip(parsed.answers, non_blank):
        # Evidence is stored only when it is a verbatim substring of the passage;
        # otherwise null (Requirement 6.3).
        evidence = (
            entry.evidence
            if entry.evidence is not None and entry.evidence in passage_text
            else None
        )
        repo.set_ai_verdict(db, answer["id"], entry.verdict, evidence)

    repo.set_assessment_ai_fields(
        db,
        assessment_id,
        evaluation=parsed.evaluation,
        recommendation=parsed.recommendation,
        evaluated_by="ai",
        evaluation_error=None,
    )

    # --- Step 8: score + diagnose from the FINAL verdicts (our code). ---
    _finalize_scoring(db, assessment_id)


def _finalize_scoring(db: Connection[DictRow], assessment_id: int) -> None:
    """Compute and persist ``comprehension_score`` and ``diagnosis``.

    Reloads the answers so the computation uses the verdicts just written (blank
    ``missed`` verdicts and any AI verdicts). The score and diagnosis are derived
    from the final verdicts — ``COALESCE(teacher_override, ai_verdict)`` — never
    from the AI (Requirements 6.1, 6.4).

    An assessment is diagnosed ``highest_priority`` when it contains a blank
    answer with no teacher override, regardless of score (Requirement 6.4).
    """
    answers = repo.load_answers_sorted_by_id(db, assessment_id)

    finals: Sequence[Optional[str]] = [
        final_verdict(a["ai_verdict"], a["teacher_override"]) for a in answers
    ]
    score = compute_score(finals)

    blank_no_override = any(
        is_blank(a["answer_text"]) and a["teacher_override"] is None for a in answers
    )
    diagnosis = compute_diagnosis(score, blank_no_override)

    repo.set_score_and_diagnosis(db, assessment_id, score, diagnosis)
