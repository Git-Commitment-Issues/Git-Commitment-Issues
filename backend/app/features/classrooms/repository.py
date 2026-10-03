"""Classrooms + roster feature repository — all SQL, no decisions.

Per the strictly layered architecture (*SoT: router → service → repository*),
this module holds **only** SQL against the ``classrooms``, ``users``,
``assessments``, and ``answers`` tables and returns raw mapping rows
(``dict_row``). It makes no decisions: parsing of pasted rosters, LRN format
validation, duplicate skipping, name defaulting, and the late-joiner backfill
orchestration all live in the service layer. The repository only persists and
reads what the service asks for.

Every query is parameterized (no string interpolation of untrusted input) to
avoid SQL injection. The dynamic ``UPDATE`` in :func:`update_learner` builds its
``SET`` clause only from a fixed allowlist of column names and still passes all
values as query parameters, so no caller input is ever interpolated into SQL.

Functions accept a ``psycopg`` connection configured with the ``dict_row``
factory (see ``app.database.connection.get_db``).

Requirements covered:
- 2.1 — persist a classroom with its ``name`` and the creating teacher's id.
- 2.3 — create a learner with ``role = 'learner'``, the LRN, classroom, active.
- 2.7 — update learner fields and set ``updated_at`` to the current time.
- 2.9 — read future batches (and their question set) and persist the assessment
  and answer rows for a late-joiner backfill.
"""

from __future__ import annotations

from datetime import date
from typing import Any, Mapping, Optional

from psycopg import Connection
from psycopg.rows import DictRow

# Columns a teacher is allowed to change on a learner (Requirement 2.7). The
# dynamic UPDATE builds its SET clause only from this allowlist, never from
# caller-supplied key names, so column identifiers can never be injected.
_UPDATABLE_LEARNER_FIELDS: frozenset[str] = frozenset(
    {"name", "learner_reference_number", "classroom_id", "is_active"}
)


def insert_classroom(
    db: Connection[DictRow], name: str, teacher_id: int
) -> DictRow:
    """Insert a classroom and return its ``id``, ``name``, and ``teacher_id``.

    Persists the classroom with the given ``name`` and the creating teacher's
    ``teacher_id`` (Requirement 2.1). The service is responsible for validating
    the name length (1–100 chars) before calling this; the repository just
    writes the row and returns the generated identity.
    """
    with db.cursor() as cur:
        cur.execute(
            """
            INSERT INTO classrooms (name, teacher_id)
            VALUES (%s, %s)
            RETURNING id, name, teacher_id
            """,
            (name, teacher_id),
        )
        return cur.fetchone()


def list_classrooms_by_teacher(
    db: Connection[DictRow], teacher_id: int
) -> list[DictRow]:
    """Return all classrooms owned by ``teacher_id``, newest first.

    Ordered by ``created_at`` descending (then ``id`` descending as a stable
    tie-breaker) so the most recently created classroom appears first.
    """
    with db.cursor() as cur:
        cur.execute(
            """
            SELECT id, name, teacher_id, created_at
            FROM classrooms
            WHERE teacher_id = %s
            ORDER BY created_at DESC, id DESC
            """,
            (teacher_id,),
        )
        return cur.fetchall()


def insert_learner(
    db: Connection[DictRow],
    name: str,
    lrn: str,
    classroom_id: int,
    is_active: bool = True,
) -> DictRow:
    """Insert a learner into a classroom and return the created roster row.

    Writes a user with ``role = 'learner'``, the parsed ``lrn`` as
    ``learner_reference_number``, the ``classroom_id``, and ``is_active``
    (defaulting to true) per Requirement 2.3. The service decides the final
    ``name`` (including the ``Learner <last 4 of LRN>`` default) and ensures the
    LRN is new before calling this.

    Returns the row with ``id``, ``name``, ``learner_reference_number``,
    ``classroom_id``, and ``is_active``.
    """
    with db.cursor() as cur:
        cur.execute(
            """
            INSERT INTO users (name, role, learner_reference_number,
                               classroom_id, is_active)
            VALUES (%s, 'learner', %s, %s, %s)
            RETURNING id, name, learner_reference_number, classroom_id, is_active
            """,
            (name, lrn, classroom_id, is_active),
        )
        return cur.fetchone()


def lrn_exists(db: Connection[DictRow], lrn: str) -> bool:
    """Return ``True`` if any user already has ``learner_reference_number`` ``lrn``.

    Used by the service to skip duplicate roster entries (Requirement 2.5)
    before attempting an insert. ``learner_reference_number`` is unique, so a
    single ``SELECT 1`` is enough; the fetched row is irrelevant beyond its
    existence.
    """
    with db.cursor() as cur:
        cur.execute(
            """
            SELECT 1
            FROM users
            WHERE learner_reference_number = %s
            """,
            (lrn,),
        )
        return cur.fetchone() is not None


def update_learner(
    db: Connection[DictRow], learner_id: int, fields: Mapping[str, Any]
) -> Optional[DictRow]:
    """Update the provided learner fields and bump ``updated_at`` to now.

    Dynamically builds the ``SET`` clause from only the keys in ``fields`` that
    are in the allowlist ``{name, learner_reference_number, classroom_id,
    is_active}`` (Requirement 2.7). Column identifiers come exclusively from that
    allowlist — never from caller input — and every value is passed as a bound
    parameter, so the dynamic SQL carries no injection risk. ``updated_at`` is
    always set to ``now()`` on any update, matching the "app sets updated_at on
    every users update" invariant (no DB trigger).

    Only ``role = 'learner'`` rows are targeted, so a teacher id cannot be
    mutated through this path.

    Raises :class:`ValueError` when ``fields`` contains no updatable keys, since
    an empty ``SET`` clause would be invalid SQL and signals a caller bug.
    Returns the updated learner row, or ``None`` if no learner matches
    ``learner_id``.
    """
    assignments: list[str] = []
    params: list[Any] = []
    for column in _UPDATABLE_LEARNER_FIELDS:
        if column in fields:
            assignments.append(f"{column} = %s")
            params.append(fields[column])

    if not assignments:
        raise ValueError("update_learner requires at least one updatable field")

    # updated_at is always refreshed; it is not caller-controlled.
    assignments.append("updated_at = now()")

    set_clause = ", ".join(assignments)
    params.append(learner_id)

    with db.cursor() as cur:
        cur.execute(
            f"""
            UPDATE users
            SET {set_clause}
            WHERE id = %s
              AND role = 'learner'
            RETURNING id, name, learner_reference_number, classroom_id,
                      is_active, updated_at
            """,
            params,
        )
        return cur.fetchone()


def list_active_learners(
    db: Connection[DictRow], classroom_id: int
) -> list[DictRow]:
    """Return the active learners in a classroom, ordered by name.

    Filters to ``role = 'learner'`` and ``is_active = true`` for the given
    ``classroom_id``. Inactive learners are retained in the table
    (Requirement 2.8) but excluded here; the service uses this active roster for
    scheduling and roster display.
    """
    with db.cursor() as cur:
        cur.execute(
            """
            SELECT id, name, learner_reference_number, classroom_id, is_active
            FROM users
            WHERE classroom_id = %s
              AND role = 'learner'
              AND is_active = true
            ORDER BY lower(name), id
            """,
            (classroom_id,),
        )
        return cur.fetchall()


def list_future_batches(
    db: Connection[DictRow], classroom_id: int, today: date
) -> list[DictRow]:
    """Return one representative row per future batch in a classroom.

    A batch is all assessments sharing one ``access_code``; at scheduling time
    every batch has one assessment row per learner with identical
    ``title``, ``category``, ``passage_text``, and ``scheduled_for``. For
    late-joiner backfill (Requirement 2.9) the service needs, for every batch in
    this classroom whose ``scheduled_for >= today`` (Manila), enough shared
    metadata to recreate a new learner's assessment row. This returns one row per
    distinct ``access_code`` — the representative with the lowest assessment
    ``id`` — carrying that shared metadata.

    The per-batch question set is fetched separately via
    :func:`list_batch_questions`, keyed by ``access_code`` + ``classroom_id``.

    Returns rows with ``access_code``, ``title``, ``category``,
    ``passage_text``, and ``scheduled_for``, ordered by ``scheduled_for`` then
    ``access_code`` for deterministic processing.
    """
    with db.cursor() as cur:
        cur.execute(
            """
            SELECT DISTINCT ON (access_code)
                   access_code,
                   title,
                   category,
                   passage_text,
                   scheduled_for
            FROM assessments
            WHERE classroom_id = %s
              AND scheduled_for >= %s
            ORDER BY access_code, id
            """,
            (classroom_id, today),
        )
        rows = cur.fetchall()

    # Present in schedule order for deterministic backfill; the DISTINCT ON above
    # already fixed ordering by access_code to pick the representative row.
    rows.sort(key=lambda r: (r["scheduled_for"], r["access_code"]))
    return rows


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

    Used by the late-joiner backfill (Requirement 2.9): when a new learner joins
    a classroom, the service recreates — for every future batch — the same
    assessment the batch's other learners already have. The shared batch
    metadata (``access_code``, ``title``, ``category``, ``passage_text``,
    ``scheduled_for``) is passed in by the service from the representative batch
    row; ``status`` defaults to ``'scheduled'`` so the new learner's assessment
    starts unstarted like everyone else's.

    The ``unique (access_code, learner_id)`` constraint protects against
    duplicating a learner's row for the same batch; the service skips batches the
    learner already has before calling this.

    Returns the row with the generated ``id``.
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
) -> None:
    """Insert one unanswered answer row for an assessment.

    Companion to :func:`insert_assessment` for late-joiner backfill
    (Requirement 2.9): for each question in a backfilled batch, create the
    question row the learner will later answer. Only the question content
    (``question_text``, ``skill``, ``expected_ideas``) is written; ``answer_text``
    and ``ai_verdict`` (and the other evaluation columns) stay ``NULL`` until the
    learner submits and evaluation runs.
    """
    with db.cursor() as cur:
        cur.execute(
            """
            INSERT INTO answers (assessment_id, question_text, skill,
                                 expected_ideas)
            VALUES (%s, %s, %s, %s)
            """,
            (assessment_id, question_text, skill, expected_ideas),
        )


def learner_has_batch(
    db: Connection[DictRow], access_code: str, learner_id: int
) -> bool:
    """Return ``True`` if ``learner_id`` already has an assessment for ``access_code``.

    Lets the backfill service respect the ``unique (access_code, learner_id)``
    constraint without catching an integrity error: an update that re-adds a
    learner into a classroom they already have future batches for must not
    attempt a duplicate insert (Requirement 2.9).
    """
    with db.cursor() as cur:
        cur.execute(
            """
            SELECT 1
            FROM assessments
            WHERE access_code = %s
              AND learner_id = %s
            """,
            (access_code, learner_id),
        )
        return cur.fetchone() is not None


def list_batch_questions(
    db: Connection[DictRow], access_code: str, classroom_id: int
) -> list[DictRow]:
    """Return the distinct question set for one batch, for backfill.

    Every assessment in a batch shares the same questions, so to recreate the
    answer rows for a late joiner (Requirement 2.9) the service needs the
    batch's question definitions once. This reads the ``answers`` for the
    assessments in the given batch (matched by ``access_code`` within the given
    ``classroom_id``) and returns the distinct
    ``(question_text, skill, expected_ideas)`` triples — the question content
    only, without any learner's ``answer_text`` or verdicts.

    Returns rows with ``question_text``, ``skill``, and ``expected_ideas``,
    ordered by the lowest answer ``id`` so the original question order is
    preserved.
    """
    with db.cursor() as cur:
        cur.execute(
            """
            SELECT a.question_text,
                   a.skill,
                   a.expected_ideas
            FROM answers a
            JOIN assessments s ON s.id = a.assessment_id
            WHERE s.classroom_id = %s
              AND s.access_code = %s
            GROUP BY a.question_text, a.skill, a.expected_ideas
            ORDER BY min(a.id)
            """,
            (classroom_id, access_code),
        )
        return cur.fetchall()
