const normalizeApiBase = (baseUrl = '') => String(baseUrl || '').replace(/\/+$/, '')

function browserHostname() {
  if (typeof window === 'undefined') return ''
  return window.location?.hostname || ''
}

export function isHostedFrontend() {
  const hostname = browserHostname()
  return Boolean(
    process.env.NEXT_PUBLIC_API_PROXY_ONLY === 'true'
    || hostname.endsWith('.vercel.app')
    || hostname.endsWith('.netlify.app')
  )
}

export function directBackendApi(path = '') {
  const base = normalizeApiBase(process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || '')
  return base ? `${base}/api${path}` : null
}

export function proxiedBackendApi(path = '') {
  return `/api/backend${path}`
}

export function buildBackendCandidates(path = '', { preferProxy = isHostedFrontend() } = {}) {
  const preferred = preferProxy
    ? [proxiedBackendApi(path), directBackendApi(path)]
    : [directBackendApi(path), proxiedBackendApi(path)]
  const seen = new Set()
  return preferred.filter((candidate) => candidate && !seen.has(candidate) && seen.add(candidate))
}

export async function readErrorDetail(response) {
  const payload = await response.clone().json().catch(() => null)
  if (payload?.detail || payload?.message) {
    return payload.detail || payload.message
  }
  return response.text().catch(() => '')
}

export async function fetchBackendWithFallback(path, options = {}, runtime = {}) {
  const method = String(options.method || 'GET').toUpperCase()
  const defaultRetryOnStatuses = ['GET', 'HEAD'].includes(method)
    ? [401, 403, 404, 408, 409, 413, 429, 500, 502, 503, 504]
    : [401, 403, 404, 408, 409, 413, 429, 502, 503, 504]
  const { preferProxy = isHostedFrontend(), retryOnStatuses = defaultRetryOnStatuses } = runtime
  const candidates = buildBackendCandidates(path, { preferProxy })
  let lastError = null
  let firstBackendError = null

  for (let index = 0; index < candidates.length; index += 1) {
    const url = candidates[index]
    try {
      const response = await fetch(url, options)
      if (response.ok) {
        return response
      }

      const shouldRetry = index < candidates.length - 1 && retryOnStatuses.includes(response.status)
      if (!shouldRetry) {
        return response
      }

      firstBackendError ||= new Error((await readErrorDetail(response)) || `Request failed with status ${response.status}`)
      lastError = firstBackendError
    } catch (error) {
      lastError = error
    }
  }

  throw firstBackendError || lastError || new Error('Unable to reach the backend service.')
}

export function toWebSocketBase() {
  const configuredBase = normalizeApiBase(process.env.NEXT_PUBLIC_WS_URL || process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || '')
  if (!configuredBase) return ''
  if (configuredBase.startsWith('https://')) return configuredBase.replace('https://', 'wss://')
  if (configuredBase.startsWith('http://')) return configuredBase.replace('http://', 'ws://')
  return configuredBase
}
