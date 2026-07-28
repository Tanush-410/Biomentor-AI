import React, { useState } from 'react'
import { ChevronDown, ChevronUp, Lightbulb } from 'lucide-react'

/**
 * A collapsible in-context "how to use this tool" card. Kept as a shared
 * component so every lab/studio page presents instructions the same way,
 * rather than each page inventing its own layout for them.
 */
export default function HowToUseCard({ title = 'How to use this', steps = [], defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="card p-5">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-zinc-950 p-2.5 text-[#d9c25c]">
            <Lightbulb className="h-4 w-4" />
          </div>
          <p className="text-sm font-bold text-zinc-950">{title}</p>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-zinc-500" /> : <ChevronDown className="h-4 w-4 text-zinc-500" />}
      </button>

      {open && (
        <ol className="mt-4 space-y-2.5">
          {steps.map((step, index) => (
            <li key={index} className="flex gap-3 text-sm leading-6 text-zinc-700">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#f2e9c4] text-xs font-bold text-zinc-900">
                {index + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
