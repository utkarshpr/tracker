import { useState, useEffect, useRef, useCallback } from 'react'
import { touchProgress } from '../lib/progressSync'

const STORAGE_KEY = 'faang_todos_v1'

function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? { todos: [], reminders: [] }
  } catch { return { todos: [], reminders: [] } }
}
function save(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  touchProgress()
  window.dispatchEvent(new CustomEvent('faang_todos_updated'))
}

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2) }

const TABS = ['Todos', 'Reminders', 'Study Timer']

// ── Study Timer ───────────────────────────────────────────────────────────
function StudyTimer() {
  const [mode, setMode] = useState('focus') // focus | break | custom
  const PRESETS = { focus: 25 * 60, break: 5 * 60, custom: 10 * 60 }
  const [totalSec, setTotalSec] = useState(PRESETS.focus)
  const [remaining, setRemaining] = useState(PRESETS.focus)
  const [running, setRunning] = useState(false)
  const [customMin, setCustomMin] = useState(10)
  const [sessions, setSessions] = useState(0)
  const intervalRef = useRef(null)

  const start = useCallback(() => {
    setRunning(true)
    intervalRef.current = setInterval(() => {
      setRemaining(r => {
        if (r <= 1) {
          clearInterval(intervalRef.current)
          setRunning(false)
          setSessions(s => s + 1)
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('⏱️ Timer Done!', { body: mode === 'focus' ? 'Focus session complete. Take a break!' : 'Break over! Back to work.' })
          }
          return 0
        }
        return r - 1
      })
    }, 1000)
  }, [mode])

  const pause = () => { clearInterval(intervalRef.current); setRunning(false) }

  const reset = () => {
    clearInterval(intervalRef.current)
    setRunning(false)
    setRemaining(totalSec)
  }

  const changeMode = (m) => {
    clearInterval(intervalRef.current)
    setRunning(false)
    setMode(m)
    const t = m === 'custom' ? customMin * 60 : PRESETS[m]
    setTotalSec(t)
    setRemaining(t)
  }

  const applyCustom = () => {
    const t = Math.max(1, customMin) * 60
    setTotalSec(t)
    setRemaining(t)
    setRunning(false)
    clearInterval(intervalRef.current)
  }

  useEffect(() => () => clearInterval(intervalRef.current), [])

  const requestNotif = () => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }

  const pct = totalSec > 0 ? ((totalSec - remaining) / totalSec) * 100 : 0
  const mm = String(Math.floor(remaining / 60)).padStart(2, '0')
  const ss = String(remaining % 60).padStart(2, '0')
  const r = 52
  const circ = 2 * Math.PI * r
  const dash = circ - (pct / 100) * circ

  return (
    <div className="timer-wrap">
      <div className="timer-mode-tabs">
        {['focus', 'break', 'custom'].map(m => (
          <button key={m} className={`timer-mode-btn ${mode === m ? 'active' : ''}`} onClick={() => changeMode(m)}>
            {m === 'focus' ? '🎯 Focus' : m === 'break' ? '☕ Break' : '⚙️ Custom'}
          </button>
        ))}
      </div>

      <div className="timer-circle-wrap">
        <svg className="timer-svg" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={r} className="timer-track" />
          <circle
            cx="60" cy="60" r={r}
            className="timer-progress"
            strokeDasharray={circ}
            strokeDashoffset={dash}
            strokeLinecap="round"
            transform="rotate(-90 60 60)"
          />
        </svg>
        <div className="timer-display">
          <span className="timer-time">{mm}:{ss}</span>
          <span className="timer-label">{mode === 'focus' ? 'Focus' : mode === 'break' ? 'Break' : 'Custom'}</span>
        </div>
      </div>

      {mode === 'custom' && (
        <div className="timer-custom-row">
          <input
            type="number"
            className="timer-custom-input"
            value={customMin}
            min={1}
            max={180}
            onChange={e => setCustomMin(Number(e.target.value))}
          />
          <span className="timer-custom-label">minutes</span>
          <button className="timer-custom-apply" onClick={applyCustom}>Set</button>
        </div>
      )}

      <div className="timer-controls">
        {!running ? (
          <button className="timer-btn start" onClick={() => { requestNotif(); start() }} disabled={remaining === 0}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            {remaining === totalSec ? 'Start' : 'Resume'}
          </button>
        ) : (
          <button className="timer-btn pause" onClick={pause}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
            Pause
          </button>
        )}
        <button className="timer-btn reset" onClick={reset}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/>
          </svg>
          Reset
        </button>
      </div>

      {sessions > 0 && (
        <div className="timer-sessions">
          🔥 {sessions} session{sessions !== 1 ? 's' : ''} completed today
        </div>
      )}
    </div>
  )
}

// ── Reminders ────────────────────────────────────────────────────────────
function Reminders({ reminders, onChange }) {
  const [text, setText] = useState('')
  const [time, setTime] = useState('')
  // Timeout scheduling and alarm firing handled globally by useAlarm in App

  const add = () => {
    if (!text.trim() || !time) return
    const ts = new Date(time).getTime()
    if (isNaN(ts) || ts <= Date.now()) return
    const r = { id: genId(), text: text.trim(), ts, fired: false }
    const next = [...reminders, r].sort((a, b) => a.ts - b.ts)
    onChange(next)
    save({ todos: load().todos, reminders: next })
    setText('')
    setTime('')
  }

  const remove = (id) => {
    const next = reminders.filter(r => r.id !== id)
    onChange(next)
    save({ todos: load().todos, reminders: next })
  }

  const now = Date.now()

  return (
    <div className="reminders-wrap">
      <div className="reminder-add">
        <input
          className="todo-input"
          placeholder="Reminder text..."
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
        />
        <input
          className="reminder-time-input"
          type="datetime-local"
          value={time}
          onChange={e => setTime(e.target.value)}
          min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
        />
        <button className="todo-add-btn" onClick={add} disabled={!text.trim() || !time}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      </div>

      <div className="reminder-list">
        {reminders.length === 0 && (
          <div className="todo-empty">No reminders set. Add one above.</div>
        )}
        {reminders.map(r => {
          const dt = new Date(r.ts)
          const past = r.ts < now
          return (
            <div key={r.id} className={`reminder-item ${r.fired ? 'fired' : ''} ${past && !r.fired ? 'overdue' : ''}`}>
              <div className="reminder-icon">{r.fired ? '✅' : past ? '⚠️' : '⏰'}</div>
              <div className="reminder-body">
                <span className="reminder-text">{r.text}</span>
                <span className="reminder-time">
                  {dt.toLocaleDateString()} {dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {r.fired && ' · Fired'}{past && !r.fired && ' · Overdue'}
                </span>
              </div>
              <button className="todo-del-btn" onClick={() => remove(r.id)} aria-label="Delete">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────
export default function TodoReminder({ isOpen, onClose }) {
  const [tab, setTab] = useState(0)
  const [data, setData] = useState(load)
  const [newTodo, setNewTodo] = useState('')
  const [filter, setFilter] = useState('all') // all | active | done
  const inputRef = useRef(null)

  useEffect(() => {
    if (isOpen && tab === 0) setTimeout(() => inputRef.current?.focus(), 60)
  }, [isOpen, tab])

  const addTodo = () => {
    if (!newTodo.trim()) return
    const t = { id: genId(), text: newTodo.trim(), done: false, created: Date.now() }
    const next = { ...data, todos: [t, ...data.todos] }
    setData(next)
    save(next)
    setNewTodo('')
  }

  const toggleTodo = (id) => {
    const next = { ...data, todos: data.todos.map(t => t.id === id ? { ...t, done: !t.done } : t) }
    setData(next)
    save(next)
  }

  const deleteTodo = (id) => {
    const next = { ...data, todos: data.todos.filter(t => t.id !== id) }
    setData(next)
    save(next)
  }

  const clearDone = () => {
    const next = { ...data, todos: data.todos.filter(t => !t.done) }
    setData(next)
    save(next)
  }

  const setReminders = useCallback((val) => {
    setData(prev => {
      const next = { ...prev, reminders: typeof val === 'function' ? val(prev.reminders) : val }
      save(next)
      return next
    })
  }, [])

  const filtered = data.todos.filter(t =>
    filter === 'all' ? true : filter === 'active' ? !t.done : t.done
  )
  const doneCount = data.todos.filter(t => t.done).length

  if (!isOpen) return null

  return (
    <div className="todo-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="todo-panel">
        <div className="todo-header">
          <div className="todo-tabs">
            {TABS.map((t, i) => (
              <button key={i} className={`todo-tab ${tab === i ? 'active' : ''}`} onClick={() => setTab(i)}>
                {i === 0 ? '✅' : i === 1 ? '⏰' : '⏱️'} {t}
              </button>
            ))}
          </div>
          <button className="todo-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="todo-body">
          {tab === 0 && (
            <div className="todos-wrap">
              <div className="todo-add-row">
                <input
                  ref={inputRef}
                  className="todo-input"
                  placeholder="Add a task... (Enter)"
                  value={newTodo}
                  onChange={e => setNewTodo(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addTodo()}
                />
                <button className="todo-add-btn" onClick={addTodo} disabled={!newTodo.trim()}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                </button>
              </div>

              <div className="todo-filter-row">
                {['all', 'active', 'done'].map(f => (
                  <button key={f} className={`todo-filter-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                    {f === 'done' && doneCount > 0 && <span className="todo-filter-count">{doneCount}</span>}
                  </button>
                ))}
                {doneCount > 0 && (
                  <button className="todo-clear-btn" onClick={clearDone}>Clear done</button>
                )}
              </div>

              <div className="todo-list">
                {filtered.length === 0 && (
                  <div className="todo-empty">
                    {filter === 'all' ? 'No tasks yet. Add one above!' : `No ${filter} tasks.`}
                  </div>
                )}
                {filtered.map(t => (
                  <div key={t.id} className={`todo-item ${t.done ? 'done' : ''}`}>
                    <button
                      className={`todo-check ${t.done ? 'checked' : ''}`}
                      onClick={() => toggleTodo(t.id)}
                      aria-label={t.done ? 'Unmark' : 'Mark done'}
                    >
                      {t.done && (
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      )}
                    </button>
                    <span className="todo-text">{t.text}</span>
                    <button className="todo-del-btn" onClick={() => deleteTodo(t.id)} aria-label="Delete">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>

              {data.todos.length > 0 && (
                <div className="todo-stats">
                  {doneCount}/{data.todos.length} completed · {Math.round((doneCount / data.todos.length) * 100)}%
                </div>
              )}
            </div>
          )}

          {tab === 1 && (
            <Reminders
              reminders={data.reminders}
              onChange={setReminders}
            />
          )}

          {tab === 2 && <StudyTimer />}
        </div>
      </div>
    </div>
  )
}
