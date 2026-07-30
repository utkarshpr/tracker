import { useEffect, useState } from 'react'

export default function ProgressRing({ pct, size = 80, stroke = 6, color = '#6366f1', animate = true }) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const [mounted, setMounted] = useState(!animate)
  const displayPct = mounted ? pct : 0
  const offset = circ - (displayPct / 100) * circ

  useEffect(() => {
    if (!animate) return undefined
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      setMounted(true)
      return undefined
    }
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [animate])

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} className="progress-ring-svg">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ring-track, rgba(255,255,255,0.14))" strokeWidth={stroke} />
      <circle
        className="progress-ring-arc"
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={stroke}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 1.15s cubic-bezier(0.22, 1, 0.36, 1)' }}
      />
    </svg>
  )
}
