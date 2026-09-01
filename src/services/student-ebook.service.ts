import { supabase } from '../lib/supabase'

export type StudentEbook = {
  ebook_id: string
  level_id: string
  level_name: string
  level_number: number
  title: string
  heyzine_url: string
}

export async function getMyActiveLevelEbooks(): Promise<StudentEbook[]> {
  const { data, error } = await supabase.rpc('get_my_active_level_ebooks')

  if (error) {
    throw error
  }

  return (data ?? []) as StudentEbook[]
}
