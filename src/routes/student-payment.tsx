import { createFileRoute } from '@tanstack/react-router'
import { StudentPaymentPageV2 } from '../components/student/StudentPaymentPageV2'

export const Route = createFileRoute('/student-payment')({
  component: StudentPaymentPageV2,
})
