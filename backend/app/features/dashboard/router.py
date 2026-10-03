"""Dashboard feature router — HTTP endpoints, parse/map only.

Per the strictly layered architecture (*SoT: router → service → repository*),
this router only parses requests and maps service results to the wire; all
dashboard rules (batch resolution, inactive-learner exclusion, read-only
aggregation) live in :mod:`app.features.dashboard.service` and the repository
SQL beneath it. Every endpoint is teacher-only via the ``require_teacher``
dependency, which raises ``403`` for non-teachers, and every endpoint is
read-only (Requirement 7.6) — the underlying service/repository calls are all
``SELECT``s.

Batch-scoped endpoints accept an optional ``access_code`` query parameter. When
omitted, the service resolves the most recent batch with a completed assessment
(Requirement 7.4); when provided, it must name a batch that exists and has a
completed assessment (Requirement 7.5). Inactive learners are excluded from the
aggregates (Requirement 7.1).

Endpoints:

- ``GET /classrooms/{classroom_id}/needs-help`` — "needs help" roster for the
  resolved batch (Requirements 7.1, 7.6).
- ``GET /classrooms/{classroom_id}/skills`` — per-skill percent-correct
  breakdown for the resolved batch.
- ``GET /classrooms/{classroom_id}/questions`` — most-missed questions for the
  resolved batch.
- ``GET /classrooms/{classroom_id}/override-rate`` — teacher-override rate for
  the resolved batch.
- ``GET /classrooms/{classroom_id}/batches`` — the classroom's distinct batches,
  newest first. (The task phrases this dashboard aggregate as "/assessments",
  but the scheduling router already owns
  ``GET /classrooms/{classroom_id}/assessments`` as the per-learner assessment
  list; this endpoint is named ``/batches`` to avoid a route collision.)
- ``GET /students/{student_id}/progress`` — one learner's completed assessments
  over time, oldest first.

The service returns plain ``dict``/``list`` payloads, which this router returns
directly for FastAPI to serialize.
"""

from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Depends
from psycopg import Connection
from psycopg.rows import DictRow

from app.database.connection import get_db
from app.features.dashboard import service
from app.middleware.dependencies import CurrentUser, require_teacher

router = APIRouter(tags=["dashboard"])


@router.get("/classrooms/{classroom_id}/needs-help")
def get_needs_help(
    classroom_id: int,
    access_code: Optional[str] = None,
    db: Connection[DictRow] = Depends(get_db),
    _current_user: CurrentUser = Depends(require_teacher),
) -> dict[str, Any]:
    """Return the "needs help" roster for the resolved batch (Reqs 7.1, 7.6)."""
    return service.get_needs_help(db, classroom_id, access_code)


@router.get("/classrooms/{classroom_id}/skills")
def get_skills(
    classroom_id: int,
    access_code: Optional[str] = None,
    db: Connection[DictRow] = Depends(get_db),
    _current_user: CurrentUser = Depends(require_teacher),
) -> dict[str, Any]:
    """Return the per-skill percent-correct breakdown for the resolved batch."""
    return service.get_skills(db, classroom_id, access_code)


@router.get("/classrooms/{classroom_id}/questions")
def get_questions(
    classroom_id: int,
    access_code: Optional[str] = None,
    db: Connection[DictRow] = Depends(get_db),
    _current_user: CurrentUser = Depends(require_teacher),
) -> dict[str, Any]:
    """Return the most-missed questions for the resolved batch."""
    return service.get_questions(db, classroom_id, access_code)


@router.get("/classrooms/{classroom_id}/override-rate")
def get_override_rate(
    classroom_id: int,
    access_code: Optional[str] = None,
    db: Connection[DictRow] = Depends(get_db),
    _current_user: CurrentUser = Depends(require_teacher),
) -> dict[str, Any]:
    """Return the teacher-override rate for the resolved batch."""
    return service.get_override_rate(db, classroom_id, access_code)


@router.get("/classrooms/{classroom_id}/batches")
def list_batches(
    classroom_id: int,
    db: Connection[DictRow] = Depends(get_db),
    _current_user: CurrentUser = Depends(require_teacher),
) -> list[DictRow]:
    """Return the classroom's distinct batches, newest first (Req 7.1)."""
    return service.list_batches(db, classroom_id)


@router.get("/students/{student_id}/progress")
def get_student_progress(
    student_id: int,
    db: Connection[DictRow] = Depends(get_db),
    _current_user: CurrentUser = Depends(require_teacher),
) -> list[DictRow]:
    """Return one learner's completed assessments over time, oldest first."""
    return service.get_student_progress(db, student_id)
