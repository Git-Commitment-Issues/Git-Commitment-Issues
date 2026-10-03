"""Reviews feature router — teacher override endpoint, parse/map only.

Per the strictly layered architecture (*SoT: router → service → repository*),
this router only parses the request body and maps the service result to a
response schema; all override rules and the immediate recompute live in
:mod:`app.features.reviews.service`. The single endpoint is teacher-only via
the ``require_teacher`` dependency, which raises ``403`` for non-teachers
(Requirement 1.8).

Endpoint:

- ``PATCH /answers/{answer_id}/override`` — apply or clear a teacher override
  on an answer, then recompute the owning assessment's comprehension score and
  diagnosis (Requirements 5.5, 5.7).
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends
from psycopg import Connection
from psycopg.rows import DictRow
from pydantic import BaseModel

from app.database.connection import get_db
from app.features.reviews import service
from app.features.reviews.schemas import OverrideRequest
from app.middleware.dependencies import CurrentUser, require_teacher

router = APIRouter(tags=["reviews"])


class OverrideResultOut(BaseModel):
    """Response body for ``PATCH /answers/{answer_id}/override``.

    The freshly recomputed summary for the owning assessment after the override
    was applied or cleared (Requirement 5.5).
    """

    assessment_id: int
    comprehension_score: Optional[float] = None
    diagnosis: Optional[str] = None


@router.patch("/answers/{answer_id}/override", response_model=OverrideResultOut)
def override_answer(
    answer_id: int,
    body: OverrideRequest,
    db: Connection[DictRow] = Depends(get_db),
    _current_user: CurrentUser = Depends(require_teacher),
) -> OverrideResultOut:
    """Apply or clear a teacher override and recompute (Reqs 5.5, 5.7)."""
    result = service.override_answer(db, answer_id, body)
    return OverrideResultOut(**result)
