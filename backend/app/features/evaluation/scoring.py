"""Pure scoring and diagnosis functions (*SoT: Scoring/Diagnosis*).

These functions compute the comprehension score and diagnosis in our own code,
never the AI. They are pure: no I/O, no mutation of inputs. All enum values,
scoring weights, and thresholds come from `app.constants` so the module stays
aligned with the database checks and the rest of the backend.

See design.md ("Key Functions with Formal Specifications") and requirements
6.1, 6.4, and 5.5.
"""

from typing import Optional, Sequence

from app.constants import (
    HIGHEST_PRIORITY_MAX_SCORE,
    ON_TRACK_MIN_SCORE,
    VERDICT_MISSED,
    VERDICT_POINTS,
    DIAGNOSIS_COMPREHENSION_BARRIER,
    DIAGNOSIS_HIGHEST_PRIORITY,
    DIAGNOSIS_ON_TRACK,
)


def final_verdict(
    ai_verdict: Optional[str], teacher_override: Optional[str]
) -> Optional[str]:
    """Return the final verdict as ``COALESCE(teacher_override, ai_verdict)``.

    The teacher's override always wins when present; otherwise the AI verdict is
    used. Returns ``None`` when neither is set (unevaluated answer).
    """
    return teacher_override if teacher_override is not None else ai_verdict


def compute_score(final_verdicts: Sequence[Optional[str]]) -> float:
    """Compute ``comprehension_score`` from final verdicts.

    ``comprehension_score = round(100 * total_points / num_questions, 1)`` where
    ``total_points`` sums the per-verdict weights (``correct=1.0``,
    ``partial=0.5``, ``missed=0.0``) and ``None``/blank is treated as ``missed``.

    The result is bounded to ``[0.0, 100.0]``. Pure function: no mutation, no I/O.

    Precondition: ``num_questions >= 1`` (scheduling guarantees 3-5 questions).
    """
    num_questions = len(final_verdicts)
    if num_questions < 1:
        raise ValueError("compute_score requires at least one verdict")

    missed_points = VERDICT_POINTS[VERDICT_MISSED]
    total_points = sum(
        VERDICT_POINTS.get(verdict, missed_points) if verdict is not None else missed_points
        for verdict in final_verdicts
    )

    score = round(100 * total_points / num_questions, 1)
    # Bound defensively to the valid 0.0-100.0 range.
    return max(0.0, min(100.0, score))


def compute_diagnosis(
    comprehension_score: float,
    has_unoverridden_blank: bool,
) -> str:
    """Map a comprehension score to a diagnosis using exact thresholds.

    Exact mapping (*SoT: Scoring/Diagnosis*):
      - ``has_unoverridden_blank`` OR ``score < 40``  -> ``highest_priority``
      - ``40 <= score < 70``                          -> ``comprehension_barrier``
      - ``score >= 70``                               -> ``on_track``

    Pure function; ``decoding_barrier`` is reserved for Phase 2 and never
    returned in the MVP.

    Precondition: ``0.0 <= comprehension_score <= 100.0``.
    """
    if has_unoverridden_blank or comprehension_score < HIGHEST_PRIORITY_MAX_SCORE:
        return DIAGNOSIS_HIGHEST_PRIORITY
    if comprehension_score < ON_TRACK_MIN_SCORE:
        return DIAGNOSIS_COMPREHENSION_BARRIER
    return DIAGNOSIS_ON_TRACK
