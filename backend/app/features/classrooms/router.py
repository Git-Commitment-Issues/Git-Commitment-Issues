"""Classrooms + roster feature router — HTTP endpoints, parse/map only.

Per the strictly layered architecture (*SoT: router → service → repository*),
this router only parses requests and maps service results to response schemas;
all classroom/roster rules (name validation, LRN format, duplicate skipping,
name defaulting, late-joiner backfill) live in
:mod:`app.features.classrooms.service`. Every endpoint is teacher-only via the
``require_teacher`` dependency, which raises ``403`` for non-teachers
(Requirement 1.8) and returns the :class:`CurrentUser`.

Endpoints:

- ``GET /classrooms`` — list the calling teacher's classrooms
  (Requirement 2.1).
- ``POST /classrooms`` — create a classroom owned by the caller
  (Requirement 2.1); ``201``.
- ``GET /classrooms/{classroom_id}/students`` — the classroom's active roster
  (Requirement 2.3 / 2.8).
- ``POST /classrooms/{classroom_id}/students`` — add one learner
  (Requirement 2.3); ``201``.
- ``POST /classrooms/{classroom_id}/students/bulk`` — bulk-create learners from
  pasted roster text (Requirements 2.3, 2.5, 2.6).
- ``PATCH /students/{student_id}`` — partial learner update (Requirement 2.7).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from psycopg import Connection
from psycopg.rows import DictRow

from app.database.connection import get_db
from app.features.classrooms import service
from app.features.classrooms.schemas import (
    BulkRosterRequest,
    BulkRosterResult,
    ClassroomOut,
    CreateClassroomRequest,
    StudentCreateRequest,
    StudentOut,
    StudentUpdateRequest,
)
from app.middleware.dependencies import CurrentUser, require_teacher

router = APIRouter(tags=["classrooms"])


@router.get("/classrooms", response_model=list[ClassroomOut])
def list_classrooms(
    db: Connection[DictRow] = Depends(get_db),
    current_user: CurrentUser = Depends(require_teacher),
) -> list[ClassroomOut]:
    """List the calling teacher's classrooms (Requirement 2.1)."""
    return service.list_classrooms_by_teacher(db, current_user.id)


@router.post(
    "/classrooms",
    response_model=ClassroomOut,
    status_code=status.HTTP_201_CREATED,
)
def create_classroom(
    body: CreateClassroomRequest,
    db: Connection[DictRow] = Depends(get_db),
    current_user: CurrentUser = Depends(require_teacher),
) -> ClassroomOut:
    """Create a classroom owned by the caller (Requirement 2.1)."""
    return service.create_classroom(db, body.name, current_user.id)


@router.get(
    "/classrooms/{classroom_id}/students",
    response_model=list[StudentOut],
)
def list_students(
    classroom_id: int,
    db: Connection[DictRow] = Depends(get_db),
    _current_user: CurrentUser = Depends(require_teacher),
) -> list[StudentOut]:
    """Return the classroom's active roster (Requirements 2.3, 2.8)."""
    return service.list_active_students(db, classroom_id)


@router.post(
    "/classrooms/{classroom_id}/students",
    response_model=StudentOut,
    status_code=status.HTTP_201_CREATED,
)
def add_student(
    classroom_id: int,
    body: StudentCreateRequest,
    db: Connection[DictRow] = Depends(get_db),
    _current_user: CurrentUser = Depends(require_teacher),
) -> StudentOut:
    """Add one learner to a classroom (Requirement 2.3)."""
    return service.add_student(db, classroom_id, body)


@router.post(
    "/classrooms/{classroom_id}/students/bulk",
    response_model=BulkRosterResult,
)
def bulk_add_students(
    classroom_id: int,
    body: BulkRosterRequest,
    db: Connection[DictRow] = Depends(get_db),
    _current_user: CurrentUser = Depends(require_teacher),
) -> BulkRosterResult:
    """Bulk-create learners from pasted roster text (Reqs 2.3, 2.5, 2.6)."""
    return service.parse_and_bulk_create(db, classroom_id, body.raw_text)


@router.patch("/students/{student_id}", response_model=StudentOut)
def update_student(
    student_id: int,
    body: StudentUpdateRequest,
    db: Connection[DictRow] = Depends(get_db),
    _current_user: CurrentUser = Depends(require_teacher),
) -> StudentOut:
    """Apply a partial learner update (Requirement 2.7)."""
    return service.update_student(db, student_id, body)
