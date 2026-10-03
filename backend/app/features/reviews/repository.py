"""Reviews feature repository — all SQL for teacher overrides, no decisions.

Per the strictly layered architecture (*SoT: router → service → repository*),
this module holds **only** SQL against the ``answers`` and ``assessments``
tables. It makes no decisions: verdict validation, the ``COALESCE`` final-verdict
rule, score/diagnosis recomputation, and the "set now()" vs "clear" branch all
live in the reviews service and the pure ``scoring`` module. This layer simply
sets/clears the override columns, reloads the answer rows the service needs to
recompute final verdicts, and persists the recomputed score and diagnosis.

Critically, the override write path **never** touches ``evaluation`` or
``recommendation`` (*SoT: Rules — "evaluation / recommendation are never
rewritten on override"*; Requirement 5.5). ``set_score_and_diagnosis`` updates
only ``comprehension_score`` and ``diagnosis``, leaving the AI narrative fields
invariant under any number of overrides.

Every query is parameterized (no string interpolation of inputs) to avoid SQL
injection. Functions accept a ``psycopg`` connection configured with the
``dict_row`` factory (see ``app.database.connection.get_db``); writes are
committed by the surrounding request/transaction scope, not here.

Requirements covered:
- 5.5 — recompute ``comprehension_score``/``diagnosis`` from the final verdicts
  while preserving ``evaluation``/``recommendation`` unchanged.
- 5.7 — set the override (``teacher_override``, ``overridden_at = now()``,
  ``override_note``) or clear it (all three back to ``NULL``).
"""

from __future__ import annotations

from typing import Optional

from psycopg import Connection
from psycopg.rows import DictRow


def get_answer(
    db: Connection[DictRow], answer_id: int
) -> Optional[DictRow]:
    """Return a single answer row by primary key, or ``None`` if not found.

    Selects the fields the service needs to apply and describe an override:
    the answer's ``id``, its owning ``assessment_id`` (used to reload the
    assessment's answers and recompute), the current override columns
    (``teacher_override``, ``overridden_at``, ``override_note``), the
    ``answer_text`` (blank answers participate in diagnosis), and the AI's
    ``ai_verdict`` (the other half of the ``COALESCE`` final-verdict rule).

    Returns the answer row, or ``None`` when no answer has that id.
    """
    with db.cursor() as cur:
        cur.execute(
            """
            SELECT id,
                   assessment_id,
                   teacher_override,
                   overridden_at,
                   override_note,
                   answer_text,
                   ai_verdict
            FROM answers
            WHERE id = %s
            """,
            (answer_id,),
        )
        return cur.fetchone()


def get_assessment_id_for_answer(
    db: Connection[DictRow], answer_id: int
) -> Optional[int]:
    """Return the ``assessment_id`` owning an answer, or ``None`` if not found.

    A narrow lookup for callers that only need the owning assessment id (the
    broader :func:`get_answer` already returns ``assessment_id`` as well).
    """
    with db.cursor() as cur:
        cur.execute(
            """
            SELECT assessment_id
            FROM answers
            WHERE id = %s
            """,
            (answer_id,),
        )
        row = cur.fetchone()
        return row["assessment_id"] if row is not None else None


def set_override(
    db: Connection[DictRow],
    answer_id: int,
    verdict: str,
    note: Optional[str],
) -> None:
    """Set a teacher override on an answer, stamping ``overridden_at = now()``.

    The service calls this only after validating ``verdict`` is exactly one of
    ``correct``/``partial``/``missed`` (Requirement 5.7). ``overridden_at`` is
    set to the database ``now()`` so the learner-view correction-alert
    comparison (``overridden_at > corrections_seen_at``) uses a server
    timestamp. ``override_note`` is stored as provided (may be ``None``).

    This statement does not touch ``evaluation`` or ``recommendation`` — those
    live on the ``assessments`` table and are never rewritten on override
    (Requirement 5.5).
    """
    with db.cursor() as cur:
        cur.execute(
            """
            UPDATE answers
            SET teacher_override = %s,
                overridden_at = now(),
                override_note = %s
            WHERE id = %s
            """,
            (verdict, note, answer_id),
        )


def clear_override(db: Connection[DictRow], answer_id: int) -> None:
    """Clear a teacher override, returning the answer to its AI verdict.

    Sets ``teacher_override``, ``overridden_at``, and ``override_note`` all back
    to ``NULL`` (Requirement 5.7). After clearing, the answer's final verdict
    reverts to ``COALESCE(teacher_override, ai_verdict) = ai_verdict``. Like
    :func:`set_override`, this leaves ``evaluation``/``recommendation``
    untouched.
    """
    with db.cursor() as cur:
        cur.execute(
            """
            UPDATE answers
            SET teacher_override = NULL,
                overridden_at = NULL,
                override_note = NULL
            WHERE id = %s
            """,
            (answer_id,),
        )


def load_answers(
    db: Connection[DictRow], assessment_id: int
) -> list[DictRow]:
    """Reload an assessment's answer rows ordered by ``id`` ascending.

    Called after an override is set or cleared so the service can recompute the
    final verdicts (``COALESCE(teacher_override, ai_verdict)``), the
    ``comprehension_score``, and the ``diagnosis`` from the fresh state. The
    ascending ``id`` order matches how answers display throughout the product
    (*SoT: Data Model*). Includes ``ai_verdict`` and ``teacher_override`` (the
    two halves of the final-verdict rule) and ``answer_text`` (an unoverridden
    blank forces the ``highest_priority`` diagnosis).

    Returns a (possibly empty) list of answer rows.
    """
    with db.cursor() as cur:
        cur.execute(
            """
            SELECT id,
                   assessment_id,
                   answer_text,
                   ai_verdict,
                   teacher_override,
                   overridden_at,
                   override_note
            FROM answers
            WHERE assessment_id = %s
            ORDER BY id ASC
            """,
            (assessment_id,),
        )
        return cur.fetchall()


def set_score_and_diagnosis(
    db: Connection[DictRow],
    assessment_id: int,
    score: float,
    diagnosis: str,
) -> None:
    """Persist the recomputed ``comprehension_score`` and ``diagnosis`` only.

    Both values are computed by the pure ``scoring`` module from the final
    verdicts after an override; the repository merely persists them. This
    statement updates exactly two columns and deliberately does **not** touch
    ``evaluation`` or ``recommendation``, enforcing the invariant that the AI
    narrative is never rewritten on override (Requirement 5.5; *SoT: Rules*).
    """
    with db.cursor() as cur:
        cur.execute(
            """
            UPDATE assessments
            SET comprehension_score = %s,
                diagnosis = %s
            WHERE id = %s
            """,
            (score, diagnosis, assessment_id),
        )
