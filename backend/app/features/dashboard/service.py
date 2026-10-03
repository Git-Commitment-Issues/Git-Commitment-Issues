"""Dashboard feature service — rules only, no SQL.

Per the strictly layered architecture (*SoT: router → service → repository*),
this module holds **all** dashboard business rules and makes **no** SQL calls
of its own: it delegates every read to
:mod:`app.features.dashboard.repository` (which holds the read-only aggregate
SQL) and returns plain mapping rows straight through. Routers call into this
service and map its results to the wire.

The service's one real decision is **batch resolution** (*SoT: Rules*,
Requirements 7.4 / 7.5), centralised in :func:`_resolve_batch`:

- **Explicit ``access_code`` (7.5).** When the caller names a batch, the batch
  must exist in the classroom *and* have at least one completed assessment for
  an active learner. If not, the service raises ``404`` reporting that no
  matching batch with a completed assessment was found — **without modifying any
  stored data** (every repository call it makes is a ``SELECT``).
- **Default batch (7.4).** When the caller omits ``access_code``, the service
  resolves the target to the most recent batch in the classroom that has at
  least one completed assessment. When the classroom has no completed batch yet,
  the service raises ``404``.

Once the batch is resolved, each aggregate function is a thin wrapper that calls
the matching repository query and returns its rows. The exclusion of inactive
learners (Requirement 7.1) and the read-only guarantee (Requirement 7.6) are
enforced by the repository SQL, not re-implemented here.

Return shape: dashboard payloads are plain ``dict``/``list`` passthroughs of the
repository rows. Each batch-scoped function returns ``{"access_code": ...,
"rows": ...}`` (or the single-object aggregate merged with ``access_code``) so
the caller always knows which batch the figures describe — including the one the
service picked by default.

Note: ``psycopg`` cannot run live in this environment, so the underlying queries
are not executed against a database here; this module is verified only for
Python syntax (``py_compile``). Live validation happens against the real
Supabase pooler.
"""

from __future__ import annotations

from typing import Any, Optional

from fastapi import HTTPException, status
from psycopg import Connection
from psycopg.rows import DictRow

from app.features.dashboard import repository


# --- Batch resolution (Requirements 7.4 / 7.5) -----------------------------


def _resolve_batch(
    db: Connection[DictRow],
    classroom_id: int,
    access_code: Optional[str],
) -> str:
    """Resolve the target batch's ``access_code`` for a dashboard aggregate.

    Centralises the batch-resolution policy shared by every batch-scoped
    aggregate so the rule lives in exactly one place:

    - **Explicit ``access_code`` (Requirement 7.5).** When ``access_code`` is
      provided, it must name a batch that exists in the classroom and has at
      least one completed assessment for an active learner, as checked by
      :func:`repository.batch_exists_with_completed`. If it does not, raise
      ``404`` reporting that no matching batch with a completed assessment was
      found. The check is a read-only ``SELECT``, so a bad code never modifies
      stored data. The validated code is returned unchanged.
    - **Default batch (Requirement 7.4).** When ``access_code`` is omitted,
      resolve to the most recent batch in the classroom with a completed
      assessment via :func:`repository.resolve_default_batch`. When the
      classroom has no completed batch yet (``None``), raise ``404``.

    Returns the resolved ``access_code``; raises :class:`HTTPException` 404
    otherwise.
    """
    if access_code is not None:
        if not repository.batch_exists_with_completed(
            db, classroom_id, access_code
        ):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=(
                    "No matching batch with a completed assessment was found "
                    f"for access_code {access_code!r}."
                ),
            )
        return access_code

    code = repository.resolve_default_batch(db, classroom_id)
    if code is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No completed batches yet for this classroom.",
        )
    return code


# --- Batch-scoped aggregates (resolve, then read) --------------------------


def get_needs_help(
    db: Connection[DictRow],
    classroom_id: int,
    access_code: Optional[str] = None,
) -> dict[str, Any]:
    """Return the "needs help" roster for the resolved batch.

    Resolves the target batch (Requirements 7.4 / 7.5), then returns the active
    learners flagged as needing help, lowest comprehension score first
    (Requirements 7.1, inactive-learner exclusion enforced in the repository
    SQL). The payload echoes the resolved ``access_code`` alongside the rows.
    """
    code = _resolve_batch(db, classroom_id, access_code)
    rows = repository.needs_help(db, classroom_id, code)
    return {"access_code": code, "rows": rows}


def get_skills(
    db: Connection[DictRow],
    classroom_id: int,
    access_code: Optional[str] = None,
) -> dict[str, Any]:
    """Return the per-skill percent-correct breakdown for the resolved batch.

    Resolves the target batch (Requirements 7.4 / 7.5), then returns the
    per-skill aggregates over active learners (Requirements 7.1 / 7.2, enforced
    in the repository SQL). The payload echoes the resolved ``access_code``
    alongside the rows.
    """
    code = _resolve_batch(db, classroom_id, access_code)
    rows = repository.skills_breakdown(db, classroom_id, code)
    return {"access_code": code, "rows": rows}


def get_questions(
    db: Connection[DictRow],
    classroom_id: int,
    access_code: Optional[str] = None,
) -> dict[str, Any]:
    """Return the most-missed questions for the resolved batch.

    Resolves the target batch (Requirements 7.4 / 7.5), then returns the batch's
    questions ordered by percent correct ascending — most-missed first
    (Requirements 7.1 / 7.2 / 7.3, enforced in the repository SQL). The payload
    echoes the resolved ``access_code`` alongside the rows.
    """
    code = _resolve_batch(db, classroom_id, access_code)
    rows = repository.most_missed_questions(db, classroom_id, code)
    return {"access_code": code, "rows": rows}


def get_override_rate(
    db: Connection[DictRow],
    classroom_id: int,
    access_code: Optional[str] = None,
) -> dict[str, Any]:
    """Return the teacher-override rate for the resolved batch.

    Resolves the target batch (Requirements 7.4 / 7.5), then returns the
    override-rate aggregate over active learners (Requirement 7.1, enforced in
    the repository SQL). The single repository row (``overridden`` / ``total`` /
    ``rate``) is merged into the payload alongside the resolved ``access_code``.
    """
    code = _resolve_batch(db, classroom_id, access_code)
    row = repository.override_rate(db, classroom_id, code)
    return {"access_code": code, **row}


# --- Non batch-scoped reads ------------------------------------------------


def list_batches(
    db: Connection[DictRow], classroom_id: int
) -> list[DictRow]:
    """Return the distinct batches in a classroom, newest first.

    No batch resolution is needed: this *is* the list of batches a teacher
    chooses from. Thin passthrough of the repository rows, which count active
    learners only (Requirement 7.1, enforced in the repository SQL).
    """
    return repository.list_batches(db, classroom_id)


def get_student_progress(
    db: Connection[DictRow], student_id: int
) -> list[DictRow]:
    """Return one learner's completed assessments over time, oldest first.

    No batch resolution is needed: this is a per-student history view. Thin
    passthrough of the repository rows. Progress intentionally returns the
    learner's own history regardless of their ``is_active`` flag, since
    deactivation preserves history (Requirement 7.1) and this teacher-only view
    plots comprehension over time.
    """
    return repository.student_progress(db, student_id)
