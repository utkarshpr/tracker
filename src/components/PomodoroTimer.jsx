import { useState, useEffect, useRef, useCallback } from 'react'
import ProgressRing from './ProgressRing'

const WORK_SECS  = 25 * 60
const BREAK_SECS =  5 * 60

function beep(freq = 660, duration = 0.4, vol = 0.25) {
  try {
    const ctx  = new AudioContext()
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.type = 'sine'; osc.frequency.value = freq
    gain.gain.setValueAtTime(vol, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + duration)
  } catch { /* AudioContext not available */ }
}

export default function PomodoroTimer({ onSessionComplete }) {
  const [mode,      setMode]      = useState('work')
  const [timeLeft,  setTimeLeft]  = useState(WORK_SECS)
  const [running,   setRunning]   = useState(false)
  const [sessions,  setSessions]  = useState(0)
  const [minimized, setMinimized] = useState(true)
  const intervalRef = useRef(null)

  const totalSecs = mode === 'work' ? WORK_SECS : BREAK_SECS
  const pct       = Math.round(((totalSecs - timeLeft) / totalSecs) * 100)
  const mins      = String(Math.floor(timeLeft / 60)).padStart(2, '0')
  const secs      = String(timeLeft % 60).padStart(2, '0')
  const color     = mode === 'work' ? '#8b5cf6' : '#34d399'

  const reset = useCallback(() => {
    clearInterval(intervalRef.current)
    setRunning(false)
    setTimeLeft(mode === 'work' ? WORK_SECS : BREAK_SECS)
  }, [mode])

  useEffect(() => {
    if (!running) { clearInterval(intervalRef.current); return }
    intervalRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(intervalRef.current)
          setRunning(false)
          if (mode === 'work') {
            setSessions(s => s + 1)
            onSessionComplete?.()
            beep(880)
            setTimeout(() => beep(660), 300)
            setMode('break')
            setTimeLeft(BREAK_SECS)
          } else {
            beep(440)
            setMode('work')
            setTimeLeft(WORK_SECS)
          }
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(intervalRef.current)
  }, [running, mode, onSessionComplete])

  useEffect(() => { setTimeLeft(mode === 'work' ? WORK_SECS : BREAK_SECS) }, [mode])

  return (
    <>
    {/* Bottom progress bar — visible whenever running */}
    {running && (
      <div className="pomo-bar" style={{ '--pc': color }}>
        <div className="pomo-bar-track">
          <div className="pomo-bar-fill" style={{ width: `${pct}%` }} />
          <div className="pomo-bar-glow" style={{ left: `${pct}%` }} />
        </div>
        <div className="pomo-bar-pill" onClick={() => setMinimized(false)}>
          <span className="pomo-bar-emoji">{mode === 'work' ? '🍅' : '☕'}</span>
          <span className="pomo-bar-label">{mode === 'work' ? 'Focus' : 'Break'}</span>
          <span className="pomo-bar-time" style={{ color }}>{mins}:{secs}</span>
          <button
            className="pomo-bar-btn"
            onClick={e => { e.stopPropagation(); setRunning(false) }}
            title="Pause"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
            </svg>
          </button>
        </div>
      </div>
    )}
    <div className={`pomodoro ${minimized ? 'pomo-mini' : ''} ${mode}`}>
      {minimized ? (
        <button className="pomo-mini-btn" onClick={() => setMinimized(false)} title="Open Pomodoro Timer">
          <div className="pomo-mini-ring">
            <ProgressRing pct={pct} size={40} stroke={3} color={color} />
            <span className="pomo-mini-time">{mins}:{secs}</span>
          </div>
          {running && <span className="pomo-dot" style={{ background: color }} />}
        </button>
      ) : (
        <div className="pomo-card">
          <div className="pomo-card-header">
            <span className="pomo-mode-badge" style={{ color }}>{mode === 'work' ? '🍅 Focus' : '☕ Break'}</span>
            <div style={{ display: 'flex', gap: '.3rem' }}>
              <button className="pomo-icon-btn" onClick={() => setMinimized(true)}>−</button>
            </div>
          </div>

          <div className="pomo-ring-wrap">
            <ProgressRing pct={pct} size={120} stroke={7} color={color} />
            <div className="pomo-ring-center">
              <div className="pomo-time" style={{ color }}>{mins}:{secs}</div>
              <div className="pomo-mode-label">{mode === 'work' ? 'Focus' : 'Break'}</div>
            </div>
          </div>

          <div className="pomo-controls">
            <button className="pomo-btn secondary" onClick={reset}>↺</button>
            <button className="pomo-btn primary" style={{ background: color }} onClick={() => setRunning(r => !r)}>
              {running ? '⏸' : '▶'}
            </button>
            <button
              className="pomo-btn secondary"
              onClick={() => setMode(m => m === 'work' ? 'break' : 'work')}
              title="Switch mode"
            >⇄</button>
          </div>

          <div className="pomo-sessions">
            {Array.from({ length: Math.max(sessions, 4) }).map((_, i) => (
              <span key={i} className={`pomo-session-dot ${i < sessions ? 'done' : ''}`} />
            ))}
            <span className="pomo-session-label">{sessions} session{sessions !== 1 ? 's' : ''}</span>
          </div>
        </div>
      )}
    </div>
    </>
  )
}
