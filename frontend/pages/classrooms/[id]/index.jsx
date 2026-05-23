import { useEffect } from 'react'
import { useRouter } from 'next/router'

export default function ClassroomIndexRedirect() {
  const router = useRouter()

  useEffect(() => {
    if (!router.isReady) return
    const { id } = router.query
    if (id) {
      router.replace(`/classrooms/${id}/stream`)
    }
  }, [router])

  return null
}
