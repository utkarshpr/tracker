import { useState, useMemo } from 'react'
import { todayKey, ROUTINE_TIMELINE, PAUSE_REASONS } from '../hooks/useProgress'

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function getNextDateStr(baseStr, offset) {
  const d = new Date(baseStr)
  d.setDate(d.getDate() + offset)
  return d.toISOString().split('T')[0]
}

function parse12h(str) {
  const [time, ampm] = str.split(' ')
  let [h, m] = time.split(':').map(Number)
  if (ampm === 'PM' && h !== 12) h += 12
  if (ampm === 'AM' && h === 12) h = 0
  return h * 60 + (m || 0)
}

function motivationText(pct) {
  if (pct === 100) return '🎉 Perfect day! You crushed it!'
  if (pct >= 70)   return '💪 Great progress! Almost there.'
  if (pct >= 40)   return '📚 Halfway there. Keep going!'
  return '🌅 New day, new goals. Let\'s go!'
}

function PauseLabel({ pauseInfo }) {
  const reason = PAUSE_REASONS.find(r => r.id === pauseInfo?.reason)
  if (!reason) return null
  return <span>{reason.icon}{' '}{reason.label}</span>
}

export default function DailyTracker({ isOpen, onClose, progress, fileTree }) {
  const [tab, setTab] = useState('tasks')
  const [pauseOpen, setPauseOpen] = useState(false)
  const [pauseReason, setPauseReason] = useState('sick')
  const [pauseDayCount, setPauseDayCount] = useState(1)
  const [pauseStart, setPauseStart] = useState(todayKey())

  const todayData = progress.getTodayData()
  const streak    = progress.getStreak()
  const today     = todayKey()
  const isPaused  = progress.isPausedDay(today)
  const pauseInfo = progress.getPauseInfo(today)

  const { done: totalDone, total: totalFiles, pct } = progress.getTotalProgress(fileTree.allFiles)

  const dateStr   = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const tasksDone = todayData.tasks.filter(t => t.done).length
  const tasksPct  = todayData.tasks.length ? Math.round((tasksDone / todayData.tasks.length) * 100) : 0

  const nextTask = useMemo(() => {
    const now  = new Date()
    const mins = now.getHours() * 60 + now.getMinutes()
    return todayData.tasks.find(t => !t.done && parse12h(t.time) > mins) ?? null
  }, [todayData.tasks])

  const pausePreviewDates = useMemo(
    () => Array.from({ length: pauseDayCount }, (_, i) => getNextDateStr(pauseStart, i)),
    [pauseStart, pauseDayCount]
  )

  const handlePauseSubmit = () => {
    progress.pauseDays(pauseStart, pauseDayCount, pauseReason)
    setPauseOpen(false)
  }

  const streakLabel = isPaused
    ? <><span style={{ marginRight: 4 }}>🛡️</span><span>Streak protected</span>{' · '}<PauseLabel pauseInfo={pauseInfo} /></>
    : streak > 0
      ? <><span className="streak-fire">🔥</span>{' '}<span>{streak}-day streak — keep it up!</span></>
      : <span>Start your streak today!</span>

  return (
    <>
      <div
        className={`daily-overlay ${isOpen ? 'open' : ''}`}
        role="presentation"
        onClick={onClose}
        onKeyDown={e => e.key === 'Escape' && onClose()}
      />
      <div className={`daily-drawer ${isOpen ? 'open' : ''}`}>

        {/* Header */}
        <div className="daily-header">
          <div>
            <div className="daily-date">{dateStr}</div>
            <div className="daily-streak">{streakLabel}</div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {isPaused ? (
              <button className="pause-undo-btn" onClick={() => progress.unpauseDay(today)}>
                Undo Pause
              </button>
            ) : (
              <button className="pause-day-btn" onClick={() => setPauseOpen(true)}>
                🛡️ Pause
              </button>
            )}
            <button className="icon-btn" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Paused banner */}
        {isPaused && (
          <div className="pause-banner">
            <span className="pause-banner-icon">🛡️</span>
            <div>
              <div className="pause-banner-title">Day Paused — Streak Protected</div>
              <div className="pause-banner-sub">
                <PauseLabel pauseInfo={pauseInfo} />
                <span>{' · No streak loss'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="daily-tabs">
          <button className={`dtab ${tab === 'tasks' ? 'active' : ''}`} onClick={() => setTab('tasks')}>
            Today's Tasks
            <span className="dtab-badge">{tasksDone}/{todayData.tasks.length}</span>
          </button>
          <button className={`dtab ${tab === 'routine' ? 'active' : ''}`} onClick={() => setTab('routine')}>
            Daily Routine
          </button>
          <button className={`dtab ${tab === 'studied' ? 'active' : ''}`} onClick={() => setTab('studied')}>
            Studied
            <span className="dtab-badge">{todayData.studiedFiles.length}</span>
          </button>
          <button className={`dtab ${tab === 'overall' ? 'active' : ''}`} onClick={() => setTab('overall')}>
            Overall
          </button>
        </div>

        <div className="daily-body">

          {/* ── TASKS TAB ── */}
          {tab === 'tasks' && (
            <>
              {nextTask && (
                <div className="next-task-banner">
                  <span className="next-task-label">Next up</span>
                  <span className="next-task-icon">{nextTask.icon}</span>
                  <div className="next-task-info">
                    <div className="next-task-text">{nextTask.text}</div>
                    <div className="next-task-time">{nextTask.time} · {nextTask.duration}</div>
                  </div>
                </div>
              )}
              <div className="day-progress-row">
                <span className="day-pct-text">{tasksPct}% of today's routine</span>
                <span className="day-count">{tasksDone} / {todayData.tasks.length}</span>
              </div>
              <div className="day-pbar">
                <div className="day-pbar-fill" style={{ width: `${tasksPct}%` }} />
              </div>
              <div className="task-list">
                {todayData.tasks.map(task => (
                  <button
                    key={task.id}
                    className={`task-item ${task.done ? 'done' : ''}`}
                    onClick={() => progress.toggleDailyTask(task.id)}
                  >
                    <div className={`task-check ${task.done ? 'checked' : ''}`}>
                      {task.done && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                    <span className="task-icon">{task.icon}</span>
                    <div className="task-content">
                      <div className="task-text">{task.text}</div>
                      <div className="task-time">{task.time} · {task.duration}</div>
                    </div>
                  </button>
                ))}
              </div>
              <div className="motivation-box">
                <div className="motiv-text">{motivationText(tasksPct)}</div>
              </div>
            </>
          )}

          {/* ── ROUTINE TAB ── */}
          {tab === 'routine' && (
            <div className="routine-timeline">
              {ROUTINE_TIMELINE.map((block, i) => {
                const task = block.taskId ? todayData.tasks.find(t => t.id === block.taskId) : null
                const isLast = i === ROUTINE_TIMELINE.length - 1
                return (
                  <div
                    key={block.time}
                    className={`tl-row ${block.type}${block.nested ? ' nested' : ''}${task?.done ? ' done' : ''}`}
                  >
                    <div className="tl-time">{block.time}</div>
                    <div className="tl-spine">
                      <div className="tl-dot" />
                      {!isLast && <div className="tl-line" />}
                    </div>
                    <div className="tl-card">
                      <div className="tl-card-left">
                        <span className="tl-icon">{block.icon}</span>
                        <div>
                          <div className="tl-label">{block.label}</div>
                          <div className="tl-dur">{block.duration}</div>
                        </div>
                      </div>
                      {task && (
                        <button
                          className={`tl-check ${task.done ? 'checked' : ''}`}
                          onClick={() => progress.toggleDailyTask(task.id)}
                          aria-label={task.done ? 'Mark undone' : 'Mark done'}
                        >
                          {task.done && (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── STUDIED TAB ── */}
          {tab === 'studied' && (
            todayData.studiedFiles.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📚</div>
                <div className="empty-text">No topics studied yet today</div>
                <div className="empty-sub">Open a topic and mark it as studied</div>
              </div>
            ) : (
              <div className="studied-list">
                {todayData.studiedFiles.map(fileId => {
                  const file = fileTree.allFiles.find(f => f.id === fileId)
                  if (!file) return null
                  return (
                    <div key={fileId} className="studied-item" style={{ '--tc': file.color }}>
                      <span className="studied-icon">{file.icon}</span>
                      <div className="studied-info">
                        <div className="studied-name">{file.name}</div>
                        <div className="studied-meta">{file.readTime} min read</div>
                      </div>
                      <span className="studied-check">✓</span>
                      <button
                        className="studied-uncheck"
                        onClick={() => progress.unmarkStudied(fileId)}
                        title="Unmark as studied"
                        aria-label="Unmark as studied"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    </div>
                  )
                })}
              </div>
            )
          )}

          {/* ── OVERALL TAB ── */}
          {tab === 'overall' && (
            <div className="overall-view">
              <div className="overall-hero">
                <div className="overall-pct gradient-text">{pct}%</div>
                <div className="overall-label">Overall Progress</div>
                <div className="overall-sub">{totalDone} of {totalFiles} topics completed</div>
                <div className="overall-pbar">
                  <div className="overall-pbar-fill" style={{ width: `${pct}%` }} />
                </div>
              </div>
              <div className="month-overview">
                {fileTree.sections.filter(s => s.key.startsWith('Month-')).map(section => {
                  const { done, total, pct: mp } = progress.getMonthProgress(section.files)
                  return (
                    <div key={section.key} className="mo-row">
                      <div className="mo-label">
                        <span className="mo-dot" style={{ background: section.color }} />
                        {section.label}
                      </div>
                      <div className="mo-bar">
                        <div className="mo-fill" style={{ width: `${mp}%`, background: section.color }} />
                      </div>
                      <div className="mo-count">{done}/{total}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── PAUSE MODAL ── */}
      {pauseOpen && (
        <>
          <div
            className="pause-modal-overlay"
            role="presentation"
            onClick={() => setPauseOpen(false)}
            onKeyDown={e => e.key === 'Escape' && setPauseOpen(false)}
          />
          <div className="pause-modal">
            <div className="pause-modal-header">
              <span className="pause-modal-title">🛡️ Pause Streak Protection</span>
              <button className="icon-btn" onClick={() => setPauseOpen(false)}>✕</button>
            </div>
            <p className="pause-modal-desc">
              Paused days don't break your streak. Pick reason, start date, and how many days to protect.
            </p>

            <span className="pause-field-label">Reason</span>
            <div className="pause-reasons-grid">
              {PAUSE_REASONS.map(r => (
                <button
                  key={r.id}
                  className={`pause-reason-btn ${pauseReason === r.id ? 'active' : ''}`}
                  onClick={() => setPauseReason(r.id)}
                >
                  <span>{r.icon}</span>
                  <span>{r.label}</span>
                </button>
              ))}
            </div>

            <label className="pause-field-label" htmlFor="pause-start-date">Start Date</label>
            <input
              id="pause-start-date"
              type="date"
              className="pause-date-input"
              value={pauseStart}
              min={today}
              onChange={e => setPauseStart(e.target.value)}
            />

            <label className="pause-field-label" htmlFor="pause-day-count">Number of Days</label>
            <div className="pause-days-row" id="pause-day-count">
              <button className="pause-stepper" onClick={() => setPauseDayCount(d => Math.max(1, d - 1))}>−</button>
              <span className="pause-days-val">{pauseDayCount}</span>
              <button className="pause-stepper" onClick={() => setPauseDayCount(d => Math.min(30, d + 1))}>+</button>
            </div>

            {pauseDayCount > 1 && (
              <div className="pause-preview">
                {pausePreviewDates.map(d => (
                  <span key={d} className="pause-preview-chip">{formatDate(d)}</span>
                ))}
              </div>
            )}

            <button className="pause-confirm-btn" onClick={handlePauseSubmit}>
              Protect {pauseDayCount} day{pauseDayCount > 1 ? 's' : ''}
            </button>
          </div>
        </>
      )}
    </>
  )
}
