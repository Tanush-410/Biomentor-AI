import { requestBackendJson } from './backendApi'

const STICKY_NOTES_PATH = '/sticky-notes'

export function buildStickyNotesUrl(pageUrl) {
  const encoded = pageUrl ? `?page_url=${encodeURIComponent(pageUrl)}` : ''
  return `/api${STICKY_NOTES_PATH}${encoded}`
}

export function listStickyNotes(token, pageUrl) {
  return requestBackendJson(`${STICKY_NOTES_PATH}${pageUrl ? `?page_url=${encodeURIComponent(pageUrl)}` : ''}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  })
}

export function createStickyNote(token, payload) {
  return requestBackendJson(STICKY_NOTES_PATH, {
    method: 'POST',
    body: payload,
    headers: { Authorization: `Bearer ${token}` },
  })
}

export function updateStickyNote(token, noteId, payload) {
  return requestBackendJson(`${STICKY_NOTES_PATH}/${noteId}`, {
    method: 'PATCH',
    body: payload,
    headers: { Authorization: `Bearer ${token}` },
  })
}

export function deleteStickyNote(token, noteId) {
  return requestBackendJson(`${STICKY_NOTES_PATH}/${noteId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
}

export { STICKY_NOTES_PATH as STICKY_NOTES_PROXY_BASE }
