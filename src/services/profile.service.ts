import { supabase } from '../lib/supabase'

export type MyProfile = {
  id: string
  full_name: string
  email: string
  phone: string | null
  address: string | null
  avatar_url: string | null
  role: 'student' | 'teacher' | 'admin'
  status: string
}

export type UpdateMyProfileInput = {
  fullName: string
  phone: string
  address: string
  avatarPath: string | null
}

const avatarBucket = 'avatars'
const maximumAvatarFileSize = 2 * 1024 * 1024
const acceptedAvatarTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])

export async function getMyProfile(): Promise<MyProfile> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone, address, avatar_url, role, status')
    .single()

  if (error) throw error
  return data as MyProfile
}

export function validateAvatarFile(file: File) {
  if (!acceptedAvatarTypes.has(file.type)) {
    throw new Error('Avatar must be a JPG, PNG, or WebP image.')
  }
  if (file.size <= 0 || file.size > maximumAvatarFileSize) {
    throw new Error('Avatar must be between 1 byte and 2 MiB.')
  }
}

function avatarExtension(file: File) {
  if (file.type === 'image/jpeg') return 'jpg'
  if (file.type === 'image/png') return 'png'
  return 'webp'
}

export async function uploadMyAvatar(file: File) {
  validateAvatarFile(file)
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  if (!userData.user) throw new Error('Authentication is required.')

  const path = `${userData.user.id}/${crypto.randomUUID()}.${avatarExtension(file)}`
  const { error } = await supabase.storage.from(avatarBucket).upload(path, file, {
    contentType: file.type,
    upsert: false,
  })
  if (error) throw error
  return path
}

export async function removeMyAvatar(path: string) {
  const { error } = await supabase.storage.from(avatarBucket).remove([path])
  if (error) throw error
}

export async function createMyAvatarUrl(path: string | null) {
  if (!path) return null
  const { data, error } = await supabase.storage.from(avatarBucket).createSignedUrl(path, 60 * 60)
  if (error) throw error
  return data.signedUrl
}

export async function updateMyProfile(input: UpdateMyProfileInput) {
  const { error } = await supabase.rpc('update_my_profile', {
    p_full_name: input.fullName,
    p_phone: input.phone,
    p_address: input.address,
    p_avatar_url: input.avatarPath,
  })
  if (error) throw error
  return getMyProfile()
}
