import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Settings,
} from 'lucide-react'

/**
 * Primary navigation for the teacher portal. Each item maps a route to a
 * lucide icon and a short description used for tooltips / collapsed state.
 * Order here is the order rendered in the sidebar.
 */
export const NAV_ITEMS = [
  {
    to: '/',
    labelKey: 'nav.dashboard',
    descriptionKey: 'nav.dashboardSub',
    icon: LayoutDashboard,
    end: true,
  },
  {
    to: '/students',
    labelKey: 'nav.students',
    descriptionKey: 'nav.studentsSub',
    icon: Users,
  },
  {
    to: '/assessments',
    labelKey: 'nav.assessments',
    descriptionKey: 'nav.assessmentsSub',
    icon: ClipboardList,
  },
  {
    to: '/settings',
    labelKey: 'nav.settings',
    descriptionKey: 'nav.settingsSub',
    icon: Settings,
  },
]
