function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function rectanglesOverlap(a, b) {
  return !(
    a.left + a.width <= b.left ||
    b.left + b.width <= a.left ||
    a.top + a.height <= b.top ||
    b.top + b.height <= a.top
  )
}

function ratioToRect(note, viewportWidth, viewportHeight) {
  const left = clamp(note.x_ratio * viewportWidth, 0, Math.max(0, viewportWidth - note.width))
  const top = clamp(note.y_ratio * viewportHeight, 0, Math.max(0, viewportHeight - note.height))
  return {
    id: note.id,
    left,
    top,
    width: note.width,
    height: note.height,
  }
}

export function resolveStickyNoteCollisions(notes, viewportWidth, viewportHeight) {
  if (!Array.isArray(notes) || notes.length <= 1 || !viewportWidth || !viewportHeight) {
    return notes
  }

  const placed = []

  return notes.map((note) => {
    const rect = ratioToRect(note, viewportWidth, viewportHeight)
    let nextLeft = rect.left
    let nextTop = rect.top
    let guard = 0

    while (
      placed.some((existing) =>
        rectanglesOverlap(
          { left: nextLeft, top: nextTop, width: rect.width, height: rect.height },
          existing
        )
      ) &&
      guard < 120
    ) {
      nextTop += 28
      if (nextTop + rect.height > viewportHeight) {
        nextTop = 16
        nextLeft += 28
      }
      if (nextLeft + rect.width > viewportWidth) {
        nextLeft = 16
      }
      guard += 1
    }

    const boundedLeft = clamp(nextLeft, 0, Math.max(0, viewportWidth - rect.width))
    const boundedTop = clamp(nextTop, 0, Math.max(0, viewportHeight - rect.height))

    const resolved = {
      ...note,
      x_ratio: viewportWidth > 0 ? boundedLeft / viewportWidth : note.x_ratio,
      y_ratio: viewportHeight > 0 ? boundedTop / viewportHeight : note.y_ratio,
    }

    placed.push({
      left: boundedLeft,
      top: boundedTop,
      width: rect.width,
      height: rect.height,
    })

    return resolved
  })
}

export { clamp }
