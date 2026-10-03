"""Auth feature DTOs (Pydantic schemas only, no logic).

Request/response shapes for the lightweight MVP login flow. The service layer
holds the matching rules; these schemas just define the wire contract.

See design.md (*SoT: Roles/Auth*) and requirements 1.1 and 1.2.
"""

from typing import Optional

from pydantic import BaseModel

from app.constants import Role  # Literal["teacher", "learner"]


class LoginRequest(BaseModel):
    """Login payload: a teacher logs in by `name`, a learner by `lrn`."""

    name: Optional[str] = None  # teacher login
    lrn: Optional[str] = None   # learner login


class UserOut(BaseModel):
    """Resolved user returned by login and `GET /auth/me`."""

    id: int
    name: str
    role: Role
    classroom_id: Optional[int] = None
