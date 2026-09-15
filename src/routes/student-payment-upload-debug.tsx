import { useState, type ChangeEvent } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/student-payment-upload-debug')({
  component: StudentPaymentUploadDebugPage,
})

type SelectionState = {
  label: string
  hasFile: boolean
  fileName: string
  fileType: string
  fileSize: string
  fileCount: string
  inputValue: string
}

const emptySelection: SelectionState = {
  label: 'No selection event yet',
  hasFile: false,
  fileName: '—',
  fileType: '—',
  fileSize: '—',
  fileCount: '—',
  inputValue: '—',
}

function describeSelection(label: string, event: ChangeEvent<HTMLInputElement>): SelectionState {
  const file = event.currentTarget.files?.[0] ?? null
  return {
    label,
    hasFile: Boolean(file),
    fileName: file?.name ?? 'No file received',
    fileType: file?.type || '(empty MIME type)',
    fileSize: file ? `${(file.size / 1024 / 1024).toFixed(2)} MiB` : '—',
    fileCount: String(event.currentTarget.files?.length ?? 0),
    inputValue: event.currentTarget.value || '(empty)',
  }
}

function StudentPaymentUploadDebugPage() {
  const [selection, setSelection] = useState<SelectionState>(emptySelection)
  const [inputEvents, setInputEvents] = useState(0)
  const [changeEvents, setChangeEvents] = useState(0)

  const handleInput = () => {
    setInputEvents((current) => current + 1)
  }

  const handleChange = (label: string) => (event: ChangeEvent<HTMLInputElement>) => {
    setChangeEvents((current) => current + 1)
    setSelection(describeSelection(label, event))
  }

  return (
    <main className="mx-auto min-h-screen max-w-xl bg-slate-50 px-4 py-8 text-slate-900">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-700">QuickSpeak Diagnostic</p>
        <h1 className="mt-2 text-2xl font-extrabold text-[#102449]">Payment File Picker Test</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          This page does not upload or save anything. It only checks whether the browser delivers a File object after Gallery/File or Camera selection.
        </p>

        <div className="mt-6 space-y-4">
          <label className="block rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold">
            Gallery / File
            <input
              type="file"
              accept="image/*,.pdf"
              onInput={handleInput}
              onChange={handleChange('Gallery / File')}
              className="mt-3 block w-full text-xs font-normal text-slate-600"
            />
          </label>

          <label className="block rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold">
            Camera
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onInput={handleInput}
              onChange={handleChange('Camera')}
              className="mt-3 block w-full text-xs font-normal text-slate-600"
            />
          </label>
        </div>

        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
          <p className="font-extrabold text-[#102449]">Last event</p>
          <dl className="mt-3 grid grid-cols-[140px_1fr] gap-y-2">
            <dt className="text-slate-500">Source</dt><dd className="font-semibold break-words">{selection.label}</dd>
            <dt className="text-slate-500">File received</dt><dd className="font-semibold">{selection.hasFile ? 'YES' : 'NO'}</dd>
            <dt className="text-slate-500">File name</dt><dd className="font-semibold break-all">{selection.fileName}</dd>
            <dt className="text-slate-500">MIME type</dt><dd className="font-semibold break-all">{selection.fileType}</dd>
            <dt className="text-slate-500">File size</dt><dd className="font-semibold">{selection.fileSize}</dd>
            <dt className="text-slate-500">files.length</dt><dd className="font-semibold">{selection.fileCount}</dd>
            <dt className="text-slate-500">input.value</dt><dd className="font-semibold break-all">{selection.inputValue}</dd>
          </dl>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 p-4 text-sm">
          <p className="font-extrabold text-[#102449]">Event counters</p>
          <p className="mt-2">input events: <span className="font-bold">{inputEvents}</span></p>
          <p>change events: <span className="font-bold">{changeEvents}</span></p>
        </div>

        <button
          type="button"
          onClick={() => {
            setSelection(emptySelection)
            setInputEvents(0)
            setChangeEvents(0)
          }}
          className="mt-5 inline-flex rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
        >
          Reset Diagnostic
        </button>

        <p className="mt-5 text-xs leading-5 text-slate-500">
          Return to Payment after testing: <Link to="/student/payment" className="font-bold text-blue-700 underline">Student Payment</Link>
        </p>
      </section>
    </main>
  )
}
