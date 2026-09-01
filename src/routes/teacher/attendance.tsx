import { createFileRoute } from '@tanstack/react-router'
import { TeacherAttendancePage } from '../teacher'

export const Route = createFileRoute('/teacher/attendance')({
  component: TeacherAttendancePage,
})
