"""End-to-end smoke verification of the pipeline against the STUB AI client.

Run with::

    python -m app.scripts.smoke

What this script proves (Task 14.2; Requirements 8.4, 6.6)
----------------------------------------------------------
It walks the demo pipeline **in code** (never over HTTP), calling the feature
services directly on a single borrowed pooled connection, to show the system
runs end-to-end **without a live AI provider**:

1. Reset + seed the database (``app.database.reset.reset``).
2. Resolve the seeded teacher ("Ms. Reyes") and their classroom.
3. Schedule a batch of 4 questions for today
   (``assessments.service.schedule_batch``) -> get an ``access_code``.
4. For one learner in that batch: ``start_assessment``, persist typed answers,
   mark the assessment completed, then run the evaluation **synchronously** by
   calling ``evaluation.service.evaluate(conn, assessment_id)`` directly (the
   HTTP path enqueues this via ``BackgroundTasks``; the script bypasses that so
   it is deterministic and connection-local). The stub returns an all-``correct``
   response, so the assessment ends with a non-null ``comprehension_score`` of
   100.0 and ``diagnosis = on_track`` — proving the full
   schedule -> submit -> evaluate -> score/diagnose path completes against the
   stub (Requirement 8.4).
5. For a second learner: submit **all-blank** answers and evaluate. Code marks
   every answer ``missed`` and skips the AI call entirely; the result is
   ``comprehension_score = 0.0`` and ``diagnosis = highest_priority`` via the
   unoverridden-blank rule (Requirement 6.6).
6. Apply a teacher override (``reviews.service.override_answer``) on the first
   learner's assessment and assert the score/diagnosis recompute while the AI
   ``evaluation``/``recommendation`` narrative is left unchanged (Requirement
   5.5 invariant, exercised here as part of the demo path).

Each step prints a clear ``PASS``/``FAIL`` line; the process exits non-zero if
any assertion fails.

IMPORTANT — where this can actually run
---------------------------------------
This script requires a **live Postgres** reachable at ``DATABASE_URL`` AND a
working ``psycopg`` / ``libpq`` install, because it resets, seeds, and queries a
real database. It is **not** runnable on a machine where ``psycopg``/``libpq``
cannot load (e.g. a Windows host where an Application Control policy blocks the
native library). Run it in an environment wired to a real Supabase/Postgres
``DATABASE_URL`` with ``psycopg`` importable. It has been validated here by
``py_compile`` and static review against the service/repository signatures; it
has **not** been executed against a live database in that blocked environment.

The script talks to services and repositories only — it never computes scores or
diagnoses itself, so what it asserts is exactly what the production code paths
produce.
"""

from __future__ import annotations

import sys
from dataclasses import dataclass

from psycopg import Connection
from psycopg.rows import DictRow

from app.constants import (
    DIAGNOSIS_HIGHEST_PRIORITY,
    DIAGNOSIS_ON_TRACK,
    ROLE_LEARNER,
    ROLE_TEACHER,
    STATUS_COMPLETED,
    VERDICT_PARTIAL,
)
from app.database.connection import get_pool
from app.database.reset import reset
from app.datetime_utils import manila_today
from app.features.assessments import repository as assessments_repo
from app.features.assessments.schemas import CreateAssessmentRequest, QuestionIn
from app.features.assessments.service import schedule_batch, start_assessment
from app.features.evaluation.service import evaluate
from app.features.reviews.schemas import OverrideRequest
from app.features.reviews.service import override_answer


# ---------------------------------------------------------------------------
# Lightweight Current_User stand-in
# ---------------------------------------------------------------------------


@dataclass
class _StubUser:
    """Minimal stand-in for ``middleware.dependencies.CurrentUser``.

    The services only read ``.id`` (ownership checks) and ``.role`` from the
    user they are handed, so a tiny object with those two attributes is a
    faithful substitute for the real header-resolved user in this in-code run.
    """

    id: int
    role: str


# ---------------------------------------------------------------------------
# Reporting helpers
# ---------------------------------------------------------------------------

_failures = 0


def _check(label: str, ok: bool, detail: str = "") -> None:
    """Print a PASS/FAIL line for a step and record any failure."""
    global _failures
    if ok:
        print(f"PASS - {label}")
    else:
        _failures += 1
        suffix = f" ({detail})" if detail else ""
        print(f"FAIL - {label}{suffix}")


# ---------------------------------------------------------------------------
# Seeded-data lookups (read-only, via SQL — this is a dev script, not a feature)
# ---------------------------------------------------------------------------


def _resolve_teacher(conn: Connection[DictRow]) -> DictRow:
    """Return the seeded teacher row ("Ms. Reyes")."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, name, role, classroom_id FROM users "
            "WHERE role = %s ORDER BY id LIMIT 1",
            (ROLE_TEACHER,),
        )
        return cur.fetchone()


def _resolve_classroom_id(conn: Connection[DictRow], teacher_id: int) -> int:
    """Return the id of the classroom owned by the given teacher."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id FROM classrooms WHERE teacher_id = %s ORDER BY id LIMIT 1",
            (teacher_id,),
        )
        return cur.fetchone()["id"]


def _assessments_for_code(
    conn: Connection[DictRow], access_code: str
) -> list[DictRow]:
    """Return every assessment row in a batch, ordered by owning learner id."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, learner_id FROM assessments "
            "WHERE access_code = %s ORDER BY learner_id",
            (access_code,),
        )
        return cur.fetchall()


# ---------------------------------------------------------------------------
# Demo question set (3-5 questions, each a valid skill + non-empty fields)
# ---------------------------------------------------------------------------

_PASSAGE = (
    "The Lighthouse Keeper\n\n"
    "Every night, old Marco climbed the spiral stairs to light the great lamp. "
    "The ships at sea depended on its steady beam to find the harbor safely. "
    "One stormy evening the power failed, so Marco lit the old oil lantern by "
    "hand and kept it burning until dawn. Because of his care, every ship "
    "reached port without harm."
)

_QUESTIONS = [
    QuestionIn(
        question_text="What did Marco do every night?",
        skill="literal",
        expected_ideas="climbed the stairs, lit the great lamp",
    ),
    QuestionIn(
        question_text="Why did the ships depend on the lamp?",
        skill="inference",
        expected_ideas="to find the harbor safely, to avoid danger",
    ),
    QuestionIn(
        question_text="What does the word 'steady' suggest about the beam?",
        skill="vocabulary",
        expected_ideas="constant, reliable, unwavering",
    ),
    QuestionIn(
        question_text="Order the events of the stormy evening.",
        skill="sequencing",
        expected_ideas="power failed, lit the oil lantern, kept it burning until dawn",
    ),
]


# ---------------------------------------------------------------------------
# Pipeline steps
# ---------------------------------------------------------------------------


def _run(conn: Connection[DictRow]) -> None:
    """Execute the full in-code demo pipeline against the stub, with asserts."""
    # --- Step 1: reset + seed ------------------------------------------------
    reset(conn)
    _check("reset+seed completed", True)

    # --- Step 2: resolve the seeded teacher and classroom --------------------
    teacher_row = _resolve_teacher(conn)
    _check(
        "resolved seeded teacher",
        teacher_row is not None and teacher_row["role"] == ROLE_TEACHER,
        detail="no teacher found after seed" if teacher_row is None else "",
    )
    teacher = _StubUser(id=teacher_row["id"], role=teacher_row["role"])
    classroom_id = _resolve_classroom_id(conn, teacher.id)

    # --- Step 3: schedule a batch for today ----------------------------------
    request = CreateAssessmentRequest(
        classroom_id=classroom_id,
        title="Smoke Check: The Lighthouse Keeper",
        category="Fiction",
        passage_text=_PASSAGE,
        scheduled_for=manila_today(),
        questions=_QUESTIONS,
    )
    summary = schedule_batch(conn, request, teacher)
    access_code = summary["access_code"]
    _check(
        "scheduled batch (3-5 questions) and received access_code",
        isinstance(access_code, str)
        and len(access_code) == 6
        and summary["learner_count"] >= 1
        and summary["question_count"] == len(_QUESTIONS),
        detail=f"summary={summary}",
    )

    batch = _assessments_for_code(conn, access_code)
    _check(
        "batch created one assessment per active learner",
        len(batch) == summary["learner_count"] and len(batch) >= 2,
        detail=f"rows={len(batch)} expected={summary['learner_count']}",
    )

    # Two distinct learners/assessments: one answered, one all-blank.
    answered = batch[0]
    blank = batch[1]
    answered_learner = _StubUser(id=answered["learner_id"], role=ROLE_LEARNER)
    blank_learner = _StubUser(id=blank["learner_id"], role=ROLE_LEARNER)

    # --- Step 4: answered path -> start, submit (in code), evaluate ----------
    started = start_assessment(conn, answered["id"], answered_learner)
    _check(
        "started answered assessment (-> in_progress)",
        started["status"] == "in_progress",
        detail=f"status={started['status']}",
    )

    # Persist typed answers directly (the HTTP submit path saves these then
    # enqueues evaluation via BackgroundTasks; we save + evaluate inline).
    answered_answers = assessments_repo.load_answers(conn, answered["id"])
    for ans in answered_answers:
        assessments_repo.update_answer_text(
            conn, ans["id"], f"My answer to: {ans['question_text']}"
        )
    assessments_repo.set_assessment_status(
        conn, answered["id"], STATUS_COMPLETED, completed_at=True
    )

    # Run the stub evaluation synchronously on this same connection.
    evaluate(conn, answered["id"])

    evaluated = assessments_repo.get_assessment(conn, answered["id"])
    _check(
        "answered assessment scored by stub (non-null score, on_track)",
        evaluated is not None
        and evaluated["comprehension_score"] is not None
        and evaluated["comprehension_score"] == 100.0
        and evaluated["diagnosis"] == DIAGNOSIS_ON_TRACK
        and evaluated["evaluation_error"] is None,
        detail=(
            f"score={evaluated['comprehension_score']} "
            f"diagnosis={evaluated['diagnosis']} "
            f"error={evaluated['evaluation_error']}"
        ),
    )
    _check(
        "stub produced AI evaluation + recommendation narrative",
        evaluated["evaluation"] is not None
        and evaluated["recommendation"] is not None
        and evaluated["evaluated_by"] == "ai",
        detail=f"evaluated_by={evaluated['evaluated_by']}",
    )

    # --- Step 5: all-blank path -> AI skipped, highest_priority (Req 6.6) ----
    start_assessment(conn, blank["id"], blank_learner)
    # Submit nothing: leave every answer_text NULL, just complete + evaluate.
    assessments_repo.set_assessment_status(
        conn, blank["id"], STATUS_COMPLETED, completed_at=True
    )
    evaluate(conn, blank["id"])

    blank_result = assessments_repo.get_assessment(conn, blank["id"])
    _check(
        "all-blank assessment: AI skipped, score 0.0, highest_priority (Req 6.6)",
        blank_result is not None
        and blank_result["comprehension_score"] == 0.0
        and blank_result["diagnosis"] == DIAGNOSIS_HIGHEST_PRIORITY
        and blank_result["evaluation_error"] is None,
        detail=(
            f"score={blank_result['comprehension_score']} "
            f"diagnosis={blank_result['diagnosis']}"
        ),
    )
    # The stub's AI evaluation/recommendation are NOT written for an all-blank
    # submission (the AI call is skipped entirely).
    _check(
        "all-blank assessment skipped the AI narrative",
        blank_result["evaluation"] is None
        and blank_result["recommendation"] is None,
        detail=(
            f"evaluation={blank_result['evaluation']!r} "
            f"recommendation={blank_result['recommendation']!r}"
        ),
    )

    # --- Step 6: teacher override recompute, narrative unchanged (Req 5.5) ---
    # Capture the AI narrative before overriding so we can assert it is kept.
    eval_before = evaluated["evaluation"]
    reco_before = evaluated["recommendation"]
    score_before = evaluated["comprehension_score"]

    # Override the first answer of the answered assessment down to 'partial'.
    first_answer_id = answered_answers[0]["id"]
    result = override_answer(
        conn,
        first_answer_id,
        OverrideRequest(
            verdict=VERDICT_PARTIAL,
            note="Smoke-test override: partial credit on the first answer.",
        ),
    )

    after = assessments_repo.get_assessment(conn, answered["id"])
    # 4 questions, stub made all 4 'correct' (score 100.0). Overriding one to
    # 'partial' drops total points from 4.0 to 3.5 -> round(100*3.5/4,1)=87.5.
    _check(
        "override recomputed comprehension_score",
        result["comprehension_score"] == 87.5
        and after["comprehension_score"] == 87.5
        and after["comprehension_score"] != score_before,
        detail=(
            f"recomputed={result['comprehension_score']} "
            f"stored={after['comprehension_score']} before={score_before}"
        ),
    )
    _check(
        "override preserved AI evaluation + recommendation unchanged (Req 5.5)",
        after["evaluation"] == eval_before
        and after["recommendation"] == reco_before,
        detail="evaluation or recommendation changed on override",
    )

    # Commit so a human inspecting the DB after the run sees the final state.
    conn.commit()


def main() -> int:
    """Borrow a pooled connection, run the pipeline, and report overall result.

    Returns a process exit code: ``0`` when every step passed, ``1`` otherwise.
    """
    print("=== Reading Comprehension Screener — pipeline smoke test (stub AI) ===")
    pool = get_pool()
    with pool.connection() as conn:
        try:
            _run(conn)
        except Exception as exc:  # pragma: no cover - surfaced as a FAIL line
            conn.rollback()
            print(f"FAIL - pipeline raised an unexpected exception: {exc!r}")
            raise

    print("=" * 70)
    if _failures == 0:
        print("ALL STEPS PASSED - pipeline completed end-to-end against the stub.")
        return 0
    print(f"{_failures} STEP(S) FAILED.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
