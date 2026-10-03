"""Database connection pool and FastAPI ``get_db`` dependency.

This module wires a real ``psycopg`` (v3) connection pool against the Supabase
pooler connection string from ``settings.DATABASE_URL`` (Requirement 8.3). It is
part of the boilerplate goal: wired for real from environment configuration,
yet import-safe so the application module graph can be imported without a live
database (pool creation is lazy and does not block on an initial connection).

Consumers obtain a connection via FastAPI dependency injection::

    from fastapi import Depends
    from app.database.connection import get_db

    def my_route(db = Depends(get_db)):
        with db.cursor() as cur:
            cur.execute("SELECT 1")
            ...

The dependency yields a pooled connection with a dict row factory, so
repositories receive rows as mappings. The connection is returned to the pool
when the request finishes; the surrounding transaction is committed on success
and rolled back if the handler raises.
"""

from __future__ import annotations

from typing import Iterator

from psycopg import Connection
from psycopg.rows import dict_row, DictRow
from psycopg_pool import ConnectionPool

from app.config import settings


# Module-level singleton pool, created lazily on first use so importing this
# module (and therefore the whole app) never requires a live database.
_pool: ConnectionPool | None = None


def get_pool() -> ConnectionPool:
    """Return the process-wide connection pool, creating it on first call.

    The pool is opened with ``open=False`` and then explicitly opened without
    waiting for an initial connection, so pool creation never blocks or raises
    when the database is temporarily unreachable (Render free instances sleep;
    import must stay fast and offline-safe). Connections are configured with a
    dict row factory so repositories receive mapping rows.
    """
    global _pool
    if _pool is None:
        _pool = ConnectionPool(
            conninfo=settings.DATABASE_URL,
            open=False,
            kwargs={"row_factory": dict_row},
        )
        # Open without waiting: do not require a live DB at construction time.
        _pool.open(wait=False)
    return _pool


def close_pool() -> None:
    """Close the connection pool if it has been created.

    Intended for application shutdown. Safe to call when no pool exists.
    """
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None


def get_db() -> Iterator[Connection[DictRow]]:
    """FastAPI dependency yielding a pooled database connection.

    Borrows a connection from the pool for the duration of the request and
    returns it afterwards. The connection runs in a transaction that is
    committed when the request completes successfully and rolled back if the
    handler raises, keeping writes atomic per request.
    """
    pool = get_pool()
    with pool.connection() as conn:
        try:
            yield conn
        except Exception:
            conn.rollback()
            raise
        else:
            conn.commit()
