import { createFileRoute } from '@tanstack/react-router'
import { TeacherDashboardV2 } from '../../components/teacher/TeacherDashboardV2'

export const Route = createFileRoute('/teacher/overview')({
  component: TeacherDashboardV2,
})
