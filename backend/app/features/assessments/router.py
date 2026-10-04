"""Assessments feature router ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â scheduling, taking, and learner-view endpoints.

Per the strictly layered architecture (*SoT: router -> service -> repository*),
this router only parses requests and maps service results onto response
schemas; **all** business rules live in the services it calls. It fronts two
tasks that share this single module and one ``router`` object:

- **Scheduling + taking** (Task 10.5, Requirements 5.1, 3.1, 3.3, 3.6) via
  :mod:`app.features.assessments.service`.
- **Learner views** (Task 11.3, Requirements 4.1, 4.6, 4.7) via
  :mod:`app.features.assessments.learner_view_service`.

Endpoints:

- ``POST /assessments`` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â teacher-only; schedule a batch (``201``).
- ``GET /classrooms/{classroom_id}/assessments`` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â teacher-only; list a
  classroom's batches.
- ``GET /assessments/code/{code}`` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â a learner reads their own assessment by
  Access_Code.
- ``POST /assessments/{assessment_id}/start`` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â a learner starts their own
  assessment.
- ``POST /assessments/{assessment_id}/submit`` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â a learner submits answers;
  ``202`` with a single background evaluation enqueued (Requirement 3.6).
- ``GET /assessments/{assessment_id}`` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â a learner reads their own assessment
  by id.
- ``GET /me/assessments`` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â a learner's own list (upcoming/previous + alert).
- ``POST /assessments/{assessment_id}/seen`` ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â a learner acknowledges
  corrections.

**Routing order matters**: ``GET /assessments/code/{code}`` is declared before
``GET /assessments/{assessment_id}`` so the literal ``code`` segment is matched
first and never captured as an ``assessment_id``. ``/me/assessments`` is a
distinct literal path and is unaffected.
"""

from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, status
from psycopg import Connection
from psycopg.rows import DictRow

from app.database.connection import get_db
from pydantic import BaseModel

from app.features.assessments import (
    extraction_service,
    learner_view_service,
    service,
)
from app.features.assessments.extraction_schemas import ExtractedAssessment
from app.features.assessments.schemas import (
    AssessmentDetailOut,
    AssessmentSummaryOut,
    CreateAssessmentRequest,
    SchedulingSummaryOut,
    SubmitRequest,
)
from app.middleware.dependencies import CurrentUser, get_current_user, require_teacher

router = APIRouter(tags=["assessments"])


# ---------------------------------------------------------------------------
# Scheduling + teacher batch listing (Task 10.5 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Requirements 5.1)
# ---------------------------------------------------------------------------


@router.post(
    "/assessments",
    response_model=SchedulingSummaryOut,
    status_code=status.HTTP_201_CREATED,
)
def create_assessment(
    body: CreateAssessmentRequest,
    db: Connection[DictRow] = Depends(get_db),
    current_user: CurrentUser = Depends(require_teacher),
) -> SchedulingSummaryOut:
    """Schedule a batch for a classroom's active learners (Requirement 5.1).

    Teacher-only via ``require_teacher``. The service validates the question set,
    assigns a unique Access_Code, and creates one ``scheduled`` assessment per
    active learner; this maps its summary dict onto :class:`SchedulingSummaryOut`.
    """
    summary = service.schedule_batch(db, body, current_user)
    return SchedulingSummaryOut(**summary)


class ExtractRequest(BaseModel):
    """Raw scanned/pasted text to turn into an assessment draft."""

    raw_text: str


@router.post("/assessments/extract", response_model=ExtractedAssessment)
def extract_assessment(
    body: ExtractRequest,
    _current_user: CurrentUser = Depends(require_teacher),
) -> ExtractedAssessment:
    """Draft an assessment from raw scanned/pasted text (teacher-only).

    Sends the text to the AI client, which returns a structured draft
    (title, category, passage, and 3-5 skill-tagged questions). Does NOT
    write to the database â€” the teacher reviews/edits the draft and submits
    it through the normal create flow. Raises ``422`` when the text is too
    short or the AI could not produce a valid draft after one retry.
    """
    draft = extraction_service.extract_assessment(body.raw_text)
    return ExtractedAssessment(**draft)


@router.get(
    "/classrooms/{classroom_id}/assessments",
    response_model=list[AssessmentSummaryOut],
)
def list_classroom_assessments(
    classroom_id: int,
    db: Connection[DictRow] = Depends(get_db),
    _current_user: CurrentUser = Depends(require_teacher),
) -> list[AssessmentSummaryOut]:
    """List a classroom's assessment batches, newest first (teacher-only)."""
    rows = service.list_classroom_assessments(db, classroom_id)
    return [
        AssessmentSummaryOut(
            id=row["id"],
            title=row["title"],
            access_code=row["access_code"],
            scheduled_for=row["scheduled_for"],
            status=row["status"],
            comprehension_score=row["comprehension_score"],
            diagnosis=row["diagnosis"],
        )
        for row in rows
    ]


# ---------------------------------------------------------------------------
# Taking ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â by Access_Code (Task 10.5). Declared BEFORE the /{assessment_id}
# routes so the literal "code" segment is never captured as an id.
# ---------------------------------------------------------------------------


@router.get("/assessments/code/{code}", response_model=AssessmentDetailOut)
def get_assessment_by_code(
    code: str,
    db: Connection[DictRow] = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> AssessmentDetailOut:
    """Return the caller's own assessment for an Access_Code (Requirement 4.1).

    The learner-view service scopes the lookup to ``current_user`` and raises
    ``404`` when the code is not the caller's own.
    """
    return learner_view_service.get_assessment_by_code(db, code, current_user)


@router.get("/assessments/batch/{code}", response_model=AssessmentDetailOut)
def get_batch_by_code(
    code: str,
    db: Connection[DictRow] = Depends(get_db),
    current_user: CurrentUser = Depends(require_teacher),
) -> AssessmentDetailOut:
    """Return a batch's shared content by access code (teacher-only).

    Unlike ``/assessments/code/{code}`` (which is learner-scoped to the
    caller's own row), this returns the batch's representative assessment
    for any batch in a classroom the teacher owns, so the teacher share /
    detail screen can show the passage and questions after creating a batch.
    Raises ``404`` when the batch is not in one of the teacher's classrooms.
    """
    detail = service.get_batch_for_teacher(db, code, current_user)
    assessment = detail["assessment"]
    answers = detail["answers"]
    return AssessmentDetailOut(
        id=assessment["id"],
        title=assessment["title"],
        category=assessment["category"],
        passage_text=assessment["passage_text"],
        status=assessment["status"],
        comprehension_score=assessment["comprehension_score"],
        diagnosis=assessment["diagnosis"],
        evaluation=assessment["evaluation"],
        recommendation=assessment["recommendation"],
        evaluation_error=assessment["evaluation_error"],
        has_correction_alert=False,
        answers=[
            {
                "id": a["id"],
                "question_text": a["question_text"],
                "skill": a["skill"],
                "answer_text": a.get("answer_text"),
                "final_verdict": a.get("teacher_override") or a.get("ai_verdict"),
                "evidence": a.get("evidence"),
                "override_note": a.get("override_note"),
            }
            for a in answers
        ],
    )


# ---------------------------------------------------------------------------
# Taking ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â start / submit (Task 10.5 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Requirements 3.1, 3.3, 3.6)
# ---------------------------------------------------------------------------


@router.post("/assessments/{assessment_id}/start")
def start_assessment(
    assessment_id: int,
    db: Connection[DictRow] = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> dict:
    """Start the caller's own ``scheduled`` assessment (Requirement 3.1).

    The service gates the transition by ownership, status, and date, then flips
    the status to ``in_progress`` and returns the updated row; this maps it to a
    small status payload the taking view can act on.
    """
    updated = service.start_assessment(db, assessment_id, current_user)
    return {"id": updated["id"], "status": updated["status"]}


@router.post(
    "/assessments/{assessment_id}/submit",
    status_code=status.HTTP_202_ACCEPTED,
)
def submit_assessment(
    assessment_id: int,
    body: SubmitRequest,
    background_tasks: BackgroundTasks,
    db: Connection[DictRow] = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> dict:
    """Submit the caller's answers and enqueue one evaluation (Requirement 3.3).

    Returns ``202`` so the learner view can poll for results while the single
    background evaluation task runs after the response is sent (Requirement 3.6).
    """
    service.submit_assessment(
        db, assessment_id, body, current_user, background_tasks
    )
    return {"status": "submitted"}


# ---------------------------------------------------------------------------
# Learner views (Task 11.3 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Requirements 4.1, 4.6, 4.7)
# ---------------------------------------------------------------------------


@router.get("/me/assessments")
def list_my_assessments(
    db: Connection[DictRow] = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> dict:
    """Return the caller's own assessments: upcoming/previous plus an alert.

    The learner-view service splits the caller's rows into ``upcoming`` and
    ``previous`` and computes the overall correction ``alert`` (Requirements 4.6,
    4.7). Returned as its structured dict (summaries plus per-item flags).
    """
    return learner_view_service.list_my_assessments(db, current_user)


@router.get("/assessments/{assessment_id}", response_model=AssessmentDetailOut)
def get_assessment(
    assessment_id: int,
    db: Connection[DictRow] = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> AssessmentDetailOut:
    """Return the caller's own assessment by id (Requirement 4.1).

    The learner-view service scopes the read to ``current_user``, applies the
    evaluation-state rules, and raises ``404`` for a missing/not-owned row.
    """
    return learner_view_service.get_assessment(db, assessment_id, current_user)


@router.post("/assessments/{assessment_id}/seen")
def mark_corrections_seen(
    assessment_id: int,
    db: Connection[DictRow] = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> dict:
    """Acknowledge corrections for the caller's own assessment (Requirement 4.6).

    Stamps ``corrections_seen_at`` so previously-seen overrides stop raising a
    correction alert; raises ``404`` for a missing/not-owned row.
    """
    return learner_view_service.acknowledge_corrections(
        db, assessment_id, current_user
    )
