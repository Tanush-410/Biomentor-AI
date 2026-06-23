const DEFAULT_HOSTED_BACKEND_ORIGIN = 'https://biomentor-ai.onrender.com'
const DEFAULT_LOCAL_BACKEND_ORIGIN = 'http://localhost:8000'

const normalizeApiBase = (baseUrl = '') => String(baseUrl || '').replace(/\/+$/, '')

function isLoopbackOrigin(baseUrl = '') {
  try {
    const hostname = new URL(baseUrl).hostname
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0'
  } catch {
    return false
  }
}

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

function configuredBackendOrigin() {
  const configured = normalizeApiBase(process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || '')
  if (configured && !(isHostedFrontend() && isLoopbackOrigin(configured))) {
    return configured
  }
  return isHostedFrontend() ? DEFAULT_HOSTED_BACKEND_ORIGIN : DEFAULT_LOCAL_BACKEND_ORIGIN
}

export function backendOrigin() {
  return configuredBackendOrigin()
}

export function directBackendApi(path = '') {
  const base = configuredBackendOrigin()
  return base ? `${base}/api${path}` : null
}

export function proxiedBackendApi(path = '') {
  const normalizedPath = String(path || '').replace(/^\/api/, '')
  return `/api/backend${normalizedPath}`
}

function shouldPreferProxy() {
  return process.env.NEXT_PUBLIC_API_PROXY_ONLY === 'true'
}

export function buildBackendCandidates(path = '', { preferProxy = shouldPreferProxy() } = {}) {
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

export function normalizeListPayload(payload, keys = []) {
  if (Array.isArray(payload)) {
    return payload
  }

  const candidateKeys = Array.isArray(keys) ? keys : [keys]
  for (const key of candidateKeys) {
    if (Array.isArray(payload?.[key])) {
      return payload[key]
    }
  }

  return []
}

export async function fetchBackendWithFallback(path, options = {}, runtime = {}) {
  const method = String(options.method || 'GET').toUpperCase()
  const defaultRetryOnStatuses = ['GET', 'HEAD'].includes(method)
    ? [401, 403, 404, 408, 409, 413, 429, 500, 502, 503, 504]
    : [401, 403, 404, 408, 409, 413, 429, 502, 503, 504]
  const { preferProxy = shouldPreferProxy(), retryOnStatuses = defaultRetryOnStatuses } = runtime
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

export async function requestBackendJson(path, options = {}, runtime = {}) {
  const method = String(options.method || 'GET').toUpperCase()
  const body = options.body
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData
  const resolvedBody = body == null || isFormData || typeof body === 'string'
    ? body
    : JSON.stringify(body)
  const headers = {
    ...(resolvedBody != null && !isFormData && typeof resolvedBody !== 'string' ? { 'Content-Type': 'application/json' } : {}),
    ...(resolvedBody != null && typeof resolvedBody === 'string' && !(options.headers || {})['Content-Type'] ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {}),
  }

  const defaultRetryOnStatuses = ['GET', 'HEAD'].includes(method)
    ? [401, 403, 404, 408, 409, 413, 429, 500, 502, 503, 504]
    : [401, 403, 404, 408, 409, 413, 429, 502, 503, 504]
  const { preferProxy = shouldPreferProxy(), retryOnStatuses = defaultRetryOnStatuses } = runtime
  const candidates = buildBackendCandidates(path, { preferProxy })
  const acceptsEmptyResponse = method === 'DELETE' || method === 'HEAD'
  const canRetryEmptyJson = candidates.length > 1 && !isFormData && !acceptsEmptyResponse
  let lastError = null

  for (let index = 0; index < candidates.length; index += 1) {
    const url = candidates[index]

    let response
    try {
      response = await fetch(url, {
        ...options,
        method,
        headers,
        body: resolvedBody,
      })
    } catch (error) {
      lastError = error
      continue
    }

    if (response.status === 204) {
      if (acceptsEmptyResponse) {
        return null
      }
      const shouldRetryEmptyResponse = canRetryEmptyJson && index < candidates.length - 1
      if (shouldRetryEmptyResponse) {
        lastError = new Error('Backend returned an empty JSON response.')
        continue
      }
      return null
    }

    const payload = await response.clone().json().catch(() => null)
    if (response.ok) {
      if (payload != null) {
        return payload
      }

      if (acceptsEmptyResponse) {
        return null
      }

      const shouldRetryEmptyJson = canRetryEmptyJson && index < candidates.length - 1
      if (shouldRetryEmptyJson) {
        lastError = new Error('Backend returned an empty JSON response.')
        continue
      }

      throw new Error('Backend returned an empty JSON response.')
    }

    const shouldRetry = index < candidates.length - 1 && retryOnStatuses.includes(response.status)
    const error = new Error(payload?.detail || payload?.message || (await readErrorDetail(response)) || 'Request failed')
    if (!shouldRetry) {
      throw error
    }
    lastError = error
  }

  throw lastError || new Error('Unable to reach the backend service.')
}

export function toWebSocketBase() {
  const configuredWsBase = normalizeApiBase(process.env.NEXT_PUBLIC_WS_URL || '')
  const configuredBase = (
    configuredWsBase && !(isHostedFrontend() && isLoopbackOrigin(configuredWsBase))
      ? configuredWsBase
      : configuredBackendOrigin()
  )
  if (!configuredBase) return ''
  if (configuredBase.startsWith('https://')) return configuredBase.replace('https://', 'wss://')
  if (configuredBase.startsWith('http://')) return configuredBase.replace('http://', 'ws://')
  return configuredBase
}
