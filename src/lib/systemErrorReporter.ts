import { supabase } from './supabase'

export type CriticalFeature =
  | 'LOGIN'
  | 'REGISTER'
  | 'DASHBOARD'
  | 'ATTENDANCE'
  | 'PAYMENT_UPLOAD'
  | 'TEACHER_FEE'
  | 'PAYMENT_VERIFICATION'

interface SystemErrorOptions {
  feature: CriticalFeature
  action: string
  error: unknown
  durationMs?: number
  metadata?: Record<string, unknown>
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error

  try {
    return JSON.stringify(error)
  } catch {
    return 'Unknown error'
  }
}

export async function reportSystemError({
  feature,
  action,
  error,
  durationMs,
  metadata,
}: SystemErrorOptions): Promise<void> {
  const message = getErrorMessage(error)

  // Monitoring must never break the application.
  console.error(`[${feature}] ${action}:`, error)

  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL

    if (!supabaseUrl) {
      return
    }

    const { data } = await supabase.auth.getSession()
    const accessToken = data.session?.access_token ?? null

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`
    }

    await fetch(
      `${supabaseUrl}/functions/v1/report-system-error`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          feature,
          action,
          message,
          durationMs,
          metadata,
          path: window.location.pathname,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
        }),
      },
    )
  } catch (reportingError) {
    // Never allow monitoring failure to affect the user-facing application.
    console.error(
      'Failed to report system error:',
      reportingError,
    )
  }
}