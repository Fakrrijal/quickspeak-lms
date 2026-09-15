import { createFileRoute } from '@tanstack/react-router'
import { StudentPaymentPageV3 } from '../components/student/StudentPaymentPageV3'

export const Route = createFileRoute('/student-payment')({
  component: StudentPaymentPageV3,
})
