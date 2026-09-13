import { createFileRoute } from '@tanstack/react-router'
import { StudentLearningPageEntry } from '../../components/student/StudentLearningPageEntry'

export const Route = createFileRoute('/student/learning')({
  component: StudentLearningPageEntry,
})
