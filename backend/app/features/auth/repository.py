"""Auth feature repository — all SQL for identity lookups, no decisions.

Per the strictly layered architecture (*SoT: router → service → repository*),
this module holds **only** SQL against the ``users`` table and returns raw
mapping rows (``dict_row``). It makes no decisions: it does not decide whether a
learner is allowed to log in (that is Requirement 1.5, handled by the service),
so learner lookups return the row **regardless of ``is_active``** and include
the ``is_active`` flag so the service can distinguish an active match from an
Inactive_Learner and respond ``401`` accordingly.

Every query is parameterized (no string interpolation of inputs) to avoid SQL
injection. Functions accept a ``psycopg`` connection configured with the
``dict_row`` factory (see ``app.database.connection.get_db``).

Requirements covered:
- 1.1 — match a teacher by case-insensitive name and ``role = 'teacher'``.
- 1.2 — match a learner by ``learner_reference_number`` (service checks active).
- 1.5 — select includes ``is_active`` so the service can reject inactive learners.
"""

from __future__ import annotations

from typing import Optional

from psycopg import Connection
from psycopg.rows import DictRow


def find_teacher_by_name(
    db: Connection[DictRow], name: str
) -> Optional[DictRow]:
    """Return the teacher row whose name matches ``name`` case-insensitively.

    Matches against users with ``role = 'teacher'`` using ``lower(name)`` on both
    sides so the comparison is case-insensitive (Requirement 1.1). The database's
    partial unique index ``users_teacher_name_uq`` guarantees at most one such
    teacher, so this returns a single row or ``None``.

    Returns the row with ``id``, ``name``, ``role``, and ``classroom_id``, or
    ``None`` when no teacher matches.
    """
    with db.cursor() as cur:
        cur.execute(
            """
            SELECT id, name, role, classroom_id
            FROM users
            WHERE lower(name) = lower(%s)
              AND role = 'teacher'
            """,
            (name,),
        )
        return cur.fetchone()


def find_learner_by_lrn(
    db: Connection[DictRow], lrn: str
) -> Optional[DictRow]:
    """Return the learner row matching ``lrn``, regardless of active status.

    Matches ``learner_reference_number`` for users with ``role = 'learner'`` and
    returns the row **including ``is_active``** so the service can decide the
    outcome: an active learner logs in (Requirement 1.2) while an
    Inactive_Learner is rejected with ``401`` (Requirement 1.5). Keeping the
    activity decision in the service honors the "repository makes no decisions"
    rule. ``learner_reference_number`` is unique, so this returns a single row or
    ``None``.

    Returns the row with ``id``, ``name``, ``role``, ``classroom_id``, and
    ``is_active``, or ``None`` when no learner matches.
    """
    with db.cursor() as cur:
        cur.execute(
            """
            SELECT id, name, role, classroom_id, is_active
            FROM users
            WHERE learner_reference_number = %s
              AND role = 'learner'
            """,
            (lrn,),
        )
        return cur.fetchone()


def find_active_learner_by_lrn(
    db: Connection[DictRow], lrn: str
) -> Optional[DictRow]:
    """Return the **active** learner row matching ``lrn``, or ``None``.

    A narrower variant of :func:`find_learner_by_lrn` that additionally filters
    on ``is_active = true`` at the SQL level (Requirement 1.2). This is a
    convenience for callers that only ever want an active match; services that
    must distinguish an inactive learner to emit a specific ``401``
    (Requirement 1.5) should prefer :func:`find_learner_by_lrn` and inspect
    ``is_active`` themselves.

    Returns the row with ``id``, ``name``, ``role``, ``classroom_id``, and
    ``is_active``, or ``None`` when no active learner matches.
    """
    with db.cursor() as cur:
        cur.execute(
            """
            SELECT id, name, role, classroom_id, is_active
            FROM users
            WHERE learner_reference_number = %s
              AND role = 'learner'
              AND is_active = true
            """,
            (lrn,),
        )
        return cur.fetchone()


def find_user_by_id(
    db: Connection[DictRow], user_id: int
) -> Optional[DictRow]:
    """Return a single user row by primary key, or ``None`` if not found.

    Provided as a convenience for resolving the Current_User (Requirement 1.6);
    identity middleware currently queries ``users`` directly, but services may
    reuse this helper to stay within the repository layer.

    Returns the row with ``id``, ``name``, ``role``, ``classroom_id``, and
    ``is_active``, or ``None`` when no user has that id.
    """
    with db.cursor() as cur:
        cur.execute(
            """
            SELECT id, name, role, classroom_id, is_active
            FROM users
            WHERE id = %s
            """,
            (user_id,),
        )
        return cur.fetchone()
