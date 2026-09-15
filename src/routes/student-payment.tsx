import { createFileRoute } from '@tanstack/react-router'
import { useEffect } from 'react'
import { StudentPaymentPageV3 } from '../components/student/StudentPaymentPageV3'

type FileHandleLike = { getFile: () => Promise<File> }
type FilePickerWindow = Window & {
  showOpenFilePicker?: (options?: {
    multiple?: boolean
    types?: Array<{ description?: string; accept: Record<string, string[]> }>
  }) => Promise<FileHandleLike[]>
}

function StudentPaymentRoute() {
  useEffect(() => {
    let cleanup: (() => void) | null = null
    let observer: MutationObserver | null = null

    const installGalleryOnlyPicker = () => {
      if (cleanup) return true

      const originalInput = document.getElementById('student-payment-proof-input') as HTMLInputElement | null
      const originalButton = Array.from(document.querySelectorAll('button')).find(
        (button) => button.textContent?.trim() === 'Choose from Gallery / File',
      ) as HTMLButtonElement | undefined

      if (!originalInput || !originalButton) return false

      const parent = originalButton.parentElement
      if (!parent) return false

      const galleryButton = document.createElement('button')
      galleryButton.type = 'button'
      galleryButton.className = 'mt-2.5 inline-flex w-full cursor-pointer items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50'
      galleryButton.textContent = 'Choose from Gallery / File'

      const galleryInput = document.createElement('input')
      galleryInput.type = 'file'
      galleryInput.className = 'hidden'
      galleryInput.setAttribute('aria-label', 'Choose payment proof from gallery or file')

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
      const handleGalleryClick = async () => {
        const pickerWindow = window as FilePickerWindow
        if (pickerWindow.showOpenFilePicker) {
          try {
            const [handle] = await pickerWindow.showOpenFilePicker({
              multiple: false,
              types: [
                {
                  description: 'Payment proof',
                  accept: {
                    'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'],
                    'application/pdf': ['.pdf'],
                  },
                },
              ],
            })
            if (handle) adoptFile(await handle.getFile())
            return
          } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') return
          }
        }
        galleryInput.click()
      }

      galleryInput.addEventListener('change', handleGalleryChange)
      galleryButton.addEventListener('click', handleGalleryClick)
      parent.replaceChild(galleryButton, originalButton)
      parent.insertBefore(galleryInput, galleryButton)

      cleanup = () => {
        galleryInput.removeEventListener('change', handleGalleryChange)
        galleryButton.removeEventListener('click', handleGalleryClick)
        galleryInput.remove()
        galleryButton.replaceWith(originalButton)
        cleanup = null
      }

      return true
    }

    if (!installGalleryOnlyPicker()) {
      observer = new MutationObserver(() => {
        if (installGalleryOnlyPicker()) observer?.disconnect()
      })
      observer.observe(document.body, { childList: true, subtree: true })
    }

    return () => {
      observer?.disconnect()
      cleanup?.()
    }
  }, [])

  return <StudentPaymentPageV3 />
}

export const Route = createFileRoute('/student-payment')({
  component: StudentPaymentRoute,
})
