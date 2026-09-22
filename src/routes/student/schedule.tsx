import { createFileRoute } from '@tanstack/react-router'
import { StudentSchedulePage } from '../../components/student/StudentSchedulePage'

export const Route = createFileRoute('/student/schedule')({
  component: StudentSchedulePage,
})
