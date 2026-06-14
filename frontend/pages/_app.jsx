import React, { useEffect } from 'react'
import { useRouter } from 'next/router'
import '@fontsource/source-sans-3/300.css'
import '@fontsource/source-sans-3/400.css'
import '@fontsource/source-sans-3/500.css'
import '@fontsource/source-sans-3/600.css'
import '@fontsource/source-sans-3/700.css'
import '@fontsource/cormorant-garamond/500.css'
import '@fontsource/cormorant-garamond/600.css'
import '@fontsource/cormorant-garamond/700.css'
import { AuthProvider, useAuth } from '../context/AuthContext'
import '../styles/globals.css'

function AppContent({ Component, pageProps }) {
  const router = useRouter()
  const { token, loading } = useAuth()

  // Redirect to login if not authenticated and on protected pages
  useEffect(() => {
    const publicPages = ['/', '/register', '/login', '/forgot-password']
    const isPublicPage = publicPages.includes(router.pathname)
    
    if (!loading && !token && !isPublicPage) {
      router.push('/login')
    }
  }, [token, loading, router])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(180,120,76,0.14),_transparent_30%),linear-gradient(180deg,_#fbf5ee,_#f3e6d6)] px-6">
        <div className="card max-w-md p-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-amber-800">BioMentor AI</p>
          <h1 className="mt-4 text-3xl font-bold text-slate-950">Preparing your workspace</h1>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            Loading your role-aware dashboard, study tools, and saved session state.
          </p>
          <div className="mt-6 h-2 overflow-hidden rounded-full bg-stone-200">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-gradient-to-r from-[#6d472d] via-[#8b5a35] to-[#b9895d]" />
          </div>
        </div>
      </div>
    )
  }

  return <Component {...pageProps} />
}

export default function App(props) {
  // Register Service Worker for offline support
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      if (process.env.NODE_ENV !== 'production') {
        navigator.serviceWorker.getRegistrations()
          .then((registrations) => {
            registrations.forEach((registration) => registration.unregister())
          })
          .catch((error) => {
            console.log('Service Worker cleanup failed:', error)
          })
        return
      }

      navigator.serviceWorker.register('/service-worker.js')
        .then(registration => {
          console.log('Service Worker registered successfully:', registration)
        })
        .catch(error => {
          console.log('Service Worker registration failed:', error)
        })

      // Listen for updates
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('Service Worker controller changed')
      })
    }
  }, [])

  return (
    <AuthProvider>
      <AppContent {...props} />
    </AuthProvider>
  )
}
