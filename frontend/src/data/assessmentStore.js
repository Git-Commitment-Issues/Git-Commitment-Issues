/* =============================================================================
   Assessment store — a tiny localStorage-backed store for assessments that
   teachers create in the app, plus student responses.
   -----------------------------------------------------------------------------
   This is intentionally small and self-contained. It is separate from the
   demo mockData.js (which still powers the dashboard/roster visuals). When a
   real backend exists, swap these four functions for API calls — the shapes
   stay the same.

   Shapes:
     assessment = {
       code, title, passage, createdAt,
       questions: [{ id, prompt, skill }],
       responses: [{ studentName, answers: { [questionId]: text }, submittedAt }]
     }
   ========================================================================== */

const KEY = 'anaread-assessments-v1'

function loadAll() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? []
  } catch {
    return []
  }
}

function saveAll(list) {
  localStorage.setItem(KEY, JSON.stringify(list))
}

/** Short, easy-to-type join code (no ambiguous characters). */
export function makeCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < 6; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)]
  }
  return out
}

/** All assessments a teacher has created, newest first. */
export function listAssessments() {
  return loadAll().sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
}

/** Create and persist a new assessment. Returns it (with a fresh join code). */
export function createAssessment({ title, passage, questions }) {
  const list = loadAll()
  // Ensure a unique code.
  let code = makeCode()
  while (list.some((a) => a.code === code)) code = makeCode()

  const assessment = {
    code,
    title: title.trim(),
    passage: passage.trim(),
    questions: questions.map((q, i) => ({
      id: `q${i + 1}`,
      prompt: q.prompt.trim(),
      skill: q.skill,
    })),
    responses: [],
    createdAt: Date.now(),
  }
  list.push(assessment)
  saveAll(list)
  return assessment
}

/** Find an assessment by its join code (case-insensitive). */
export function getByCode(code) {
  const target = (code ?? '').trim().toUpperCase()
  return loadAll().find((a) => a.code === target) ?? null
}

/** Record a student's submission for an assessment. */
export function submitResponse(code, { studentName, answers }) {
  const list = loadAll()
  const assessment = list.find((a) => a.code === (code ?? '').toUpperCase())
  if (!assessment) throw new Error('Assessment not found')
  assessment.responses.push({
    studentName: studentName.trim(),
    answers,
    submittedAt: Date.now(),
  })
  saveAll(list)
  return assessment
}
