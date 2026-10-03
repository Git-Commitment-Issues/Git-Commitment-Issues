"""Single source of truth for enums, scoring weights, and diagnosis thresholds.

Every role, status, skill, verdict, and diagnosis value used across the backend
is defined here so that expanding a set (e.g. adding a skill) is a one-line
change in this module. Scoring weights and diagnosis thresholds live here too so
the Scoring_Module and database checks stay aligned.

See design.md (*SoT: Scoring/Diagnosis*) and requirements 6.1 and 6.4.
"""

from typing import Literal

# --- Roles ---
Role = Literal["teacher", "learner"]
ROLE_TEACHER: Role = "teacher"
ROLE_LEARNER: Role = "learner"
ROLES: tuple[Role, ...] = ("teacher", "learner")

# --- Assessment statuses ---
Status = Literal["scheduled", "in_progress", "completed"]
STATUS_SCHEDULED: Status = "scheduled"
STATUS_IN_PROGRESS: Status = "in_progress"
STATUS_COMPLETED: Status = "completed"
STATUSES: tuple[Status, ...] = ("scheduled", "in_progress", "completed")

# --- Skills ---
# Skill list expansion is a one-line change here (*SoT: Open Items*).
Skill = Literal["literal", "inference", "vocabulary", "sequencing"]
SKILL_LITERAL: Skill = "literal"
SKILL_INFERENCE: Skill = "inference"
SKILL_VOCABULARY: Skill = "vocabulary"
SKILL_SEQUENCING: Skill = "sequencing"
SKILLS: tuple[Skill, ...] = ("literal", "inference", "vocabulary", "sequencing")

# --- Verdicts ---
Verdict = Literal["correct", "partial", "missed"]
VERDICT_CORRECT: Verdict = "correct"
VERDICT_PARTIAL: Verdict = "partial"
VERDICT_MISSED: Verdict = "missed"
VERDICTS: tuple[Verdict, ...] = ("correct", "partial", "missed")

# --- Diagnosis values ---
# `decoding_barrier` is reserved for Phase 2 and is never produced in the MVP,
# but it remains part of the allowed set so the database check and schema match.
Diagnosis = Literal[
    "on_track", "decoding_barrier", "comprehension_barrier", "highest_priority"
]
DIAGNOSIS_ON_TRACK: Diagnosis = "on_track"
DIAGNOSIS_DECODING_BARRIER: Diagnosis = "decoding_barrier"  # reserved Phase 2
DIAGNOSIS_COMPREHENSION_BARRIER: Diagnosis = "comprehension_barrier"
DIAGNOSIS_HIGHEST_PRIORITY: Diagnosis = "highest_priority"
DIAGNOSES: tuple[Diagnosis, ...] = (
    "on_track",
    "decoding_barrier",
    "comprehension_barrier",
    "highest_priority",
)

# --- Verdict scoring weights ---
# Points awarded per Final_Verdict when computing comprehension_score.
# A Blank_Answer / None is treated as `missed` (0.0) by the Scoring_Module.
VERDICT_POINTS: dict[Verdict, float] = {
    "correct": 1.0,
    "partial": 0.5,
    "missed": 0.0,
}

# --- Diagnosis thresholds (on a 0-100 comprehension_score scale) ---
# score < HIGHEST_PRIORITY_MAX_SCORE (or an unoverridden blank) -> highest_priority
# HIGHEST_PRIORITY_MAX_SCORE <= score < ON_TRACK_MIN_SCORE      -> comprehension_barrier
# score >= ON_TRACK_MIN_SCORE                                   -> on_track
HIGHEST_PRIORITY_MAX_SCORE: float = 40.0
ON_TRACK_MIN_SCORE: float = 70.0
