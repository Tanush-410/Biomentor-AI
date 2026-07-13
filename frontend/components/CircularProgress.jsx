import React from 'react'

export default function CircularProgress({
  value = 0,
  size = 84,
  stroke = 8,
  label,
  caption,
  tone = 'text-zinc-950',
  trackClassName = 'stroke-zinc-200',
  progressClassName = 'stroke-zinc-950',
  className = '',
  valueSuffix = '%'
}) {
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0))
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference - (safeValue / 100) * circumference

  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            className={trackClassName}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            className={`${progressClassName} transition-[stroke-dashoffset] duration-500 ease-out`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-lg font-bold ${tone}`}>{Math.round(safeValue)}{valueSuffix}</span>
        </div>
      </div>
      {(label || caption) && (
        <div className="min-w-0">
          {label && <p className="font-semibold text-zinc-900">{label}</p>}
          {caption && <p className="text-sm text-zinc-600">{caption}</p>}
        </div>
      )}
    </div>
  )
}
