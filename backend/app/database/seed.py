"""Fake demo data seeder (dev only).

Populates the database with a small, self-consistent demo dataset so the system
can be walked end-to-end for a demo without a live AI provider or hand-entered
data (Requirements 8.3, 7.1). All data here is fabricated â€” names, learner
reference numbers (LRNs), passages, and answers are invented for demonstration.

Per the source of truth, ``seed`` creates:

- 1 teacher, "Ms. Reyes".
- 1 classroom owned by that teacher.
- 9 fake learners (within the 8â€“10 range), all active.
- 2 reading passages, reused across the scheduled batches.
- 3 completed batches (every learner has a completed, evaluated assessment),
  covering the full spread of diagnoses (on_track, comprehension_barrier,
  highest_priority) so the dashboards show meaningful aggregates.
- 1â€“2 teacher overrides, including one **unseen** correction â€” an override
  recorded after the learner last acknowledged corrections (so the learner-side
  "corrections" alert fires).
- 1 upcoming batch (scheduled in the future, not yet taken).
- One all-blank-answer assessment that resolves to ``highest_priority`` via the
  unoverridden-blank rule (Requirement 6.4 / Scoring_Module).

The module exposes :func:`seed`, which accepts an open ``psycopg`` connection
and does all its work with parameterized SQL (no string interpolation of
values). A thin :func:`main` is provided for manual runs; it borrows a
connection from the pool in :mod:`app.database.connection`.

Scoring note: scores and diagnoses are written here as *precomputed* demo
values that match what the Scoring_Module would produce from the seeded final
verdicts, so the seeded data is internally consistent with the live scoring
rules (``correct=1.0``, ``partial=0.5``, ``missed/blank=0.0``; ``<40`` or an
unoverridden blank â†’ highest_priority; ``[40,70)`` â†’ comprehension_barrier;
``>=70`` â†’ on_track).
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Optional, Sequence

from app.datetime_utils import manila_today


# --- Demo constants -------------------------------------------------------

TEACHER_NAME = "Ms. Reyes"
CLASSROOM_NAME = "Grade 4 - Mabini"

# Nine fabricated learners: (name, learner_reference_number). LRNs are 12-digit
# strings in the demo range 9999_0000_00NN, matching the roster format.
DEMO_LEARNERS: tuple[tuple[str, str], ...] = (
    ("Andoy Cruz", "999900000001"),
    ("Bea Santos", "999900000002"),
    ("Carlo Reyes", "999900000003"),
    ("Divina Lim", "999900000004"),
    ("Elias Tan", "999900000005"),
    ("Faye Garcia", "999900000006"),
    ("Gani Mercado", "999900000007"),
    ("Hazel Ong", "999900000008"),
    ("Ivan dela Cruz", "999900000009"),
)

# Two reusable passages. Kept short; realistic enough to demo the reader view.
PASSAGE_A = (
    "The Carabao and the Farmer\n\n"
    "Every morning before sunrise, Mang Tomas led his carabao to the rice "
    "field. The carabao was strong and patient, pulling the heavy plow through "
    "the wet soil without complaint. One hot afternoon, the carabao stopped "
    "under a mango tree to rest in its shade. Mang Tomas understood that even "
    "the hardest worker needs rest, so he waited beside the animal until the "
    "sun was low. From that day on, they always paused together in the "
    "afternoon, and the field was planted on time all the same."
)

PASSAGE_B = (
    "The Kite That Learned to Wait\n\n"
    "Liwayway wanted to fly her new kite the moment she finished building it, "
    "but the air was perfectly still. She ran across the field again and "
    "again, yet the kite only dragged along the grass. Her lola told her that "
    "a kite needs the wind as much as it needs a runner. So Liwayway sat on the "
    "hill and waited. When the afternoon breeze finally arrived, she stood, let "
    "out the string, and the kite rose high above the coconut trees."
)

# Four questions per passage: (question_text, skill, expected_ideas).
QUESTIONS_A: tuple[tuple[str, str, str], ...] = (
    (
        "Where did Mang Tomas take his carabao every morning?",
        "literal",
        "the rice field, to plow, before sunrise",
    ),
    (
        "Why did Mang Tomas wait beside the resting carabao?",
        "inference",
        "he understood the animal needed rest, respect for the worker",
    ),
    (
        "What does the word 'patient' tell us about the carabao?",
        "vocabulary",
        "calm, enduring, works without complaint",
    ),
    (
        "What happened after the carabao rested, and then what did they do daily?",
        "sequencing",
        "they resumed work, then paused together each afternoon, field planted on time",
    ),
)

QUESTIONS_B: tuple[tuple[str, str, str], ...] = (
    (
        "What did Liwayway want to do with her new kite?",
        "literal",
        "fly it, right after building it",
    ),
    (
        "Why could the kite not fly at first?",
        "inference",
        "the air was still, no wind, running was not enough",
    ),
    (
        "What does 'still' mean in the phrase 'the air was perfectly still'?",
        "vocabulary",
        "no movement, calm, no wind",
    ),
    (
        "Put the events in order: building, waiting, flying.",
        "sequencing",
        "built the kite, waited for the breeze, kite rose high",
    ),
)


# --- Low-level insert helpers (all parameterized) -------------------------


def _insert_teacher(cur, name: str) -> int:
    cur.execute(
        """
        insert into users (name, role, is_active)
        values (%s, 'teacher', true)
        returning id
        """,
        (name,),
    )
    return cur.fetchone()["id"]


def _insert_classroom(cur, name: str, teacher_id: int) -> int:
    cur.execute(
        """
        insert into classrooms (name, teacher_id)
        values (%s, %s)
        returning id
        """,
        (name, teacher_id),
    )
    return cur.fetchone()["id"]


def _insert_learner(
    cur, name: str, lrn: str, classroom_id: int, is_active: bool = True
) -> int:
    cur.execute(
        """
        insert into users (name, role, learner_reference_number, classroom_id, is_active)
        values (%s, 'learner', %s, %s, %s)
        returning id
        """,
        (name, lrn, classroom_id, is_active),
    )
    return cur.fetchone()["id"]


def _insert_assessment(
    cur,
    *,
    learner_id: int,
    classroom_id: int,
    access_code: str,
    title: str,
    category: str,
    passage_text: str,
    scheduled_for: date,
    status: str,
    completed_at_now: bool = False,
    comprehension_score: Optional[float] = None,
    diagnosis: Optional[str] = None,
    evaluation: Optional[str] = None,
    recommendation: Optional[str] = None,
    evaluated_by: Optional[str] = None,
    evaluation_error: Optional[str] = None,
    corrections_seen_days_ago: Optional[int] = None,
) -> int:
    """Insert one assessment row (one learner's slot in a batch).

    ``completed_at`` and ``corrections_seen_at`` are set with ``now()`` /
    ``now() - interval`` in SQL so timestamps are DB-consistent. ``scheduled_for``
    is a Manila-relative ``date`` computed by the caller.
    """
    cur.execute(
        """
        insert into assessments (
            learner_id, classroom_id, access_code, title, category,
            passage_text, scheduled_for, status,
            completed_at,
            comprehension_score, diagnosis, evaluation, recommendation,
            evaluated_by, evaluation_error,
            corrections_seen_at
        )
        values (
            %s, %s, %s, %s, %s,
            %s, %s, %s,
            case when %s::boolean then now() else null end,
            %s, %s, %s, %s,
            %s, %s,
            case when %s::int is null then null else now() - make_interval(days => %s::int) end
        )
        returning id
        """,
        (
            learner_id,
            classroom_id,
            access_code,
            title,
            category,
            passage_text,
            scheduled_for,
            status,
            completed_at_now,
            comprehension_score,
            diagnosis,
            evaluation,
            recommendation,
            evaluated_by,
            evaluation_error,
            corrections_seen_days_ago,
            corrections_seen_days_ago,
        ),
    )
    return cur.fetchone()["id"]


def _insert_answer(
    cur,
    *,
    assessment_id: int,
    question_text: str,
    skill: str,
    expected_ideas: str,
    answer_text: Optional[str] = None,
    ai_verdict: Optional[str] = None,
    evidence: Optional[str] = None,
    teacher_override: Optional[str] = None,
    override_note: Optional[str] = None,
    overridden_days_ago: Optional[int] = None,
) -> int:
    """Insert one answer row.

    ``overridden_at`` is set to ``now() - interval`` when ``overridden_days_ago``
    is provided, so an override can be positioned relative to the learner's
    ``corrections_seen_at`` to simulate seen/unseen corrections.
    """
    cur.execute(
        """
        insert into answers (
            assessment_id, question_text, skill, expected_ideas,
            answer_text, ai_verdict, evidence,
            teacher_override, overridden_at, override_note
        )
        values (
            %s, %s, %s, %s,
            %s, %s, %s,
            %s,
            case when %s::int is null then null else now() - make_interval(days => %s::int) end,
            %s
        )
        returning id
        """,
        (
            assessment_id,
            question_text,
            skill,
            expected_ideas,
            answer_text,
            ai_verdict,
            evidence,
            teacher_override,
            overridden_days_ago,
            overridden_days_ago,
            override_note,
        ),
    )
    return cur.fetchone()["id"]


# --- Demo answer plans -----------------------------------------------------

# A "plan" is one verdict per question for a learner's completed assessment.
# Verdicts drive the (precomputed) comprehension_score and diagnosis so the
# seeded values stay consistent with the Scoring_Module.
#
# With 4 questions, points map to score as:
#   4 correct               -> 100.0  (on_track)
#   3 correct + 1 partial   ->  87.5  (on_track)
#   2 correct + 2 partial   ->  75.0  (on_track)
#   2 correct + 1 partial + 1 missed -> 62.5 (comprehension_barrier)
#   1 correct + 1 partial + 2 missed -> 37.5 (highest_priority)
#   all blank/missed        ->   0.0  (highest_priority, unoverridden blank)

PLAN_ON_TRACK: tuple[str, ...] = ("correct", "correct", "correct", "partial")  # 87.5
PLAN_BARRIER: tuple[str, ...] = ("correct", "correct", "partial", "missed")  # 62.5
PLAN_PRIORITY: tuple[str, ...] = ("correct", "partial", "missed", "missed")  # 37.5


def _score_for(verdicts: Sequence[str]) -> float:
    points = {"correct": 1.0, "partial": 0.5, "missed": 0.0}
    total = sum(points[v] for v in verdicts)
    return round(100.0 * total / len(verdicts), 1)


def _answer_text_for(verdict: str, idea: str) -> Optional[str]:
    """Produce a plausible learner answer consistent with a verdict.

    ``missed`` yields a weak/blank-ish answer, ``partial`` a half-right answer,
    ``correct`` an answer echoing the expected idea. ``missed`` keeps a short
    non-null string (an attempted-but-wrong answer); genuine blanks are handled
    separately by the all-blank case.
    """
    if verdict == "correct":
        return idea.split(",")[0].strip().capitalize() + "."
    if verdict == "partial":
        return "I think " + idea.split(",")[0].strip() + ", but I am not sure."
    return "I don't know."


def _evidence_for(verdict: str) -> Optional[str]:
    # Stub-style evidence: a short quote-like justification, or null when missed.
    if verdict == "correct":
        return "The answer names the key idea from the passage."
    if verdict == "partial":
        return "The answer is on the right track but incomplete."
    return None


_EVAL_SUMMARY = {
    "on_track": (
        "Strong overall comprehension with clear literal and inferential "
        "understanding; one answer was only partially developed."
    ),
    "comprehension_barrier": (
        "Understands the basic facts but struggles to connect ideas and infer "
        "meaning beyond the text."
    ),
    "highest_priority": (
        "Significant difficulty across most questions; comprehension support "
        "is needed urgently."
    ),
}

_RECO = {
    "on_track": "Offer enrichment passages with more open-ended inference questions.",
    "comprehension_barrier": "Practice paired reading focused on 'why' and 'how' questions.",
    "highest_priority": "Begin one-on-one guided reading and reassess within two weeks.",
}


def _seed_completed_assessment(
    cur,
    *,
    learner_id: int,
    classroom_id: int,
    access_code: str,
    title: str,
    category: str,
    passage_text: str,
    questions: Sequence[tuple[str, str, str]],
    verdicts: Sequence[str],
    scheduled_for: date,
    corrections_seen_days_ago: Optional[int] = None,
) -> int:
    """Create a completed, evaluated assessment plus its answer rows.

    Score and diagnosis are precomputed from ``verdicts`` so the row matches the
    Scoring_Module. The ``evaluation``/``recommendation`` text reflect the
    resulting diagnosis.
    """
    score = _score_for(verdicts)
    # No blanks in these plans, so diagnosis follows the score thresholds only.
    if score >= 70.0:
        diagnosis = "on_track"
    elif score >= 40.0:
        diagnosis = "comprehension_barrier"
    else:
        diagnosis = "highest_priority"

    assessment_id = _insert_assessment(
        cur,
        learner_id=learner_id,
        classroom_id=classroom_id,
        access_code=access_code,
        title=title,
        category=category,
        passage_text=passage_text,
        scheduled_for=scheduled_for,
        status="completed",
        completed_at_now=True,
        comprehension_score=score,
        diagnosis=diagnosis,
        evaluation=_EVAL_SUMMARY[diagnosis],
        recommendation=_RECO[diagnosis],
        evaluated_by="ai",
        corrections_seen_days_ago=corrections_seen_days_ago,
    )

    for (q_text, skill, expected), verdict in zip(questions, verdicts):
        _insert_answer(
            cur,
            assessment_id=assessment_id,
            question_text=q_text,
            skill=skill,
            expected_ideas=expected,
            answer_text=_answer_text_for(verdict, expected),
            ai_verdict=verdict,
            evidence=_evidence_for(verdict),
        )

    return assessment_id


# --- Public API ------------------------------------------------------------


def seed(conn) -> None:
    """Insert the full demo dataset using the given ``psycopg`` connection.

    All work happens in one transaction, committed at the end. The connection's
    row factory is expected to return mappings (``dict_row``), as configured by
    :mod:`app.database.connection`; ``returning id`` lookups read ``row["id"]``.

    This is destructive-free with respect to existing rows (it only inserts),
    but it assumes an empty schema â€” :mod:`app.database.reset` drops and
    recreates the schema before calling ``seed``.
    """
    today = manila_today()

    with conn.cursor() as cur:
        # 1 teacher + 1 classroom (two-step FK: user -> classroom).
        teacher_id = _insert_teacher(cur, TEACHER_NAME)
        classroom_id = _insert_classroom(cur, CLASSROOM_NAME, teacher_id)

        # 8â€“10 learners (9 here), all active.
        learner_ids = [
            _insert_learner(cur, name, lrn, classroom_id)
            for (name, lrn) in DEMO_LEARNERS
        ]

        # --- Completed batch 1: passage A, two weeks ago ------------------
        # Spread of diagnoses across learners so dashboards are meaningful.
        code_1 = "BATCH1"
        scheduled_1 = today - timedelta(days=14)
        # Assign a plan to each learner (cycle through the three profiles).
        plans_1 = [PLAN_ON_TRACK, PLAN_BARRIER, PLAN_PRIORITY]
        batch1_assessment_ids: list[int] = []
        for idx, learner_id in enumerate(learner_ids):
            a_id = _seed_completed_assessment(
                cur,
                learner_id=learner_id,
                classroom_id=classroom_id,
                access_code=code_1,
                title="Reading Check 1: The Carabao and the Farmer",
                category="Fiction",
                passage_text=PASSAGE_A,
                questions=QUESTIONS_A,
                verdicts=plans_1[idx % len(plans_1)],
                scheduled_for=scheduled_1,
                # Everyone has acknowledged corrections for this old batch.
                corrections_seen_days_ago=1,
            )
            batch1_assessment_ids.append(a_id)

        # --- Completed batch 2: passage B, one week ago -------------------
        code_2 = "BATCH2"
        scheduled_2 = today - timedelta(days=7)
        plans_2 = [PLAN_ON_TRACK, PLAN_ON_TRACK, PLAN_BARRIER]
        for idx, learner_id in enumerate(learner_ids):
            _seed_completed_assessment(
                cur,
                learner_id=learner_id,
                classroom_id=classroom_id,
                access_code=code_2,
                title="Reading Check 2: The Kite That Learned to Wait",
                category="Fiction",
                passage_text=PASSAGE_B,
                questions=QUESTIONS_B,
                verdicts=plans_2[idx % len(plans_2)],
                scheduled_for=scheduled_2,
                corrections_seen_days_ago=1,
            )

        # --- Completed batch 3: passage A again, two days ago -------------
        # This is the most-recent completed batch -> the dashboard default.
        code_3 = "BATCH3"
        scheduled_3 = today - timedelta(days=2)
        plans_3 = [PLAN_BARRIER, PLAN_ON_TRACK, PLAN_PRIORITY]
        batch3_assessment_ids: list[int] = []
        for idx, learner_id in enumerate(learner_ids):
            a_id = _seed_completed_assessment(
                cur,
                learner_id=learner_id,
                classroom_id=classroom_id,
                access_code=code_3,
                title="Reading Check 3: The Carabao and the Farmer (Review)",
                category="Fiction",
                passage_text=PASSAGE_A,
                questions=QUESTIONS_A,
                verdicts=plans_3[idx % len(plans_3)],
                scheduled_for=scheduled_3,
                # Learners last viewed corrections 1 day ago (see overrides).
                corrections_seen_days_ago=1,
            )
            batch3_assessment_ids.append(a_id)

        # --- Overrides (1â€“2), including one UNSEEN correction -------------
        # Override A: a SEEN correction on batch 1 (overridden before the
        # learner acknowledged, so no outstanding alert). First learner,
        # first answer: bump missed/partial up to 'correct'.
        _apply_override_on_first_answer(
            cur,
            assessment_id=batch1_assessment_ids[0],
            verdict="correct",
            note="On review, the learner's phrasing matches the key idea.",
            overridden_days_ago=3,  # before corrections_seen (1 day ago) -> seen
        )

        # Override B: an UNSEEN correction on the most-recent completed batch.
        # Overridden *after* the learner last acknowledged corrections
        # (overridden_at > corrections_seen_at), so the learner-side alert
        # fires. Third learner (a highest_priority profile), second answer.
        _apply_override_on_second_answer(
            cur,
            assessment_id=batch3_assessment_ids[2],
            verdict="partial",
            note="Partial credit: the answer captures part of the inference.",
            overridden_days_ago=0,  # just now, after corrections_seen (1 day ago)
        )
        # Note: overriding a single answer does not, on its own, cross a
        # diagnosis threshold here; score/diagnosis recompute is exercised by
        # the live override endpoint. The seed keeps the stored score/diagnosis
        # consistent with the pre-override verdicts for simplicity, which is the
        # realistic state immediately after seeding (recompute happens on the
        # next override call through the service).

        # --- All-blank highest_priority case ------------------------------
        # A separate completed batch where one learner submitted nothing. It
        # uses its own access_code so it does not collide with the learner's
        # BATCH3 slot under the unique (access_code, learner_id) constraint.
        # Every answer is blank with no override -> unoverridden-blank rule
        # forces highest_priority with a score of 0.0 (Requirement 6.4).
        code_blank = "BLANK1"
        blank_assessment_id = _insert_assessment(
            cur,
            learner_id=learner_ids[-1],
            classroom_id=classroom_id,
            access_code=code_blank,
            title="Reading Check 3: The Carabao and the Farmer (Review)",
            category="Fiction",
            passage_text=PASSAGE_A,
            scheduled_for=scheduled_3,
            status="completed",
            completed_at_now=True,
            comprehension_score=0.0,
            diagnosis="highest_priority",
            evaluation=_EVAL_SUMMARY["highest_priority"],
            recommendation=_RECO["highest_priority"],
            # No AI call is made for an all-blank submission; code marks all
            # answers missed and sets the fallback evaluator.
            evaluated_by="fallback",
            corrections_seen_days_ago=1,
        )
        for (q_text, skill, expected) in QUESTIONS_A:
            _insert_answer(
                cur,
                assessment_id=blank_assessment_id,
                question_text=q_text,
                skill=skill,
                expected_ideas=expected,
                answer_text=None,  # blank submission
                ai_verdict="missed",  # code treats blanks as missed, no AI
                evidence=None,
            )

        # --- Upcoming batch: scheduled in the future, not yet taken -------
        # One scheduled assessment per learner, plus one blank answer row per
        # question â€” mirroring how scheduling pre-creates rows at batch time.
        code_future = "BATCH4"
        scheduled_future = today + timedelta(days=3)
        for learner_id in learner_ids:
            future_assessment_id = _insert_assessment(
                cur,
                learner_id=learner_id,
                classroom_id=classroom_id,
                access_code=code_future,
                title="Reading Check 4: The Kite That Learned to Wait",
                category="Fiction",
                passage_text=PASSAGE_B,
                scheduled_for=scheduled_future,
                status="scheduled",
            )
            for (q_text, skill, expected) in QUESTIONS_B:
                _insert_answer(
                    cur,
                    assessment_id=future_assessment_id,
                    question_text=q_text,
                    skill=skill,
                    expected_ideas=expected,
                    answer_text=None,
                    ai_verdict=None,
                    evidence=None,
                )

    conn.commit()


def _apply_override_on_first_answer(
    cur, *, assessment_id: int, verdict: str, note: str, overridden_days_ago: int
) -> None:
    """Set a teacher override on the lowest-id answer of an assessment."""
    cur.execute(
        "select id from answers where assessment_id = %s order by id asc limit 1",
        (assessment_id,),
    )
    row = cur.fetchone()
    if row is None:
        return
    _set_override(cur, row["id"], verdict, note, overridden_days_ago)


def _apply_override_on_second_answer(
    cur, *, assessment_id: int, verdict: str, note: str, overridden_days_ago: int
) -> None:
    """Set a teacher override on the second-lowest-id answer of an assessment."""
    cur.execute(
        "select id from answers where assessment_id = %s order by id asc offset 1 limit 1",
        (assessment_id,),
    )
    row = cur.fetchone()
    if row is None:
        return
    _set_override(cur, row["id"], verdict, note, overridden_days_ago)


def _set_override(
    cur, answer_id: int, verdict: str, note: str, overridden_days_ago: int
) -> None:
    cur.execute(
        """
        update answers
           set teacher_override = %s,
               override_note    = %s,
               overridden_at    = now() - make_interval(days => %s)
         where id = %s
        """,
        (verdict, note, overridden_days_ago, answer_id),
    )


def main() -> None:
    """Manual entry point: open a pooled connection and seed.

    Intended for ad-hoc dev runs (``python -m app.database.seed``). Production
    code never calls this; :mod:`app.database.reset` invokes :func:`seed`
    directly with a connection it manages.
    """
    from app.database.connection import get_pool

    pool = get_pool()
    with pool.connection() as conn:
        seed(conn)
    print("Seeded demo data: teacher, classroom, learners, batches, overrides.")


if __name__ == "__main__":
    main()
