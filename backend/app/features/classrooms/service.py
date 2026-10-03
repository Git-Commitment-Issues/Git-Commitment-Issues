"""Classrooms + roster feature service — rules only, no SQL.

Per the strictly layered architecture (*SoT: router → service → repository*),
this module holds **all** classroom/roster business rules and makes **no** SQL
calls of its own: it delegates every read/write to
:mod:`app.features.classrooms.repository` and returns Pydantic DTOs from
:mod:`app.features.classrooms.schemas`. Routers call into this service and map
its results straight to the wire; the service never touches the database
directly.

Covered here (tasks 6.3 and 6.4 implemented as one coherent module):

- 2.1 / 2.2 — create a classroom with a 1–100 char name, else reject 422.
- 2.3 — create active ``role = 'learner'`` records from roster entries.
- 2.4 — default a learner name to ``Learner <last 4 of LRN>`` when omitted.
- 2.5 — skip an LRN that already exists and report it as *skipped*.
- 2.6 — skip malformed / non-12-digit entries and report them as *invalid*
  without aborting the rest of the batch.
- 2.7 — update learner ``name`` / ``learner_reference_number`` /
  ``classroom_id`` / ``is_active`` and bump ``updated_at`` (the repository sets
  the timestamp).
- 2.8 — deactivation sets ``is_active = false`` and retains the record and its
  assessment history (no delete).
- 2.9 — late-joiner backfill: when a learner is added to a classroom (single,
  bulk, or moved in via update), create assessment and answer rows for every
  existing batch whose ``scheduled_for >= Manila_Date``.

Late-joiner backfill (Requirement 2.9) is implemented by
:func:`backfill_future_batches` and wired at module import via
:func:`set_backfill_hook`. Both single-add and bulk-create route every new
learner through :func:`_create_active_learner`, which invokes the installed
``backfill_hook`` once per created learner with ``(db, learner_row)``. The
"move a learner into a classroom" path in :func:`update_student` triggers the
same backfill directly when it changes ``classroom_id``. The module-level
:data:`backfill_hook` remains an extension point (settable to a no-op in tests
via ``set_backfill_hook(None)``).
"""

from __future__ import annotations

from typing import Any, Callable, Optional

from fastapi import HTTPException, status
from psycopg import Connection
from psycopg.rows import DictRow

from app.datetime_utils import manila_today
from app.features.classrooms import repository
from app.features.classrooms.schemas import (
    BulkRosterResult,
    ClassroomOut,
    StudentCreateRequest,
    StudentOut,
    StudentUpdateRequest,
)

# --- Constants -------------------------------------------------------------

#: Inclusive classroom-name length bounds (Requirements 2.1 / 2.2).
_NAME_MIN_LEN = 1
_NAME_MAX_LEN = 100

#: An LRN is exactly 12 ASCII digits (Requirements 2.3 / 2.6).
_LRN_LENGTH = 12


# --- Backfill extension point (wired by task 6.5) --------------------------

#: Hook invoked once per newly created learner so late-joiner backfill
#: (Requirement 2.9) can create assessment/answer rows for every future batch in
#: the learner's classroom. Task 6.5 replaces this no-op by assigning
#: :func:`set_backfill_hook`. Signature: ``(db, learner_row) -> None`` where
#: ``learner_row`` is the mapping returned by ``repository.insert_learner``.
BackfillHook = Callable[[Connection[DictRow], DictRow], None]


def _noop_backfill(db: Connection[DictRow], learner_row: DictRow) -> None:
    """Default backfill hook: do nothing (overridden by task 6.5)."""


#: Module-level hook; task 6.5 wires in the real backfill via
#: :func:`set_backfill_hook`. Kept as a module global (not a parameter) so the
#: creation paths below need no signature change when backfill lands.
backfill_hook: BackfillHook = _noop_backfill


def set_backfill_hook(hook: Optional[BackfillHook]) -> None:
    """Install (or clear) the late-joiner backfill hook.

    Task 6.5 calls this at wiring time to connect its backfill implementation.
    Passing ``None`` restores the no-op default, which is useful for tests.
    """
    global backfill_hook
    backfill_hook = hook if hook is not None else _noop_backfill


# --- Reusable helpers ------------------------------------------------------


def is_valid_lrn(lrn: Optional[str]) -> bool:
    """Return ``True`` when ``lrn`` is exactly 12 ASCII digits.

    This is the single source of LRN-format truth for the roster rules
    (Requirements 2.3 and 2.6), reused by both the single-add and bulk-create
    paths. ``str.isdigit`` would accept non-ASCII digit characters, so the check
    is restricted to ASCII ``0``–``9`` to match the ``^\\d{12}$`` intent of a
    Learner Reference Number.
    """
    if lrn is None:
        return False
    return len(lrn) == _LRN_LENGTH and all("0" <= ch <= "9" for ch in lrn)


def default_learner_name(name: Optional[str], lrn: str) -> str:
    """Return a usable learner name, defaulting to ``Learner <last 4 of LRN>``.

    When ``name`` is missing, empty, or whitespace-only, the learner name
    defaults to ``Learner`` followed by the last four characters of the LRN
    (Requirement 2.4). A provided name is returned stripped of surrounding
    whitespace. Callers pass an already-validated 12-digit ``lrn``.
    """
    if name is not None and name.strip() != "":
        return name.strip()
    return f"Learner {lrn[-4:]}"


def _row_to_classroom_out(row: DictRow) -> ClassroomOut:
    """Map a ``classrooms`` row to the :class:`ClassroomOut` DTO."""
    return ClassroomOut(
        id=row["id"],
        name=row["name"],
        teacher_id=row["teacher_id"],
    )


def _row_to_student_out(row: DictRow) -> StudentOut:
    """Map a ``users`` (learner) row to the :class:`StudentOut` DTO.

    Only the roster-contract fields are copied; extra columns such as
    ``updated_at`` returned by ``repository.update_learner`` are dropped from the
    response shape.
    """
    return StudentOut(
        id=row["id"],
        name=row["name"],
        learner_reference_number=row["learner_reference_number"],
        classroom_id=row["classroom_id"],
        is_active=row["is_active"],
    )


def _create_active_learner(
    db: Connection[DictRow],
    *,
    name: Optional[str],
    lrn: str,
    classroom_id: int,
) -> StudentOut:
    """Insert one active learner, run the backfill hook, and return the DTO.

    Single funnel for every learner creation (single-add and bulk), so the
    name-defaulting rule (Requirement 2.4) and the late-joiner backfill hook
    (Requirement 2.9, wired by task 6.5) are applied uniformly. Callers must
    pass an already-validated 12-digit ``lrn`` and must have confirmed the LRN
    does not already exist.
    """
    resolved_name = default_learner_name(name, lrn)
    row = repository.insert_learner(
        db,
        name=resolved_name,
        lrn=lrn,
        classroom_id=classroom_id,
        is_active=True,
    )
    # Extension point for task 6.5: create assessment/answer rows for future
    # batches. No-op until 6.5 installs a real hook via set_backfill_hook.
    backfill_hook(db, row)
    return _row_to_student_out(row)


# --- Task 6.3: create classroom + student edits ----------------------------


def create_classroom(
    db: Connection[DictRow], name: str, teacher_id: int
) -> ClassroomOut:
    """Create a classroom after validating its name, and return it.

    Validates that the trimmed ``name`` is between 1 and 100 characters
    inclusive (Requirement 2.1); an empty/whitespace-only or over-length name is
    rejected with ``422`` naming the ``name`` field (Requirement 2.2). The
    validated (trimmed) name is persisted together with the creating teacher's
    ``teacher_id`` via the repository.
    """
    trimmed = name.strip() if name is not None else ""
    if not (_NAME_MIN_LEN <= len(trimmed) <= _NAME_MAX_LEN):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "Invalid classroom name: 'name' must be between "
                f"{_NAME_MIN_LEN} and {_NAME_MAX_LEN} characters."
            ),
        )

    row = repository.insert_classroom(db, trimmed, teacher_id)
    return _row_to_classroom_out(row)


def list_classrooms_by_teacher(
    db: Connection[DictRow], teacher_id: int
) -> list[ClassroomOut]:
    """Return the classrooms owned by ``teacher_id`` as DTOs.

    Thin passthrough so the router stays within the layering (*router → service
    → repository*): the repository supplies the rows (newest first) and the
    service maps each to :class:`ClassroomOut`.
    """
    return [
        _row_to_classroom_out(row)
        for row in repository.list_classrooms_by_teacher(db, teacher_id)
    ]


def list_active_students(
    db: Connection[DictRow], classroom_id: int
) -> list[StudentOut]:
    """Return the active learners of a classroom as DTOs.

    Thin passthrough preserving the layering (*router → service → repository*):
    the repository supplies the active-learner rows (ordered by name) and the
    service maps each to :class:`StudentOut`. Inactive learners are retained in
    storage but excluded from this roster view (Requirement 2.8).
    """
    return [
        _row_to_student_out(row)
        for row in repository.list_active_learners(db, classroom_id)
    ]


def update_student(
    db: Connection[DictRow],
    learner_id: int,
    update: StudentUpdateRequest,
) -> StudentOut:
    """Apply a partial learner update and return the updated roster row.

    Builds a change set from only the fields the caller actually provided
    (non-``None``) among ``name``, ``learner_reference_number``,
    ``classroom_id``, and ``is_active`` (Requirement 2.7). If no field was
    provided, rejects with ``400`` since there is nothing to change. The
    repository performs the update and sets ``updated_at`` to the current time.

    Deactivation is handled as an ordinary field update: setting
    ``is_active = false`` flips the flag while retaining the learner record and
    its assessment history (Requirement 2.8) — the repository never deletes.

    If no learner matches ``learner_id`` (the repository returns ``None``),
    rejects with ``404``.
    """
    fields: dict[str, Any] = {}
    if update.name is not None:
        fields["name"] = update.name
    if update.learner_reference_number is not None:
        fields["learner_reference_number"] = update.learner_reference_number
    if update.classroom_id is not None:
        fields["classroom_id"] = update.classroom_id
    if update.is_active is not None:
        fields["is_active"] = update.is_active

    if not fields:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No updatable fields provided.",
        )

    row = repository.update_learner(db, learner_id, fields)
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Learner not found.",
        )

    # Moving a learner into a (new) classroom is a late-joiner event: backfill
    # their assessment/answer rows for that classroom's future batches
    # (Requirement 2.9). The backfill skips any batch the learner already has,
    # so re-adding a learner to the same classroom is a safe no-op.
    if "classroom_id" in fields:
        backfill_hook(db, row)

    return _row_to_student_out(row)


def add_student(
    db: Connection[DictRow],
    classroom_id: int,
    req: StudentCreateRequest,
) -> StudentOut:
    """Add one learner to a classroom and return the created roster row.

    Validates that the LRN is exactly 12 digits (Requirement 2.3); a malformed
    LRN is rejected with ``422`` naming the field (Requirement 2.6). An LRN that
    already exists is rejected with ``409`` so the duplicate is not created
    (Requirement 2.5). On success a learner is created with ``role = 'learner'``,
    the parsed LRN, the ``classroom_id``, and ``is_active = true``; the name
    defaults to ``Learner <last 4 of LRN>`` when blank (Requirement 2.4).
    """
    lrn = req.learner_reference_number.strip() if req.learner_reference_number else ""
    if not is_valid_lrn(lrn):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "Invalid 'learner_reference_number': an LRN must be exactly "
                f"{_LRN_LENGTH} digits."
            ),
        )

    if repository.lrn_exists(db, lrn):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A learner with LRN {lrn} already exists.",
        )

    return _create_active_learner(
        db, name=req.name, lrn=lrn, classroom_id=classroom_id
    )


# --- Task 6.4: bulk roster parsing -----------------------------------------


def _parse_roster_line(line: str) -> Optional[tuple[str, Optional[str]]]:
    """Parse one roster line into ``(lrn, name)``, or ``None`` for a blank line.

    Each line is either ``LRN`` or ``LRN, Name`` (comma-separated). The first
    comma-delimited token is the LRN; everything after the first comma is the
    name (so names may themselves contain commas). Returns ``(lrn, None)`` when
    only an LRN is present, or ``(lrn, name)`` when a name follows. A line that
    is empty or whitespace-only yields ``None`` so the caller can skip it
    without counting it as invalid.

    This performs **no** LRN-format validation — that is the caller's job via
    :func:`is_valid_lrn` — so a non-digit token is still returned here and later
    reported as invalid (Requirement 2.6).
    """
    if line.strip() == "":
        return None

    head, sep, tail = line.partition(",")
    lrn = head.strip()
    if not sep:
        # No comma at all: the whole (stripped) line is the LRN.
        return lrn, None
    name = tail.strip()
    return lrn, (name if name != "" else None)


def parse_and_bulk_create(
    db: Connection[DictRow], classroom_id: int, raw_text: str
) -> BulkRosterResult:
    """Parse pasted roster text and create active learners from valid entries.

    Splits ``raw_text`` into lines and processes each non-empty line
    independently; a bad line never aborts the batch (Requirement 2.6). For each
    line:

    - Parse ``LRN`` or ``LRN, Name`` (first token = LRN, remainder = name).
    - If the LRN is not exactly 12 digits (or the line is otherwise malformed),
      append the original raw line to ``invalid`` and continue (Requirement 2.6).
    - If the LRN already exists, append it to ``skipped`` and continue
      (Requirement 2.5).
    - Otherwise create an active learner, defaulting the name to
      ``Learner <last 4 of LRN>`` when omitted (Requirements 2.3 and 2.4), and
      append the created :class:`StudentOut` to ``created``.

    LRNs that are valid but duplicated **within the same paste** are handled too:
    the first occurrence is created, and later occurrences are reported as
    ``skipped`` (the just-created LRN now exists). Returns a
    :class:`BulkRosterResult` with the ``created``, ``skipped``, and ``invalid``
    collections.
    """
    result = BulkRosterResult()
    # Track LRNs created in this batch so duplicates within the same paste are
    # reported as skipped even before the DB round-trip reflects them.
    seen_in_batch: set[str] = set()

    for raw_line in raw_text.splitlines():
        parsed = _parse_roster_line(raw_line)
        if parsed is None:
            # Blank/whitespace-only line: ignore entirely (not invalid).
            continue

        lrn, name = parsed

        if not is_valid_lrn(lrn):
            # Malformed or non-12-digit entry (Requirement 2.6).
            result.invalid.append(raw_line)
            continue

        if lrn in seen_in_batch or repository.lrn_exists(db, lrn):
            # Already exists (in DB or earlier in this paste) (Requirement 2.5).
            result.skipped.append(lrn)
            continue

        student = _create_active_learner(
            db, name=name, lrn=lrn, classroom_id=classroom_id
        )
        seen_in_batch.add(lrn)
        result.created.append(student)

    return result


# --- Task 6.5: late-joiner backfill ----------------------------------------


def backfill_future_batches(
    db: Connection[DictRow], learner_row: DictRow
) -> None:
    """Create assessment + answer rows for a late joiner's future batches.

    Implements Requirement 2.9: when a learner is added to a classroom (via
    single-add, bulk roster, or being moved into the classroom through an
    update), give them the same assessments as the batches already scheduled for
    that classroom. "Future" is scoped by the Manila date — every batch whose
    ``scheduled_for >= manila_today()`` — so a learner joining mid-term is caught
    up on everything still to come (and on anything scheduled for today) without
    retroactively creating rows for batches already in the past.

    For each future batch (one representative row per ``access_code`` from
    :func:`repository.list_future_batches`):

    - Skip the batch if the learner already has an assessment for that
      ``access_code`` (the ``unique (access_code, learner_id)`` constraint). This
      makes re-adding a learner — e.g. an update that sets ``classroom_id`` to a
      classroom they already belong to — a safe no-op instead of an integrity
      error.
    - Otherwise insert one ``scheduled`` assessment carrying the batch's shared
      ``title``, ``category``, ``passage_text``, ``access_code``, and
      ``scheduled_for``, then insert one unanswered answer row per question in
      the batch's question set (from :func:`repository.list_batch_questions`),
      copying ``question_text`` / ``skill`` / ``expected_ideas`` and leaving
      ``answer_text`` / verdicts ``NULL``.

    ``learner_row`` is the mapping returned by ``repository.insert_learner`` or
    ``repository.update_learner`` — it must carry ``id`` and ``classroom_id``.
    """
    learner_id = learner_row["id"]
    classroom_id = learner_row["classroom_id"]

    today = manila_today()

    for batch in repository.list_future_batches(db, classroom_id, today):
        access_code = batch["access_code"]

        # Respect unique(access_code, learner_id): never duplicate a batch the
        # learner already has (e.g. an update re-adding them to the classroom).
        if repository.learner_has_batch(db, access_code, learner_id):
            continue

        assessment = repository.insert_assessment(
            db,
            learner_id=learner_id,
            classroom_id=classroom_id,
            access_code=access_code,
            title=batch["title"],
            category=batch["category"],
            passage_text=batch["passage_text"],
            scheduled_for=batch["scheduled_for"],
            status="scheduled",
        )

        for question in repository.list_batch_questions(
            db, access_code, classroom_id
        ):
            repository.insert_answer(
                db,
                assessment_id=assessment["id"],
                question_text=question["question_text"],
                skill=question["skill"],
                expected_ideas=question["expected_ideas"],
            )


# Wire the real backfill at import time so every learner-creation path
# (_create_active_learner) triggers it (Requirement 2.9).
set_backfill_hook(backfill_future_batches)
