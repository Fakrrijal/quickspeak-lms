import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createMyAvatarUrl,
  getMyProfile,
  removeMyAvatar,
  updateMyProfile,
  uploadMyAvatar,
  type UpdateMyProfileInput,
} from '../services/profile.service'

export function useProfile(userId: string | null, enabled: boolean) {
  const queryClient = useQueryClient()
  const profileQueryKey = ['my-profile', userId] as const
  const query = useQuery({
    queryKey: profileQueryKey,
    queryFn: getMyProfile,
    enabled: enabled && Boolean(userId),
  })
  const mutation = useMutation({
    mutationFn: async ({ input, avatarFile }: { input: Omit<UpdateMyProfileInput, 'avatarPath'>; avatarFile: File | null }) => {
      if (!userId) throw new Error('Authentication is required.')

      const previousAvatarPath = query.data?.avatar_url ?? null
      let uploadedAvatarPath: string | null = null

      try {
        uploadedAvatarPath = avatarFile ? await uploadMyAvatar(avatarFile) : previousAvatarPath
        const profile = await updateMyProfile({ ...input, avatarPath: uploadedAvatarPath })
        if (avatarFile && previousAvatarPath && previousAvatarPath !== uploadedAvatarPath) {
          await removeMyAvatar(previousAvatarPath)
        }
        return profile
      } catch (error) {
        if (uploadedAvatarPath && uploadedAvatarPath !== previousAvatarPath) {
          try { await removeMyAvatar(uploadedAvatarPath) } catch { /* preserve the original error */ }
        }
        throw error
      }
    },
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: profileQueryKey, exact: true }) },
  })
  const avatarQuery = useQuery({
    queryKey: ['my-avatar-url', userId, query.data?.avatar_url],
    queryFn: () => createMyAvatarUrl(query.data?.avatar_url ?? null),
    enabled: enabled && Boolean(userId) && Boolean(query.data?.avatar_url),
  })

  return {
    profile: query.data ?? null,
    avatarUrl: avatarQuery.data ?? null,
    loading: query.isLoading,
    saving: mutation.isPending,
    error: query.isError ? 'Unable to load your profile.' : mutation.isError ? 'Unable to save your profile. Please try again.' : null,
    success: mutation.isSuccess ? 'Profile saved successfully.' : null,
    saveProfile: mutation.mutateAsync,
    reload: query.refetch,
  }
}
