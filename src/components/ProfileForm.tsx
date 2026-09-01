import { useEffect, useState } from 'react'
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

  useEffect(() => {
    if (!profile) return
    setFullName(profile.full_name)
    setPhone(profile.phone ?? '')
    setAddress(profile.address ?? '')
  }, [profile])

  const initials = profile?.full_name.trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase() || '?'

  return <form onSubmit={(event) => { event.preventDefault(); void onSave({ fullName, phone, address }, avatarFile).then(() => setAvatarFile(null)) }} className="mt-6 max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
    <div className="flex items-center gap-4"><div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-200 text-xl font-semibold text-slate-700">{avatarUrl ? <img src={avatarUrl} alt="Profile avatar" className="h-full w-full object-cover" /> : initials}</div><label className="text-sm font-medium text-slate-700">Change Photo<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setAvatarFile(event.target.files?.[0] ?? null)} className="mt-2 block w-full text-sm text-slate-600" /></label></div>
    <div className="mt-6 grid gap-4"><label className="text-sm font-medium text-slate-700">Full Name<input required value={fullName} onChange={(event) => setFullName(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" /></label><label className="text-sm font-medium text-slate-700">Email<input readOnly value={profile?.email ?? ''} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-slate-600" /></label><label className="text-sm font-medium text-slate-700">Phone<input value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" /></label><label className="text-sm font-medium text-slate-700">Address<textarea value={address} onChange={(event) => setAddress(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" rows={3} /></label><label className="text-sm font-medium text-slate-700">Role<input readOnly value={profile?.role === 'teacher' ? 'Teacher' : 'Student'} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-slate-600" /></label><label className="text-sm font-medium text-slate-700">{levelTitle}<input readOnly value={levelLabel} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-slate-600" /></label></div>
    <button type="submit" disabled={saving || !profile} className="mt-6 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Saving...' : 'Save Changes'}</button>
  </form>
}
