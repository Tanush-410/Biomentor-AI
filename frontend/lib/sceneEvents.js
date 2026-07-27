/**
 * Pure event-sourcing reducer for the shared 3D scene inside a live
 * collaboration session. Every participant's browser holds the exact same
 * state because it's built the same way everywhere: fold every "shape_*"
 * collaboration event, in order, over an empty scene.
 *
 * This is intentionally backend-agnostic -- it doesn't know about
 * websockets or REST calls. The collaboration hub page is responsible for
 * turning event history / websocket messages into calls to
 * applySceneEvent(), and for constructing shape_* events to send.
 */

export const SHAPE_EVENT_TYPES = new Set([
  'shape_create',
  'shape_update',
  'shape_delete',
  'shape_connect',
  'shape_disconnect',
  'shape_clear'
])

export function isSceneEvent(event) {
  return Boolean(event) && SHAPE_EVENT_TYPES.has(event.event_type)
}

export function createEmptyScene() {
  return { shapesById: {}, bondsById: {} }
}

/**
 * Apply a single collaboration event to a scene state, returning a new
 * state (never mutates the input). Unknown event types, or events missing
 * the metadata they need, are no-ops -- this keeps replay resilient to a
 * malformed or unrelated event turning up in the same event stream.
 */
export function applySceneEvent(state, event) {
  const metadata = event?.metadata || {}

  switch (event?.event_type) {
    case 'shape_create': {
      if (!metadata.shape?.id) return state
      return {
        ...state,
        shapesById: { ...state.shapesById, [metadata.shape.id]: metadata.shape }
      }
    }

    case 'shape_update': {
      if (!metadata.shapeId || !state.shapesById[metadata.shapeId]) return state
      return {
        ...state,
        shapesById: {
          ...state.shapesById,
          [metadata.shapeId]: { ...state.shapesById[metadata.shapeId], ...(metadata.patch || {}) }
        }
      }
    }

    case 'shape_delete': {
      if (!metadata.shapeId || !state.shapesById[metadata.shapeId]) return state
      const nextShapes = { ...state.shapesById }
      delete nextShapes[metadata.shapeId]
      // Dropping a shape also drops any bond anchored to it, same as the
      // standalone (non-collaborative) 3D Studio.
      const nextBonds = Object.fromEntries(
        Object.entries(state.bondsById).filter(
          ([, bond]) => !(bond.points || []).some((point) => point.shapeId === metadata.shapeId)
        )
      )
      return { shapesById: nextShapes, bondsById: nextBonds }
    }

    case 'shape_connect': {
      if (!metadata.bond?.id || !Array.isArray(metadata.bond.points)) return state
      return {
        ...state,
        bondsById: { ...state.bondsById, [metadata.bond.id]: metadata.bond }
      }
    }

    case 'shape_disconnect': {
      if (!metadata.bondId || !state.bondsById[metadata.bondId]) return state
      const nextBonds = { ...state.bondsById }
      delete nextBonds[metadata.bondId]
      return { ...state, bondsById: nextBonds }
    }

    case 'shape_clear':
      return createEmptyScene()

    default:
      return state
  }
}

/** Fold a full (chronologically ordered) event history into a scene state. */
export function replaySceneEvents(events) {
  return (events || []).filter(isSceneEvent).reduce(applySceneEvent, createEmptyScene())
}

export function sceneShapesArray(state) {
  return Object.values(state.shapesById)
}

export function sceneBondsArray(state) {
  return Object.values(state.bondsById)
}
