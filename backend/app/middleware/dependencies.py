"""FastAPI request dependencies for minimal identity and role gating.

Security in this MVP is intentionally lightweight (*SoT: Roles/Auth*): a single
``X-User-Id`` header identifies the caller. There are no PINs, cookies, tokens,
or rate limiting. These dependencies resolve the Current_User for a request and
gate teacher-only routes.

- ``get_current_user`` reads the ``X-User-Id`` header, loads the matching user
  row, and raises ``401`` when the header is missing, non-numeric, or does not
  match an existing user (Requirements 1.6, 1.7).
- ``require_teacher`` depends on ``get_current_user`` and raises ``403`` when the
  resolved user is not a teacher (Requirement 1.8).

This is **not** production security and must be revisited before real data is
used. Because this is middleware-level identity resolution, it queries the
``users`` table directly rather than going through the repository layer.
"""

from __future__ import annotations

from typing import Optional

from fastapi import Depends, Header, HTTPException, status
from psycopg import Connection
from psycopg.rows import DictRow
from pydantic import BaseModel

from app.constants import ROLE_TEACHER, Role
from app.database.connection import get_db


class CurrentUser(BaseModel):
    """The user resolved from the ``X-User-Id`` header for a request.

    Includes ``is_active`` so downstream code can reason about learner status
    without a second lookup.
    """

    id: int
    name: str
    role: Role
    classroom_id: Optional[int] = None
    is_active: bool


def get_current_user(
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    db: Connection[DictRow] = Depends(get_db),
) -> CurrentUser:
    """Resolve the Current_User from the ``X-User-Id`` request header.

    Raises ``401`` when the header is absent, not an integer, or does not match
    an existing user row (Requirements 1.6 and 1.7).
    """
    if x_user_id is None or x_user_id.strip() == "":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing X-User-Id header.",
        )

    try:
        user_id = int(x_user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid X-User-Id header.",
        )

    with db.cursor() as cur:
        cur.execute(
            """
            SELECT id, name, role, classroom_id, is_active
            FROM users
            WHERE id = %s
            """,
            (user_id,),
        )
        row = cur.fetchone()

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unknown user.",
        )

    return CurrentUser(
        id=row["id"],
        name=row["name"],
        role=row["role"],
        classroom_id=row["classroom_id"],
        is_active=row["is_active"],
    )


def require_teacher(
    current_user: CurrentUser = Depends(get_current_user),
) -> CurrentUser:
    """Gate a teacher-only route, raising ``403`` for non-teachers (Req 1.8)."""
    if current_user.role != ROLE_TEACHER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Teacher role required.",
        )
    return current_user
