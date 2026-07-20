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
import FeatureBoundary from '../components/FeatureBoundary'
import StickyNotesLayer from '../components/sticky-notes/StickyNotesLayer'
import { AuthProvider, useAuth } from '../context/AuthContext'
import '../styles/globals.css'

const LEGACY_CACHE_PREFIXES = ['biomentor-', 'vydra-']

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
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(0,0,0,0.06),_transparent_30%),linear-gradient(180deg,_#ffffff,_#f4f4f5)] px-6">
        <div className="card max-w-md p-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-zinc-500">VYDRA CORE</p>
          <h1 className="mt-4 text-3xl font-bold text-zinc-950">Preparing your workspace</h1>
          <p className="mt-3 text-sm leading-7 text-zinc-600">
            Loading your role-aware dashboard, study tools, and saved session state.
          </p>
          <div className="mt-6 h-2 overflow-hidden rounded-full bg-zinc-200">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-gradient-to-r from-zinc-950 via-[#8a7a1f] to-[#d9c25c]" />
          </div>
        </div>
      </div>
    )
  }

  const pageFallback = (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#ffffff,#f4f4f5)] px-6">
      <div className="card max-w-lg p-8 text-center">
        <p className="section-kicker text-zinc-500">VYDRA CORE recovery</p>
        <h1 className="mt-4 text-3xl font-bold text-zinc-950">Something went wrong in this workspace</h1>
        <p className="mt-3 text-sm leading-7 text-zinc-600">
          Your account is safe. Reload this page to reconnect to the latest VYDRA CORE session.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => window.location.reload()} className="btn btn-primary">
            Reload workspace
          </button>
          <button type="button" onClick={() => router.push('/dashboard')} className="btn btn-outline">
            Go to dashboard
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <>
      <FeatureBoundary name="Page" resetKey={router.asPath} fallback={pageFallback}>
        <Component {...pageProps} />
      </FeatureBoundary>
      <FeatureBoundary name="Sticky notes">
        <StickyNotesLayer />
      </FeatureBoundary>
    </>
  )
}

export default function App(props) {
  // Production deploys were serving stale JS/API responses from a custom service worker.
  // We rely on IndexedDB for offline document support for now, so always remove the worker.
  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const teardownLegacyOfflineCaches = async () => {
      if ('serviceWorker' in navigator) {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations()
          await Promise.all(registrations.map((registration) => registration.unregister()))
        } catch (error) {
          console.log('Service Worker cleanup failed:', error)
        }
      }

      if ('caches' in window) {
        try {
          const cacheNames = await window.caches.keys()
          await Promise.all(
            cacheNames
              .filter((name) => LEGACY_CACHE_PREFIXES.some((prefix) => name.startsWith(prefix)))
              .map((name) => window.caches.delete(name))
          )
        } catch (error) {
          console.log('Legacy cache cleanup failed:', error)
        }
      }
    }

    teardownLegacyOfflineCaches()
  }, [])

  return (
    <AuthProvider>
      <AppContent {...props} />
    </AuthProvider>
  )
}
