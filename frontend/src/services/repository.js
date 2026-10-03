/* =============================================================================
   repository — the frontend data access layer over the FastAPI backend.
   -----------------------------------------------------------------------------
   Every page/provider talks to the backend through this object only. It maps
   the UI-facing method names and shapes onto the real HTTP endpoints and
   reshapes responses where the UI expects a different structure than the API
   returns. No component imports httpClient directly.

   Endpoint reference (backend routers):
     POST   /auth/login                                 -> UserOut
     GET    /auth/me                                    -> UserOut (X-User-Id)
     GET    /classrooms                                 -> [ClassroomOut]
     POST   /classrooms                                 -> ClassroomOut
     GET    /classrooms/{id}/students                   -> [StudentOut]
     POST   /classrooms/{id}/students                   -> StudentOut
     POST   /classrooms/{id}/students/bulk              -> BulkRosterResult
     PATCH  /students/{id}                              -> StudentOut
     POST   /assessments                                -> SchedulingSummaryOut
     GET    /classrooms/{id}/assessments                -> [AssessmentSummaryOut]
     GET    /assessments/{id}                           -> AssessmentDetailOut
     GET    /assessments/code/{code}                    -> AssessmentDetailOut
     POST   /assessments/{id}/start                     -> {id,status}
     POST   /assessments/{id}/submit                    -> 202 {status}
     GET    /me/assessments                             -> {upcoming,previous,alert}
     POST   /assessments/{id}/seen                      -> {status}
     POST   /assessments/{id}/evaluate                  -> EvaluationResultOut
     PATCH  /answers/{id}/override                      -> OverrideResultOut
     GET    /classrooms/{id}/needs-help?access_code=    -> {access_code,rows}
     GET    /classrooms/{id}/skills?access_code=        -> {access_code,rows}
     GET    /classrooms/{id}/questions?access_code=     -> {access_code,rows}
     GET    /classrooms/{id}/override-rate?access_code= -> {access_code,...}
     GET    /classrooms/{id}/batches                    -> [batch rows]
     GET    /students/{id}/progress                     -> [progress rows]
   ========================================================================== */

import { http } from "./httpClient"

/* -------------------------------------------------------------------------- */
/* Auth / session                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Resolve a login. Teachers log in by name, learners by LRN.
 * @param {{name?: string, lrn?: string}} credentials
 * @returns {Promise<UserOut>}
 */
function login(credentials) {
  return http.post("/auth/login", {
    name: credentials?.name ?? null,
    lrn: credentials?.lrn ?? null,
  })
}

/**
 * Return the user for an id by asking the backend to resolve the X-User-Id
 * header (the backend has no /users/{id}; /auth/me is the identity endpoint).
 * @param {string|number} id
 * @returns {Promise<UserOut|null>}
 */
function getUser(id) {
  if (id == null || id === "") return Promise.resolve(null)
  return http.get("/auth/me", { userId: id })
}

/* -------------------------------------------------------------------------- */
/* Public learner take flow (no persisted session)                           */
/* -------------------------------------------------------------------------- */

/**
 * Take + submit an assessment as a learner identified by LRN, WITHOUT touching
 * the persisted (teacher) session. Every call threads the resolved learner id
 * through the `userId` header option so the public /s flow never clobbers the
 * teacher's X-User-Id in localStorage.
 *
 * Steps: resolve the learner by LRN -> find their own copy of the batch by
 * access code -> start it (scheduled -> in_progress) -> submit the answers.
 *
 * @param {{ lrn: string, code: string, answers: Array<{answer_id:number, answer_text:string}> }} input
 * @returns {Promise<{ learner: UserOut, assessmentId: number }>}
 */
async function submitAsLearner({ lrn, code, answers }) {
  // 1. Resolve the learner (learner logs in by LRN). 401 -> caller handles.
  const learner = await http.post("/auth/login", { lrn })
  const uid = learner.id

  // 2. Find THIS learner's assessment for the batch code (scoped to them).
  const detail = await http.get(`/assessments/code/${code}`, { userId: uid })
  const assessmentId = detail.id

  // 3. Start it if still scheduled; ignore a benign "already started" 400.
  try {
    await http.post(`/assessments/${assessmentId}/start`, undefined, {
      userId: uid,
    })
  } catch (err) {
    // If it is already in progress that is fine; only re-throw hard failures.
    if (!(err && err.status === 400)) throw err
  }

  // 4. Submit the answers (202 accepted; evaluation runs in the background).
  await http.post(`/assessments/${assessmentId}/submit`, { answers }, {
    userId: uid,
  })

  return { learner, assessmentId }
}

/**
 * Look up a learner's own assessment for a code using an explicit learner id
 * (does not read or write the persisted session).
 */
function getAssessmentByCodeAs(code, userId) {
  return http.get(`/assessments/code/${code}`, { userId }).then(splitDetail)
}

/* -------------------------------------------------------------------------- */
/* Classrooms + roster                                                        */
/* -------------------------------------------------------------------------- */

// The backend scopes /classrooms to the X-User-Id teacher, so the teacherId
// argument is accepted for call-site clarity but not sent in the query.
function listClassrooms(/* teacherId */) {
  return http.get("/classrooms")
}

function createClassroom({ name }) {
  return http.post("/classrooms", { name })
}

function listStudents(classroomId) {
  return http.get(`/classrooms/${classroomId}/students`)
}

function addStudent(classroomId, { learner_reference_number, name }) {
  return http.post(`/classrooms/${classroomId}/students`, {
    learner_reference_number,
    name: name ?? null,
  })
}

function bulkAddStudents(classroomId, rawText) {
  return http.post(`/classrooms/${classroomId}/students/bulk`, {
    raw_text: rawText,
  })
}

function updateStudent(studentId, patch) {
  return http.patch(`/students/${studentId}`, patch)
}

/* -------------------------------------------------------------------------- */
/* Assessments                                                                */
/* -------------------------------------------------------------------------- */

// The pages expect { assessment, answers }, but the backend returns a flat
// AssessmentDetailOut with an embedded answers[]. Split it here so the UI
// contract is honored without changing the pages.
function splitDetail(detail) {
  if (!detail) return { assessment: null, answers: [] }
  const { answers = [], ...assessment } = detail
  return { assessment, answers }
}

function getAssessment(assessmentId) {
  return http
    .get(`/assessments/${assessmentId}`)
    .then(splitDetail)
}

function getAssessmentByCode(code) {
  return http.get(`/assessments/code/${code}`).then(splitDetail)
}

function listClassroomAssessments(classroomId) {
  return http.get(`/classrooms/${classroomId}/assessments`)
}

function scheduleAssessment(payload) {
  // payload matches CreateAssessmentRequest:
  // { classroom_id, title, category, passage_text, scheduled_for, questions }
  return http.post("/assessments", payload)
}

function startAssessment(assessmentId) {
  return http.post(`/assessments/${assessmentId}/start`)
}

function submitAssessment(assessmentId, answers) {
  // answers: [{ answer_id, answer_text }]
  return http.post(`/assessments/${assessmentId}/submit`, { answers })
}

function retryEvaluation(assessmentId) {
  return http.post(`/assessments/${assessmentId}/evaluate`)
}

/* -------------------------------------------------------------------------- */
/* Learner self-service views                                                 */
/* -------------------------------------------------------------------------- */

function listMyAssessments() {
  return http.get("/me/assessments")
}

function markCorrectionsSeen(assessmentId) {
  return http.post(`/assessments/${assessmentId}/seen`)
}

/* -------------------------------------------------------------------------- */
/* Teacher review / overrides                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Apply or clear a teacher override. The UI passes
 * { teacher_override, override_note }; the backend OverrideRequest wants
 * { verdict, note } (verdict null clears the override).
 */
function overrideAnswer(answerId, { teacher_override, override_note }) {
  return http.patch(`/answers/${answerId}/override`, {
    verdict: teacher_override ?? null,
    note: override_note ?? null,
  })
}

/* -------------------------------------------------------------------------- */
/* Dashboard aggregates                                                       */
/* -------------------------------------------------------------------------- */

function getNeedsHelp(classroomId, accessCode) {
  return http.get(`/classrooms/${classroomId}/needs-help`, {
    query: { access_code: accessCode },
  })
}

function getSkillsBreakdown(classroomId, accessCode) {
  return http.get(`/classrooms/${classroomId}/skills`, {
    query: { access_code: accessCode },
  })
}

function getMostMissedQuestions(classroomId, accessCode) {
  return http.get(`/classrooms/${classroomId}/questions`, {
    query: { access_code: accessCode },
  })
}

function getOverrideRate(classroomId, accessCode) {
  return http.get(`/classrooms/${classroomId}/override-rate`, {
    query: { access_code: accessCode },
  })
}

function listBatches(classroomId) {
  return http.get(`/classrooms/${classroomId}/batches`)
}

function getStudentProgress(studentId) {
  return http.get(`/students/${studentId}/progress`)
}

export const repository = {
  // auth
  login,
  getUser,
  // public learner take flow
  submitAsLearner,
  getAssessmentByCodeAs,
  // classrooms + roster
  listClassrooms,
  createClassroom,
  listStudents,
  addStudent,
  bulkAddStudents,
  updateStudent,
  // assessments
  getAssessment,
  getAssessmentByCode,
  listClassroomAssessments,
  scheduleAssessment,
  startAssessment,
  submitAssessment,
  retryEvaluation,
  // learner views
  listMyAssessments,
  markCorrectionsSeen,
  // review
  overrideAnswer,
  // dashboard
  getNeedsHelp,
  getSkillsBreakdown,
  getMostMissedQuestions,
  getOverrideRate,
  listBatches,
  getStudentProgress,
}