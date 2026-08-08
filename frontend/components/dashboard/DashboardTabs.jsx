import React, { useState } from 'react'

export default function DashboardTabs({ tabs, defaultTab, active, onChange }) {
  const [internalActive, setInternalActive] = useState(defaultTab || tabs[0]?.key)
  const isControlled = active !== undefined
  const activeKey = isControlled ? active : internalActive
  const activeTab = tabs.find((tab) => tab.key === activeKey) || tabs[0]

  const selectTab = (key) => {
    if (!isControlled) setInternalActive(key)
    onChange?.(key)
  }

  return (
    <div>
      <div className="overflow-x-auto" role="tablist" aria-label="Dashboard sections">
        <div className="flex min-w-max gap-2 rounded-full border border-zinc-200 bg-white/80 p-1.5">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={activeTab?.key === tab.key}
              onClick={() => selectTab(tab.key)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                activeTab?.key === tab.key
                  ? 'bg-zinc-950 text-[#d9c25c] shadow-md shadow-black/10'
                  : 'text-zinc-600 hover:bg-zinc-100 hover:text-black'
              }`}
            >
              {tab.label}
              {typeof tab.badge === 'number' && tab.badge > 0 ? (
                <span
                  className={`ml-2 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-xs font-bold ${
                    activeTab?.key === tab.key ? 'bg-[#d9c25c] text-zinc-950' : 'bg-zinc-200 text-zinc-700'
                  }`}
                >
                  {tab.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>
      <div role="tabpanel" className="mt-6 space-y-6">
        {activeTab?.content}
      </div>
    </div>
  )
}
