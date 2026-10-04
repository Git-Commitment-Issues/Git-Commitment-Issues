"""Assessments feature DTOs (Pydantic schemas only, no logic).

Request/response shapes for scheduling an assessment, taking it (answer
submission), and viewing results. The service layer owns all business rules
(question count enforcement beyond the schema bounds, access-code generation,
scoring, diagnosis, correction alerts); these schemas just define the wire
contract.

See design.md (*SoT: Assessments*) and requirements 5.1 and 3.3.
"""

from datetime import date
from typing import Optional

from pydantic import BaseModel, Field

from app.constants import Diagnosis, Skill, Status, Verdict


# --- scheduling ---
class QuestionIn(BaseModel):
    """A single question in a create-assessment payload (req 5.1)."""

    question_text: str = Field(min_length=1)
    skill: Skill
    expected_ideas: str = Field(min_length=1)  # comma-separated


class CreateAssessmentRequest(BaseModel):
    """Payload to schedule an assessment with 3-5 questions (req 5.1)."""

    classroom_id: int
    title: str = Field(min_length=1)
    category: str = Field(min_length=1)
    passage_text: str = Field(min_length=1)
    scheduled_for: date
    questions: list[QuestionIn] = Field(min_length=3, max_length=5)


class SchedulingSummaryOut(BaseModel):
    """Result of scheduling a batch (req 5.1, 5.2).

    Maps the scheduling service's summary dict onto the wire contract: the one
    generated `access_code` for the batch, the `scheduled_for` date, the number
    of learners the batch was created for, and the per-assessment question count.
    """

    access_code: str
    scheduled_for: date
    learner_count: int
    question_count: int


# --- taking ---
class AnswerSubmission(BaseModel):
    """One answer in a submission; `answer_text` may be blank (req 3.3)."""

    answer_id: int
    answer_text: Optional[str] = None


class SubmitRequest(BaseModel):
    """Full set of answers submitted for an assessment (req 3.3)."""

    answers: list[AnswerSubmission]


# --- viewing ---
class AnswerOut(BaseModel):
    """An answer returned for review/viewing.

    `final_verdict` is COALESCE(teacher_override, ai_verdict), resolved by the
    service layer.
    """

    id: int
    question_text: str
    skill: Skill
    answer_text: Optional[str]
    final_verdict: Optional[Verdict]
    evidence: Optional[str]
    override_note: Optional[str]


class AssessmentDetailOut(BaseModel):
    """Full assessment detail including resolved answers."""

    id: int
    title: str
    category: str
    passage_text: str
    status: Status
    comprehension_score: Optional[float]
    diagnosis: Optional[Diagnosis]
    evaluation: Optional[str]  # AI summary
    recommendation: Optional[str]  # AI next step
    evaluation_error: Optional[str]
    has_correction_alert: bool
    answers: list[AnswerOut]
    # Date the assessment opens (Manila). Lets the client show "not open yet".
    scheduled_for: Optional[date] = None


class AssessmentSummaryOut(BaseModel):
    """Lightweight assessment row for list endpoints (no answers/passage)."""

    id: int
    title: str
    access_code: str
    scheduled_for: date
    status: Status
    comprehension_score: Optional[float]
    diagnosis: Optional[Diagnosis]
