/* =============================================================================
   Mock data — placeholder content for the scaffolded UI.
   -----------------------------------------------------------------------------
   This is front-end-only sample data so the pages render meaningfully before
   the Python/Supabase backend is connected. Shapes loosely mirror the domain
   described in the AnaRead documentation (classes, students, assessments, and
   per-skill comprehension results). Replace with real API calls later.
   ========================================================================== */

/** The reading-comprehension skills the AI assessment reports on. */
export const COMPREHENSION_SKILLS = [
  { key: 'main_idea', label: 'Main Idea' },
  { key: 'supporting_details', label: 'Supporting Details' },
  { key: 'inference', label: 'Inference' },
  { key: 'vocabulary', label: 'Vocabulary in Context' },
  { key: 'authors_purpose', label: "Author's Purpose" },
]

/** Map a 0-100 score to a proficiency level used by ProficiencyBadge. */
export function scoreToLevel(score) {
  if (score >= 80) return 'proficient'
  if (score >= 60) return 'developing'
  return 'needs-practice'
}

/** Dashboard summary tiles. */
export const CLASS_SUMMARY = {
  studentsAssessed: 28,
  totalStudents: 32,
  classAverage: 74,
  needSupport: 6,
  assessmentsThisMonth: 9,
}

/** Average score per skill across the current class. */
export const CLASS_SKILL_AVERAGES = [
  { key: 'main_idea', label: 'Main Idea', score: 82 },
  { key: 'supporting_details', label: 'Supporting Details', score: 78 },
  { key: 'inference', label: 'Inference', score: 58 },
  { key: 'vocabulary', label: 'Vocabulary in Context', score: 69 },
  { key: 'authors_purpose', label: "Author's Purpose", score: 64 },
]

export const STUDENTS = [
  {
    id: 'g8-014',
    name: 'Juan Dela Cruz',
    code: 'G8A-014',
    overall: 54,
    assessmentsTaken: 7,
    lastActive: '2 days ago',
    focusSkill: 'inference',
    skills: {
      main_idea: 72,
      supporting_details: 65,
      inference: 41,
      vocabulary: 58,
      authors_purpose: 49,
    },
  },
  {
    id: 'g8-021',
    name: 'Maria Santos',
    code: 'G8A-021',
    overall: 88,
    assessmentsTaken: 8,
    lastActive: 'Today',
    focusSkill: 'authors_purpose',
    skills: {
      main_idea: 94,
      supporting_details: 90,
      inference: 85,
      vocabulary: 88,
      authors_purpose: 78,
    },
  },
  {
    id: 'g8-007',
    name: 'Carlo Mendoza',
    code: 'G8A-007',
    overall: 67,
    assessmentsTaken: 6,
    lastActive: 'Yesterday',
    focusSkill: 'vocabulary',
    skills: {
      main_idea: 75,
      supporting_details: 72,
      inference: 63,
      vocabulary: 52,
      authors_purpose: 70,
    },
  },
  {
    id: 'g8-030',
    name: 'Aisha Rahman',
    code: 'G8A-030',
    overall: 79,
    assessmentsTaken: 7,
    lastActive: 'Today',
    focusSkill: 'inference',
    skills: {
      main_idea: 85,
      supporting_details: 82,
      inference: 68,
      vocabulary: 80,
      authors_purpose: 76,
    },
  },
  {
    id: 'g8-012',
    name: 'Noah Villanueva',
    code: 'G8A-012',
    overall: 48,
    assessmentsTaken: 5,
    lastActive: '4 days ago',
    focusSkill: 'main_idea',
    skills: {
      main_idea: 44,
      supporting_details: 50,
      inference: 42,
      vocabulary: 55,
      authors_purpose: 47,
    },
  },
  {
    id: 'g8-025',
    name: 'Grace Lim',
    code: 'G8A-025',
    overall: 91,
    assessmentsTaken: 8,
    lastActive: 'Today',
    focusSkill: 'authors_purpose',
    skills: {
      main_idea: 96,
      supporting_details: 93,
      inference: 88,
      vocabulary: 92,
      authors_purpose: 85,
    },
  },
]

export const ASSESSMENTS = [
  {
    id: 'rc-012',
    title: 'The Lighthouse Keeper',
    status: 'active',
    grade: 'Grade 8',
    questions: 6,
    responses: 24,
    skills: ['main_idea', 'inference', 'vocabulary'],
    updated: '2 hours ago',
  },
  {
    id: 'rc-011',
    title: 'Rivers of the Archipelago',
    status: 'draft',
    grade: 'Grade 8',
    questions: 5,
    responses: 0,
    skills: ['supporting_details', 'authors_purpose'],
    updated: 'Yesterday',
  },
  {
    id: 'rc-010',
    title: 'A Letter to the Future',
    status: 'closed',
    grade: 'Grade 8',
    questions: 7,
    responses: 31,
    skills: ['main_idea', 'inference', 'authors_purpose'],
    updated: '1 week ago',
  },
  {
    id: 'rc-009',
    title: 'How Bridges Stay Standing',
    status: 'closed',
    grade: 'Grade 8',
    questions: 6,
    responses: 29,
    skills: ['supporting_details', 'vocabulary'],
    updated: '2 weeks ago',
  },
]

/** Students flagged by the AI as most likely to need support. */
export const STUDENTS_NEEDING_SUPPORT = STUDENTS.filter((s) => s.overall < 70)
  .sort((a, b) => a.overall - b.overall)
  .slice(0, 4)

/** Distribution of learners across proficiency bands (for the donut chart). */
export const PROFICIENCY_DISTRIBUTION = [
  { name: 'Proficient', value: 14, tone: 'success' },
  { name: 'Developing', value: 10, tone: 'primary' },
  { name: 'Needs practice', value: 6, tone: 'error' },
]

/** Class comprehension average across recent assessments (for the trend chart). */
export const CLASS_TREND = [
  { label: 'Aug', score: 61 },
  { label: 'Sep', score: 66 },
  { label: 'Oct', score: 69 },
  { label: 'Nov', score: 72 },
  { label: 'Dec', score: 74 },
]
