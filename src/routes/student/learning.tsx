import { createFileRoute } from '@tanstack/react-router'
import { StudentLearningPageV2 } from '../../components/student/StudentLearningPageV2'

export const Route = createFileRoute('/student/learning')({
  component: StudentLearningPageV2,
})
