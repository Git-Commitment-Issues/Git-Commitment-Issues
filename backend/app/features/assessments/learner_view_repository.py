"""Learner-view repository — SQL for a learner reading their own assessments.

Per the strictly layered architecture (*SoT: router → service → repository*),
this module holds **only** SQL and returns raw mapping rows (``dict_row``). It
lives in the ``assessments`` package as a separate module from ``repository.py``
(which owns scheduling and taking) so the learner-facing reads can evolve
without colliding with that file. It makes no decisions: ownership checks,
Final_Verdict resolution, evaluation-state classification, and alert policy all
live in the learner-view service; the repository persists and reads only what it
is asked for.

Every query is parameterized (no string interpolation of untrusted input) to
avoid SQL injection, and every learner-scoped read is additionally filtered by
``learner_id`` so a learner can only ever reach their own rows. Functions accept
a ``psycopg`` connection configured with the ``dict_row`` factory (see
``app.database.connection.get_db``); the surrounding request/transaction scope
owns commits.

Requirements covered:
- 4.1 — load a learner's own assessment (by id or access code) scoped to the
  requesting learner, so another learner's row is never returned.
- 4.6 — stamp ``corrections_seen_at`` when the learner acknowledges corrections.
- 4.7 — compute whether an assessment currently has a correction alert.
"""

from __future__ import annotations

from typing import Optional

from psycopg import Connection
from psycopg.rows import DictRow


# The full set of assessment columns a learner view needs. Kept as a single
# constant so the by-id and by-code reads stay identical in shape.
_ASSESSMENT_COLUMNS = """
    id,
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
"""


def get_own_assessment_by_id(
    db: Connection[DictRow], assessment_id: int, learner_id: int
) -> Optional[DictRow]:
    """Return the learner's own assessment by primary key, or ``None``.

    The query is scoped to both ``id`` and ``learner_id`` so an assessment that
    exists but belongs to a different learner returns ``None`` (Requirement 4.1).
    The service maps a ``None`` result to ``404`` so existence is never leaked.
    Selects every assessment column the learner view renders.
    """
    with db.cursor() as cur:
        cur.execute(
            f"""
            SELECT {_ASSESSMENT_COLUMNS}
            FROM assessments
            WHERE id = %s
              AND learner_id = %s
            """,
            (assessment_id, learner_id),
        )
        return cur.fetchone()


def get_own_assessment_by_code(
    db: Connection[DictRow], access_code: str, learner_id: int
) -> Optional[DictRow]:
    """Return the learner's own assessment for an access code, or ``None``.

    An access code identifies a batch (one row per learner); the ``unique
    (access_code, learner_id)`` constraint means this matches at most one row.
    Scoping to ``learner_id`` means a code that belongs to a different learner
    returns ``None`` (Requirement 4.1), which the service maps to ``404``
    (Requirement 4.2). Selects every assessment column the learner view renders.
    """
    with db.cursor() as cur:
        cur.execute(
            f"""
            SELECT {_ASSESSMENT_COLUMNS}
            FROM assessments
            WHERE access_code = %s
              AND learner_id = %s
            """,
            (access_code, learner_id),
        )
        return cur.fetchone()


def load_answers(
    db: Connection[DictRow], assessment_id: int
) -> list[DictRow]:
    """Return the assessment's answer rows ordered by ``id`` ascending.

    Answers display and align by ``id`` order throughout the product
    (*SoT: Rules*). Returns the fields the learner view needs to render results
    and resolve each Final_Verdict in the service: ``question_text``, ``skill``,
    ``answer_text``, ``ai_verdict``, ``evidence``, ``teacher_override``,
    ``overridden_at``, and ``override_note``.

    Returns a (possibly empty) list of answer rows.
    """
    with db.cursor() as cur:
        cur.execute(
            """
            SELECT id,
                   question_text,
                   skill,
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


def has_correction_alert(
    db: Connection[DictRow], assessment_id: int
) -> bool:
    """Return whether the assessment currently has a correction alert.

    An alert exists when at least one answer carries a teacher override that the
    learner has not yet acknowledged (Requirement 4.7). "Not acknowledged" means
    either the assessment's ``corrections_seen_at`` is ``NULL`` (the learner has
    never acknowledged any correction) or the override's ``overridden_at`` is
    strictly later than ``corrections_seen_at`` (a newer override landed after
    the last acknowledgement).

    Computed in a single ``EXISTS`` query that joins each answer to its
    assessment, so the service receives a plain boolean and makes no SQL
    decision of its own.
    """
    with db.cursor() as cur:
        cur.execute(
            """
            SELECT EXISTS (
                SELECT 1
                FROM answers a
                JOIN assessments s ON s.id = a.assessment_id
                WHERE a.assessment_id = %s
                  AND a.teacher_override IS NOT NULL
                  AND (
                        s.corrections_seen_at IS NULL
                     OR a.overridden_at > s.corrections_seen_at
                  )
            ) AS has_alert
            """,
            (assessment_id,),
        )
        row = cur.fetchone()
        return bool(row["has_alert"]) if row is not None else False


def set_corrections_seen(
    db: Connection[DictRow], assessment_id: int
) -> None:
    """Stamp ``corrections_seen_at`` to the current time for an assessment.

    Used when the learner acknowledges corrections (Requirement 4.6): the value
    always comes from the database's ``now()`` so the service never passes a
    clock value. After this runs, previously-seen overrides stop raising a
    correction alert (see :func:`has_correction_alert`).
    """
    with db.cursor() as cur:
        cur.execute(
            """
            UPDATE assessments
            SET corrections_seen_at = now()
            WHERE id = %s
            """,
            (assessment_id,),
        )


def list_assessments_for_learner(
    db: Connection[DictRow], learner_id: int
) -> list[DictRow]:
    """Return the learner's own assessments for the ``/me/assessments`` view.

    Scoped to ``learner_id`` so the list only ever contains the requesting
    learner's rows (Requirement 4.1). Returns the summary columns the learner's
    list view renders — ``id``, ``access_code``, ``title``, ``scheduled_for``,
    ``status``, ``comprehension_score``, ``diagnosis``, ``evaluation_error``,
    and ``corrections_seen_at`` — ordered by ``scheduled_for`` (then ``id`` for a
    stable order within a day).

    Returns a (possibly empty) list of assessment summary rows.
    """
    with db.cursor() as cur:
        cur.execute(
            """
            SELECT id,
                   access_code,
                   title,
                   scheduled_for,
                   status,
                   comprehension_score,
                   diagnosis,
                   evaluation_error,
                   corrections_seen_at
            FROM assessments
            WHERE learner_id = %s
            ORDER BY scheduled_for, id
            """,
            (learner_id,),
        )
        return cur.fetchall()
