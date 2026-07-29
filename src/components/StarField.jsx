import { useMemo } from 'react'

export default function StarField({ count = 100 }) {
  const stars = useMemo(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2.2 + 0.4,
      delay: Math.random() * 8,
      duration: 2.5 + Math.random() * 5,
      drift: (Math.random() - 0.5) * 30,
    }))
  , [])

  const orbs = useMemo(() =>
    Array.from({ length: 4 }, (_, i) => ({
      id: i,
      x: [15, 75, 35, 85][i],
      y: [20, 65, 80, 15][i],
      color: ['#6366f1', '#8b5cf6', '#22d3ee', '#a855f7'][i],
      size: [320, 260, 300, 240][i],
      duration: [20, 25, 18, 22][i],
      delay: [0, -8, -14, -5][i],
    }))
  , [])

  return (
    <div className="starfield">
      {orbs.map(o => (
        <div
          key={o.id}
          className="bg-orb"
          style={{
            left: `${o.x}%`, top: `${o.y}%`,
            width: o.size, height: o.size,
            background: o.color,
            animationDuration: `${o.duration}s`,
            animationDelay: `${o.delay}s`,
          }}
        />
      ))}
      {stars.map(s => (
        <div
          key={s.id}
          className="star"
          style={{
            left: `${s.x}%`, top: `${s.y}%`,
            width: s.size, height: s.size,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.duration}s`,
            '--drift': `${s.drift}px`,
          }}
        />
      ))}
      <div className="scanline" />
    </div>
  )
}
