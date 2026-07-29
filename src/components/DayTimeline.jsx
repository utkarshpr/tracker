import { useState, useEffect } from 'react'
import { ROUTINE_TIMELINE } from '../hooks/useProgress'

const DAY_START = 7 * 60 + 30   // 7:30 AM in minutes from midnight
const DAY_END   = 23 * 60 + 30  // 11:30 PM
const SPAN      = DAY_END - DAY_START

function parse(str) {
  const [time, ampm] = str.split(' ')
  const parts = time.split(':')
  let h = parseInt(parts[0], 10)
  const m = parts[1] ? parseInt(parts[1], 10) : 0
  if (ampm === 'PM' && h !== 12) h += 12
  if (ampm === 'AM' && h === 12) h = 0
  return h * 60 + m
}

function pct(mins) {
  return Math.max(0, Math.min(100, ((mins - DAY_START) / SPAN) * 100))
}

const MAIN_BLOCKS = ROUTINE_TIMELINE.filter(b => !b.nested).map((b, i, arr) => {
  const start = parse(b.time)
  const next  = arr[i + 1]
  const end   = next ? parse(next.time) : DAY_END + 30
  return { ...b, start, end }
})

const LUNCH = ROUTINE_TIMELINE.find(b => b.nested)

const TIME_MARKS = [
  { label: '8AM',  h: 8 },  { label: '10AM', h: 10 }, { label: '12PM', h: 12 },
  { label: '2PM',  h: 14 }, { label: '4PM',  h: 16 }, { label: '6PM',  h: 18 },
  { label: '8PM',  h: 20 }, { label: '10PM', h: 22 },
].map(({ label, h }) => ({ label, mins: h * 60 }))

function getNow() {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}

export default function DayTimeline({ tasks }) {
  const [now, setNow] = useState(getNow)

  useEffect(() => {
    const id = setInterval(() => setNow(getNow()), 30000)
    return () => clearInterval(id)
  }, [])

  const onScreen    = now >= DAY_START && now <= DAY_END
  const nowPct      = pct(now)
  const activeBlock = MAIN_BLOCKS.find(b => b.start <= now && b.end > now)

  return (
    <div className="day-timeline">
      {/* Active-now chip */}
      {activeBlock && (
        <div className="dtl-active-chip">
          <span className="dtl-chip-dot" />
          <span>{activeBlock.icon}</span>
          <span className="dtl-chip-label">{activeBlock.label}</span>
          <span className="dtl-chip-time">{activeBlock.time}</span>
        </div>
      )}

      {/* Track */}
      <div className="dtl-track">
        {MAIN_BLOCKS.map(seg => {
          const task   = seg.taskId ? tasks?.find(t => t.id === seg.taskId) : null
          const isDone = !!task?.done
          const isPast = seg.end <= now
          const isNow  = seg.start <= now && seg.end > now
          const l      = pct(seg.start)
          const w      = Math.max(pct(seg.end) - l, 0.4)

          return (
            <div
              key={seg.time}
              className={[
                'dtl-seg', seg.type,
                isPast ? 'past' : '',
                isNow  ? 'active' : '',
                isDone ? 'done' : '',
              ].filter(Boolean).join(' ')}
              style={{ left: `${l}%`, width: `${w}%` }}
              title={`${seg.time} — ${seg.label} · ${seg.duration}`}
            >
              <span className="dtl-seg-icon">{seg.icon}</span>
              {isNow && <span className="dtl-seg-name">{seg.label}</span>}
            </div>
          )
        })}

        {/* Lunch overlay inside OFFICE */}
        {LUNCH && (() => {
          const task   = tasks?.find(t => t.id === LUNCH.taskId)
          const start  = parse(LUNCH.time)
          const end    = start + 30
          const isPast = end <= now
          const isNow  = start <= now && end > now
          const l      = pct(start)
          const w      = pct(end) - l
          return (
            <div
              className={['dtl-seg study overlay', isPast ? 'past' : '', isNow ? 'active' : '', task?.done ? 'done' : ''].filter(Boolean).join(' ')}
              style={{ left: `${l}%`, width: `${w}%` }}
              title={`${LUNCH.time} — ${LUNCH.label}`}
            >
              <span className="dtl-seg-icon">{LUNCH.icon}</span>
            </div>
          )
        })()}

        {/* NOW cursor */}
        {onScreen && (
          <div className="dtl-now" style={{ left: `${nowPct}%` }}>
            <div className="dtl-now-dot" />
            <div className="dtl-now-line" />
          </div>
        )}
      </div>

      {/* Hour labels */}
      <div className="dtl-hours">
        {TIME_MARKS.map(({ label, mins }) => {
          const l = pct(mins)
          if (l < 1 || l > 99) return null
          return (
            <span
              key={label}
              className={`dtl-hour${mins < now ? ' past' : ''}`}
              style={{ left: `${l}%` }}
            >
              {label}
            </span>
          )
        })}
        {onScreen && (
          <span className="dtl-hour now-label" style={{ left: `${nowPct}%` }}>
            NOW
          </span>
        )}
      </div>
    </div>
  )
}
