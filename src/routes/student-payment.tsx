import { createFileRoute } from '@tanstack/react-router'
import { useEffect } from 'react'
import { StudentPaymentPageV3 } from '../components/student/StudentPaymentPageV3'

function StudentPaymentRoute() {
  useEffect(() => {
    const originalInput = document.getElementById('student-payment-proof-input') as HTMLInputElement | null
    const originalButton = Array.from(document.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Choose from Gallery / File',
    ) as HTMLButtonElement | undefined

    if (!originalInput || !originalButton) return

    const parent = originalButton.parentElement
    if (!parent) return

    const pickerRow = document.createElement('div')
    pickerRow.className = 'mt-2.5 grid grid-cols-2 gap-2'

    const createButton = (label: string) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'inline-flex w-full cursor-pointer items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50'
      button.textContent = label
      return button
    }

    const galleryButton = createButton('Gallery / File')
    const cameraButton = createButton('Camera')

    const galleryInput = document.createElement('input')
    galleryInput.type = 'file'
    galleryInput.className = 'hidden'
    galleryInput.setAttribute('aria-label', 'Choose payment proof from gallery or file')

    const cameraInput = document.createElement('input')
    cameraInput.type = 'file'
    cameraInput.accept = 'image/*'
    cameraInput.setAttribute('capture', 'environment')
    cameraInput.className = 'hidden'
    cameraInput.setAttribute('aria-label', 'Take payment proof photo with camera')

    const adoptFile = (file: File | null) => {
      if (!file) return
      try {
        const transfer = new DataTransfer()
        transfer.items.add(file)
        originalInput.files = transfer.files
        originalInput.dispatchEvent(new Event('input', { bubbles: true }))
        originalInput.dispatchEvent(new Event('change', { bubbles: true }))
      } catch {
        originalInput.dispatchEvent(new Event('change', { bubbles: true }))
      }
    }

    const handleGalleryChange = () => adoptFile(galleryInput.files?.[0] ?? null)
    const handleCameraChange = () => adoptFile(cameraInput.files?.[0] ?? null)

    galleryInput.addEventListener('change', handleGalleryChange)
    cameraInput.addEventListener('change', handleCameraChange)
    galleryButton.addEventListener('click', () => galleryInput.click())
    cameraButton.addEventListener('click', () => cameraInput.click())

    parent.insertBefore(pickerRow, originalButton)
    pickerRow.append(galleryButton, cameraButton)
    parent.insertBefore(galleryInput, originalInput)
    parent.insertBefore(cameraInput, originalInput)
    originalButton.style.display = 'none'

    return () => {
      galleryInput.removeEventListener('change', handleGalleryChange)
      cameraInput.removeEventListener('change', handleCameraChange)
      pickerRow.remove()
      galleryInput.remove()
      cameraInput.remove()
      originalButton.style.display = ''
    }
  }, [])

  return <StudentPaymentPageV3 />
}

export const Route = createFileRoute('/student-payment')({
  component: StudentPaymentRoute,
})
