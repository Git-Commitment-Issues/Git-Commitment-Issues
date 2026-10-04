"""Assessments feature service — scheduling and taking rules.

Per the strictly layered architecture (*SoT: router → service → repository*),
this module holds **all** business rules for scheduling a batch and for taking
(start/submit) an assessment, and makes **no** SQL calls of its own: it reads
and writes through :mod:`app.features.assessments.repository`, generates access
codes via :mod:`app.features.assessments.access_code`, resolves "today" via
:mod:`app.datetime_utils`, and enqueues evaluation through the evaluation
feature's service (never its repository). Routers above call these functions
with validated DTOs and the Current_User; they parse requests and map responses
only.

This module implements two tasks that share this one file:

- **Scheduling** (:func:`schedule_batch`): validate 3-5 well-formed questions,
  assign a unique access code, and create exactly one ``scheduled`` assessment
  per active learner with one answer row per question; reject a classroom with
  zero active learners (Requirements 5.1, 5.2, 5.4, 5.6).
- **Taking** (:func:`start_assessment`, :func:`submit_assessment`): gate the
  start transition by date and status, save answers and complete on submit, and
  enqueue a single background evaluation; reject an already-completed submit
  without mutating saved data (Requirements 3.1-3.5, 5.3).

The background evaluation runs after the request connection has been returned to
the pool, so :func:`run_evaluation` borrows its own pooled connection and
commits — see its docstring.

See design.md ("Core Flows — Scheduling", "Taking + evaluation") and
requirements 3.1-3.5, 5.1-5.6.
"""

from __future__ import annotations

from typing import Optional

from fastapi import BackgroundTasks, HTTPException, status
from psycopg import Connection
from psycopg.rows import DictRow

from app.constants import (
    SKILLS,
    STATUS_COMPLETED,
    STATUS_IN_PROGRESS,
    STATUS_SCHEDULED,
)
from app.datetime_utils import manila_today
from app.features.assessments import repository as repo
from app.features.assessments.access_code import generate_access_code
from app.features.assessments.schemas import CreateAssessmentRequest, SubmitRequest

# Scheduling requires between 3 and 5 questions inclusive (Requirement 5.1).
# Pydantic (CreateAssessmentRequest) already enforces this; the service
# re-validates defensively so no rows are persisted on a non-conforming form
# even if a caller bypasses the DTO bounds.
_MIN_QUESTIONS = 3
_MAX_QUESTIONS = 5


# ---------------------------------------------------------------------------
# Scheduling (Task 10.3)
# ---------------------------------------------------------------------------


def schedule_batch(
    db: Connection[DictRow],
    request: CreateAssessmentRequest,
    teacher,
) -> dict:
    """Create one ``scheduled`` assessment per active learner for a batch.

    Validates the question set, assigns a unique Access_Code, and inserts
    exactly one assessment per active learner in ``request.classroom_id`` with
    exactly one answer row per question (Requirement 5.4). All validation runs
    **before** any insert, so a non-conforming request persists no rows
    (Requirement 5.1).

    Args:
        db: Pooled connection (``dict_row``); the request transaction commits on
            success and rolls back if this raises.
        request: The validated create-assessment payload (3-5 questions).
        teacher: The Current_User scheduling the batch (teacher-gated by the
            router). Accepted for symmetry and future auditing; the batch is
            scoped by ``request.classroom_id``.

    Returns:
        A summary dict with ``access_code``, ``scheduled_for``, ``learner_count``
        (number of assessments created), and ``question_count``.

    Raises:
        HTTPException: ``422`` naming the first field that fails validation
            (Requirement 5.1); ``400`` when the classroom has zero active
            learners (Requirement 5.6). In both cases no rows are persisted.
    """
    # --- Validate the question set BEFORE any insert (Req 5.1). ---------------
    # Pydantic already enforces 3-5 questions and non-empty text/expected_ideas,
    # but we re-validate defensively so the "no rows persisted on failure"
    # guarantee holds regardless of how the request reached the service.
    questions = request.questions
    if not (_MIN_QUESTIONS <= len(questions) <= _MAX_QUESTIONS):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"Field 'questions' must contain between {_MIN_QUESTIONS} and "
                f"{_MAX_QUESTIONS} questions."
            ),
        )

    for index, question in enumerate(questions):
        if question.question_text is None or question.question_text.strip() == "":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    f"Field 'questions[{index}].question_text' must not be empty."
                ),
            )
        if question.skill not in SKILLS:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    f"Field 'questions[{index}].skill' must be one of "
                    f"{', '.join(SKILLS)}."
                ),
            )
        if question.expected_ideas is None or question.expected_ideas.strip() == "":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    f"Field 'questions[{index}].expected_ideas' must not be empty."
                ),
            )

    # --- Reject a classroom with zero active learners (Req 5.6), no rows. -----
    learners = repo.list_active_learners(db, request.classroom_id)
    if not learners:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="There are no active learners to schedule in this classroom.",
        )

    # --- Assign a unique Access_Code across all existing assessments (Req 5.2). -
    access_code = generate_access_code(repo.list_all_access_codes(db))

    # --- Create exactly one scheduled assessment per learner, one answer per
    #     question (Req 5.4). Validation above guarantees we never partially
    #     insert for a non-conforming request. ---------------------------------
    for learner in learners:
        assessment = repo.insert_assessment(
            db,
            learner_id=learner["id"],
            classroom_id=request.classroom_id,
            access_code=access_code,
            title=request.title,
            category=request.category,
            passage_text=request.passage_text,
            scheduled_for=request.scheduled_for,
            status=STATUS_SCHEDULED,
        )
        for question in questions:
            repo.insert_answer(
                db,
                assessment_id=assessment["id"],
                question_text=question.question_text,
                skill=question.skill,
                expected_ideas=question.expected_ideas,
            )

    return {
        "access_code": access_code,
        "scheduled_for": request.scheduled_for,
        "learner_count": len(learners),
        "question_count": len(questions),
    }


# ---------------------------------------------------------------------------
# Teacher batch listing (Task 10.5)
# ---------------------------------------------------------------------------


def list_classroom_assessments(
    db: Connection[DictRow],
    classroom_id: int,
) -> list[DictRow]:
    """Return a classroom's assessment rows, newest batch first.

    A thin service passthrough so the router never reaches into the repository
    directly (keeping the ``router -> service -> repository`` layering intact).
    The teacher batch-listing router maps each returned row onto
    :class:`AssessmentSummaryOut`; the rows carry ``access_code``, ``title``,
    ``scheduled_for``, ``status``, ``comprehension_score``, and ``diagnosis``.
    """
    return repo.list_assessments_by_classroom(db, classroom_id)


# ---------------------------------------------------------------------------
# Taking — start (Task 10.4)
# ---------------------------------------------------------------------------


def start_assessment(
    db: Connection[DictRow],
    assessment_id: int,
    learner,
) -> DictRow:
    """Move a learner's own ``scheduled`` assessment to ``in_progress``.

    Starting is permitted only when the assessment belongs to the requesting
    learner, its ``status`` is ``scheduled``, and its ``scheduled_for`` date is
    on or before the Manila_Date (Requirement 3.1). Any other case leaves the
    status unchanged (Requirement 3.2).

    Args:
        db: Pooled connection (``dict_row``).
        assessment_id: The assessment to start.
        learner: The Current_User (a learner); ownership is checked against
            ``learner.id``.

    Returns:
        The updated assessment row (status ``in_progress``).

    Raises:
        HTTPException: ``404`` when the assessment does not exist or is not owned
            by the learner; ``400`` when it is already started/completed or is
            future-dated (status left unchanged, Requirement 3.2).
    """
    assessment = _load_owned_assessment(db, assessment_id, learner)

    # Already started or completed -> reject, status unchanged (Req 3.2).
    if assessment["status"] != STATUS_SCHEDULED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This assessment cannot be started; it is not scheduled.",
        )

    # Future-dated -> reject, status unchanged (Req 3.2).
    if assessment["scheduled_for"] > manila_today():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This assessment cannot be started before its scheduled date.",
        )

    # Permitted: scheduled + due today or earlier -> in_progress (Req 3.1).
    repo.set_assessment_status(db, assessment_id, STATUS_IN_PROGRESS)

    updated = repo.get_assessment(db, assessment_id)
    # Defensive: the row existed a moment ago under the same transaction.
    return updated if updated is not None else assessment


# ---------------------------------------------------------------------------
# Taking — submit (Task 10.4)
# ---------------------------------------------------------------------------


def submit_assessment(
    db: Connection[DictRow],
    assessment_id: int,
    submit: SubmitRequest,
    learner,
    background_tasks: BackgroundTasks,
) -> None:
    """Save answers, complete the assessment, and enqueue one evaluation.

    For an assessment the learner owns whose ``status`` is ``scheduled`` or
    ``in_progress``, saves the submitted text for each answer that belongs to
    this assessment, sets ``status = 'completed'`` and ``completed_at`` to the
    current time (Requirement 3.3), and enqueues a **single** background
    evaluation task for the assessment (Requirement 3.5). The router returns
    ``202`` so the learner view can poll for results (Requirement 3.6).

    An already-``completed`` assessment is rejected with ``400`` and neither its
    saved answers nor ``completed_at`` are mutated (Requirements 3.4, 5.3).

    Args:
        db: Pooled connection (``dict_row``) for the request transaction.
        assessment_id: The assessment being submitted.
        submit: The submitted answers.
        learner: The Current_User (a learner); ownership is enforced.
        background_tasks: FastAPI background-task queue, provided by the router,
            onto which the single evaluation task is enqueued.

    Raises:
        HTTPException: ``404`` when the assessment does not exist or is not owned
            by the learner; ``400`` when it is already completed (no mutation).
    """
    assessment = _load_owned_assessment(db, assessment_id, learner)

    # Single-attempt enforcement: already completed -> reject without mutating
    # saved answers or completed_at (Requirements 3.4, 5.3).
    if assessment["status"] == STATUS_COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This assessment has already been completed.",
        )

    # status is 'scheduled' or 'in_progress': save answers, then complete.
    # Only update answers that belong to this assessment (ignore stray ids so a
    # submission cannot write to another assessment's rows).
    owned_answer_ids = {row["id"] for row in repo.load_answers(db, assessment_id)}
    for submission in submit.answers:
        if submission.answer_id in owned_answer_ids:
            repo.update_answer_text(db, submission.answer_id, submission.answer_text)

    # Complete the assessment and stamp completed_at = now() (Req 3.3).
    repo.set_assessment_status(
        db, assessment_id, STATUS_COMPLETED, completed_at=True
    )

    # Enqueue exactly one background evaluation task (Req 3.5). The task opens
    # its own pooled connection because the request connection is returned to the
    # pool once the response is sent (see run_evaluation).
    background_tasks.add_task(run_evaluation, assessment_id)


# ---------------------------------------------------------------------------
# Background evaluation helper (Task 10.4)
# ---------------------------------------------------------------------------


def run_evaluation(assessment_id: int) -> None:
    """Run the evaluation pipeline for an assessment on its own connection.

    FastAPI background tasks run **after** the request's response is sent, by
    which point the request's pooled connection has been returned to the pool.
    This helper therefore borrows a fresh connection from the process-wide pool,
    runs the evaluation feature's :func:`evaluate`, and commits — the pool's
    connection context manager does not auto-commit on its own, so the explicit
    commit persists the verdicts, score, and diagnosis the pipeline writes. On
    error the connection is rolled back and the exception re-raised so it is
    logged by the background-task runner.

    Imported locally to avoid a module-level import cycle and to keep the
    evaluation dependency where it is used (features call each other through
    services).
    """
    from app.database.connection import get_pool
    from app.features.evaluation.service import evaluate

    pool = get_pool()
    with pool.connection() as conn:
        try:
            evaluate(conn, assessment_id)
        except Exception:
            conn.rollback()
            raise
        else:
            conn.commit()


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _load_owned_assessment(
    db: Connection[DictRow], assessment_id: int, learner
) -> DictRow:
    """Load an assessment and assert the requesting learner owns it.

    Returns the row when it exists and ``learner_id`` matches ``learner.id``.
    Raises ``404`` otherwise — a not-found assessment and one owned by a
    different learner are indistinguishable to the caller, so neither leaks the
    existence of another learner's row (Requirements 3.2, 3.4 ownership gate).
    """
    assessment = repo.get_assessment(db, assessment_id)
    if assessment is None or assessment["learner_id"] != learner.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment not found.",
        )
    return assessment


# ---------------------------------------------------------------------------
# Teacher batch view (share / detail by access code)
# ---------------------------------------------------------------------------


def get_batch_for_teacher(db: Connection[DictRow], access_code: str, teacher) -> dict:
    """Return a batch's shared content for the teacher share/detail view.

    Looks up the batch by ``access_code`` scoped to a classroom the teacher owns
    (so teachers only see their own batches), and returns the representative
    assessment plus its question rows as ``{"assessment": {...}, "answers":[...]}``
    — the same shape the learner-view/detail endpoints return. The questions are
    the batch's shared question set (one representative learner's rows); no
    learner's private answers are exposed here.

    Raises ``404`` when no such batch exists for this teacher.
    """
    row = repo.get_batch_by_code_for_teacher(db, access_code, teacher.id)
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment not found.",
        )
    answers = repo.load_answers(db, row["id"])
    return {"assessment": dict(row), "answers": [dict(a) for a in answers]}