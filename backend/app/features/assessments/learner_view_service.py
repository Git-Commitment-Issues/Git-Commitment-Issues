"""Learner-view service — rules for a learner reading their own assessments.

Per the strictly layered architecture (*SoT: router → service → repository*),
this module holds **all** business rules for the learner-facing reads and makes
**no** SQL calls of its own: it reads and writes through
:mod:`app.features.assessments.learner_view_repository`, resolves each
Final_Verdict via the pure :func:`app.features.evaluation.scoring.final_verdict`,
resolves "today" via :mod:`app.datetime_utils`, and maps rows onto the
``assessments`` DTOs. It lives in the ``assessments`` package as a separate
module from ``service.py`` (which owns scheduling and taking) so the
learner-view rules can evolve without colliding with that file.

Ownership is the first rule everywhere: every read is scoped to the requesting
learner's ``id`` and a missing/not-owned row is reported as ``404`` so the
existence of another learner's row never leaks (Requirements 4.1, 4.2).

Evaluation-state rules for the detail view (Requirements 4.3-4.5):

- ``evaluation_error`` is set            -> **failed**: return the DTO with the
  error present; verdict fields may be null.
- else ``diagnosis`` is ``None``         -> **in-progress**: do not expose any
  verdicts — null out each answer's Final_Verdict and evidence, and leave the
  score/diagnosis/evaluation/recommendation null.
- else (``diagnosis`` set, no error)     -> **completed**: present each answer's
  Final_Verdict and evidence plus the comprehension score, diagnosis,
  evaluation, and recommendation.

See design.md ("Core Flows — Learner view") and requirements 4.1-4.7.
"""

from __future__ import annotations

from typing import Optional

from fastapi import HTTPException, status
from psycopg import Connection
from psycopg.rows import DictRow

from app.constants import STATUS_COMPLETED
from app.datetime_utils import manila_today
from app.features.assessments import learner_view_repository as repo
from app.features.assessments.schemas import (
    AnswerOut,
    AssessmentDetailOut,
    AssessmentSummaryOut,
)
from app.features.evaluation import scoring


# ---------------------------------------------------------------------------
# Detail view (Tasks 11.2 — Requirements 4.1-4.5, 4.7)
# ---------------------------------------------------------------------------


def get_assessment(
    db: Connection[DictRow],
    assessment_id: int,
    learner,
) -> AssessmentDetailOut:
    """Return the learner's own assessment detail, or raise ``404``.

    Loads the assessment scoped to the requesting learner's ``id``; a
    missing/not-owned row raises ``404`` so another learner's row never leaks
    (Requirements 4.1, 4.2).

    The evaluation state drives what the DTO exposes (Requirements 4.3-4.5):

    - **failed** (``evaluation_error`` set): the DTO carries ``evaluation_error``
      and the score/diagnosis/evaluation/recommendation stay null; per-answer
      verdicts are not exposed.
    - **in-progress** (``diagnosis`` null, no error): verdicts are hidden — each
      answer's ``final_verdict`` and ``evidence`` are nulled and the assessment's
      score/diagnosis/evaluation/recommendation stay null.
    - **completed** (``diagnosis`` set, no error): each answer's Final_Verdict
      (``COALESCE(teacher_override, ai_verdict)``) and ``evidence`` are presented
      along with the score, diagnosis, evaluation, and recommendation.

    ``has_correction_alert`` is always resolved from the repository
    (Requirement 4.7) regardless of state so a learner sees a pending correction
    even while the DTO otherwise reflects an earlier state.

    Args:
        db: Pooled connection (``dict_row``).
        assessment_id: The assessment to view.
        learner: The Current_User (a learner); ownership is checked against
            ``learner.id``.

    Returns:
        The populated :class:`AssessmentDetailOut` for the requested state.

    Raises:
        HTTPException: ``404`` when the assessment does not exist or is not owned
            by the requesting learner.
    """
    assessment = repo.get_own_assessment_by_id(db, assessment_id, learner.id)
    if assessment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment not found.",
        )

    return _build_detail(db, assessment)


def get_assessment_by_code(
    db: Connection[DictRow],
    access_code: str,
    learner,
) -> AssessmentDetailOut:
    """Return the learner's own assessment for an Access_Code, or raise ``404``.

    An Access_Code identifies a batch (one row per learner); the lookup is scoped
    to the requesting learner's ``id`` so a code owned by a different learner
    resolves to no row and raises ``404`` (Requirements 4.1, 4.2). The returned
    DTO follows the same evaluation-state rules as :func:`get_assessment`.
    """
    assessment = repo.get_own_assessment_by_code(db, access_code, learner.id)
    if assessment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment not found.",
        )

    return _build_detail(db, assessment)


def _build_detail(
    db: Connection[DictRow],
    assessment: DictRow,
) -> AssessmentDetailOut:
    """Map an owned assessment row (+ its answers) onto :class:`AssessmentDetailOut`.

    Applies the evaluation-state rules (Requirements 4.3-4.5) and resolves the
    correction alert (Requirement 4.7). Assumes ownership has already been
    verified by the caller.
    """
    # Evaluation state (Requirements 4.3-4.5). A non-null evaluation_error means
    # failed and wins over everything; otherwise a null diagnosis means the
    # pipeline has not finished (in-progress); otherwise it is completed.
    is_failed = assessment["evaluation_error"] is not None
    is_in_progress = (not is_failed) and assessment["diagnosis"] is None
    is_completed = (not is_failed) and (not is_in_progress)

    # Load answers and resolve each Final_Verdict in code (never the AI).
    answer_rows = repo.load_answers(db, assessment["id"])
    answers: list[AnswerOut] = []
    for row in answer_rows:
        if is_completed:
            # Present Final_Verdict and evidence (Requirement 4.3).
            final = scoring.final_verdict(
                row["ai_verdict"], row["teacher_override"]
            )
            evidence = row["evidence"]
        else:
            # Failed or in-progress: do not expose verdicts/evidence
            # (Requirements 4.4, 4.5).
            final = None
            evidence = None

        answers.append(
            AnswerOut(
                id=row["id"],
                question_text=row["question_text"],
                skill=row["skill"],
                answer_text=row["answer_text"],
                final_verdict=final,
                evidence=evidence,
                # The override note is a teacher correction the learner should
                # see once results are presented; hide it until completed so an
                # in-progress/failed view never leaks verdict-adjacent text.
                override_note=row["override_note"] if is_completed else None,
            )
        )

    # Only surface the computed/AI result fields in the completed state
    # (Requirement 4.3). In-progress and failed states keep them null so the
    # frontend shows the pipeline as unfinished (Requirement 4.4) or failed
    # (Requirement 4.5, where evaluation_error is what signals the failure).
    comprehension_score = assessment["comprehension_score"] if is_completed else None
    diagnosis = assessment["diagnosis"] if is_completed else None
    evaluation = assessment["evaluation"] if is_completed else None
    recommendation = assessment["recommendation"] if is_completed else None

    return AssessmentDetailOut(
        id=assessment["id"],
        title=assessment["title"],
        category=assessment["category"],
        passage_text=assessment["passage_text"],
        status=assessment["status"],
        comprehension_score=comprehension_score,
        diagnosis=diagnosis,
        evaluation=evaluation,
        recommendation=recommendation,
        # Present in the failed state (Requirement 4.5); null otherwise.
        evaluation_error=assessment["evaluation_error"],
        has_correction_alert=repo.has_correction_alert(db, assessment["id"]),
        scheduled_for=assessment["scheduled_for"],
        answers=answers,
    )


# ---------------------------------------------------------------------------
# Acknowledge corrections (Task 11.2 — Requirement 4.6)
# ---------------------------------------------------------------------------


def acknowledge_corrections(
    db: Connection[DictRow],
    assessment_id: int,
    learner,
) -> dict:
    """Stamp ``corrections_seen_at`` for the learner's own assessment.

    Verifies the assessment belongs to the requesting learner (``404`` otherwise,
    so another learner's row cannot be acknowledged, Requirements 4.1/4.2) and
    then sets ``corrections_seen_at`` to the database clock via the repository
    (Requirement 4.6). After this, previously-seen overrides stop raising a
    correction alert (see
    :func:`learner_view_repository.has_correction_alert`).

    Returns:
        A small success payload: ``{"status": "ok"}``.

    Raises:
        HTTPException: ``404`` when the assessment does not exist or is not owned
            by the requesting learner.
    """
    assessment = repo.get_own_assessment_by_id(db, assessment_id, learner.id)
    if assessment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment not found.",
        )

    repo.set_corrections_seen(db, assessment_id)
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# My assessments list (Task 11.2 — Requirements 4.6, 4.7)
# ---------------------------------------------------------------------------


def list_my_assessments(
    db: Connection[DictRow],
    learner,
) -> dict:
    """Return the learner's assessments split into upcoming/previous, plus alerts.

    Lists only the requesting learner's own rows (Requirement 4.1) and splits
    them for the ``/me/assessments`` view:

    - **upcoming**: not yet completed (``status != 'completed'``) or scheduled for
      a future Manila_Date — i.e. assessments the learner has still to take or
      finish.
    - **previous**: completed assessments, carrying their score and diagnosis.

    For every completed assessment the per-item ``has_correction_alert`` flag is
    resolved from the repository (Requirement 4.7); upcoming/not-yet-completed
    rows cannot have an override yet, so their flag is ``False`` without a query.
    An overall ``alert`` boolean is the OR of the per-item flags so the view can
    badge the whole list (Requirements 4.6, 4.7).

    Returns:
        ``{"upcoming": [...], "previous": [...], "alert": bool}`` where each list
        entry is ``{"assessment": AssessmentSummaryOut, "has_correction_alert":
        bool}``.
    """
    today = manila_today()
    rows = repo.list_assessments_for_learner(db, learner.id)

    upcoming: list[dict] = []
    previous: list[dict] = []
    overall_alert = False

    for row in rows:
        summary = AssessmentSummaryOut(
            id=row["id"],
            title=row["title"],
            access_code=row["access_code"],
            scheduled_for=row["scheduled_for"],
            status=row["status"],
            comprehension_score=row["comprehension_score"],
            diagnosis=row["diagnosis"],
        )

        is_completed = row["status"] == STATUS_COMPLETED
        # A correction (teacher override) can only exist on a completed,
        # evaluated assessment, so only completed rows need the alert query.
        item_alert = (
            repo.has_correction_alert(db, row["id"]) if is_completed else False
        )
        if item_alert:
            overall_alert = True

        entry = {"assessment": summary, "has_correction_alert": item_alert}

        # Previous: completed assessments (their results are the history the
        # learner reviews). Upcoming: everything else — not yet completed, which
        # includes future-dated scheduled rows the learner cannot start yet.
        if is_completed:
            previous.append(entry)
        else:
            upcoming.append(entry)

    return {"upcoming": upcoming, "previous": previous, "alert": overall_alert}
