"""Schemas + validation for AI-extracted assessment drafts (OCR -> draft).

The extraction endpoint sends raw scanned/pasted text to the AI client, which
returns a JSON draft of a reading assessment (title, category, passage, and
3-5 skill-tagged questions). ``try_parse_extraction`` turns that raw string
into a validated :class:`ExtractedAssessment`, or returns ``None`` on any
failure so the service can retry once and then surface a clear error. It never
raises on malformed input.

These are DTOs + a parse helper only — no business logic beyond validation.
See ``app.ai.prompts.build_extraction_prompt`` for the matching contract.
"""

import json
from typing import Optional

from pydantic import BaseModel, Field, ValidationError

from app.constants import Skill


class ExtractedQuestion(BaseModel):
    """One AI-drafted question for a scanned assessment."""

    question_text: str = Field(min_length=1)
    skill: Skill  # Literal set: literal | inference | vocabulary | sequencing
    expected_ideas: str = Field(min_length=1)


class ExtractedAssessment(BaseModel):
    """The full AI-drafted assessment ready to prefill the create form.

    Constrained to 3-5 questions to match the scheduling rules (Requirement
    5.1). ``title``/``category``/``passage_text`` are non-empty.
    """

    title: str = Field(min_length=1)
    category: str = Field(min_length=1)
    passage_text: str = Field(min_length=1)
    questions: list[ExtractedQuestion] = Field(min_length=3, max_length=5)


def try_parse_extraction(raw: str) -> Optional[ExtractedAssessment]:
    """Parse + validate a raw AI extraction response.

    Returns an :class:`ExtractedAssessment` on success, or ``None`` on any
    failure (invalid JSON, wrong shape, a skill outside the allowed set, or a
    question count outside 3-5). Never raises on invalid input, so the caller
    can retry once before reporting an error.
    """
    try:
        payload = json.loads(raw)
    except (ValueError, TypeError):
        return None
    try:
        return ExtractedAssessment.model_validate(payload)
    except ValidationError:
        return None