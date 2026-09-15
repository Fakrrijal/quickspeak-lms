import { createFileRoute } from '@tanstack/react-router'
import { useEffect } from 'react'
import { StudentPaymentPageV3 } from '../components/student/StudentPaymentPageV3'

function StudentPaymentWithPickerFix() {
  useEffect(() => {
    const enhanceFilePicker = () => {
      const input = document.querySelector<HTMLInputElement>('#student-payment-upload input[type="file"]')
      if (!input || input.dataset.quickSpeakPicker === '1') return

      input.dataset.quickSpeakPicker = '1'
      input.accept = 'image/*,.pdf'
      input.classList.add('sr-only')

      const pickerButton = document.createElement('button')
      pickerButton.type = 'button'
      pickerButton.textContent = 'Choose from Gallery / File'
      pickerButton.className = 'mt-2 inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50'
      pickerButton.addEventListener('click', () => input.click())

      input.parentElement?.parentElement?.insertBefore(pickerButton, input.parentElement)
    }

    enhanceFilePicker()
    const observer = new MutationObserver(enhanceFilePicker)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => observer.disconnect()
  }, [])

  return (
    <div id="student-payment-upload">
      <StudentPaymentPageV3 />
    </div>
  )
}

export const Route = createFileRoute('/student-payment')({
  component: StudentPaymentWithPickerFix,
})
