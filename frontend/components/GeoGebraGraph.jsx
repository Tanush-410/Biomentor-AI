import React, { useEffect, useId, useRef } from 'react'

const GEOGEBRA_SCRIPT_URL = 'https://www.geogebra.org/apps/deployggb.js'

let scriptLoadingPromise = null

function loadGeoGebraScript() {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'))
  if (window.GGBApplet) return Promise.resolve()
  if (scriptLoadingPromise) return scriptLoadingPromise

  scriptLoadingPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GEOGEBRA_SCRIPT_URL}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('Failed to load GeoGebra.')))
      return
    }
    const script = document.createElement('script')
    script.src = GEOGEBRA_SCRIPT_URL
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load GeoGebra.'))
    document.body.appendChild(script)
  })

  return scriptLoadingPromise
}

/**
 * Embeds a live GeoGebra applet (graphing, geometry, or full "classic" with
 * 3D + algebra view) using GeoGebra's official JS embedding API.
 * https://geogebra.github.io/docs/reference/en/GeoGebra_Apps_Embedding/
 */
export default function GeoGebraGraph({ appName = 'graphing', height = 520, onReady }) {
  const containerId = `ggb-${useId().replace(/[:]/g, '')}`
  const containerRef = useRef(null)
  const appletRef = useRef(null)

  useEffect(() => {
    let cancelled = false

    loadGeoGebraScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.GGBApplet) return
        const applet = new window.GGBApplet(
          {
            appName,
            width: containerRef.current.clientWidth || 800,
            height,
            showToolBar: true,
            showAlgebraInput: true,
            showMenuBar: false,
            showResetIcon: true,
            enableRightClick: false,
            language: 'en',
            appletOnLoad: (api) => {
              if (!cancelled) onReady?.(api)
            }
          },
          true
        )
        appletRef.current = applet
        applet.inject(containerId)
      })
      .catch(() => {
        // Surfaced via the container staying empty; the page around this
        // component shows its own error state if geogebraError is tracked there.
      })

    return () => {
      cancelled = true
      const el = document.getElementById(containerId)
      if (el) el.innerHTML = ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appName])

  return <div id={containerId} ref={containerRef} className="min-h-[420px] w-full" />
}
