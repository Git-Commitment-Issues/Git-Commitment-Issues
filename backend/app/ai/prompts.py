"""Evaluation prompt builder and AI response JSON contract.

This module owns the single prompt the backend sends to the AI_Client to check
a submitted reading-comprehension assessment, plus the documented shape of the
response the AI is expected to return.

Privacy is enforced here by construction: the prompt payload is built only from
the passage and the non-blank question records. It NEVER includes learner names,
LRNs, or classroom names (PII). See requirements 6.2 and design.md
(*SoT: Evaluation Rules*).

Response contract (the AI must return JSON ONLY matching this shape)::

    {
      "answers": [
        {"order": 1, "verdict": "correct", "evidence": "<sentence from passage>"}
      ],
      "evaluation": "<2-3 sentence summary>",
      "recommendation": "<one concrete next step, neutral wording, no names>"
    }

Contract notes:
- ``answers`` contains exactly one entry per NON-BLANK answer sent in the prompt.
- ``order`` is a 1-based position over the non-blank answers as sorted by answer
  id (NOT a database column). It maps each entry back to its answer.
- ``verdict`` is exactly one of ``correct`` | ``partial`` | ``missed``.
- ``evidence`` is a verbatim sentence copied from the passage, or ``null`` when
  no supporting sentence is found. The backend re-checks that evidence is a
  verbatim substring of the passage and stores ``null`` otherwise.
- ``evaluation`` is a short (2-3 sentence) summary of overall comprehension.
- ``recommendation`` is one concrete next step in neutral wording with no names.
"""

import json

# System rules prepended to every evaluation prompt (*SoT: Evaluation Rules*).
EVALUATION_SYSTEM_RULES = (
    "You are a reading-comprehension checker. Return JSON ONLY. "
    "Copy evidence verbatim from the passage. If evidence is not found, use null. "
    "Never include names, LRNs, or classroom names in your output."
)

# The exact response-contract shape, documented inline in the prompt so the
# model returns parseable, PII-free JSON. Kept as a constant so the stub client
# and the real provider share one source of truth for the contract.
RESPONSE_CONTRACT = {
    "answers": [
        {
            "order": 1,
            "verdict": "correct | partial | missed",
            "evidence": "<verbatim sentence from the passage, or null>",
        }
    ],
    "evaluation": "<2-3 sentence summary of overall comprehension>",
    "recommendation": "<one concrete next step, neutral wording, no names>",
}


def build_evaluation_prompt(passage: str, questions: list[dict]) -> str:
    """Build the AI evaluation prompt from a passage and non-blank questions.

    Args:
        passage: The reading passage text.
        questions: A list of NON-BLANK answer payloads, each a dict with keys
            ``question_text``, ``skill``, ``expected_ideas``, and ``answer_text``.
            Callers MUST pass only non-blank answers, already sorted by answer id.
            The 1-based position of each item in this list is the ``order`` the
            AI must echo back in its response.

    Returns:
        A single prompt string containing the system rules, the passage, one
        ``Question:`` block per item (so a 1-based ``order`` can be matched back),
        and the required JSON response contract.

    Privacy: the prompt is assembled only from the passage and the four question
    fields above. It never includes learner names, LRNs, or classroom names
    (*SoT*; requirement 6.2). Each question block carries a ``Question:`` marker
    line, which the stub AI client counts to size its deterministic response.
    """
    lines: list[str] = [
        EVALUATION_SYSTEM_RULES,
        "",
        "PASSAGE:",
        passage,
        "",
        "Evaluate each answer below. Judge each 'verdict' against the expected",
        "key ideas, and copy a verbatim supporting sentence from the passage",
        "into 'evidence' (use null when no supporting sentence exists).",
        "",
    ]

    for order, q in enumerate(questions, start=1):
        lines.append(f"Question: (order {order})")
        lines.append(f"Skill: {q.get('skill', '')}")
        lines.append(f"Prompt: {q.get('question_text', '')}")
        lines.append(f"Expected ideas: {q.get('expected_ideas', '')}")
        lines.append(f"Learner answer: {q.get('answer_text', '')}")
        lines.append("")

    lines.append(
        "Respond with JSON ONLY matching exactly this shape "
        "(one 'answers' entry per question above, in order):"
    )
    lines.append(json.dumps(RESPONSE_CONTRACT, indent=2))

    return "\n".join(lines)
