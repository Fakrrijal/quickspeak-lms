export type PortalRole = 'student' | 'teacher' | 'admin'

export type PortalNavigationItem = {
  label: string
  to: string
  activePrefixes?: string[]
}

export type PortalNavigationGroup = {
  label: string
  items: PortalNavigationItem[]
}

export const portalNavigation: Record<PortalRole, PortalNavigationGroup[]> = {
  student: [
    {
      label: 'Learning',
      items: [
        {
          label: 'Dashboard',
          to: '/student',
        },
        {
          label: 'My Learning',
          to: '/student/learning',
          activePrefixes: ['/student/learning', '/student/ebooks/'],
        },
        {
          label: 'Attendance',
          to: '/student/attendance',
        },
        { label: 'Profile', to: '/student/profile' },
      ],
    },
    {
      label: 'Finance',
      items: [
        { label: 'Payment', to: '/student-payment' },
      ],
    },
  ],
  teacher: [
    {
      label: 'Learning Operations',
      items: [
        { label: 'Dashboard', to: '/teacher' },
        { label: 'Attendance', to: '/teacher/attendance' },
        { label: 'Fee', to: '/teacher/fee' },
        { label: 'Profile', to: '/teacher/profile' },
      ],
    },
  ],
  admin: [
    {
      label: 'Operations',
      items: [
        { label: 'Dashboard', to: '/admin/dashboard' },
        { label: 'Student Management', to: '/admin' },
        { label: 'Teacher Management', to: '/admin/teachers' },
        { label: 'Waiting Students', to: '/admin/waiting-students' },
        { label: 'Waiting Teachers', to: '/admin/waiting-teachers' },
        { label: 'Teaching Groups', to: '/admin/teaching-groups' },
      ],
    },
    {
      label: 'Finance',
      items: [
        { label: 'Payments', to: '/admin/payments', activePrefixes: ['/admin/payments', '/admin/payment-settings', '/admin/payment-verification', '/admin/payment-history'] },
        { label: 'Teacher Fees', to: '/admin/teacher-fees' },
      ],
    },
    {
      label: 'Reports',
      items: [
        { label: 'Attendance Reports', to: '/admin/attendance-reports' },
        { label: 'System Errors', to: '/admin/system-errors' },
      ],
    },
    {
      label: 'Content',
      items: [
        { label: 'Ebooks', to: '/admin/ebooks' },
      ],
    },
  ],
}

export function getPortalRoleLabel(role: PortalRole) {
  return `${role.charAt(0).toUpperCase()}${role.slice(1)} Portal`
}

export function isPortalPath(pathname: string) {
  return (
    pathname === '/student'
    || pathname === '/student/learning'
    || pathname === '/student/attendance'
    || pathname === '/student/profile'
    || pathname === '/student-payment'
    || pathname === '/notifications'
    || pathname.startsWith('/student/ebooks/')
    || pathname === '/teacher'
    || pathname === '/teacher/attendance'
    || pathname === '/teacher/fee'
    || pathname === '/teacher/profile'
    || pathname === '/admin'
    || pathname.startsWith('/admin/')
  )
}
