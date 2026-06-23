const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'content-length',
  'host',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
])

const DEFAULT_HOSTED_BACKEND_ORIGIN = 'https://biomentor-ai.onrender.com'
const DEFAULT_LOCAL_BACKEND_ORIGIN = 'http://localhost:8000'

export const config = {
  api: {
    bodyParser: false,
  },
}

function buildTargetUrl(pathSegments, query) {
  const configuredBaseUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || ''
  const isProductionLoopback = process.env.NODE_ENV === 'production'
    && /^(https?:\/\/)?(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?\/?$/i.test(configuredBaseUrl)
  const baseUrl = (
    configuredBaseUrl && !isProductionLoopback
      ? configuredBaseUrl
      : process.env.NODE_ENV === 'production'
        ? DEFAULT_HOSTED_BACKEND_ORIGIN
        : DEFAULT_LOCAL_BACKEND_ORIGIN
  ).replace(/\/+$/, '')
  const normalizedPath = pathSegments.join('/')
  const needsTrailingSlash = pathSegments.length === 1 && pathSegments[0] === 'documents'
  const target = new URL(`${baseUrl}/api/${normalizedPath}${needsTrailingSlash ? '/' : ''}`)

  Object.entries(query || {}).forEach(([key, value]) => {
    if (value == null) {
      return
    }
    if (Array.isArray(value)) {
      value.forEach((item) => target.searchParams.append(key, item))
      return
    }
    target.searchParams.set(key, value)
  })

  return target.toString()
}

function copyRequestHeaders(req) {
  const headers = {}
  Object.entries(req.headers || {}).forEach(([key, value]) => {
    if (!value || HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      return
    }
    headers[key] = value
  })
  return headers
}

async function readRequestBody(req) {
  const chunks = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return chunks.length ? Buffer.concat(chunks) : undefined
}

export default async function handler(req, res) {
  const pathSegments = Array.isArray(req.query.path) ? req.query.path : [req.query.path].filter(Boolean)
  if (!pathSegments.length) {
    res.status(400).json({ detail: 'Missing backend path.' })
    return
  }

  const upstreamUrl = buildTargetUrl(pathSegments, { ...req.query, path: undefined })
  const requestHeaders = copyRequestHeaders(req)
  requestHeaders['accept-encoding'] = 'identity'
  const hasBody = !['GET', 'HEAD'].includes(req.method)
  const requestBody = hasBody ? await readRequestBody(req) : undefined

  if (requestBody) {
    requestHeaders['content-length'] = String(requestBody.length)
  }

  let upstreamResponse
  try {
    upstreamResponse = await fetch(upstreamUrl, {
      method: req.method,
      headers: requestHeaders,
      body: requestBody,
    })
  } catch (error) {
    res.status(502).json({
      detail: error?.message || 'Unable to reach the backend service.',
    })
    return
  }

  res.status(upstreamResponse.status)
  res.setHeader('Cache-Control', 'private, no-store')

  upstreamResponse.headers.forEach((value, key) => {
    if (HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      return
    }
    if (key.toLowerCase() === 'content-disposition') {
      res.setHeader(key, value)
      return
    }
    res.setHeader(key, value)
  })

  const arrayBuffer = await upstreamResponse.arrayBuffer()
  res.end(Buffer.from(arrayBuffer))
}
