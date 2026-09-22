import { createFileRoute } from '@tanstack/react-router'
import { TeacherSchedulePage } from '../../components/teacher/TeacherSchedulePage'

export const Route = createFileRoute('/teacher/schedule')({
  component: TeacherSchedulePage,
})
