import { createFileRoute } from '@tanstack/react-router'
import { StudentAssessmentPage } from '../../components/student/StudentAssessmentPage'

export const Route = createFileRoute('/student/assessment')({ component: StudentAssessmentPage })
