import { supabase } from '../lib/supabase'

export type StudentEbook = {
  ebook_id: string
  level_id: string
  level_name: string
  level_number: number
  title: string
  heyzine_url: string
  is_unlocked: boolean
  thumbnail_url: string | null
}

async function getHeyzineThumbnail(url: string) {
  try {
    const response = await fetch(
      `https://heyzine.com/api1/oembed?url=${encodeURIComponent(url)}&format=json`,
      { headers: { Accept: 'application/json' } },
    )

    if (!response.ok) return null

    const payload = await response.json() as { thumbnail_url?: unknown }
    return typeof payload.thumbnail_url === 'string' ? payload.thumbnail_url : null
  } catch {
    return null
  }
}

export async function getMyPublishedEbooks(): Promise<StudentEbook[]> {
  const { data, error } = await supabase.rpc('get_my_published_ebooks')

  if (error) {
    throw error
  }

  const ebooks = (data ?? []) as Omit<StudentEbook, 'thumbnail_url'>[]
  return Promise.all(
    ebooks.map(async (ebook) => ({
      ...ebook,
      thumbnail_url: await getHeyzineThumbnail(ebook.heyzine_url),
    })),
  )
}

export async function getMyActiveLevelEbooks(): Promise<StudentEbook[]> {
  const ebooks = await getMyPublishedEbooks()
  return ebooks.filter((ebook) => ebook.is_unlocked)
}
