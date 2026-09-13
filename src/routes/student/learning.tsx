import { createFileRoute } from '@tanstack/react-router'
import { StudentLearningEntryPage } from '../../components/student/StudentLearningEntryPage'

export const Route = createFileRoute('/student/learning')({
  component: StudentLearningEntryPage,
})
