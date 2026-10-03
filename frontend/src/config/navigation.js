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
    label: 'Dashboard',
    icon: LayoutDashboard,
    description: 'Class reading-comprehension overview',
    end: true,
  },
  {
    to: '/students',
    label: 'Students',
    icon: Users,
    description: 'Roster and per-student progress',
  },
  {
    to: '/assessments',
    label: 'Assessments',
    icon: ClipboardList,
    description: 'Create and manage reading assessments',
  },
  {
    to: '/settings',
    label: 'Settings',
    icon: Settings,
    description: 'Account and class preferences',
  },
]
