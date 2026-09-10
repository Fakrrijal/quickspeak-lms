import { useEffect, useState, type FormEvent } from 'react'
import type { MyProfile } from '../services/profile.service'

type ProfileFormProps = {
  avatarUrl: string | null
  levelLabel: string
  levelTitle: string
  profile: MyProfile | null
  saving: boolean
  onSave: (input: { fullName: string; phone: string; address: string }, avatar: File | null) => Promise<unknown>
}

export function ProfileForm({ avatarUrl, levelLabel, levelTitle, profile, saving, onSave }: ProfileFormProps) {
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!profile) return
    setFullName(profile.full_name)
    setPhone(profile.phone ?? '')
    setAddress(profile.address ?? '')
  }, [profile])

  useEffect(() => {
    const newPreviewUrl = avatarFile ? URL.createObjectURL(avatarFile) : null
    setPreviewUrl(newPreviewUrl)
    return () => {
      if (newPreviewUrl) {
        URL.revokeObjectURL(newPreviewUrl)
      }
    }
  }, [avatarFile])

  const initials = profile?.full_name.trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase() || '?'

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await onSave({ fullName: fullName.trim(), phone: phone.trim(), address: address.trim() }, avatarFile)
    setAvatarFile(null)
    setPreviewUrl(null)
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-6 py-5 sm:px-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-xl font-bold text-slate-600 ring-1 ring-slate-200">
              {previewUrl || avatarUrl ? <img src={previewUrl || avatarUrl || undefined} alt="Profile avatar" className="h-full w-full object-cover" /> : initials}
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500">Profile photo</p>
              <p className="mt-1 text-base font-bold text-[#102449]">Keep your profile up to date</p>
              <label className="mt-2 inline-flex cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
                {avatarFile ? 'Change selected photo' : 'Change Photo'}
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setAvatarFile(event.target.files?.[0] ?? null)} className="sr-only" />
              </label>
              {avatarFile && <p className="mt-2 max-w-xs truncate text-xs text-slate-500">{avatarFile.name}</p>}
            </div>
          </div>
          <div className="rounded-lg bg-slate-50 px-4 py-3 sm:max-w-xs">
            <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-500">Account role</p>
            <p className="mt-1 text-sm font-bold text-slate-900">{profile?.role === 'teacher' ? 'Teacher' : 'Student'}</p>
          </div>
        </div>
      </div>

      <div className="p-6 sm:p-7">
        <div className="grid gap-5 lg:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">
            Full Name
            <input required value={fullName} onChange={(event) => setFullName(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Email
            <input readOnly value={profile?.email ?? ''} className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-600" />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Phone
            <input value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            {levelTitle}
            <input readOnly value={levelLabel} className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-600" />
          </label>
          <label className="text-sm font-semibold text-slate-700 lg:col-span-2">
            Address
            <textarea value={address} onChange={(event) => setAddress(event.target.value)} className="mt-2 w-full resize-y rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" rows={4} />
          </label>
        </div>

        <div className="mt-6 flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-slate-500">Your email, role, and current level are managed by QuickSpeak.</p>
          <button type="submit" disabled={saving || !profile} className="inline-flex items-center justify-center rounded-lg bg-[#102449] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#17325f] disabled:cursor-not-allowed disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </form>
  )
}
