import { createFileRoute } from '@tanstack/react-router'
import { TeacherDashboardV2 } from '../teacher-dashboard-v2'

export const Route = createFileRoute('/teacher/overview')({
  component: TeacherDashboardV2,
})
