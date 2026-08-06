import React, { useEffect } from 'react'
import { useRouter } from 'next/router'

import EducatorDashboard from '../components/dashboard/EducatorDashboard'
import StudentDashboard from '../components/dashboard/StudentDashboard'
import { useAuth } from '../context/AuthContext'

export default function Dashboard() {
  const router = useRouter()
  const { token, user, loading: authLoading } = useAuth()
  const isEducator = user?.role === 'educator' || user?.role === 'admin'

  useEffect(() => {
    if (authLoading) return
    if (!token) {
      router.push('/login')
    }
  }, [authLoading, token, router])

  if (authLoading || !token) return null

  return isEducator ? <EducatorDashboard /> : <StudentDashboard />
}
