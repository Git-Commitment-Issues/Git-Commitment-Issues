"""Classrooms + roster feature DTOs (Pydantic schemas only, no logic).

Request/response shapes for classroom creation, bulk roster paste, and student
edits. The service layer holds the parsing/validation rules (name length, LRN
format, duplicate skipping, late-joiner backfill); these schemas just define the
wire contract.

See design.md (*SoT: Classrooms and Roster*) and requirements 2.1, 2.3, 2.5,
2.6, and 2.7.
"""

from typing import Optional

from pydantic import BaseModel, Field


class CreateClassroomRequest(BaseModel):
    """Payload to create a classroom (req 2.1: name is 1-100 characters)."""

    name: str = Field(min_length=1, max_length=100)


class ClassroomOut(BaseModel):
    """A classroom returned to the teacher."""

    id: int
    name: str
    teacher_id: int


class StudentCreateRequest(BaseModel):
    """Payload to add a single learner to a classroom.

    `name` is optional; when omitted the service defaults it to
    `Learner <last 4 of LRN>` (req 2.4).
    """

    learner_reference_number: str
    name: Optional[str] = None


class StudentOut(BaseModel):
    """A learner (roster member) returned to the teacher."""

    id: int
    name: str
    learner_reference_number: str
    classroom_id: int
    is_active: bool


class BulkRosterRequest(BaseModel):
    """Pasted roster text; each line is either `LRN` or `LRN, Name` (req 2.3)."""

    raw_text: str


class BulkRosterResult(BaseModel):
    """Outcome of a bulk roster submission.

    - `created`: learners newly created from valid new entries.
    - `skipped`: LRNs skipped because they already exist (req 2.5).
    - `invalid`: raw lines skipped as malformed or non-12-digit LRN (req 2.6).
    """

    created: list[StudentOut] = Field(default_factory=list)
    skipped: list[str] = Field(default_factory=list)
    invalid: list[str] = Field(default_factory=list)


class StudentUpdateRequest(BaseModel):
    """Partial update of a learner; every field is optional (req 2.7).

    Only the provided fields are changed; the service sets `updated_at` on any
    change and treats deactivation (`is_active = false`) as retain-not-delete.
    """

    name: Optional[str] = None
    learner_reference_number: Optional[str] = None
    classroom_id: Optional[int] = None
    is_active: Optional[bool] = None
