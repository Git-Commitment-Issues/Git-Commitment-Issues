"""Pydantic DTOs and parse/validate helpers for the AI evaluation response.

The evaluation service calls the AI client, which returns a JSON string shaped
per the AI response contract (*SoT: AI response contract*):

    {
      "answers": [{"order": 1, "verdict": "correct", "evidence": "<quote>"}],
      "evaluation": "<2-3 sentence summary>",
      "recommendation": "<one concrete next step>"
    }

`try_parse_and_validate` turns that raw string into a validated
`ParsedAIResponse`, or returns ``None`` on any failure so the service can retry
once and then treat the result as an AI failure (requirement 6.5). It never
raises on malformed input.

These are DTOs only, no business logic beyond parse/validation (*SoT: Layer
Rules*). See design.md ("AI response validation contract") and requirement 6.5.
"""

import json
from typing import Optional

from pydantic import BaseModel, ValidationError

from app.constants import Verdict


class AIAnswerEntry(BaseModel):
    """A single per-answer verdict entry from the AI response.

    ``order`` is a 1-based position over the non-blank answers (sorted by answer
    id) that were sent to the AI, not a database column. ``evidence`` is the
    verbatim passage quote the AI copied, or ``None`` when it reported none; the
    service still re-checks that the quote is a verbatim substring of the passage
    before storing it.
    """

    order: int
    verdict: Verdict
    evidence: Optional[str] = None


class ParsedAIResponse(BaseModel):
    """The full parsed AI response: per-answer verdicts plus narrative fields."""

    answers: list[AIAnswerEntry]
    evaluation: str
    recommendation: str


def try_parse_and_validate(
    raw: str, expected_count: int
) -> Optional[ParsedAIResponse]:
    """Parse and validate a raw AI response string.

    Returns a `ParsedAIResponse` on success, or ``None`` on any validation
    failure so the caller can retry once before treating the result as an AI
    failure. This function never raises on invalid input.

    A response is considered valid only when all of the following hold
    (requirement 6.5):
      - ``raw`` is valid JSON describing the expected object shape.
      - ``answers`` contains exactly ``expected_count`` entries (one per
        non-blank answer).
      - Every entry's ``verdict`` is within the allowed set
        (``correct``/``partial``/``missed``) — enforced by the `Verdict`
        literal during model validation.
    """
    # 1. Must be valid JSON.
    try:
        payload = json.loads(raw)
    except (ValueError, TypeError):
        return None

    # 2. Must match the expected object shape, and every verdict must be within
    #    the allowed set (enforced by the Verdict literal on AIAnswerEntry).
    try:
        parsed = ParsedAIResponse.model_validate(payload)
    except ValidationError:
        return None

    # 3. Must contain exactly one entry per non-blank answer.
    if len(parsed.answers) != expected_count:
        return None

    return parsed
