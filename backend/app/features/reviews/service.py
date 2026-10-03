"""Reviews feature service — teacher overrides and immediate recompute.

Per the strictly layered architecture (*SoT: router → service → repository*),
this module holds **all** override rules and makes **no** SQL calls of its own:
it reads and writes override state through
:mod:`app.features.reviews.repository`, computes final verdicts, score, and
diagnosis in our own code via :mod:`app.features.evaluation.scoring`, and reuses
the shared Blank_Answer rule from :mod:`app.features.evaluation.service`
(``is_blank``). Routers above call :func:`override_answer` with a validated
:class:`~app.features.reviews.schemas.OverrideRequest` and the Current_User;
they parse requests and map responses only.

Override flow (design.md — "Teacher override recompute"; Requirements 5.5, 5.7):

1. Validate ``verdict`` is ``None`` or exactly one of
   ``correct``/``partial``/``missed``. The DTO already rejects any other literal
   with a ``422`` at the router; the service re-checks defensively and raises a
   ``422`` making **no** change if an invalid value somehow reaches it
   (Requirement 5.7).
2. Load the answer; ``404`` if it does not exist.
3. ``verdict is None`` -> clear the override (``teacher_override``,
   ``overridden_at``, ``override_note`` all back to ``NULL``); otherwise set the
   override with ``overridden_at = now()`` (stamped by the repository) and the
   provided note (Requirement 5.7).
4. Reload the answers and recompute ``comprehension_score`` and ``diagnosis``
   from the final verdicts (``COALESCE(teacher_override, ai_verdict)``), then
   persist them. ``evaluation`` and ``recommendation`` are preserved unchanged
   because the repository's ``set_score_and_diagnosis`` touches only the two
   score/diagnosis columns (Requirement 5.5; *SoT: Rules*).

See design.md ("Core Flows — Teacher override recompute") and requirements
5.5 and 5.7.
"""

from __future__ import annotations

from typing import Optional

from fastapi import HTTPException, status
from psycopg import Connection
from psycopg.rows import DictRow

from app.constants import VERDICTS
from app.features.evaluation.scoring import (
    compute_diagnosis,
    compute_score,
    final_verdict,
)
from app.features.evaluation.service import is_blank
from app.features.reviews import repository as repo
from app.features.reviews.schemas import OverrideRequest


def override_answer(
    db: Connection[DictRow], answer_id: int, request: OverrideRequest
) -> dict:
    """Apply or clear a teacher override on an answer and recompute results.

    Sets the override (``teacher_override``, ``overridden_at = now()``,
    ``override_note``) when ``request.verdict`` is a valid verdict, or clears it
    when ``request.verdict`` is ``None`` (Requirement 5.7). Then recomputes the
    owning assessment's ``comprehension_score`` and ``diagnosis`` from the final
    verdicts and persists them, leaving ``evaluation``/``recommendation``
    unchanged (Requirement 5.5).

    Returns a summary dict ``{"assessment_id", "comprehension_score",
    "diagnosis"}`` with the freshly recomputed values.

    Raises ``HTTPException(422)`` if ``verdict`` is an invalid value (no change
    is made), and ``HTTPException(404)`` if no answer has ``answer_id``.
    """
    # --- Step 1: defensive validation; make NO change on an invalid verdict. ---
    # The OverrideRequest DTO types verdict as Optional[Verdict], so Pydantic
    # already rejects anything outside correct/partial/missed/null with a 422 at
    # the router. Re-check here so an invalid value that somehow bypasses the DTO
    # still produces a 422 without touching the answer (Requirement 5.7).
    if request.verdict is not None and request.verdict not in VERDICTS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid verdict; must be one of correct, partial, missed, or null.",
        )

    # --- Step 2: load the answer; 404 if it does not exist. ---
    answer = repo.get_answer(db, answer_id)
    if answer is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Answer not found.",
        )
    assessment_id = answer["assessment_id"]

    # --- Step 3: set or clear the override (Requirement 5.7). ---
    if request.verdict is None:
        repo.clear_override(db, answer_id)
    else:
        # overridden_at = now() is stamped by the repository.
        repo.set_override(db, answer_id, request.verdict, request.note)

    # --- Step 4: recompute score + diagnosis from the final verdicts. ---
    # evaluation/recommendation are preserved: set_score_and_diagnosis only
    # updates comprehension_score and diagnosis (Requirement 5.5).
    answers = repo.load_answers(db, assessment_id)

    finals: list[Optional[str]] = [
        final_verdict(a["ai_verdict"], a["teacher_override"]) for a in answers
    ]
    score = compute_score(finals)

    blank_no_override = any(
        is_blank(a["answer_text"]) and a["teacher_override"] is None for a in answers
    )
    diagnosis = compute_diagnosis(score, blank_no_override)

    repo.set_score_and_diagnosis(db, assessment_id, score, diagnosis)

    return {
        "assessment_id": assessment_id,
        "comprehension_score": score,
        "diagnosis": diagnosis,
    }
