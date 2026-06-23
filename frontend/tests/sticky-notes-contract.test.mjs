import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('sticky notes frontend helper routes private note traffic through the shared backend client', () => {
  const source = fs.readFileSync(new URL('../lib/stickyNotesApi.js', import.meta.url), 'utf8')
  assert.match(source, /import \{ requestBackendJson \} from '\.\/backendApi'/)
  assert.match(source, /const STICKY_NOTES_PATH = '\/sticky-notes'/)
  assert.match(source, /Authorization: `Bearer \$\{token\}`/)
  assert.match(source, /encodeURIComponent\(pageUrl\)/)
  assert.match(source, /export function listStickyNotes\(token, pageUrl\)/)
  assert.match(source, /export function createStickyNote\(token, payload\)/)
  assert.match(source, /export function updateStickyNote\(token, noteId, payload\)/)
  assert.match(source, /export function deleteStickyNote\(token, noteId\)/)
})

test('sticky notes layer mounts globally, opens from right click, and keys notes to the exact current page path', () => {
  const appSource = fs.readFileSync(new URL('../pages/_app.jsx', import.meta.url), 'utf8')
  const layerSource = fs.readFileSync(new URL('../components/sticky-notes/StickyNotesLayer.jsx', import.meta.url), 'utf8')
  assert.match(appSource, /<StickyNotesLayer \/>/)
  assert.match(layerSource, /window\.addEventListener\('contextmenu', handleContextMenu\)/)
  assert.match(layerSource, /return `\$\{window\.location\.pathname\}\$\{window\.location\.search\}`/)
  assert.match(layerSource, /resolveStickyNoteCollisions/)
  assert.match(layerSource, /data-sticky-note-root="true"/)
})

test('sticky notes layer includes request feedback and optimistic rollback protections', () => {
  const layerSource = fs.readFileSync(new URL('../components/sticky-notes/StickyNotesLayer.jsx', import.meta.url), 'utf8')
  assert.match(layerSource, /const \[statusMessage, setStatusMessage\] = useState\(null\)/)
  assert.match(layerSource, /const \[statusTone, setStatusTone\] = useState\('neutral'\)/)
  assert.match(layerSource, /previousNotes = notesRef\.current/)
  assert.match(layerSource, /setNotes\(previousNotes\)/)
  assert.match(layerSource, /Unable to save sticky note changes right now/)
  assert.match(layerSource, /Sticky note saved/)
})

test('sticky notes loading is tied to page and auth changes rather than viewport resize churn', () => {
  const layerSource = fs.readFileSync(new URL('../components/sticky-notes/StickyNotesLayer.jsx', import.meta.url), 'utf8')
  assert.match(layerSource, /\}, \[currentPageUrl, isEnabledPage, token\]\)/)
  assert.doesNotMatch(layerSource, /\}, \[currentPageUrl, isEnabledPage, token, viewport.height, viewport.width\]\)/)
})
