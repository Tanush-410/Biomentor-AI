import { useEffect } from 'react'
import { useRouter } from 'next/router'

export default function LegacyStudentClassroomsRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/classrooms')
  }, [router])

  return null
}
