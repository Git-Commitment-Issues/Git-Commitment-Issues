"""Evaluation feature router — HTTP endpoint for the teacher evaluation retry.

Per the strictly layered architecture (*SoT: router → service → repository*),
this router only parses the request and maps results to a response; all
evaluation rules live in :mod:`app.features.evaluation.service` and all SQL in
:mod:`app.features.evaluation.repository`.

It exposes a single teacher-only endpoint:

- ``POST /assessments/{assessment_id}/evaluate`` — clear any prior
  ``evaluation_error`` and re-run the evaluation pipeline synchronously, then
  return the updated assessment's evaluation state. See Requirement 6.5.

The retry runs synchronously (unlike the submit path, which enqueues a
background task) so the teacher gets the refreshed result in the response.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from psycopg import Connection
from psycopg.rows import DictRow
from pydantic import BaseModel

from app.database.connection import get_db
from app.features.evaluation import repository, service
from app.middleware.dependencies import CurrentUser, require_teacher

router = APIRouter(tags=["evaluation"])


class EvaluationResultOut(BaseModel):
    """The assessment's evaluation state after a synchronous retry.

    Mirrors the fields the evaluation pipeline writes so the teacher sees the
    refreshed outcome without a second request: a cleared ``evaluation_error``
    on success, or a populated one when the AI still could not be checked.
    """

    id: int
    status: str
    comprehension_score: Optional[float] = None
    diagnosis: Optional[str] = None
    evaluation: Optional[str] = None
    recommendation: Optional[str] = None
    evaluated_by: Optional[str] = None
    evaluation_error: Optional[str] = None


@router.post(
    "/assessments/{assessment_id}/evaluate",
    response_model=EvaluationResultOut,
)
def retry_evaluation(
    assessment_id: int,
    db: Connection[DictRow] = Depends(get_db),
    _current_user: CurrentUser = Depends(require_teacher),
) -> EvaluationResultOut:
    """Clear ``evaluation_error`` and re-run evaluation synchronously (Req 6.5).

    Teacher-only (``require_teacher`` raises ``403`` for non-teachers). Raises
    ``404`` when the assessment does not exist. Otherwise clears any prior
    evaluation error, re-runs the full evaluation pipeline in-request, and
    returns the assessment's refreshed evaluation state.
    """
    assessment = repository.load_assessment(db, assessment_id)
    if assessment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment not found.",
        )

    repository.clear_evaluation_error(db, assessment_id)
    service.evaluate(db, assessment_id)

    updated = repository.load_assessment(db, assessment_id)
    if updated is None:
        # Defensive: the assessment existed a moment ago; if it vanished mid-run
        # there is nothing to report.
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment not found.",
        )

    return EvaluationResultOut(
        id=updated["id"],
        status=updated["status"],
        comprehension_score=updated["comprehension_score"],
        diagnosis=updated["diagnosis"],
        evaluation=updated["evaluation"],
        recommendation=updated["recommendation"],
        evaluated_by=updated["evaluated_by"],
        evaluation_error=updated["evaluation_error"],
    )
