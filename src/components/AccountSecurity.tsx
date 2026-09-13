import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

type AccountSecurityProps = {
  email: string | null
}

type FieldName = 'current' | 'new' | 'confirm'

function EyeIcon({ hidden }: { hidden: boolean }) {
  return hidden ? (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 fill-none stroke-current stroke-2">
      <path d="M3 3l18 18" />
      <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
      <path d="M9.9 4.2A12.4 12.4 0 0 1 12 4c5 0 8.7 3.4 10 8-.4 1.3-1 2.5-1.8 3.5" />
      <path d="M6.3 6.3C4.8 7.5 3.6 9.3 2 12c1.3 4.6 5 8 10 8 1.5 0 2.9-.3 4.2-.8" />
    </svg>
  ) : (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 fill-none stroke-current stroke-2">
      <path d="M2 12s3.7-7 10-7 10 7 10 7-3.7 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  )
}

function passwordError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unable to change password.'
  if (/invalid login credentials|invalid credentials/i.test(message)) return 'Current password is incorrect.'
  if (/same password/i.test(message)) return 'New password must be different from your current password.'
  return message
}

export function AccountSecurity({ email }: AccountSecurityProps) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [show, setShow] = useState<Record<FieldName, boolean>>({ current: false, new: false, confirm: false })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const toggle = (field: FieldName) => setShow((value) => ({ ...value, [field]: !value[field] }))

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    if (!email) {
      setError('Your account email is not available. Please refresh the page and try again.')
      return
    }
    if (newPassword.length < 4) {
      setError('New password must be at least 4 characters long.')
      return
    }
    if (newPassword === currentPassword) {
      setError('New password must be different from your current password.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.')
      return
    }

    setSaving(true)
    try {
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      })
      if (verifyError) throw verifyError

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
      if (updateError) throw updateError

      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setSuccess('Password changed successfully.')
    } catch (submitError) {
      setError(passwordError(submitError))
    } finally {
      setSaving(false)
    }
  }

  const fields: Array<{ key: FieldName; label: string; value: string; setValue: (value: string) => void }> = [
    { key: 'current', label: 'Current Password', value: currentPassword, setValue: setCurrentPassword },
    { key: 'new', label: 'New Password', value: newPassword, setValue: setNewPassword },
    { key: 'confirm', label: 'Confirm New Password', value: confirmPassword, setValue: setConfirmPassword },
  ]

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-labelledby="account-security-title">
      <div className="border-b border-slate-200 bg-slate-50/70 px-6 py-5 sm:px-7">
        <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-blue-700">Security</p>
        <h2 id="account-security-title" className="mt-1 text-lg font-bold text-[#102449]">Account Security</h2>
        <p className="mt-1 text-sm text-slate-600">Change your QuickSpeak login password.</p>
      </div>

      <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5 px-6 py-6 sm:px-7 sm:py-7">
        <div className="grid gap-5 lg:grid-cols-2">
          {fields.map((field) => (
            <label key={field.key} className={`text-sm font-semibold text-slate-700 ${field.key === 'confirm' ? 'lg:col-span-2' : ''}`}>
              {field.label}
              <span className="relative mt-2 block">
                <input
                  required
                  type={show[field.key] ? 'text' : 'password'}
                  value={field.value}
                  onChange={(event) => field.setValue(event.target.value)}
                  autoComplete={field.key === 'current' ? 'current-password' : 'new-password'}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 pr-12 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
                <button
                  type="button"
                  onClick={() => toggle(field.key)}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-500 transition hover:text-slate-800"
                  aria-label={show[field.key] ? `Hide ${field.label.toLowerCase()}` : `Show ${field.label.toLowerCase()}`}
                >
                  <EyeIcon hidden={show[field.key]} />
                </button>
              </span>
            </label>
          ))}
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Password must be at least 4 characters. Use a password you do not use for other accounts.
        </div>

        {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">{error}</p>}
        {success && <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{success}</p>}

        <div className="flex justify-end border-t border-slate-200 pt-5">
          <button type="submit" disabled={saving} className="inline-flex items-center justify-center rounded-lg bg-[#102449] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#17325f] disabled:cursor-not-allowed disabled:opacity-50">
            {saving ? 'Changing Password...' : 'Change Password'}
          </button>
        </div>
      </form>
    </section>
  )
}
