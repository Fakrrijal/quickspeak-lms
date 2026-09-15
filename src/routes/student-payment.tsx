import { createFileRoute } from '@tanstack/react-router'
import { useLayoutEffect } from 'react'
import { StudentPaymentPageV3 } from '../components/student/StudentPaymentPageV3'

function StudentPaymentRoute() {
  useLayoutEffect(() => {
    document.getElementById('student-payment-proof-input')?.removeAttribute('accept')
  }, [])

  return <StudentPaymentPageV3 />
}

export const Route = createFileRoute('/student-payment')({
  component: StudentPaymentRoute,
})
