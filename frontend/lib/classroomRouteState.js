export function normalizeClassroomId(routeId, classroom) {
  if (typeof routeId === 'string' && routeId.trim()) {
    return routeId
  }

  if (classroom?.id && typeof classroom.id === 'string') {
    return classroom.id
  }

  return ''
}

export function getClassroomBasePath(routeId, classroom) {
  const classroomId = normalizeClassroomId(routeId, classroom)
  return classroomId ? `/classrooms/${classroomId}` : '/classrooms'
}

export function shouldApplyClassroomResponse(activeRouteId, responseClassroomId) {
  return Boolean(
    typeof activeRouteId === 'string' &&
      activeRouteId &&
      typeof responseClassroomId === 'string' &&
      responseClassroomId &&
      activeRouteId === responseClassroomId
  )
}
