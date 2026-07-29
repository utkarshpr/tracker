import { useMemo, useState, useEffect, useCallback } from 'react'
import ProgressRing from './ProgressRing'
import ActivityHeatmap from './ActivityHeatmap'
import { useCountUp } from '../hooks/useCountUp'
import { extractTasksFromMd, extractTOC } from '../utils/parseFiles'
import DayTimeline from './DayTimeline'
import { touchProgress } from '../lib/progressSync'

const TODO_KEY    = 'faang_todos_v1'
const TOC_DONE_KEY = 'faang_toc_done_v1'
function loadTodoData() {
  try { return JSON.parse(localStorage.getItem(TODO_KEY)) ?? { todos: [], reminders: [] } }
  catch { return { todos: [], reminders: [] } }
}
function loadTocDone() {
  try { return JSON.parse(localStorage.getItem(TOC_DONE_KEY)) ?? {} }
  catch { return {} }
}

function monthStatusClass(pct) {
  if (pct === 100) return 'complete'
  if (pct > 0) return 'in-progress'
  return 'not-started'
}
function monthStatusLabel(pct) {
  if (pct === 100) return '✓ Complete'
  if (pct > 0) return 'In Progress'
  return 'Not Started'
}

export default function Dashboard({ fileTree, onSelectFile, onSelectMonth, progress, problems, theme, notes, onDeleteNote, onEditNote, onOpenTodo, onOpenDaily }) {
  const { done: topicsDone, total: totalTopics } = progress.getTotalProgress(fileTree.allFiles)
  const streak = progress.getStreak()

  const [todoData, setTodoData] = useState(loadTodoData)
  useEffect(() => {
    const handler = () => setTodoData(loadTodoData())
    window.addEventListener('faang_todos_updated', handler)
    return () => window.removeEventListener('faang_todos_updated', handler)
  }, [])

  const saveTodoData = useCallback((next) => {
    localStorage.setItem(TODO_KEY, JSON.stringify(next))
    touchProgress()
    window.dispatchEvent(new CustomEvent('faang_todos_updated'))
    setTodoData(next)
  }, [])
  const toggleTodo   = useCallback((id) => {
    const next = { ...todoData, todos: todoData.todos.map(t => t.id === id ? { ...t, done: !t.done } : t) }
    saveTodoData(next)
  }, [todoData, saveTodoData])
  const deleteTodo   = useCallback((id) => {
    saveTodoData({ ...todoData, todos: todoData.todos.filter(t => t.id !== id) })
  }, [todoData, saveTodoData])
  const deleteReminder = useCallback((id) => {
    saveTodoData({ ...todoData, reminders: todoData.reminders.filter(r => r.id !== id) })
  }, [todoData, saveTodoData])

  // TOC sections — re-read on every mount (Dashboard unmounts while viewing files)
  const [tocDone] = useState(loadTocDone)
  const totalSections = useMemo(
    () => fileTree.allFiles.reduce((sum, f) => sum + extractTOC(f.content).length, 0),
    [fileTree]
  )
  const sectionsDone = Object.values(tocDone).filter(Boolean).length

  // Total DSA problems across all files (memoized — runs once)
  const totalProblems = useMemo(
    () => fileTree.allFiles.reduce((sum, f) => sum + extractTasksFromMd(f.content).length, 0),
    [fileTree]
  )
  const solvedProblems = problems?.getTotalSolved() ?? 0

  // Combined stats: topics + sections + DSA problems
  const totalItems = totalTopics + totalSections + totalProblems
  const totalDone  = topicsDone  + sectionsDone  + solvedProblems
  const totalPct   = totalItems  ? Math.round((totalDone / totalItems) * 100) : 0

  const countDone      = useCountUp(totalDone,             1200, 200)
  const countRemaining = useCountUp(totalItems - totalDone, 1200, 350)
  const countStreak    = useCountUp(streak,      900,  500)
  const countPct       = useCountUp(totalPct,   1400, 100)

  const months = fileTree.sections.filter(s => s.key.startsWith('Month-'))

  return (
    <div className="dashboard">
      {/* Hero */}
      <div className="hero">
        <div className="hero-bg" />
        <div className="hero-aurora" />
        <div className="hero-content">
          <div className="hero-badge">
            <span>🎯</span>
            <span>SDE-3 Interview Preparation</span>
          </div>
          <h1 className="hero-title">
            <span className="gradient-text">FAANG</span>
            <span> Study Hub</span>
          </h1>
          <p className="hero-subtitle">
            3 months · {totalTopics} topics · {totalSections} sections · {totalProblems} problems · algorithms, system design &amp; leadership
          </p>
          <div className="hero-stats">
            <div className="stat">
              <div className="stat-val gradient-text">{countDone}</div>
              <div className="stat-label">Completed</div>
            </div>
            <div className="stat-divider" />
            <div className="stat">
              <div className="stat-val">{countRemaining}</div>
              <div className="stat-label">Remaining</div>
            </div>
            <div className="stat-divider" />
            <div className="stat">
              <div className="stat-val" style={{ color: '#fbbf24' }}>🔥 {countStreak}</div>
              <div className="stat-label">Day Streak</div>
            </div>
            <div className="stat-divider" />
            <div className="stat">
              <div className="stat-val gradient-text">{countPct}%</div>
              <div className="stat-label">Progress</div>
            </div>
          </div>
        </div>
        <div className="hero-ring">
          <ProgressRing pct={totalPct} size={160} stroke={10} color="#8b5cf6" />
          <div className="hero-ring-label">
            <div className="hero-ring-pct">{countPct}%</div>
            <div className="hero-ring-text">done</div>
          </div>
        </div>
      </div>

      {/* Activity Heatmap */}
      <ActivityHeatmap daily={progress.daily} theme={theme} />

      {/* Today's Routine Card */}
      {(() => {
        const todayData  = progress.getTodayData()
        const isPaused   = progress.isPausedDay()
        const pauseInfo  = progress.getPauseInfo()
        const tasksDone  = todayData.tasks.filter(t => t.done).length
        const tasksPct   = todayData.tasks.length ? Math.round((tasksDone / todayData.tasks.length) * 100) : 0

        const now   = new Date()
        const mins  = now.getHours() * 60 + now.getMinutes()
        const parse = (str) => {
          const [time, ampm] = str.split(' ')
          let [h, m] = time.split(':').map(Number)
          if (ampm === 'PM' && h !== 12) h += 12
          if (ampm === 'AM' && h === 12) h = 0
          return h * 60 + (m || 0)
        }
        const nextTask = todayData.tasks.find(t => !t.done && parse(t.time) > mins) ?? null

        return (
          <div className="dash-today-section" style={{ marginTop: '2.5rem' }}>
            <div className="section-title-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: '.7rem' }}>
                <h2 className="section-title">Today's Routine</h2>
                {isPaused && (
                  <span className="dash-pause-chip">🛡️ Paused{pauseInfo?.reason ? ` · ${pauseInfo.reason}` : ''}</span>
                )}
              </div>
              <button className="dash-tasks-manage-btn" onClick={onOpenDaily}>
                Open Full View
              </button>
            </div>

            <div className="dash-today-card">
              {/* Progress bar */}
              <div className="dash-today-progress-row">
                <span className="dash-today-pct">{tasksPct}% complete</span>
                <span className="dash-today-count">{tasksDone} / {todayData.tasks.length} tasks</span>
              </div>
              <div className="dash-today-pbar">
                <div className="dash-today-pbar-fill" style={{ width: `${tasksPct}%` }} />
              </div>

              {/* Next up */}
              {nextTask && !isPaused && (
                <div className="dash-next-task">
                  <span className="dash-next-label">Next up</span>
                  <span>{nextTask.icon}</span>
                  <div className="dash-next-info">
                    <span className="dash-next-text">{nextTask.text}</span>
                    <span className="dash-next-time">{nextTask.time} · {nextTask.duration}</span>
                  </div>
                </div>
              )}

              {/* Task grid */}
              <div className="dash-today-tasks">
                {todayData.tasks.map(task => (
                  <button
                    key={task.id}
                    className={`dash-today-task ${task.done ? 'done' : ''}`}
                    onClick={() => progress.toggleDailyTask(task.id)}
                  >
                    <div className={`dash-today-check ${task.done ? 'checked' : ''}`}>
                      {task.done && (
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                    <span className="dash-today-task-icon">{task.icon}</span>
                    <div className="dash-today-task-info">
                      <div className="dash-today-task-text">{task.text}</div>
                      <div className="dash-today-task-time">{task.time} · {task.duration}</div>
                    </div>
                  </button>
                ))}
              </div>

              <DayTimeline tasks={todayData.tasks} />
            </div>
          </div>
        )
      })()}

      {/* Month Cards */}
      <div className="section-title-row">
        <h2 className="section-title">Monthly Progress</h2>
        <span className="section-subtitle">Track your study journey</span>
      </div>
      <div className="month-grid">
        {months.map((month, i) => {
          const { done, total, pct } = progress.getMonthProgress(month.files)
          return (
            <button
              key={month.key}
              className="month-card"
              style={{ '--mc': month.color, animationDelay: `${i * 0.12}s` }}
              onClick={() => onSelectMonth(month)}
            >
              <div className="month-card-top">
                <div>
                  <div className="month-card-label">{month.label}</div>
                  <div className="month-card-sub">{month.subtitle}</div>
                </div>
                <div style={{ position: 'relative' }}>
                  <ProgressRing pct={pct} size={64} stroke={5} color={month.color} />
                  <div className="month-ring-overlay">{pct}%</div>
                </div>
              </div>
              <div className="month-progress-bar">
                <div className="month-progress-fill" style={{ width: `${pct}%`, background: month.color }} />
              </div>
              <div className="month-card-footer">
                <span className="month-done">{done} / {total} topics</span>
                <span className={`month-status ${monthStatusClass(pct)}`}>
                  {monthStatusLabel(pct)}
                </span>
              </div>
              <div className="month-topics">
                {month.files.map(f => (
                  <button
                    key={f.id}
                    className={`topic-chip ${progress.isStudied(f.id) ? 'studied' : ''}`}
                    onClick={e => { e.stopPropagation(); onSelectFile(f) }}
                    style={{ '--tc': f.color }}
                    title={f.name}
                  >
                    {f.icon} {f.name}
                  </button>
                ))}
              </div>
              <div className="month-card-view" style={{ color: month.color }}>
                View all topics
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            </button>
          )
        })}
      </div>

      {/* Notes */}
      {(() => {
        const fileMap    = Object.fromEntries(fileTree.allFiles.map(f => [f.id, f]))
        const noteEntries = notes
          ? Object.entries(notes)
              .filter(([, n]) => n?.text)
              .sort((a, b) => new Date(b[1].updatedAt) - new Date(a[1].updatedAt))
          : []

        return (
          <div style={{ marginTop: '2.5rem' }}>
            <div className="section-title-row">
              <h2 className="section-title">My Notes</h2>
              {noteEntries.length > 0 && (
                <span className="section-subtitle">
                  {noteEntries.length} annotated topic{noteEntries.length === 1 ? '' : 's'}
                </span>
              )}
            </div>

            {noteEntries.length === 0 ? (
              <div className="notes-empty">
                <div className="notes-empty-icon">📝</div>
                <div className="notes-empty-text">No notes yet</div>
                <div className="notes-empty-sub">
                  Open any topic and press <strong>Notes</strong> in the header to start writing
                </div>
              </div>
            ) : (
              <div className="notes-grid">
                {noteEntries.map(([fileId, note]) => {
                  const file = fileMap[fileId]
                  if (!file) return null
                  const when = note.updatedAt
                    ? new Date(note.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : ''
                  return (
                    <div key={fileId} className="note-card" style={{ '--tc': file.color }}>
                      <div className="note-card-top">
                        <span className="note-card-icon">{file.icon}</span>
                        <div className="note-card-meta">
                          <span className="note-card-name">{file.name}</span>
                          {when && <span className="note-card-time">{when}</span>}
                        </div>
                        <div className="note-card-actions">
                          <button
                            className="note-action-btn edit"
                            onClick={() => onEditNote(file)}
                            title="Edit note"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                          </button>
                          <button
                            className="note-action-btn delete"
                            onClick={() => onDeleteNote(fileId)}
                            title="Delete note"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6"/>
                              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                              <path d="M10 11v6M14 11v6"/>
                              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                            </svg>
                          </button>
                        </div>
                      </div>
                      <button className="note-card-preview" onClick={() => onSelectFile(file)}>
                        {note.text.slice(0, 160)}{note.text.length > 160 ? '…' : ''}
                      </button>
                      <div className="note-card-bar">
                        <div className="note-card-bar-fill" style={{ background: file.color }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })()}

      {/* Tasks & Reminders */}
      {(() => {
        const activeTodos = todoData.todos.filter(t => !t.done).slice(0, 6)
        const doneTodos   = todoData.todos.filter(t => t.done).length
        const now = Date.now()
        const upcoming = todoData.reminders
          .filter(r => !r.fired && r.ts > now)
          .sort((a, b) => a.ts - b.ts)
          .slice(0, 5)
        const overdue = todoData.reminders.filter(r => !r.fired && r.ts <= now)

        return (
          <div className="dash-tasks-section" style={{ marginTop: '2.5rem' }}>
            <div className="section-title-row">
              <h2 className="section-title">Tasks &amp; Reminders</h2>
              <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
                {(todoData.todos.length > 0 || todoData.reminders.length > 0) && (
                  <span className="section-subtitle">
                    {doneTodos}/{todoData.todos.length} tasks · {todoData.reminders.filter(r => !r.fired).length} reminders
                  </span>
                )}
                <button className="dash-tasks-manage-btn" onClick={onOpenTodo}>
                  + Manage
                </button>
              </div>
            </div>

            <div className="dash-tasks-grid">
              {/* Todos card */}
              <div className="dash-card">
                <div className="dash-card-head">
                  <span className="dash-card-icon">✅</span>
                  <span className="dash-card-title">Todos</span>
                  {doneTodos > 0 && (
                    <span className="dash-card-badge">{doneTodos} done</span>
                  )}
                </div>
                {activeTodos.length === 0 ? (
                  <div className="dash-empty">
                    {todoData.todos.length === 0
                      ? <><div className="dash-empty-icon">📋</div><div>No tasks yet</div><button className="dash-empty-btn" onClick={onOpenTodo}>Add a task</button></>
                      : <><div className="dash-empty-icon">🎉</div><div>All tasks done!</div></>
                    }
                  </div>
                ) : (
                  <ul className="dash-todo-list">
                    {activeTodos.map(t => (
                      <li key={t.id} className="dash-todo-item">
                        <button
                          className="dash-todo-check"
                          onClick={() => toggleTodo(t.id)}
                          aria-label="Mark done"
                          title="Mark done"
                        />
                        <span className="dash-todo-text">{t.text}</span>
                        <button
                          className="dash-item-del"
                          onClick={() => deleteTodo(t.id)}
                          aria-label="Delete"
                          title="Delete"
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                      </li>
                    ))}
                    {todoData.todos.filter(t => !t.done).length > 6 && (
                      <li>
                        <button className="dash-todo-more" onClick={onOpenTodo}>
                          +{todoData.todos.filter(t => !t.done).length - 6} more…
                        </button>
                      </li>
                    )}
                  </ul>
                )}
              </div>

              {/* Reminders card */}
              <div className="dash-card">
                <div className="dash-card-head">
                  <span className="dash-card-icon">⏰</span>
                  <span className="dash-card-title">Reminders</span>
                  {overdue.length > 0 && (
                    <span className="dash-card-badge overdue">{overdue.length} overdue</span>
                  )}
                </div>
                {upcoming.length === 0 && overdue.length === 0 ? (
                  <div className="dash-empty">
                    <div className="dash-empty-icon">🔔</div>
                    <div>No upcoming reminders</div>
                    <button className="dash-empty-btn" onClick={onOpenTodo}>Set a reminder</button>
                  </div>
                ) : (
                  <ul className="dash-reminder-list">
                    {overdue.map(r => (
                      <li key={r.id} className="dash-reminder-item overdue">
                        <span className="dash-reminder-icon">⚠️</span>
                        <div className="dash-reminder-body">
                          <span className="dash-reminder-text">{r.text}</span>
                          <span className="dash-reminder-time overdue-label">Overdue</span>
                        </div>
                        <button
                          className="dash-item-del"
                          onClick={() => deleteReminder(r.id)}
                          aria-label="Delete"
                          title="Delete"
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                      </li>
                    ))}
                    {upcoming.map(r => {
                      const dt = new Date(r.ts)
                      const isToday = dt.toDateString() === new Date().toDateString()
                      const timeStr = isToday
                        ? dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : dt.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      return (
                        <li key={r.id} className="dash-reminder-item">
                          <span className="dash-reminder-icon">⏰</span>
                          <div className="dash-reminder-body">
                            <span className="dash-reminder-text">{r.text}</span>
                            <span className="dash-reminder-time">{timeStr}</span>
                          </div>
                          <button
                            className="dash-item-del"
                            onClick={() => deleteReminder(r.id)}
                            aria-label="Delete"
                            title="Delete"
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
