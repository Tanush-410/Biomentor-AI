import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Palette, Pin, Plus, StickyNote, Trash2, X } from 'lucide-react'
import { useRouter } from 'next/router'

import { useAuth } from '../../context/AuthContext'
import {
  createStickyNote,
  deleteStickyNote,
  listStickyNotes,
  updateStickyNote,
} from '../../lib/stickyNotesApi'
import { clamp } from '../../lib/stickyNotesLayout'

const NOTE_COLORS = [
  { id: 'white', label: 'White', classes: 'from-white via-zinc-50 to-zinc-100 border-zinc-300 text-zinc-950' },
  { id: 'silver', label: 'Silver', classes: 'from-zinc-100 via-zinc-200 to-zinc-300 border-zinc-400 text-zinc-950' },
  { id: 'graphite', label: 'Graphite', classes: 'from-zinc-800 via-zinc-900 to-black border-zinc-700 text-zinc-50' },
  { id: 'paper', label: 'Paper', classes: 'from-stone-50 via-zinc-50 to-white border-zinc-200 text-zinc-950' },
  { id: 'ink', label: 'Ink', classes: 'from-black via-zinc-950 to-zinc-900 border-zinc-700 text-white' },
]

const LEGACY_NOTE_COLOR_FALLBACKS = {
  amber: 'white',
  rose: 'paper',
  mint: 'silver',
  sky: 'silver',
  violet: 'graphite',
}

const DEFAULT_NOTE = {
  title: '',
  content: '',
  color: 'white',
  width: 320,
  height: 220,
}

const PROTECTED_PATHS = ['/', '/login', '/register', '/forgot-password']

function colorClasses(color) {
  const normalizedColor = LEGACY_NOTE_COLOR_FALLBACKS[color] || color
  return NOTE_COLORS.find((entry) => entry.id === normalizedColor)?.classes || NOTE_COLORS[0].classes
}

function getViewport() {
  if (typeof window === 'undefined') {
    return { width: 1440, height: 900 }
  }
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  }
}

function getDocumentBounds() {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return { width: 1440, height: 900 }
  }

  const root = document.documentElement
  const body = document.body
  return {
    width: Math.max(window.innerWidth, root.scrollWidth, body?.scrollWidth || 0),
    height: Math.max(window.innerHeight, root.scrollHeight, body?.scrollHeight || 0),
  }
}

function toPageUrl(asPath) {
  if (typeof window === 'undefined') {
    return asPath || '/'
  }
  return `${window.location.pathname}${window.location.search}`
}

function toStyle(note, viewport) {
  const fallbackLeft =
    (typeof window === 'undefined' ? 0 : window.scrollX) +
    clamp(note.x_ratio * viewport.width, 12, Math.max(12, viewport.width - note.width - 12))
  const fallbackTop =
    (typeof window === 'undefined' ? 0 : window.scrollY) +
    clamp(note.y_ratio * viewport.height, 12, Math.max(12, viewport.height - note.height - 12))

  return {
    left: note.x_position ?? fallbackLeft,
    top: note.y_position ?? fallbackTop,
    width: note.width,
    minHeight: note.height,
    zIndex: 120 + note.z_index,
  }
}

export default function StickyNotesLayer() {
  const router = useRouter()
  const { token, user, loading } = useAuth()
  const [notes, setNotes] = useState([])
  const [activeNoteId, setActiveNoteId] = useState(null)
  const [contextMenu, setContextMenu] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [statusMessage, setStatusMessage] = useState(null)
  const [statusTone, setStatusTone] = useState('neutral')
  const [viewport, setViewport] = useState(getViewport)
  const draggingRef = useRef(null)
  const notesRef = useRef([])
  const statusTimerRef = useRef(null)
  const saveTimersRef = useRef(new Map())
  const saveQueuesRef = useRef(new Map())
  const positionSavesRef = useRef(new Map())
  const deletedNoteIdsRef = useRef(new Set())

  const currentPageUrl = useMemo(() => toPageUrl(router.asPath), [router.asPath])
  const isEnabledPage = token && !loading && !PROTECTED_PATHS.includes(router.pathname)

  useEffect(() => {
    notesRef.current = notes
  }, [notes])

  useEffect(() => () => {
    if (statusTimerRef.current) {
      window.clearTimeout(statusTimerRef.current)
    }
    saveTimersRef.current.forEach(({ timer }) => window.clearTimeout(timer))
    saveTimersRef.current.clear()
  }, [])

  const showStatus = (message, tone = 'neutral') => {
    setStatusMessage(message)
    setStatusTone(tone)
    if (typeof window !== 'undefined') {
      if (statusTimerRef.current) {
        window.clearTimeout(statusTimerRef.current)
      }
      statusTimerRef.current = window.setTimeout(() => {
        setStatusMessage(null)
      }, 2400)
    }
  }

  useEffect(() => {
    if (!isEnabledPage) {
      setNotes([])
      setContextMenu(null)
      setStatusMessage(null)
      return
    }

    let cancelled = false
    const loadNotes = async () => {
      try {
        const payload = await listStickyNotes(token, currentPageUrl)
        if (!cancelled) {
          const nextViewport = getViewport()
          setViewport(nextViewport)
          setNotes(payload || [])

          const legacyNotes = (payload || []).filter(
            (note) => note.x_position == null || note.y_position == null
          )
          if (legacyNotes.length > 0) {
            const scrollX = window.scrollX
            const scrollY = window.scrollY
            const migratedNotes = (payload || []).map((note) => {
              if (note.x_position != null && note.y_position != null) {
                return note
              }
              return {
                ...note,
                x_position:
                  scrollX +
                  clamp(
                    note.x_ratio * nextViewport.width,
                    12,
                    Math.max(12, nextViewport.width - note.width - 12)
                  ),
                y_position:
                  scrollY +
                  clamp(
                    note.y_ratio * nextViewport.height,
                    12,
                    Math.max(12, nextViewport.height - note.height - 12)
                  ),
              }
            })
            setNotes(migratedNotes)
            void Promise.allSettled(
              migratedNotes
                .filter((note) => legacyNotes.some((legacyNote) => legacyNote.id === note.id))
                .map((note) =>
                  updateStickyNote(token, note.id, {
                    x_position: Math.round(note.x_position),
                    y_position: Math.round(note.y_position),
                  })
                )
            )
          }
        }
      } catch (error) {
        console.error('Sticky notes failed to load:', error)
        if (!cancelled) {
          showStatus('Unable to load sticky notes for this page right now.', 'error')
        }
      }
    }

    loadNotes()
    return () => {
      cancelled = true
    }
  }, [currentPageUrl, isEnabledPage, token])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const handleResize = () => setViewport(getViewport())

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (!isEnabledPage || typeof window === 'undefined') {
      return undefined
    }

    const handleContextMenu = (event) => {
      const target = event.target
      if (target instanceof HTMLElement && target.closest('[data-sticky-note-root="true"]')) {
        return
      }
      event.preventDefault()
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        pageX: event.pageX,
        pageY: event.pageY,
      })
    }

    const closeMenu = () => setContextMenu(null)

    window.addEventListener('contextmenu', handleContextMenu)
    window.addEventListener('click', closeMenu)
    window.addEventListener('scroll', closeMenu, true)
    return () => {
      window.removeEventListener('contextmenu', handleContextMenu)
      window.removeEventListener('click', closeMenu)
      window.removeEventListener('scroll', closeMenu, true)
    }
  }, [isEnabledPage])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const handlePointerMove = (event) => {
      if (!draggingRef.current) {
        return
      }

      const { noteId, pointerOffsetX, pointerOffsetY } = draggingRef.current
      const documentBounds = getDocumentBounds()
      setNotes((current) =>
        current.map((note) => {
          if (note.id !== noteId) {
            return note
          }

          const left = clamp(
            event.pageX - pointerOffsetX,
            12,
            Math.max(12, documentBounds.width - note.width - 12)
          )
          const top = clamp(
            event.pageY - pointerOffsetY,
            12,
            Math.max(12, documentBounds.height - note.height - 12)
          )
          return {
            ...note,
            x_position: Math.round(left),
            y_position: Math.round(top),
            x_ratio: clamp((left - window.scrollX) / viewport.width, 0, 1),
            y_ratio: clamp((top - window.scrollY) / viewport.height, 0, 1),
          }
        })
      )
    }

    const handlePointerUp = async () => {
      if (!draggingRef.current) {
        return
      }

      const { noteId, previousNotes } = draggingRef.current
      draggingRef.current = null
      const note = notesRef.current.find((entry) => entry.id === noteId)
      if (!note) {
        return
      }

      const positionSave = updateStickyNote(token, note.id, {
        x_ratio: note.x_ratio,
        y_ratio: note.y_ratio,
        x_position: note.x_position,
        y_position: note.y_position,
      })
      positionSavesRef.current.set(note.id, positionSave)

      try {
        await positionSave
        if (deletedNoteIdsRef.current.has(note.id)) {
          return
        }
        showStatus('Sticky note saved.', 'success')
      } catch (error) {
        if (deletedNoteIdsRef.current.has(note.id)) {
          return
        }
        console.error('Sticky note position failed to persist:', error)
        setNotes(previousNotes)
        showStatus('Unable to save sticky note changes right now.', 'error')
      } finally {
        if (positionSavesRef.current.get(note.id) === positionSave) {
          positionSavesRef.current.delete(note.id)
        }
      }
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [token, viewport.height, viewport.width])

  const handleCreateNote = async () => {
    if (!contextMenu || !token) {
      return
    }

    setIsSaving(true)
    try {
      const documentBounds = getDocumentBounds()
      const xPosition = clamp(
        contextMenu.pageX,
        12,
        Math.max(12, documentBounds.width - DEFAULT_NOTE.width - 12)
      )
      const yPosition = clamp(
        contextMenu.pageY,
        12,
        Math.max(12, documentBounds.height - DEFAULT_NOTE.height - 12)
      )
      const created = await createStickyNote(token, {
        ...DEFAULT_NOTE,
        page_url: currentPageUrl,
        x_ratio: clamp(contextMenu.x / viewport.width, 0, 1),
        y_ratio: clamp(contextMenu.y / viewport.height, 0, 1),
        x_position: Math.round(xPosition),
        y_position: Math.round(yPosition),
        title: `${user?.role === 'educator' ? 'Educator' : 'Study'} note`,
        content: '',
      })
      setNotes((current) => [...current, created])
      setActiveNoteId(created.id)
      showStatus('Sticky note created.', 'success')
    } catch (error) {
      console.error('Sticky note creation failed:', error)
      showStatus('Unable to create a sticky note right now.', 'error')
    } finally {
      setContextMenu(null)
      setIsSaving(false)
    }
  }

  const handlePatchNote = (noteId, changes) => {
    if (deletedNoteIdsRef.current.has(noteId)) {
      return Promise.resolve()
    }

    const previousNotes = notesRef.current
    const preserveDraftOnFailure = Object.hasOwn(changes, 'title') || Object.hasOwn(changes, 'content')
    setNotes((current) => current.map((note) => (note.id === noteId ? { ...note, ...changes } : note)))

    const previousSave = saveQueuesRef.current.get(noteId) || Promise.resolve()
    const nextSave = previousSave
      .catch(() => undefined)
      .then(async () => {
        if (deletedNoteIdsRef.current.has(noteId)) {
          return
        }

        try {
          await updateStickyNote(token, noteId, changes)
          showStatus('Sticky note saved.', 'success')
        } catch (error) {
          if (deletedNoteIdsRef.current.has(noteId)) {
            return
          }
          console.error('Sticky note update failed:', error)
          if (!preserveDraftOnFailure) {
            setNotes(previousNotes)
          }
          showStatus('Unable to save sticky note changes right now.', 'error')
        }
      })

    saveQueuesRef.current.set(noteId, nextSave)
    void nextSave.finally(() => {
      if (saveQueuesRef.current.get(noteId) === nextSave) {
        saveQueuesRef.current.delete(noteId)
      }
    })
    return nextSave
  }

  const clearPendingNoteSave = (noteId) => {
    const pending = saveTimersRef.current.get(noteId)
    if (pending?.timer && typeof window !== 'undefined') {
      window.clearTimeout(pending.timer)
    }
    saveTimersRef.current.delete(noteId)
    return pending?.changes || {}
  }

  const scheduleNoteSave = (noteId, changes) => {
    if (typeof window === 'undefined') {
      return
    }

    const pendingChanges = clearPendingNoteSave(noteId)
    const nextChanges = { ...pendingChanges, ...changes }
    const timer = window.setTimeout(() => {
      saveTimersRef.current.delete(noteId)
      void handlePatchNote(noteId, nextChanges)
    }, 650)
    saveTimersRef.current.set(noteId, { timer, changes: nextChanges })
  }

  const flushNoteSave = (noteId, changes) => {
    const pendingChanges = clearPendingNoteSave(noteId)
    void handlePatchNote(noteId, { ...pendingChanges, ...changes })
  }

  const handleDeleteNote = async (noteId) => {
    clearPendingNoteSave(noteId)
    const previousNotes = notesRef.current
    deletedNoteIdsRef.current.add(noteId)
    setNotes((current) => current.filter((note) => note.id !== noteId))
    try {
      const pendingSave = saveQueuesRef.current.get(noteId)
      if (pendingSave) {
        await pendingSave.catch(() => undefined)
      }
      const pendingPositionSave = positionSavesRef.current.get(noteId)
      if (pendingPositionSave) {
        await pendingPositionSave.catch(() => undefined)
      }
      await deleteStickyNote(token, noteId)
      showStatus('Sticky note deleted.', 'success')
    } catch (error) {
      console.error('Sticky note delete failed:', error)
      deletedNoteIdsRef.current.delete(noteId)
      setNotes(previousNotes)
      showStatus('Unable to delete that sticky note right now.', 'error')
    }
  }

  const handleBringToFront = (noteId) => {
    const highestZIndex = notes.reduce((max, note) => Math.max(max, note.z_index), 0)
    void handlePatchNote(noteId, { z_index: highestZIndex + 1 })
  }

  if (!isEnabledPage) {
    return null
  }

  return (
    <>
      {statusMessage && (
        <div
          data-sticky-note-root="true"
          className={`fixed right-4 top-4 z-[320] rounded-2xl border px-4 py-3 text-sm font-semibold shadow-xl backdrop-blur ${
            statusTone === 'error'
              ? 'border-zinc-400 bg-white/95 text-zinc-900'
              : statusTone === 'success'
                ? 'border-zinc-300 bg-white/95 text-zinc-900'
                : 'border-zinc-200 bg-white/95 text-zinc-700'
          }`}
        >
          {statusMessage}
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 top-0 z-[90]">
        {notes.map((note) => {
          const isActive = activeNoteId === note.id
          const style = toStyle(note, viewport)
          return (
            <section
              key={note.id}
              data-sticky-note-root="true"
              style={style}
              className={`pointer-events-auto absolute overflow-hidden rounded-[24px] border bg-gradient-to-br shadow-[0_24px_60px_rgba(0,0,0,0.18)] transition ${
                colorClasses(note.color)
              } ${isActive ? 'ring-2 ring-black/30' : ''}`}
              onMouseDown={() => {
                setActiveNoteId(note.id)
                handleBringToFront(note.id)
              }}
            >
              <header
                className="flex cursor-grab items-center justify-between border-b border-black/10 px-4 py-3"
                onPointerDown={(event) => {
                  const rect = event.currentTarget.parentElement?.getBoundingClientRect()
                  if (!rect) {
                    return
                  }
                  draggingRef.current = {
                    noteId: note.id,
                    pointerOffsetX: event.clientX - rect.left,
                    pointerOffsetY: event.clientY - rect.top,
                    previousNotes: notesRef.current,
                  }
                }}
              >
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em]">
                  <StickyNote className="h-3.5 w-3.5" />
                  Private note
                </div>
                <button
                  type="button"
                  className="rounded-full bg-white/55 p-1.5 transition hover:bg-white/80"
                  onClick={() => handleDeleteNote(note.id)}
                  aria-label="Delete sticky note"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </header>

              <div className="space-y-3 p-4">
                <input
                  value={note.title || ''}
                  onChange={(event) => {
                    const value = event.target.value
                    setNotes((current) => current.map((entry) => (entry.id === note.id ? { ...entry, title: value } : entry)))
                    scheduleNoteSave(note.id, { title: value })
                  }}
                  onBlur={(event) => flushNoteSave(note.id, { title: event.target.value })}
                  placeholder="Title"
                  maxLength={120}
                  className="w-full bg-transparent text-lg font-semibold outline-none placeholder:text-current/55"
                />
                <textarea
                  value={note.content || ''}
                  onChange={(event) => {
                    const value = event.target.value
                    setNotes((current) => current.map((entry) => (entry.id === note.id ? { ...entry, content: value } : entry)))
                    scheduleNoteSave(note.id, { content: value })
                  }}
                  onBlur={(event) => flushNoteSave(note.id, { content: event.target.value })}
                  placeholder="Type your note here..."
                  maxLength={4000}
                  className="min-h-[96px] w-full resize-none bg-transparent text-sm leading-6 outline-none placeholder:text-current/50"
                />
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 rounded-full bg-white/55 px-3 py-2">
                    <Palette className="h-3.5 w-3.5" />
                    {NOTE_COLORS.map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        aria-label={`Set note color to ${entry.label}`}
                        className={`h-4 w-4 rounded-full border border-black/10 transition ${
                          (LEGACY_NOTE_COLOR_FALLBACKS[note.color] || note.color) === entry.id
                            ? 'scale-110 ring-2 ring-black/30'
                            : ''
                        } ${
                          entry.id === 'white'
                            ? 'bg-white'
                            : entry.id === 'silver'
                              ? 'bg-zinc-300'
                              : entry.id === 'graphite'
                                ? 'bg-zinc-800'
                                : entry.id === 'paper'
                                  ? 'bg-zinc-100'
                                  : 'bg-black'
                        }`}
                        onClick={() => void handlePatchNote(note.id, { color: entry.id })}
                      />
                    ))}
                  </div>
                  <div className="rounded-full bg-white/55 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.24em]">
                    {currentPageUrl}
                  </div>
                </div>
              </div>
            </section>
          )
        })}
      </div>

      {contextMenu && (
        <div
          data-sticky-note-root="true"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
            zIndex: 300,
          }}
          className="fixed rounded-[20px] border border-zinc-200 bg-white/95 p-3 shadow-2xl backdrop-blur"
        >
          <div className="mb-2 flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">
            <div className="flex items-center gap-2">
              <Pin className="h-3.5 w-3.5" />
              Sticky notes
            </div>
            <button
              type="button"
              className="rounded-full p-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
              onClick={() => setContextMenu(null)}
              aria-label="Close sticky notes menu"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-semibold text-[#d9c25c] transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => void handleCreateNote()}
            disabled={isSaving}
          >
            <Plus className="h-4 w-4" />
            {isSaving ? 'Creating…' : 'Add sticky note here'}
          </button>
        </div>
      )}
    </>
  )
}
