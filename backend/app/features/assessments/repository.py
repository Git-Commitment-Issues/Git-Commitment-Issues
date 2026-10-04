"""Assessments feature repository — all SQL for scheduling, taking, and views.

Per the strictly layered architecture (*SoT: router → service → repository*),
this module holds **only** SQL against the ``assessments`` and ``answers``
tables and returns raw mapping rows (``dict_row``). It makes no decisions:
question-count validation, access-code generation, blank handling, scoring,
diagnosis, single-attempt enforcement, and alert computation all live in the
service layer and the pure helper modules. The repository persists and reads
what the service asks for.

Every query is parameterized (no string interpolation of untrusted input) to
avoid SQL injection. Functions accept a ``psycopg`` connection configured with
the ``dict_row`` factory (see ``app.database.connection.get_db``); the
surrounding request/transaction scope owns commits.

Requirements covered:
- 5.2 — read the existing access codes so the service can assign a unique one.
- 5.4 — insert exactly one ``scheduled`` assessment per active learner and one
  answer row per question (the service drives the per-learner/per-question loop).
- 5.6 — list the active learners used to decide whether a batch can be scheduled.
- 3.1 / 3.3 / 3.4 — read an assessment, flip its status, save an answer's text,
  and stamp ``completed_at`` for the taking flow.
- 4.1 — load a learner's own assessment by access code with its answers.
"""

from __future__ import annotations

from datetime import date
from typing import Optional

from psycopg import Connection
from psycopg.rows import DictRow


def list_all_access_codes(db: Connection[DictRow]) -> set[str]:
    """Return the set of every ``access_code`` already used across assessments.

    The scheduling service passes this set to
    :func:`app.features.assessments.access_code.generate_access_code` to assign a
    code that is unique across all existing assessments (Requirement 5.2). A
    ``DISTINCT`` keeps the result compact; the caller treats it as a membership
    set, so order is irrelevant.
    """
    with db.cursor() as cur:
        cur.execute(
            """
            SELECT DISTINCT access_code
            FROM assessments
            """
        )
        return {row["access_code"] for row in cur.fetchall()}


def list_active_learners(
    db: Connection[DictRow], classroom_id: int
) -> list[DictRow]:
    """Return the active learners in a classroom, ordered by name.

    Filters to ``role = 'learner'`` and ``is_active = true`` for the given
    ``classroom_id``. The scheduling service uses this roster to create one
    assessment per active learner (Requirement 5.4) and to reject scheduling for
    a classroom with zero active learners (Requirement 5.6). Inactive learners
    are retained in the table but excluded here.

    Returns rows with ``id``, ``name``, ``learner_reference_number``, and
    ``classroom_id``, ordered by lower-cased name then ``id`` for a stable order.
    """
    with db.cursor() as cur:
        cur.execute(
            """
            SELECT id, name, learner_reference_number, classroom_id
            FROM users
            WHERE classroom_id = %s
              AND role = 'learner'
              AND is_active = true
            ORDER BY lower(name), id
            """,
            (classroom_id,),
        )
        return cur.fetchall()


def insert_assessment(
    db: Connection[DictRow],
    learner_id: int,
    classroom_id: int,
    access_code: str,
    title: str,
    category: str,
    passage_text: str,
    scheduled_for: date,
    status: str = "scheduled",
) -> DictRow:
    """Insert one assessment row for a learner in a batch, returning its ``id``.

    Drives the per-learner side of scheduling (Requirement 5.4): the service
    calls this once per active learner with the shared batch metadata
    (``access_code``, ``title``, ``category``, ``passage_text``,
    ``scheduled_for``) and the batch's single generated ``access_code``.
    ``status`` defaults to ``'scheduled'`` so every learner's assessment starts
    unstarted. The ``unique (access_code, learner_id)`` constraint guarantees an
    access code resolves to at most one assessment per learner.

    Returns the row with the generated ``id`` so the service can insert the
    matching answer rows.
    """
    with db.cursor() as cur:
        cur.execute(
            """
            INSERT INTO assessments (learner_id, classroom_id, access_code,
                                     title, category, passage_text,
                                     scheduled_for, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                learner_id,
                classroom_id,
                access_code,
                title,
                category,
                passage_text,
                scheduled_for,
                status,
            ),
        )
        return cur.fetchone()


def insert_answer(
    db: Connection[DictRow],
    assessment_id: int,
    question_text: str,
    skill: str,
    expected_ideas: str,
) -> DictRow:
    """Insert one unanswered answer row for an assessment, returning its ``id``.

    Companion to :func:`insert_assessment` for scheduling (Requirement 5.4): the
    service creates one answer row per question per assessment. Only the question
    content (``question_text``, ``skill``, ``expected_ideas``) is written;
    ``answer_text`` and the evaluation columns stay ``NULL`` until the learner
    submits and evaluation runs.

    Returns the row with the generated ``id`` so submit can map an
    ``AnswerSubmission.answer_id`` back to the stored row.
    """
    with db.cursor() as cur:
        cur.execute(
            """
            INSERT INTO answers (assessment_id, question_text, skill,
                                 expected_ideas)
            VALUES (%s, %s, %s, %s)
            RETURNING id
            """,
            (assessment_id, question_text, skill, expected_ideas),
        )
        return cur.fetchone()


def get_assessment(
    db: Connection[DictRow], assessment_id: int
) -> Optional[DictRow]:
    """Return the full assessment row by primary key, or ``None`` if not found.

    Selects every assessment column so the taking and view services have the
    ``status``, ``scheduled_for``, and result fields they need without a second
    query. The service enforces ownership and status preconditions.
    """
    with db.cursor() as cur:
        cur.execute(
            """
            SELECT id,
                   learner_id,
                   classroom_id,
                   access_code,
                   title,
                   category,
                   passage_text,
                   scheduled_for,
                   status,
                   completed_at,
                   reading_accuracy,
                   comprehension_score,
                   diagnosis,
                   evaluation,
                   recommendation,
                   evaluated_by,
                   evaluation_error,
                   corrections_seen_at,
                   created_at
            FROM assessments
            WHERE id = %s
            """,
            (assessment_id,),
        )
        return cur.fetchone()


def get_assessment_by_code_for_learner(
    db: Connection[DictRow], access_code: str, learner_id: int
) -> Optional[DictRow]:
    """Return the learner's own assessment for an access code, or ``None``.

    An access code identifies a batch (one row per learner); the ``unique
    (access_code, learner_id)`` constraint means this matches at most one row.
    The learner-view service uses this so a learner can only ever read their own
    row (Requirement 4.1); a code that belongs to a different learner returns
    ``None`` and the service maps that to ``404`` (Requirement 4.2).
    """
    with db.cursor() as cur:
        cur.execute(
            """
            SELECT id,
                   learner_id,
                   classroom_id,
                   access_code,
                   title,
                   category,
                   passage_text,
                   scheduled_for,
                   status,
                   completed_at,
                   reading_accuracy,
                   comprehension_score,
                   diagnosis,
                   evaluation,
                   recommendation,
                   evaluated_by,
                   evaluation_error,
                   corrections_seen_at,
                   created_at
            FROM assessments
            WHERE access_code = %s
              AND learner_id = %s
            """,
            (access_code, learner_id),
        )
        return cur.fetchone()


def list_assessments_by_classroom(
    db: Connection[DictRow], classroom_id: int
) -> list[DictRow]:
    """Return the assessments in a classroom, newest batch first.

    Backs the teacher's batch listing for a classroom. Ordered by
    ``scheduled_for`` descending, then ``access_code`` and ``id`` for a stable
    order within a batch. Returns the summary-relevant columns plus the owning
    ``learner_id`` so the service can group or map as needed.
    """
    with db.cursor() as cur:
        cur.execute(
            """
            SELECT id,
                   learner_id,
                   classroom_id,
                   access_code,
                   title,
                   category,
                   scheduled_for,
                   status,
                   comprehension_score,
                   diagnosis,
                   evaluation_error,
                   completed_at,
                   created_at
            FROM assessments
            WHERE classroom_id = %s
            ORDER BY scheduled_for DESC, access_code, id
            """,
            (classroom_id,),
        )
        return cur.fetchall()


def update_answer_text(
    db: Connection[DictRow], answer_id: int, answer_text: Optional[str]
) -> None:
    """Save the submitted ``answer_text`` for one answer row.

    Used by the taking service on submit (Requirement 3.3): for each provided
    answer, the service persists the typed text (which may be ``None``/blank).
    The repository makes no decision about blankness — that classification
    happens later during evaluation.
    """
    with db.cursor() as cur:
        cur.execute(
            """
            UPDATE answers
            SET answer_text = %s
            WHERE id = %s
            """,
            (answer_text, answer_id),
        )


def set_assessment_status(
    db: Connection[DictRow],
    assessment_id: int,
    status: str,
    completed_at: bool = False,
) -> None:
    """Set an assessment's ``status``, optionally stamping ``completed_at``.

    - When ``completed_at`` is ``False`` (default), only ``status`` is written —
      used to move a ``scheduled`` assessment to ``in_progress`` on start
      (Requirement 3.1).
    - When ``completed_at`` is ``True``, ``completed_at`` is set to ``now()`` in
      the same statement — used when submit sets ``status = 'completed'``
      (Requirement 3.3).

    ``completed_at`` is a boolean flag controlling *whether* to stamp the
    timestamp, not the timestamp value itself; the actual value always comes from
    the database's ``now()`` so the service never passes a clock value.
    """
    with db.cursor() as cur:
        if completed_at:
            cur.execute(
                """
                UPDATE assessments
                SET status = %s,
                    completed_at = now()
                WHERE id = %s
                """,
                (status, assessment_id),
            )
        else:
            cur.execute(
                """
                UPDATE assessments
                SET status = %s
                WHERE id = %s
                """,
                (status, assessment_id),
            )


def load_answers(
    db: Connection[DictRow], assessment_id: int
) -> list[DictRow]:
    """Return the assessment's answer rows ordered by ``id`` ascending.

    Answers display and align by ``id`` order throughout the product
    (*SoT: Rules*). Returns the fields the taking and view services need to map
    submissions, resolve final verdicts, and render results: ``question_text``,
    ``skill``, ``expected_ideas``, ``answer_text``, ``ai_verdict``, ``evidence``,
    ``teacher_override``, ``overridden_at``, and ``override_note``.

    Returns a (possibly empty) list of answer rows.
    """
    with db.cursor() as cur:
        cur.execute(
            """
            SELECT id,
                   assessment_id,
                   question_text,
                   skill,
                   expected_ideas,
                   answer_text,
                   ai_verdict,
                   evidence,
                   teacher_override,
                   overridden_at,
                   override_note
            FROM answers
            WHERE assessment_id = %s
            ORDER BY id ASC
            """,
            (assessment_id,),
        )
        return cur.fetchall()


def get_batch_by_code_for_teacher(
    db: Connection[DictRow], access_code: str, teacher_id: int
) -> Optional[DictRow]:
    """Return one representative assessment for a batch the teacher owns.

    An access code identifies a batch (one assessment row per learner). For the
    teacher share/detail view we want the shared batch content (passage,
    questions, title) regardless of which learner's row it is, but only if the
    teacher owns the batch's classroom. This joins ``assessments`` to
    ``classrooms`` and filters on ``classrooms.teacher_id`` so a teacher can only
    read batches in their own classrooms; it returns the lowest-id row for the
    code as the representative, or ``None`` when no such batch exists for this
    teacher.
    """
    with db.cursor() as cur:
        cur.execute(
            """
            SELECT a.id,
                   a.learner_id,
                   a.classroom_id,
                   a.access_code,
                   a.title,
                   a.category,
                   a.passage_text,
                   a.scheduled_for,
                   a.status,
                   a.completed_at,
                   a.reading_accuracy,
                   a.comprehension_score,
                   a.diagnosis,
                   a.evaluation,
                   a.recommendation,
                   a.evaluated_by,
                   a.evaluation_error,
                   a.corrections_seen_at,
                   a.created_at
            FROM assessments a
            JOIN classrooms c ON c.id = a.classroom_id
            WHERE a.access_code = %s
              AND c.teacher_id = %s
            ORDER BY a.id ASC
            LIMIT 1
            """,
            (access_code, teacher_id),
        )
        return cur.fetchone()