"""Dashboard feature repository — read-only aggregate SQL for teachers.

Per the strictly layered architecture (*SoT: router → service → repository*),
this module holds **only** SQL and returns raw mapping rows (``dict_row``). It
makes no decisions: batch resolution policy, error mapping (e.g. a missing
batch -> 404), and DTO shaping all live in the service layer. The repository
reads what the service asks for and never writes.

Dashboard invariants encoded here (*SoT: Rules*, Requirements 7.1-7.6):

- **Read-only (7.6).** Every statement in this module is a ``SELECT``; no
  ``INSERT``/``UPDATE``/``DELETE`` touches learner, assessment, or verdict data.
- **Exclude inactive learners (7.1).** Every aggregate that reads ``answers`` or
  ``assessments`` joins through to ``users`` and filters
  ``users.is_active = true`` (and ``users.role = 'learner'``), so inactive
  learners drop out of results while their history rows stay in the database.
- **Final verdict scoring (7.2).** Verdict aggregation uses the final verdict
  ``COALESCE(teacher_override, ai_verdict)`` with weights ``correct = 1.0``,
  ``partial = 0.5``, and ``missed``/``NULL = 0.0`` via a ``CASE`` expression.
- **Most-missed grouping (7.3).** Grouped by ``access_code`` combined with
  ``question_text`` and sorted ascending by percent correct.
- **Default batch (7.4).** The most recent batch (by ``scheduled_for`` then
  ``created_at``/``id``) in the classroom with at least one completed
  assessment, as computed by :func:`resolve_default_batch`.

Every query is parameterized (no string interpolation of untrusted input) to
avoid SQL injection. Functions accept a ``psycopg`` connection configured with
the ``dict_row`` factory (see ``app.database.connection.get_db``).

Note: ``psycopg`` cannot run live in this environment, so these queries are not
executed against a database here; they are verified only for Python syntax
(``py_compile``). Live validation happens against the real Supabase pooler.
"""

from __future__ import annotations

from typing import Optional

from psycopg import Connection
from psycopg.rows import DictRow


# Final verdict for an answer, as a SQL fragment: the teacher override wins,
# otherwise the AI verdict (Rules: Final verdict = COALESCE(teacher_override,
# ai_verdict)).
_FINAL_VERDICT = "COALESCE(a.teacher_override, a.ai_verdict)"

# Weight of a final verdict toward "percent correct": correct = 1.0,
# partial = 0.5, missed / NULL = 0.0 (Requirement 7.2). Expressed over the
# final-verdict fragment above.
_VERDICT_WEIGHT = f"""
    CASE {_FINAL_VERDICT}
        WHEN 'correct' THEN 1.0
        WHEN 'partial' THEN 0.5
        ELSE 0.0
    END
"""


def resolve_default_batch(
    db: Connection[DictRow], classroom_id: int
) -> Optional[str]:
    """Return the default batch's ``access_code`` for a classroom, or ``None``.

    The default batch (Requirement 7.4) is the most recent batch in the
    classroom that has at least one **completed** assessment belonging to an
    **active learner** (Requirement 7.1). "Most recent" orders by
    ``scheduled_for`` descending, then by the latest ``created_at`` and ``id``
    within the batch as a stable tie-breaker.

    Returns the winning ``access_code``, or ``None`` when the classroom has no
    batch with a completed assessment yet (the service maps that to an empty
    dashboard rather than an error).
    """
    with db.cursor() as cur:
        cur.execute(
            """
            SELECT asm.access_code
            FROM assessments asm
            JOIN users u ON u.id = asm.learner_id
            WHERE asm.classroom_id = %s
              AND asm.status = 'completed'
              AND u.is_active = true
              AND u.role = 'learner'
            GROUP BY asm.access_code
            ORDER BY max(asm.scheduled_for) DESC,
                     max(asm.created_at) DESC,
                     max(asm.id) DESC
            LIMIT 1
            """,
            (classroom_id,),
        )
        row = cur.fetchone()
        return row["access_code"] if row else None


def batch_exists_with_completed(
    db: Connection[DictRow], classroom_id: int, access_code: str
) -> bool:
    """Return whether a batch exists in the classroom with a completed assessment.

    Backs the validation for an explicitly requested ``access_code``
    (Requirement 7.5): the service rejects a code that either does not exist in
    the classroom or has no completed assessment (for an active learner). Returns
    ``True`` only when at least one such row exists.
    """
    with db.cursor() as cur:
        cur.execute(
            """
            SELECT 1
            FROM assessments asm
            JOIN users u ON u.id = asm.learner_id
            WHERE asm.classroom_id = %s
              AND asm.access_code = %s
              AND asm.status = 'completed'
              AND u.is_active = true
              AND u.role = 'learner'
            LIMIT 1
            """,
            (classroom_id, access_code),
        )
        return cur.fetchone() is not None


def needs_help(
    db: Connection[DictRow], classroom_id: int, access_code: str
) -> list[DictRow]:
    """Return active learners in a batch who need help, lowest score first.

    For the given batch (``classroom_id`` + ``access_code``), returns one row per
    **active learner** (Requirement 7.1) whose assessment ``diagnosis`` flags a
    need for help — ``highest_priority`` or ``comprehension_barrier`` — ordered
    by ``comprehension_score`` ascending so the most at-risk learners surface
    first. ``on_track`` and ``decoding_barrier`` learners are excluded.

    Returns rows with the learner ``id`` and ``name``, the assessment's
    ``comprehension_score``, and its ``diagnosis``.
    """
    with db.cursor() as cur:
        cur.execute(
            """
            SELECT u.id   AS id,
                   u.name AS name,
                   asm.comprehension_score AS comprehension_score,
                   asm.diagnosis           AS diagnosis
            FROM assessments asm
            JOIN users u ON u.id = asm.learner_id
            WHERE asm.classroom_id = %s
              AND asm.access_code = %s
              AND u.is_active = true
              AND u.role = 'learner'
              AND asm.diagnosis IN ('highest_priority', 'comprehension_barrier')
            ORDER BY asm.comprehension_score ASC NULLS FIRST, u.id ASC
            """,
            (classroom_id, access_code),
        )
        return cur.fetchall()


def skills_breakdown(
    db: Connection[DictRow], classroom_id: int, access_code: str
) -> list[DictRow]:
    """Return per-skill percent-correct for a batch, across active learners.

    Aggregates answers in the batch by ``skill`` using the final-verdict weights
    (Requirement 7.2: correct = 1.0, partial = 0.5, else 0.0) over active
    learners only (Requirement 7.1). ``avg_score`` is the mean weight expressed
    on a 0-100 scale. Also returns the raw counts used to compute it so the
    service can render coverage.

    Returns rows with ``skill``, ``avg_score`` (0-100), ``answered`` (answers
    with a final verdict), and ``total`` (all answers for the skill). Ordered by
    ``skill`` for a stable presentation.
    """
    with db.cursor() as cur:
        cur.execute(
            f"""
            SELECT a.skill AS skill,
                   round(100.0 * avg({_VERDICT_WEIGHT}), 2) AS avg_score,
                   count(*) FILTER (
                       WHERE {_FINAL_VERDICT} IS NOT NULL
                   ) AS answered,
                   count(*) AS total
            FROM answers a
            JOIN assessments asm ON asm.id = a.assessment_id
            JOIN users u ON u.id = asm.learner_id
            WHERE asm.classroom_id = %s
              AND asm.access_code = %s
              AND u.is_active = true
              AND u.role = 'learner'
            GROUP BY a.skill
            ORDER BY a.skill
            """,
            (classroom_id, access_code),
        )
        return cur.fetchall()


def most_missed_questions(
    db: Connection[DictRow], classroom_id: int, access_code: str
) -> list[DictRow]:
    """Return questions in a batch ordered by percent correct, lowest first.

    Groups answers by ``access_code`` combined with ``question_text``
    (Requirement 7.3), computing ``percent_correct`` as
    ``100 * sum(final-verdict weight) / count`` over active learners'
    answers (Requirements 7.1, 7.2). Results are sorted ascending by
    ``percent_correct`` so the most-missed questions appear first.

    Returns rows with ``question_text``, the question's ``skill``,
    ``percent_correct`` (0-100), and ``n`` (number of answers aggregated).
    """
    with db.cursor() as cur:
        cur.execute(
            f"""
            SELECT a.question_text AS question_text,
                   min(a.skill)    AS skill,
                   round(100.0 * sum({_VERDICT_WEIGHT}) / count(*), 2)
                       AS percent_correct,
                   count(*) AS n
            FROM answers a
            JOIN assessments asm ON asm.id = a.assessment_id
            JOIN users u ON u.id = asm.learner_id
            WHERE asm.classroom_id = %s
              AND asm.access_code = %s
              AND u.is_active = true
              AND u.role = 'learner'
            GROUP BY asm.access_code, a.question_text
            ORDER BY percent_correct ASC, a.question_text ASC
            """,
            (classroom_id, access_code),
        )
        return cur.fetchall()


def override_rate(
    db: Connection[DictRow], classroom_id: int, access_code: str
) -> DictRow:
    """Return the teacher-override rate for a batch, across active learners.

    Computes how often a teacher overrode the AI verdict in the batch: the
    fraction of answers with ``teacher_override IS NOT NULL`` over all answers,
    counting active learners only (Requirement 7.1). This is a read-only insight
    into teacher-vs-AI disagreement (Requirement 7.6).

    Returns a single row with ``overridden`` (count of overridden answers),
    ``total`` (count of all answers), and ``rate`` (``overridden / total``, or
    ``0`` when there are no answers so the service never divides by zero).
    """
    with db.cursor() as cur:
        cur.execute(
            """
            SELECT count(*) FILTER (
                       WHERE a.teacher_override IS NOT NULL
                   ) AS overridden,
                   count(*) AS total,
                   CASE
                       WHEN count(*) = 0 THEN 0.0
                       ELSE round(
                           count(*) FILTER (
                               WHERE a.teacher_override IS NOT NULL
                           )::numeric / count(*),
                           4
                       )
                   END AS rate
            FROM answers a
            JOIN assessments asm ON asm.id = a.assessment_id
            JOIN users u ON u.id = asm.learner_id
            WHERE asm.classroom_id = %s
              AND asm.access_code = %s
              AND u.is_active = true
              AND u.role = 'learner'
            """,
            (classroom_id, access_code),
        )
        return cur.fetchone()


def list_batches(
    db: Connection[DictRow], classroom_id: int
) -> list[DictRow]:
    """Return the distinct batches in a classroom, newest first.

    One row per ``access_code`` in the classroom, counting assessments for
    active learners only (Requirement 7.1). Each row carries the batch's
    ``scheduled_for`` and ``title`` plus the number of ``completed`` assessments
    and the ``total`` number of assessments, so the service can show progress
    per batch. Ordered by ``scheduled_for`` descending, then latest
    ``created_at``/``access_code`` for a stable newest-first order.

    Returns rows with ``access_code``, ``title``, ``scheduled_for``,
    ``completed``, and ``total``.
    """
    with db.cursor() as cur:
        cur.execute(
            """
            SELECT asm.access_code AS access_code,
                   min(asm.title)  AS title,
                   max(asm.scheduled_for) AS scheduled_for,
                   count(*) FILTER (
                       WHERE asm.status = 'completed'
                   ) AS completed,
                   count(*) AS total
            FROM assessments asm
            JOIN users u ON u.id = asm.learner_id
            WHERE asm.classroom_id = %s
              AND u.is_active = true
              AND u.role = 'learner'
            GROUP BY asm.access_code
            ORDER BY max(asm.scheduled_for) DESC,
                     max(asm.created_at) DESC,
                     asm.access_code DESC
            """,
            (classroom_id,),
        )
        return cur.fetchall()


def student_progress(
    db: Connection[DictRow], student_id: int
) -> list[DictRow]:
    """Return one learner's completed assessments over time.

    Returns the learner's completed assessments ordered by ``scheduled_for`` so
    the service can plot comprehension over time. Progress is per-student
    history and the endpoint is teacher-only, so this intentionally returns the
    learner's own rows regardless of their ``is_active`` flag — inactive learners
    keep their history (Requirement 7.1 preserves history rows).

    Returns rows with ``access_code``, ``title``, ``scheduled_for``,
    ``comprehension_score``, and ``diagnosis``, oldest first.
    """
    with db.cursor() as cur:
        cur.execute(
            """
            SELECT asm.access_code AS access_code,
                   asm.title       AS title,
                   asm.scheduled_for AS scheduled_for,
                   asm.comprehension_score AS comprehension_score,
                   asm.diagnosis   AS diagnosis
            FROM assessments asm
            WHERE asm.learner_id = %s
              AND asm.status = 'completed'
            ORDER BY asm.scheduled_for ASC, asm.id ASC
            """,
            (student_id,),
        )
        return cur.fetchall()
