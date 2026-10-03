"""Auth feature router — HTTP endpoints for login and current-user lookup.

Per the strictly layered architecture (*SoT: router → service → repository*),
this router only parses the request and maps results to response schemas; all
login rules live in :mod:`app.features.auth.service`. It exposes two endpoints:

- ``POST /auth/login`` — resolve a :class:`LoginRequest` to a :class:`UserOut`
  (teacher by name, learner by LRN). See Requirements 1.1 and 1.2.
- ``GET /auth/me`` — return the Current_User resolved from the ``X-User-Id``
  header, mapped to :class:`UserOut`. See Requirement 1.6.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from psycopg import Connection
from psycopg.rows import DictRow

from app.database.connection import get_db
from app.features.auth import service
from app.features.auth.schemas import LoginRequest, UserOut
from app.middleware.dependencies import CurrentUser, get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=UserOut)
def login(
    request: LoginRequest,
    db: Connection[DictRow] = Depends(get_db),
) -> UserOut:
    """Resolve a login request to the matching user (Requirements 1.1, 1.2).

    Delegates all resolution rules to the service, which raises the appropriate
    ``400``/``401`` on missing credentials, no match, or an inactive learner.
    """
    return service.login(db, request)


@router.get("/me", response_model=UserOut)
def me(
    current_user: CurrentUser = Depends(get_current_user),
) -> UserOut:
    """Return the Current_User resolved from ``X-User-Id`` (Requirement 1.6)."""
    return service.to_user_out(current_user)
