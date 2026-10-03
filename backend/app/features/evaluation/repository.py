"""Evaluation feature repository — all SQL for the evaluation pipeline, no decisions.

Per the strictly layered architecture (*SoT: router → service → repository*),
this module holds **only** SQL against the ``assessments`` and ``answers``
tables. It makes no decisions: classification of blank answers, blank-skip
logic, prompt building, AI parsing/validation, scoring, and diagnosis all live
in the evaluation service and the pure ``scoring`` module. This layer simply
loads the rows the service needs and writes back the values the service
computes.

Every query is parameterized (no string interpolation of inputs) to avoid SQL
injection. Functions accept a ``psycopg`` connection configured with the
``dict_row`` factory (see ``app.database.connection.get_db``); writes are
committed by the surrounding request/transaction scope, not here.

Requirements covered:
- 6.3 — stores per-answer ``ai_verdict`` and ``evidence`` (the service decides
  whether evidence is a verbatim substring or ``None``).
- 6.5 — supports setting ``evaluation_error`` (and clearing it for the teacher
  retry) and writing the assessment AI fields atomically after a valid response.
"""

from __future__ import annotations

from typing import Optional

from psycopg import Connection
from psycopg.rows import DictRow


def load_assessment(
    db: Connection[DictRow], assessment_id: int
) -> Optional[DictRow]:
    """Return the full assessment row by primary key, or ``None`` if not found.

    Selects every assessment column — including ``passage_text`` (needed to
    build the AI prompt and to verify evidence is a verbatim substring) and
    ``status`` (the service precondition that the assessment is ``completed``) —
    so the service has everything it needs without a second query.

    Returns the assessment row, or ``None`` when no assessment has that id.
    """
    with db.cursor() as cur:
        cur.execute(
            """
            SELECT id,
                   learner_id,
                   classroom_id,
                   access_code,
                   title,
                   category,
                   passage_text,
                   scheduled_for,
                   status,
                   completed_at,
                   reading_accuracy,
                   comprehension_score,
                   diagnosis,
                   evaluation,
                   recommendation,
                   evaluated_by,
                   evaluation_error,
                   corrections_seen_at,
                   created_at
            FROM assessments
            WHERE id = %s
            """,
            (assessment_id,),
        )
        return cur.fetchone()


def load_answers_sorted_by_id(
    db: Connection[DictRow], assessment_id: int
) -> list[DictRow]:
    """Return the assessment's answer rows ordered by ``id`` ascending.

    The ascending ``id`` order is significant: the AI response's 1-based
    ``order`` field aligns with the non-blank answers in this exact ordering
    (*SoT: Evaluation Rules*), and answers display in ``id`` order throughout the
    product. Includes the fields the service needs to classify blanks, build the
    PII-free prompt, apply AI verdicts, and compute final verdicts:
    ``question_text``, ``skill``, ``expected_ideas``, ``answer_text``,
    ``ai_verdict``, ``evidence``, and ``teacher_override``.

    Returns a (possibly empty) list of answer rows.
    """
    with db.cursor() as cur:
        cur.execute(
            """
            SELECT id,
                   assessment_id,
                   question_text,
                   skill,
                   expected_ideas,
                   answer_text,
                   ai_verdict,
                   evidence,
                   teacher_override,
                   overridden_at,
                   override_note
            FROM answers
            WHERE assessment_id = %s
            ORDER BY id ASC
            """,
            (assessment_id,),
        )
        return cur.fetchall()


def set_ai_verdict(
    db: Connection[DictRow],
    answer_id: int,
    verdict: Optional[str],
    evidence: Optional[str],
) -> None:
    """Set a single answer's ``ai_verdict`` and ``evidence``.

    Used both for blank answers (the service passes ``verdict='missed'`` and
    ``evidence=None`` without calling the AI) and for non-blank answers after a
    valid AI response (``evidence`` already resolved by the service to a verbatim
    passage substring or ``None``). Requirement 6.3. The repository makes no
    decision about which value to store.
    """
    with db.cursor() as cur:
        cur.execute(
            """
            UPDATE answers
            SET ai_verdict = %s,
                evidence = %s
            WHERE id = %s
            """,
            (verdict, evidence, answer_id),
        )


def set_assessment_ai_fields(
    db: Connection[DictRow],
    assessment_id: int,
    evaluation: Optional[str],
    recommendation: Optional[str],
    evaluated_by: Optional[str],
    evaluation_error: Optional[str],
) -> None:
    """Write the assessment's AI narrative fields after a valid evaluation.

    Sets ``evaluation`` (AI summary), ``recommendation`` (AI next step),
    ``evaluated_by`` (``'ai'`` on success), and ``evaluation_error`` in one
    statement. On a successful run the service passes ``evaluation_error=None``
    to clear any prior error (Requirement 6.5). ``evaluation`` and
    ``recommendation`` are written here only by the evaluation pipeline and are
    never rewritten on a teacher override (*SoT: Rules*).
    """
    with db.cursor() as cur:
        cur.execute(
            """
            UPDATE assessments
            SET evaluation = %s,
                recommendation = %s,
                evaluated_by = %s,
                evaluation_error = %s
            WHERE id = %s
            """,
            (evaluation, recommendation, evaluated_by, evaluation_error, assessment_id),
        )


def set_evaluation_error(
    db: Connection[DictRow], assessment_id: int, error: str
) -> None:
    """Record an evaluation failure message on the assessment.

    Called when the AI response is still invalid after one retry (Requirement
    6.5). The service leaves ``diagnosis`` null and writes no partial verdicts;
    this only stamps the short error message so the learner view can report the
    evaluation state as failed.
    """
    with db.cursor() as cur:
        cur.execute(
            """
            UPDATE assessments
            SET evaluation_error = %s
            WHERE id = %s
            """,
            (error, assessment_id),
        )


def set_score_and_diagnosis(
    db: Connection[DictRow],
    assessment_id: int,
    score: float,
    diagnosis: str,
) -> None:
    """Write the computed ``comprehension_score`` and ``diagnosis``.

    Both values are computed by the pure ``scoring`` module from the final
    verdicts (``COALESCE(teacher_override, ai_verdict)``) — never by the AI
    (Requirements 6.1, 6.4). The repository only persists what the service
    computed.
    """
    with db.cursor() as cur:
        cur.execute(
            """
            UPDATE assessments
            SET comprehension_score = %s,
                diagnosis = %s
            WHERE id = %s
            """,
            (score, diagnosis, assessment_id),
        )


def clear_evaluation_error(
    db: Connection[DictRow], assessment_id: int
) -> None:
    """Clear a prior ``evaluation_error`` so a teacher can re-run evaluation.

    Backs the teacher retry endpoint (Requirement 6.5): the service clears the
    error before re-running the evaluation pipeline synchronously.
    """
    with db.cursor() as cur:
        cur.execute(
            """
            UPDATE assessments
            SET evaluation_error = NULL
            WHERE id = %s
            """,
            (assessment_id,),
        )
