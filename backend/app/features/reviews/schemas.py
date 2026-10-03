"""Pydantic DTOs for the reviews feature — teacher overrides.

These are DTOs only, with no business logic (*SoT: Layer Rules*). The reviews
router parses the request body into an :class:`OverrideRequest`; the reviews
service applies the validation and recompute rules.

The ``verdict`` field is typed as ``Optional[Verdict]`` (``Verdict`` is the
``Literal["correct", "partial", "missed"]`` from :mod:`app.constants`), so
Pydantic rejects any value outside ``correct``/``partial``/``missed``/``null``
with a ``422`` at the router before the service runs (Requirement 5.7). A
``null`` ``verdict`` is the explicit "clear this override" signal.

See design.md ("Pydantic schemas (DTOs) — review") and requirement 5.7.
"""

from typing import Optional

from pydantic import BaseModel

from app.constants import Verdict


class OverrideRequest(BaseModel):
    """Teacher override request body for ``PATCH /answers/{id}/override``.

    - ``verdict``: the override verdict to apply, one of ``correct``,
      ``partial``, or ``missed``; ``None`` clears any existing override
      (Requirement 5.7).
    - ``note``: an optional free-text teacher note stored alongside a set
      override; ignored when clearing.
    """

    verdict: Optional[Verdict] = None  # null clears the override
    note: Optional[str] = None
