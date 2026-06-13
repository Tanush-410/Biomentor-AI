const STICKY_NOTES_PROXY_BASE = '/api/backend/sticky-notes'

function buildStickyNotesUrl(pageUrl) {
  const target = new URL(STICKY_NOTES_PROXY_BASE, 'http://localhost')
  if (pageUrl) {
    target.searchParams.set('page_url', pageUrl)
  }
  return `${target.pathname}${target.search}`
}

async function stickyNotesRequest(path, token, options = {}) {
  const response = await fetch(`${STICKY_NOTES_PROXY_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  })

  if (response.status === 204) {
    return null
  }

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.detail || payload.message || 'Sticky note request failed')
  }
  return payload
}

export function listStickyNotes(token, pageUrl) {
  return stickyNotesRequest(buildStickyNotesUrl(pageUrl).replace(STICKY_NOTES_PROXY_BASE, ''), token)
}

export function createStickyNote(token, payload) {
  return stickyNotesRequest('', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateStickyNote(token, noteId, payload) {
  return stickyNotesRequest(`/${noteId}`, token, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteStickyNote(token, noteId) {
  return stickyNotesRequest(`/${noteId}`, token, {
    method: 'DELETE',
  })
}

export { STICKY_NOTES_PROXY_BASE, buildStickyNotesUrl }
