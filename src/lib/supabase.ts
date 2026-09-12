import { createClient } from '@supabase/supabase-js'

// Vite injects VITE_* values at build time. Cloudflare's current build
// configuration has not been reliably exposing them to every preview build,
// so keep a public-client fallback here to prevent a blank SPA when the build
// environment is missing. The publishable key is intended for browser use;
// database access remains protected by Supabase RLS.
const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  'https://qqexvikrcztgctlcivajf.supabase.co'
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_bg-WP3ZzYp09Vkv5LbK3YA_04Dzi2QN'

type EmailConfirmationCallback = {
  accessToken: string | null
  hasError: boolean
  isPresent: boolean
  refreshToken: string | null
  tokenType: string | null
  type: string | null
}

function readEmailConfirmationCallback(): EmailConfirmationCallback {
  if (typeof window === 'undefined') {
    return {
      accessToken: null,
      hasError: false,
      isPresent: false,
      refreshToken: null,
      tokenType: null,
      type: null,
    }
  }

  const query = new URLSearchParams(window.location.search)
  const hash = new URLSearchParams(window.location.hash.slice(1))
  const getParameter = (name: string) => hash.get(name) ?? query.get(name)
  const hasError = Boolean(
    getParameter('error')
    || getParameter('error_code')
    || getParameter('error_description')
    || getParameter('access_denied')
  )
  const accessToken = getParameter('access_token')
  const refreshToken = getParameter('refresh_token')
  const tokenType = getParameter('token_type')
  const type = getParameter('type')

  return {
    accessToken,
    hasError,
    isPresent: hasError || Boolean(accessToken || refreshToken || tokenType || type),
    refreshToken,
    tokenType,
    type,
  }
}

// Supabase may consume the implicit-flow hash as soon as the client is created.
// Capture it only for this initial confirmation navigation, then let the route
// consume it once so it cannot affect a later SPA navigation.
let pendingEmailConfirmationCallback =
  typeof window !== 'undefined' && window.location.pathname === '/email-confirmed'
    ? readEmailConfirmationCallback()
    : null

let pendingPasswordRecoveryCallback =
  typeof window !== 'undefined' && window.location.pathname === '/reset-password'
    ? readEmailConfirmationCallback()
    : null

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey,
)

export type EmailConfirmationResult =
  | 'success'
  | 'callback_error'
  | 'invalid_callback'
  | 'no_callback'

export type PasswordRecoveryResult =
  | 'success'
  | 'callback_error'
  | 'invalid_callback'
  | 'no_callback'

export function takeEmailConfirmationCallback(): EmailConfirmationCallback | null {
  const callback = pendingEmailConfirmationCallback
  pendingEmailConfirmationCallback = null
  return callback
}

export async function getEmailConfirmationResult(
  callback: EmailConfirmationCallback | null,
): Promise<EmailConfirmationResult> {
  if (!callback) {
    return 'no_callback'
  }

  if (callback.hasError) {
    return 'callback_error'
  }

  if (!callback.isPresent) {
    return 'no_callback'
  }

  if (
    callback.type !== 'signup'
    || !callback.accessToken
    || !callback.refreshToken
    || !callback.tokenType
  ) {
    return 'invalid_callback'
  }

  const { data, error } = await supabase.auth.getSession()

  if (error || !data.session) {
    return 'invalid_callback'
  }

  return data.session.access_token === callback.accessToken
    ? 'success'
    : 'invalid_callback'
}

export function takePasswordRecoveryCallback(): EmailConfirmationCallback | null {
  const callback = pendingPasswordRecoveryCallback
  pendingPasswordRecoveryCallback = null
  return callback
}

export async function getPasswordRecoveryResult(
  callback: EmailConfirmationCallback | null,
): Promise<PasswordRecoveryResult> {
  if (!callback) {
    return 'no_callback'
  }

  if (callback.hasError) {
    return 'callback_error'
  }

  if (
    callback.type !== 'recovery'
    || !callback.accessToken
    || !callback.refreshToken
    || !callback.tokenType
  ) {
    return 'invalid_callback'
  }

  const { data, error } = await supabase.auth.getSession()

  if (error || !data.session) {
    return 'invalid_callback'
  }

  return data.session.access_token === callback.accessToken
    ? 'success'
    : 'invalid_callback'
}
