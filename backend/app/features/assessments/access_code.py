"""Access-code generation for assessment batches (*SoT: Scheduling*).

A :term:`Batch` is identified by a 6-character uppercase alphanumeric
``access_code``. :func:`generate_access_code` is a **pure** function: given the
set of codes already in use, it returns a fresh code matching ``^[A-Z0-9]{6}$``
that is not in that set. It performs no I/O — the caller (the scheduling
service) reads the existing codes from the repository and passes them in — so
this logic lives here rather than in the repository (SQL only) or the service
(orchestration).

Randomness comes from :mod:`secrets` (cryptographically strong) rather than
:mod:`random`, which is unsuitable for generating unguessable join codes.

See design.md ("Key Functions with Formal Specifications — generate_access_code")
and requirement 5.2.
"""

from __future__ import annotations

import secrets
from typing import AbstractSet

# The alphabet for access codes: uppercase A-Z and digits 0-9. This exactly
# spans the ``^[A-Z0-9]{6}$`` pattern required for an Access_Code.
_ACCESS_CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
_ACCESS_CODE_LENGTH = 6


def generate_access_code(existing: AbstractSet[str]) -> str:
    """Return a unique 6-char uppercase alphanumeric code not in ``existing``.

    Draws each of the 6 characters uniformly from ``A-Z0-9`` using
    :func:`secrets.choice` and loops until the generated code is not already
    present in ``existing``. With a 36-character alphabet there are 36**6 (~2.2
    billion) possible codes, so collisions against a classroom-sized set are
    rare and the loop terminates quickly.

    Args:
        existing: The set of access codes already in use (e.g. every code across
            all existing assessments). Membership is checked with ``in``.

    Returns:
        A string matching ``^[A-Z0-9]{6}$`` that is not a member of ``existing``.

    This is a pure function: it does not mutate ``existing`` and performs no I/O.
    """
    while True:
        code = "".join(
            secrets.choice(_ACCESS_CODE_ALPHABET)
            for _ in range(_ACCESS_CODE_LENGTH)
        )
        if code not in existing:
            return code
