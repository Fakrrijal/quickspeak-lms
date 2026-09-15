import { createFileRoute } from '@tanstack/react-router'
import { useLayoutEffect } from 'react'
import { StudentPaymentPageV3 } from '../components/student/StudentPaymentPageV3'

function StudentPaymentRoute() {
  useLayoutEffect(() => {
    const blockPickerReturnHandlers = (event: Event) => {
      event.stopImmediatePropagation()
    }

    window.addEventListener('focus', blockPickerReturnHandlers, true)
    window.addEventListener('pageshow', blockPickerReturnHandlers, true)

    return () => {
      window.removeEventListener('focus', blockPickerReturnHandlers, true)
      window.removeEventListener('pageshow', blockPickerReturnHandlers, true)
    }
  }, [])

  return <StudentPaymentPageV3 />
}

export const Route = createFileRoute('/student-payment')({
  component: StudentPaymentRoute,
})
