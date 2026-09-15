import { createFileRoute } from '@tanstack/react-router'
import { useEffect } from 'react'
import { StudentPaymentPageV3 } from '../components/student/StudentPaymentPageV3'

function StudentPaymentRoute() {
  useEffect(() => {
    const hideCameraButton = () => {
      const cameraButton = Array.from(document.querySelectorAll('button')).find(
        (button) => button.textContent?.trim() === 'Take Photo',
      ) as HTMLButtonElement | undefined
      if (cameraButton) cameraButton.style.display = 'none'
    }

    hideCameraButton()
    const observer = new MutationObserver(hideCameraButton)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  return <StudentPaymentPageV3 />
}

export const Route = createFileRoute('/student-payment')({
  component: StudentPaymentRoute,
})
