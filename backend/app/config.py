"""Environment-driven application settings.

Configuration is loaded once at import time from environment variables (and a
local ``.env`` file via ``python-dotenv``). The resulting :data:`settings`
object is the single source of truth consumed across the backend as
``from app.config import settings`` (see design.md *Entry layer / config.py*).

Loaded variables (Requirement 8.1):

- ``DATABASE_URL``  — Supabase pooler connection string (required).
- ``AI_API_KEY``    — chatbot provider key (optional until the provider lands).
- ``AI_BASE_URL``   — chatbot provider base URL (optional).
- ``AI_MODEL``      — chatbot model identifier (optional).
- ``CORS_ORIGINS``  — comma-separated allowed origins (required), parsed into a
  list of individual origins.
- ``TIMEZONE``      — timezone name for all "today" comparisons; defaults to
  ``Asia/Manila`` (Requirement 8.8).

Startup abort (Requirement 8.2): if ``DATABASE_URL`` or ``CORS_ORIGINS`` is
absent or empty, importing this module raises :class:`ConfigError` with a clear
message naming the missing variable, so the application fails fast at startup.
"""

from __future__ import annotations

import os
from typing import List

try:  # python-dotenv is listed in requirements.txt; stay importable without it.
    from dotenv import load_dotenv

    load_dotenv()
except Exception:  # pragma: no cover - absence of dotenv must not break import
    pass


DEFAULT_TIMEZONE = "Asia/Manila"

# Variables that must be present and non-empty for the app to start.
REQUIRED_VARS = ("DATABASE_URL", "CORS_ORIGINS")


class ConfigError(RuntimeError):
    """Raised at startup when required configuration is missing or invalid."""


def _get_required(name: str) -> str:
    """Return a required environment variable, aborting startup if it is unset.

    Treats an unset, empty, or whitespace-only value as missing and raises a
    :class:`ConfigError` naming the offending variable (Requirement 8.2).
    """
    value = os.environ.get(name)
    if value is None or value.strip() == "":
        raise ConfigError(
            f"Missing required environment variable: {name}. "
            f"Set {name} (see backend/.env.example) before starting the app."
        )
    return value.strip()


def _get_optional(name: str, default: str | None = None) -> str | None:
    """Return an optional environment variable, or ``default`` when unset/empty."""
    value = os.environ.get(name)
    if value is None or value.strip() == "":
        return default
    return value.strip()


def _parse_cors_origins(raw: str) -> List[str]:
    """Parse a comma-separated ``CORS_ORIGINS`` value into a list of origins.

    Whitespace around each entry is stripped and empty entries are discarded.
    Raises :class:`ConfigError` when no usable origin remains, since an empty
    allow-list is treated the same as a missing value (Requirement 8.2).
    """
    origins = [part.strip() for part in raw.split(",")]
    origins = [origin for origin in origins if origin]
    if not origins:
        raise ConfigError(
            "Missing required environment variable: CORS_ORIGINS. "
            "Provide at least one comma-separated origin (see backend/.env.example)."
        )
    return origins


class Settings:
    """Resolved application settings.

    Attributes mirror the environment variables in Requirement 8.1. The object
    is constructed once at module import and exposed as :data:`settings`.
    """

    def __init__(self) -> None:
        # Required — missing/empty aborts startup with a named error.
        self.DATABASE_URL: str = _get_required("DATABASE_URL")
        self.CORS_ORIGINS: List[str] = _parse_cors_origins(_get_required("CORS_ORIGINS"))

        # Optional — the AI stub ships without a live provider configured.
        self.AI_API_KEY: str | None = _get_optional("AI_API_KEY")
        self.AI_BASE_URL: str | None = _get_optional("AI_BASE_URL")
        self.AI_MODEL: str | None = _get_optional("AI_MODEL")

        # Defaulted — all "today" comparisons use this timezone (Requirement 8.8).
        self.TIMEZONE: str = _get_optional("TIMEZONE", DEFAULT_TIMEZONE) or DEFAULT_TIMEZONE

    def __repr__(self) -> str:  # pragma: no cover - debugging aid, redacts secrets
        return (
            "Settings("
            f"DATABASE_URL='***', "
            f"AI_API_KEY={'set' if self.AI_API_KEY else 'None'}, "
            f"AI_BASE_URL={self.AI_BASE_URL!r}, "
            f"AI_MODEL={self.AI_MODEL!r}, "
            f"CORS_ORIGINS={self.CORS_ORIGINS!r}, "
            f"TIMEZONE={self.TIMEZONE!r})"
        )


# Instantiated at import so startup fails fast when required config is missing.
settings = Settings()
