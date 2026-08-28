import React from 'react'

// `dark`/`transparent` swap in a fully separate base class string rather
// than relying on a caller-supplied className to out-specificity these
// defaults -- two Tailwind utility classes for the same CSS property (e.g.
// the default bg-white/80 vs a passed-in bg-transparent) have equal
// specificity, so whichever one wins depends on unpredictable build-time
// class order, not on which appears later in the string. That silently
// left this footer opaque white both on the dark landing page and on
// every AppShell-wrapped authenticated page (dashboard, quiz, progress,
// etc), despite both passing an override className asking for transparent.
export default function Footer({ className = '', dark = false, transparent = false }) {
  let base = 'border-t border-zinc-200 bg-white/80 text-zinc-500'
  if (dark) base = 'border-t border-white/10 bg-transparent text-zinc-500'
  else if (transparent) base = 'border-t-0 bg-transparent text-zinc-500'
  return (
    <footer className={`${base} px-6 py-6 text-center text-xs font-semibold md:px-10 lg:px-16 ${className}`}>
      © 2026 VYDRA CORE. All rights reserved.
    </footer>
  )
}
