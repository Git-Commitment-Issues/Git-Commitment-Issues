"""Dev-only database reset: drop, recreate from ``schema.sql``, then reseed.

This module provides a single destructive helper used during development and
for demo preparation (Requirement 8.3). It:

1. Drops the four domain tables (``answers``, ``assessments``, ``users``,
   ``classrooms``) with ``cascade`` so dependent objects (indexes, constraints,
   the circular ``classrooms.teacher_id`` FK) go with them.
2. Recreates the schema by executing the DDL in :mod:`app.database`'s
   ``schema.sql`` verbatim.
3. Repopulates fake demo data by invoking :func:`app.database.seed.seed`.

It is intentionally *not* wired into the application or any route — it exists to
be run by hand (``python -m app.database.reset``) against a development database.
Running it against anything with real data would destroy that data.

The DDL file is read at runtime relative to this module (via
:mod:`importlib.resources`), so the reset works regardless of the current
working directory the command is launched from.
"""

from __future__ import annotations

from importlib import resources


# Order matters: drop children before parents is not strictly required with
# ``cascade``, but listing all four (child-first) keeps the intent obvious and
# is robust even if ``cascade`` is ever removed.
_DROP_SQL = (
    "drop table if exists answers, assessments, users, classrooms cascade;"
)


def _read_schema_sql() -> str:
    """Return the contents of ``schema.sql`` shipped alongside this module.

    Uses :mod:`importlib.resources` so the DDL is located relative to the
    ``app.database`` package rather than the process working directory.
    """
    return (
        resources.files("app.database")
        .joinpath("schema.sql")
        .read_text(encoding="utf-8")
    )


def reset(conn) -> None:
    """Drop every table, recreate the schema, and reseed demo data.

    All work uses the given open ``psycopg`` connection. The drop + DDL run in a
    single transaction committed before seeding; :func:`app.database.seed.seed`
    then inserts the demo dataset and commits its own transaction. On any error
    the partial transaction is rolled back so the connection is left clean.

    This is destructive: it unconditionally drops the domain tables. It is meant
    for development/demo databases only.
    """
    from app.database.seed import seed

    schema_ddl = _read_schema_sql()

    try:
        with conn.cursor() as cur:
            cur.execute(_DROP_SQL)
            cur.execute(schema_ddl)
        conn.commit()
    except Exception:
        conn.rollback()
        raise

    # seed() runs in its own transaction and commits at the end.
    seed(conn)


def main() -> None:
    """Manual entry point: borrow a pooled connection and reset the database.

    Intended for ad-hoc dev runs via ``python -m app.database.reset``. Never
    called by application code.
    """
    from app.database.connection import get_pool

    pool = get_pool()
    with pool.connection() as conn:
        reset(conn)
    print(
        "Reset complete: dropped tables, recreated schema, and reseeded demo data."
    )


if __name__ == "__main__":
    main()
