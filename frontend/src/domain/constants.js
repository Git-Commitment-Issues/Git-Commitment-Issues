/* =============================================================================
   Domain constants — the single frontend source of truth for the backend
   taxonomy. Mirrors backend/app/constants.py exactly so labels, verdicts,
   statuses, and diagnoses line up with what the API returns.
   ========================================================================== */

/* ---- Skills (backend: literal | inference | vocabulary | sequencing) ------ */
export const SKILLS = [
  { key: "literal", label: "Literal" },
  { key: "inference", label: "Inference" },
  { key: "vocabulary", label: "Vocabulary" },
  { key: "sequencing", label: "Sequencing" },
]

const SKILL_LABELS = Object.fromEntries(SKILLS.map((s) => [s.key, s.label]))

/** Human label for a backend skill key; falls back to the raw key. */
export function skillLabel(key) {
  return SKILL_LABELS[key] ?? key
}

/* ---- Verdicts (backend: correct | partial | missed) ----------------------- */
export const VERDICT = {
  correct: { key: "correct", label: "Correct", tone: "success" },
  partial: { key: "partial", label: "Partial", tone: "accent" },
  missed: { key: "missed", label: "Missed", tone: "error" },
}

/** Ordered list for rendering override buttons. */
export const VERDICT_LIST = [VERDICT.correct, VERDICT.partial, VERDICT.missed]

/**
 * Final verdict for an answer = COALESCE(teacher_override, ai_verdict).
 * Matches the backend scoring rule; returns the verdict key or null.
 */
export function finalVerdict(answer) {
  if (!answer) return null
  return answer.teacher_override ?? answer.ai_verdict ?? null
}

/* ---- Assessment status (backend: scheduled | in_progress | completed) ----- */
export const STATUS = {
  scheduled: { key: "scheduled", label: "Scheduled", tone: "neutral" },
  in_progress: { key: "in_progress", label: "In progress", tone: "accent" },
  completed: { key: "completed", label: "Completed", tone: "success" },
}

/** Status descriptor for a backend status key; safe fallback for unknowns. */
export function statusInfo(key) {
  return STATUS[key] ?? { key, label: key ?? "Unknown", tone: "neutral" }
}

/* ---- Diagnosis (backend: on_track | comprehension_barrier | highest_priority;
   decoding_barrier is reserved for a later phase and never produced today). -- */
export const DIAGNOSIS = {
  on_track: { key: "on_track", label: "On track", tone: "success" },
  comprehension_barrier: {
    key: "comprehension_barrier",
    label: "Comprehension barrier",
    tone: "accent",
  },
  highest_priority: {
    key: "highest_priority",
    label: "Highest priority",
    tone: "error",
  },
  decoding_barrier: {
    key: "decoding_barrier",
    label: "Decoding barrier",
    tone: "accent",
  },
}

/** Diagnosis descriptor for a backend diagnosis key; safe fallback. */
export function diagnosisInfo(key) {
  return (
    DIAGNOSIS[key] ?? { key, label: key ?? "Not evaluated", tone: "neutral" }
  )
}

/**
 * Map a backend diagnosis onto the frontend ProficiencyBadge levels
 * (proficient | developing | needs-practice) so existing UI renders unchanged.
 */
export function diagnosisToLevel(diagnosis) {
  if (diagnosis === "on_track") return "proficient"
  if (diagnosis === "comprehension_barrier") return "developing"
  if (diagnosis === "highest_priority") return "needs-practice"
  return "developing"
}