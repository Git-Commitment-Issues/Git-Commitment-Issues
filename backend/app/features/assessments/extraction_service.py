"""Service: turn raw scanned/pasted text into a structured assessment draft.

Orchestrates the AI call for the OCR-to-assessment feature: builds the
extraction prompt, calls the swappable AI client, parses/validates the draft,
and retries once on an invalid response (mirroring the evaluation pipeline's
retry policy). It returns a plain dict ready to prefill the create form; it does
NOT write to the database — the teacher reviews and submits the draft, which
then goes through the normal scheduling path.
"""

from __future__ import annotations

import time

from fastapi import HTTPException, status

from app.ai.chatbot_client import build_ai_client
from app.ai.prompts import build_extraction_prompt
from app.features.assessments.extraction_schemas import try_parse_extraction

# Initial attempt plus one retry on an invalid response.
_MAX_ATTEMPTS = 2

# Guard against sending near-empty OCR noise to the model.
_MIN_SOURCE_CHARS = 30


def extract_assessment(raw_text: str) -> dict:
    """Draft a reading assessment from raw scanned/pasted text.

    Args:
        raw_text: OCR / pasted source text (may contain noise).

    Returns:
        A dict matching the create-assessment draft shape::

            {title, category, passage_text,
             questions: [{question_text, skill, expected_ideas}, ...]}  (3-5)

    Raises:
        HTTPException: ``422`` when the source text is too short to work with,
            or when the AI could not produce a valid draft after one retry.
    """
    text = (raw_text or "").strip()
    if len(text) < _MIN_SOURCE_CHARS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "Not enough text to build an assessment. Scan or paste a longer "
                "passage and try again."
            ),
        )

    prompt = build_extraction_prompt(text)
    client = build_ai_client()

    parsed = None
    for attempt in range(1, _MAX_ATTEMPTS + 1):
        start = time.monotonic()
        raw = client.complete(prompt)
        latency_s = time.monotonic() - start
        print(
            f"[extraction] attempt={attempt} latency={latency_s:.3f}s "
            f"chars_in={len(text)}"
        )
        parsed = try_parse_extraction(raw)
        if parsed is not None:
            break

    if parsed is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "Couldn't turn that text into an assessment automatically. You "
                "can still create one manually, or try a clearer scan."
            ),
        )

    # Return a plain dict for the response model / client to consume.
    return parsed.model_dump()