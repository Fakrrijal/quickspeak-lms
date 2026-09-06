import { supabase } from '../lib/supabase'

export type SystemErrorStatus = 'all' | 'open' | 'resolved'

export type SystemErrorEvent = {
  id: string
  status: SystemErrorStatus
  feature: string
  action: string
  message: string
  occurrence_count: number
  first_seen_at: string
  last_seen_at: string
  user_id: string | null
}

export async function getSystemErrorEvents(statusFilter?: SystemErrorStatus): Promise<SystemErrorEvent[]> {
  let query = supabase
    .from('system_error_events')
    .select('id,status,feature,action,message,occurrence_count,first_seen_at,last_seen_at,user_id')
    .order('last_seen_at', { ascending: false })

  if (statusFilter) {
    query = query.eq('status', statusFilter)
  }

  const { data, error } = await query

  if (error) {
    throw error
  }

  return (data ?? []) as SystemErrorEvent[]
}

export async function markSystemErrorResolved(errorId: string): Promise<void> {
  const { error } = await supabase
    .from('system_error_events')
    .update({ status: 'resolved' })
    .eq('id', errorId)

  if (error) {
    throw error
  }
}
