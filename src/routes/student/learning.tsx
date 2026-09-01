import { createFileRoute } from '@tanstack/react-router'
import { StudentLearningPage } from '../student'

export const Route = createFileRoute('/student/learning')({
  component: StudentLearningPage,
})
