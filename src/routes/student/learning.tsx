import { createFileRoute } from '@tanstack/react-router'
import { StudentLearningCurrentPage } from '../../components/student/StudentLearningCurrentPage'

export const Route = createFileRoute('/student/learning')({
  component: StudentLearningCurrentPage,
})
