import { supabase } from '../lib/supabase'

export type AdminEbook = {
  ebook_id: string
  level_id: string
  level_name: string
  level_number: number
  title: string
  heyzine_url: string
  status: 'draft' | 'published' | 'archived'
  created_at: string
  updated_at: string
}

export type CreateAdminEbookInput = {
  levelId: string
  title: string
  heyzineUrl: string
}

export type UpdateAdminEbookDraftInput = CreateAdminEbookInput & {
  ebookId: string
}

export async function listAdminEbooks() {
  const { data, error } = await supabase.rpc('admin_list_ebooks')

  if (error) {
    throw error
  }

  return (data ?? []) as AdminEbook[]
}

export async function createAdminEbook({
  levelId,
  title,
  heyzineUrl,
}: CreateAdminEbookInput) {
  const { data, error } = await supabase.rpc('admin_create_ebook', {
    p_level_id: levelId,
    p_title: title,
    p_heyzine_url: heyzineUrl,
  })

  if (error) {
    throw error
  }

  return (data?.[0] ?? null) as AdminEbook | null
}

export async function updateAdminEbookDraft({
  ebookId,
  levelId,
  title,
  heyzineUrl,
}: UpdateAdminEbookDraftInput) {
  const { data, error } = await supabase.rpc('admin_update_ebook_draft', {
    p_ebook_id: ebookId,
    p_level_id: levelId,
    p_title: title,
    p_heyzine_url: heyzineUrl,
  })

  if (error) {
    throw error
  }

  return (data?.[0] ?? null) as AdminEbook | null
}

export async function deleteAdminEbookDraft(ebookId: string) {
  const { data, error } = await supabase.rpc('admin_delete_ebook_draft', {
    p_ebook_id: ebookId,
  })

  if (error) {
    throw error
  }

  return data?.[0]?.ebook_id ?? null
}

export async function publishAdminEbook(ebookId: string) {
  const { data, error } = await supabase.rpc('admin_publish_ebook', {
    p_ebook_id: ebookId,
  })

  if (error) {
    throw error
  }

  return (data?.[0] ?? null) as AdminEbook | null
}

export async function archiveAdminEbook(ebookId: string) {
  const { data, error } = await supabase.rpc('admin_archive_ebook', {
    p_ebook_id: ebookId,
  })

  if (error) {
    throw error
  }

  return (data?.[0] ?? null) as AdminEbook | null
}
