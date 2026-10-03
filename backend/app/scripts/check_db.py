"""Standalone Supabase connectivity check.

Run with::

    python -m app.scripts.check_db

A self-contained diagnostic that proves the backend can actually reach the
Supabase Postgres database configured in ``backend/.env`` (``DATABASE_URL``).
It does NOT go through the FastAPI app or the connection pool — it opens one
direct psycopg connection, runs a few read-only queries, and prints a clear
report. Read-only: it never writes, drops, or seeds anything.

Exit code 0 on success, 1 on any failure, so it is usable in scripts/CI.
"""

from __future__ import annotations

import sys
import time


def _mask_dsn(dsn: str) -> str:
    """Return the DSN with the password obscured, for safe printing."""
    # postgresql://user:PASSWORD@host:port/db  ->  hide between ':' and '@'
    try:
        scheme_sep = dsn.index("://") + 3
        at = dsn.index("@", scheme_sep)
        creds = dsn[scheme_sep:at]
        if ":" in creds:
            user, _pw = creds.split(":", 1)
            return dsn[:scheme_sep] + user + ":***@" + dsn[at + 1 :]
    except ValueError:
        pass
    return dsn


def main() -> int:
    print("=== Supabase connectivity check ===")

    # 1. Load config (fails fast if DATABASE_URL / CORS_ORIGINS are missing).
    try:
        from app.config import settings
    except Exception as exc:  # noqa: BLE001 - report any config error plainly
        print(f"FAIL - could not load config: {exc!r}")
        return 1

    dsn = settings.DATABASE_URL
    print(f"Target: {_mask_dsn(dsn)}")

    # 2. Import the driver.
    try:
        import psycopg
    except Exception as exc:  # noqa: BLE001
        print(f"FAIL - psycopg import failed: {exc!r}")
        return 1

    # 3. Open ONE direct connection (no pool) with a bounded timeout.
    started = time.monotonic()
    try:
        conn = psycopg.connect(dsn, connect_timeout=15)
    except Exception as exc:  # noqa: BLE001
        print(f"FAIL - could not connect: {exc!r}")
        return 1
    connect_ms = (time.monotonic() - started) * 1000
    print(f"PASS - connected in {connect_ms:.0f} ms")

    ok = True
    try:
        with conn.cursor() as cur:
            # 3a. Prove we are really talking to Postgres and which one.
            cur.execute("select version()")
            print("PASS - server:", cur.fetchone()[0].split(" on ")[0])

            cur.execute("select current_database(), current_user, now()")
            db, user, now = cur.fetchone()
            print(f"PASS - database={db} user={user} server_time={now}")

            # 3b. Confirm the expected tables exist in the public schema.
            cur.execute(
                """
                select table_name
                from information_schema.tables
                where table_schema = 'public'
                order by table_name
                """
            )
            tables = [r[0] for r in cur.fetchall()]
            expected = {"answers", "assessments", "classrooms", "users"}
            present = expected.intersection(tables)
            if present == expected:
                print(f"PASS - all expected tables present: {sorted(expected)}")
            else:
                missing = sorted(expected - present)
                print(f"WARN - missing tables: {missing} (run: python -m app.database.reset)")
                ok = False

            # 3c. Row counts, so you can see live data is really there.
            for table in ("classrooms", "users", "assessments", "answers"):
                if table in tables:
                    cur.execute(f"select count(*) from {table}")
                    print(f"      {table}: {cur.fetchone()[0]} rows")

            # 3d. Confirm the seeded teacher is reachable (a real read).
            if "users" in tables:
                cur.execute(
                    "select id, name from users where role = 'teacher' order by id limit 1"
                )
                row = cur.fetchone()
                if row:
                    print(f"PASS - teacher row: id={row[0]} name={row[1]!r}")
                else:
                    print("WARN - no teacher row found (database not seeded?)")
    except Exception as exc:  # noqa: BLE001
        print(f"FAIL - query error: {exc!r}")
        ok = False
    finally:
        conn.close()

    print("=" * 36)
    if ok:
        print("RESULT: Supabase is being hit and responding. [OK]")
        return 0
    print("RESULT: Connected, but something was off (see WARN/FAIL above).")
    return 1


if __name__ == "__main__":
    sys.exit(main())