"""Auth feature service — login rules and current-user mapping, no SQL.

Per the strictly layered architecture (*SoT: router → service → repository*),
this module holds **all** auth business rules and makes **no** SQL calls of its
own: it delegates every lookup to :mod:`app.features.auth.repository`. Routers
call into this service and map its results to response schemas; the service
never touches the database directly.

Login resolution (*SoT: Roles/Auth*):

- A **teacher** logs in by ``name`` (case-insensitive match, Requirement 1.1).
- A **learner** logs in by ``lrn`` (Learner Reference Number, Requirement 1.2).
- Missing credentials (neither / both empty) are rejected ``400`` (Req 1.3).
- No matching user is rejected ``401`` (Requirement 1.4).
- A matched but inactive learner is rejected ``401`` (Requirement 1.5).

The service returns :class:`~app.features.auth.schemas.UserOut`, so routers can
map it straight to the wire without reshaping.
"""

from __future__ import annotations

from typing import Optional

from fastapi import HTTPException, status
from psycopg import Connection
from psycopg.rows import DictRow

from app.features.auth.repository import (
    find_learner_by_lrn,
    find_teacher_by_name,
)
from app.features.auth.schemas import LoginRequest, UserOut


def _is_blank(value: Optional[str]) -> bool:
    """Return ``True`` when ``value`` is ``None`` or only whitespace.

    A credential that is missing, empty, or whitespace-only does not count as
    "provided" for the purposes of Requirement 1.3.
    """
    return value is None or value.strip() == ""


def _row_to_user_out(row: DictRow) -> UserOut:
    """Map a ``users`` row (mapping) to the :class:`UserOut` DTO.

    Only the four fields on the login/identity contract are copied
    (``id``, ``name``, ``role``, ``classroom_id``); any extra columns such as
    ``is_active`` on the row are intentionally dropped from the response.
    """
    return UserOut(
        id=row["id"],
        name=row["name"],
        role=row["role"],
        classroom_id=row["classroom_id"],
    )


def login(db: Connection[DictRow], request: LoginRequest) -> UserOut:
    """Resolve a login request to a :class:`UserOut`, or raise an ``HTTPException``.

    Rules (*SoT: Roles/Auth*):

    - If neither ``name`` nor ``lrn`` is provided (both missing/blank), raise
      ``400`` indicating missing credentials (Requirement 1.3).
    - If ``name`` is provided, match a teacher case-insensitively; no match
      raises ``401`` (Requirements 1.1 and 1.4).
    - Otherwise ``lrn`` is provided: match a learner; no match raises ``401``
      (Requirements 1.2 and 1.4); a matched but inactive learner raises ``401``
      (Requirement 1.5).

    A provided teacher ``name`` takes precedence over ``lrn`` when both are
    present, consistent with teacher login being by name.
    """
    name_provided = not _is_blank(request.name)
    lrn_provided = not _is_blank(request.lrn)

    # Requirement 1.3 — neither credential supplied.
    if not name_provided and not lrn_provided:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing credentials: provide a teacher name or a learner LRN.",
        )

    # Requirement 1.1 — teacher login by case-insensitive name.
    if name_provided:
        assert request.name is not None  # narrowed by name_provided
        teacher = find_teacher_by_name(db, request.name.strip())
        if teacher is None:
            # Requirement 1.4 — no matching user.
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials.",
            )
        return _row_to_user_out(teacher)

    # Requirement 1.2 — learner login by LRN.
    assert request.lrn is not None  # narrowed by lrn_provided
    learner = find_learner_by_lrn(db, request.lrn.strip())
    if learner is None:
        # Requirement 1.4 — no matching user.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials.",
        )
    if not learner["is_active"]:
        # Requirement 1.5 — matched an Inactive_Learner.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials.",
        )
    return _row_to_user_out(learner)


def to_user_out(user: object) -> UserOut:
    """Map the resolved Current_User (or a ``users`` row) to :class:`UserOut`.

    Used by ``GET /auth/me`` (router task 5.4) to return the already-resolved
    Current_User without exposing internal fields like ``is_active``. Accepts
    either a ``CurrentUser`` model (from the identity middleware) or a raw
    ``users`` mapping row, copying only the ``id``, ``name``, ``role``, and
    ``classroom_id`` fields onto the response contract.
    """
    if isinstance(user, dict):
        return _row_to_user_out(user)
    return UserOut(
        id=user.id,
        name=user.name,
        role=user.role,
        classroom_id=user.classroom_id,
    )
