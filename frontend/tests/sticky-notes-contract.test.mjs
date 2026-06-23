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
  assert.match(layerSource, /data-sticky-note-root="true"/)
})

test('sticky notes preserve saved positions without collision-driven movement', () => {
  const layerSource = fs.readFileSync(new URL('../components/sticky-notes/StickyNotesLayer.jsx', import.meta.url), 'utf8')
  assert.doesNotMatch(layerSource, /resolveStickyNoteCollisions/)
  assert.match(layerSource, /setNotes\(payload \|\| \[\]\)/)
  assert.match(layerSource, /setNotes\(\(current\) => \[\.\.\.current, created\]\)/)
  assert.match(layerSource, /const handleResize = \(\) => setViewport\(getViewport\(\)\)/)
})

test('sticky notes use document coordinates so scrolling does not move them with the viewport', () => {
  const layerSource = fs.readFileSync(new URL('../components/sticky-notes/StickyNotesLayer.jsx', import.meta.url), 'utf8')
  assert.match(layerSource, /x_position/)
  assert.match(layerSource, /y_position/)
  assert.match(layerSource, /event\.pageX/)
  assert.match(layerSource, /event\.pageY/)
  assert.match(layerSource, /className="pointer-events-none absolute inset-x-0 top-0 z-\[90\]"/)
  assert.match(layerSource, /className=\{`pointer-events-auto absolute/)
  assert.doesNotMatch(layerSource, /className=\{`pointer-events-auto fixed/)
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

test('sticky note text autosaves, blur flushes, and delete cancels pending saves', () => {
  const layerSource = fs.readFileSync(new URL('../components/sticky-notes/StickyNotesLayer.jsx', import.meta.url), 'utf8')
  assert.match(layerSource, /const saveTimersRef = useRef\(new Map\(\)\)/)
  assert.match(layerSource, /const saveQueuesRef = useRef\(new Map\(\)\)/)
  assert.match(layerSource, /const positionSavesRef = useRef\(new Map\(\)\)/)
  assert.match(layerSource, /const scheduleNoteSave = \(noteId, changes\) =>/)
  assert.match(layerSource, /window\.setTimeout\(\(\) =>/)
  assert.match(layerSource, /const flushNoteSave = \(noteId, changes\) =>/)
  assert.match(layerSource, /clearPendingNoteSave\(noteId\)/)
  assert.match(layerSource, /scheduleNoteSave\(note\.id, \{ title: value \}\)/)
  assert.match(layerSource, /scheduleNoteSave\(note\.id, \{ content: value \}\)/)
  assert.match(layerSource, /flushNoteSave\(note\.id, \{ title: event\.target\.value \}\)/)
  assert.match(layerSource, /flushNoteSave\(note\.id, \{ content: event\.target\.value \}\)/)
  assert.match(layerSource, /const pendingSave = saveQueuesRef\.current\.get\(noteId\)/)
  assert.match(layerSource, /const pendingPositionSave = positionSavesRef\.current\.get\(noteId\)/)
  assert.match(layerSource, /await pendingSave\.catch\(\(\) => undefined\)/)
  assert.match(layerSource, /await pendingPositionSave\.catch\(\(\) => undefined\)/)
})

test('sticky notes loading is tied to page and auth changes rather than viewport resize churn', () => {
  const layerSource = fs.readFileSync(new URL('../components/sticky-notes/StickyNotesLayer.jsx', import.meta.url), 'utf8')
  assert.match(layerSource, /\}, \[currentPageUrl, isEnabledPage, token\]\)/)
  assert.doesNotMatch(layerSource, /\}, \[currentPageUrl, isEnabledPage, token, viewport.height, viewport.width\]\)/)
})
