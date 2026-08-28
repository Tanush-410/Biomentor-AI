import React from 'react'

export default function Footer({ className = '' }) {
  return (
    <footer className={`border-t border-zinc-200 bg-white/80 px-6 py-6 text-center text-xs font-semibold text-zinc-500 md:px-10 lg:px-16 ${className}`}>
      © 2026 VYDRA CORE. All rights reserved.
    </footer>
  )
}
