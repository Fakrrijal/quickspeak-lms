const configuredAppUrl = import.meta.env.VITE_PUBLIC_APP_URL?.trim()

export function getAppUrl(): string {
  if (typeof window === 'undefined') {
    return configuredAppUrl?.replace(/\/$/, '') ?? ''
  }

  const hostname = window.location.hostname
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'

  if (isLocalhost && configuredAppUrl) {
    return configuredAppUrl.replace(/\/$/, '')
  }

  return window.location.origin
}

export function getAuthRedirect(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${getAppUrl()}${normalizedPath}`
}
