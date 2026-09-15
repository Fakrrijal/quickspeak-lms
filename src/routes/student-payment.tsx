import { createFileRoute } from '@tanstack/react-router'
import { useEffect } from 'react'
import { StudentPaymentPageV3 } from '../components/student/StudentPaymentPageV3'

function StudentPaymentInputEventBridge() {
  useEffect(() => {
    let cleanup: (() => void) | null = null

    const attachBridge = () => {
      if (cleanup) return

      const input = document.getElementById('student-payment-proof-input') as HTMLInputElement | null
      if (!input) return

      const handleInput = () => {
        if (!input.files?.length) return
        queueMicrotask(() => {
          input.dispatchEvent(new Event('change', { bubbles: true }))
        })
      }

      input.addEventListener('input', handleInput)
      cleanup = () => {
        input.removeEventListener('input', handleInput)
        cleanup = null
      }
    }

    attachBridge()
    const observer = new MutationObserver(attachBridge)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      cleanup?.()
    }
  }, [])

  return <StudentPaymentPageV3 />
}

export const Route = createFileRoute('/student-payment')({
  component: StudentPaymentInputEventBridge,
})
