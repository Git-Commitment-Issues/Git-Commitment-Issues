"""Timezone-aware date helpers.

All "today" comparisons in the system use the configured timezone, which
defaults to ``Asia/Manila`` (see Requirement 8.8). The timezone is driven by
``config.TIMEZONE`` so a deployment can override it via the ``TIMEZONE``
environment variable.
"""

from __future__ import annotations

import os
from datetime import date, datetime
from zoneinfo import ZoneInfo

DEFAULT_TIMEZONE = "Asia/Manila"


def _configured_timezone() -> str:
    """Resolve the configured timezone name.

    Prefers ``app.config.settings.TIMEZONE``; falls back to the ``TIMEZONE``
    environment variable, then to ``Asia/Manila``. The fallbacks keep this
    helper usable even before the settings loader (``config.py``) is wired.
    """
    try:
        from app.config import settings  # local import to avoid hard dependency

        tz = getattr(settings, "TIMEZONE", None)
        if tz:
            return tz
    except Exception:
        pass

    return os.environ.get("TIMEZONE") or DEFAULT_TIMEZONE


def manila_now() -> datetime:
    """Return the current timezone-aware datetime in the configured timezone."""
    return datetime.now(ZoneInfo(_configured_timezone()))


def manila_today() -> date:
    """Return the current date in the configured timezone (default Asia/Manila).

    Used for all "today" comparisons such as late-joiner backfill scope and
    assessment start-date gating.
    """
    return manila_now().date()
