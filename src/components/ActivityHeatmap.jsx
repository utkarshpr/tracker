import { useMemo, useState } from 'react'

const TABS = ['Day', 'Week', 'Month', 'Year']
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

function dateKey(d) { return d.toISOString().split('T')[0] }

function addDays(d, n) {
  const r = new Date(d); r.setDate(r.getDate() + n); return r
}

function activityLevel(data) {
  if (!data) return 0
  const items = (data.studiedFiles?.length || 0) +
                (data.tasks?.filter(t => t.done).length || 0) +
                (data.pomodoros || 0)
  if (items === 0) return 0
  if (items <= 2)  return 1
  if (items <= 5)  return 2
  return 3
}

const LEVEL_COLORS_DARK  = ['rgba(255,255,255,0.05)', '#312e81', '#6366f1', '#a5b4fc']
const LEVEL_COLORS_LIGHT = ['rgba(0,0,0,0.05)',       '#ddd6fe', '#818cf8', '#4f46e5']
const LEVEL_LABELS = ['No Activity', 'Low', 'Moderate', 'High']

function getYearDays() {
  const days = [], today = new Date()
  for (let i = 364; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i); days.push(dateKey(d))
  }
  return days
}

function getMonthCells(year, month) {
  const firstDay = new Date(year, month, 1)
  const lastDay  = new Date(year, month + 1, 0)
  const cells = []
  for (let i = 0; i < firstDay.getDay(); i++) cells.push(null)
  for (let d = 1; d <= lastDay.getDate(); d++) cells.push(dateKey(new Date(year, month, d)))
  return cells
}

function getWeekDays(cursor) {
  const d = new Date(cursor)
  const sun = new Date(d); sun.setDate(d.getDate() - d.getDay())
  return Array.from({ length: 7 }, (_, i) => dateKey(addDays(sun, i)))
}

function TooltipContent({ day, data }) {
  if (!day) return null
  const items = (data?.studiedFiles?.length || 0) + (data?.tasks?.filter(t => t.done).length || 0)
  const pomodoros = data?.pomodoros || 0
  const label = new Date(day + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return (
    <div className="heatmap-tooltip">
      <strong>{label}</strong>
      {!data || activityLevel(data) === 0
        ? ' — No activity'
        : ` — ${items} item${items !== 1 ? 's' : ''}${pomodoros > 0 ? `, ${pomodoros} 🍅` : ''}`}
    </div>
  )
}

export default function ActivityHeatmap({ daily, theme }) {
  const [tab,     setTab]     = useState('Day')
  const [cursor,  setCursor]  = useState(new Date())
  const [tooltip, setTooltip] = useState(null)

  const todayStr = dateKey(new Date())
  const colors   = theme === 'light' ? LEVEL_COLORS_LIGHT : LEVEL_COLORS_DARK

  const yearDays  = useMemo(() => getYearDays(), [])
  const yearWeeks = useMemo(() => {
    const weeks = []
    for (let i = 0; i < 52; i++) weeks.push(yearDays.slice(i * 7, i * 7 + 7))
    const rem = yearDays.slice(364); if (rem.length) weeks.push(rem)
    return weeks
  }, [yearDays])

  const yearMonthLabels = useMemo(() => {
    let last = null
    return yearWeeks.map(week => {
      const mon = new Date(week[0]).toLocaleString('default', { month: 'short' })
      if (mon !== last) { last = mon; return mon }
      return null
    })
  }, [yearWeeks])

  const totalActive    = yearDays.filter(d => activityLevel(daily[d]) > 0).length
  const totalPomodoros = yearDays.reduce((a, d) => a + (daily[d]?.pomodoros || 0), 0)
  const totalStudied   = yearDays.reduce((a, d) => a + (daily[d]?.studiedFiles?.length || 0), 0)

  const monthCells = useMemo(() => getMonthCells(cursor.getFullYear(), cursor.getMonth()), [cursor])
  const weekDays   = useMemo(() => getWeekDays(cursor), [cursor])
  const cursorKey  = dateKey(cursor)

  const navigate = dir => {
    const c = new Date(cursor)
    if (tab === 'Month')     c.setMonth(c.getMonth() + dir)
    else if (tab === 'Week') c.setDate(c.getDate() + dir * 7)
    else if (tab === 'Day')  c.setDate(c.getDate() + dir)
    setCursor(c)
  }

  const navLabel = (() => {
    if (tab === 'Month') return `${MONTH_NAMES[cursor.getMonth()]} ${cursor.getFullYear()}`
    if (tab === 'Week') {
      const d = new Date(cursor)
      const sun = new Date(d); sun.setDate(d.getDate() - d.getDay())
      const sat = addDays(sun, 6)
      return `${sun.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${sat.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    }
    if (tab === 'Day') return cursor.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    return ''
  })()

  const canGoForward = tab === 'Day' ? cursorKey < todayStr
                     : tab === 'Week' ? weekDays[6] < todayStr
                     : tab === 'Month' ? `${cursor.getFullYear()}-${String(cursor.getMonth()).padStart(2,'0')}` < `${new Date().getFullYear()}-${String(new Date().getMonth()).padStart(2,'0')}`
                     : false

  return (
    <div className="heatmap-wrap">
      <div className="heatmap-header">
        <h2 className="section-title">Study Activity</h2>
        <div className="heatmap-stats">
          <span><strong>{totalActive}</strong> active days</span>
          <span>·</span>
          <span><strong>{totalStudied}</strong> topics reviewed</span>
          <span>·</span>
          <span><strong>{totalPomodoros}</strong> 🍅 sessions</span>
        </div>
      </div>

      {/* Tab bar */}
      <div className="activity-tabs">
        {TABS.map(t => (
          <button
            key={t}
            className={`activity-tab ${tab === t ? 'active' : ''}`}
            onClick={() => { setTab(t); setCursor(new Date()) }}
          >
            {t}
          </button>
        ))}
        {tab !== 'Year' && (
          <div className="activity-nav">
            <button className="activity-nav-btn" onClick={() => navigate(-1)}>‹</button>
            <span className="activity-nav-label">{navLabel}</span>
            <button className="activity-nav-btn" onClick={() => navigate(1)} disabled={!canGoForward}>›</button>
          </div>
        )}
      </div>

      {/* ── YEAR VIEW ── */}
      {tab === 'Year' && (
        <div className="heatmap-outer">
          <div className="heatmap-month-row">
            {yearMonthLabels.map((m, i) =>
              m ? <span key={i} className="heatmap-month">{m}</span> : <span key={i} />
            )}
          </div>
          <div className="heatmap-grid">
            {yearWeeks.map((week, wi) => (
              <div key={wi} className="heatmap-col">
                {week.map(day => {
                  const data  = daily[day]
                  const level = activityLevel(data)
                  return (
                    <div
                      key={day}
                      className={`heatmap-day${day === todayStr ? ' today' : ''}`}
                      style={{ background: colors[level] }}
                      onMouseEnter={() => setTooltip({ day, data })}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  )
                })}
              </div>
            ))}
          </div>
          <div className="heatmap-legend">
            <span className="legend-label">Less</span>
            {colors.map((c, i) => <div key={i} className="heatmap-day" style={{ background: c }} />)}
            <span className="legend-label">More</span>
          </div>
        </div>
      )}

      {/* ── MONTH VIEW ── */}
      {tab === 'Month' && (
        <div className="cal-month">
          <div className="cal-day-headers">
            {DAY_NAMES.map(d => <div key={d} className="cal-day-header">{d}</div>)}
          </div>
          <div className="cal-grid">
            {monthCells.map((day, i) => {
              if (!day) return <div key={`pad-${i}`} className="cal-cell empty" />
              const data   = daily[day]
              const level  = activityLevel(data)
              const isToday = day === todayStr
              const dateNum = new Date(day + 'T12:00:00').getDate()
              return (
                <div
                  key={day}
                  className={`cal-cell${isToday ? ' today' : ''}${level > 0 ? ' active' : ''}`}
                  style={{ '--lc': colors[level] }}
                  onMouseEnter={() => setTooltip({ day, data })}
                  onMouseLeave={() => setTooltip(null)}
                >
                  <span className="cal-date-num">{dateNum}</span>
                  {level > 0 && (
                    <div className="cal-activity-dots">
                      {(data?.studiedFiles?.length || 0) + (data?.tasks?.filter(t=>t.done).length||0) > 0 && (
                        <span className="cal-dot" style={{ background: colors[Math.min(level,3)] }} />
                      )}
                      {(data?.pomodoros || 0) > 0 && (
                        <span className="cal-dot" style={{ background: '#f59e0b' }} />
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── WEEK VIEW ── */}
      {tab === 'Week' && (
        <div className="cal-week">
          {weekDays.map(day => {
            const data    = daily[day]
            const level   = activityLevel(data)
            const isToday = day === todayStr
            const date    = new Date(day + 'T12:00:00')
            const items   = (data?.studiedFiles?.length || 0) + (data?.tasks?.filter(t=>t.done).length||0)
            const poms    = data?.pomodoros || 0
            return (
              <div
                key={day}
                className={`cal-week-day${isToday ? ' today' : ''}${level > 0 ? ' active' : ''}`}
                style={{ '--lc': colors[level] }}
              >
                <div className="cal-week-header">
                  <span className="cal-week-dayname">{DAY_NAMES[date.getDay()]}</span>
                  <span className={`cal-week-datenum${isToday ? ' today' : ''}`}>{date.getDate()}</span>
                </div>
                <div className="cal-week-body">
                  {level === 0 ? (
                    <span className="cal-week-empty">No activity</span>
                  ) : (
                    <>
                      {items > 0 && <div className="cal-week-stat">📚 {items} item{items !== 1 ? 's' : ''}</div>}
                      {poms  > 0 && <div className="cal-week-stat">🍅 {poms} session{poms !== 1 ? 's' : ''}</div>}
                    </>
                  )}
                </div>
                <div className="cal-week-bar" style={{ background: colors[level], opacity: level > 0 ? 1 : 0.15 }} />
              </div>
            )
          })}
        </div>
      )}

      {/* ── DAY VIEW ── */}
      {tab === 'Day' && (() => {
        const data     = daily[cursorKey]
        const level    = activityLevel(data)
        const isToday  = cursorKey === todayStr
        const studied  = data?.studiedFiles || []
        const doneTasks = data?.tasks?.filter(t => t.done) || []
        const poms     = data?.pomodoros || 0
        return (
          <div className="cal-day-view">
            <div className="cal-day-level-row">
              <div className="cal-day-level-bar-wrap">
                <div className="cal-day-level-fill" style={{ width: `${level * 33.33}%`, background: colors[Math.max(1, level)] }} />
              </div>
              <span className="cal-day-level-label">{LEVEL_LABELS[level]}</span>
            </div>
            <div className="cal-day-stats-row">
              <div className="cal-day-stat-box">
                <div className="cal-day-stat-num">{studied.length}</div>
                <div className="cal-day-stat-label">Topics Studied</div>
              </div>
              <div className="cal-day-stat-box">
                <div className="cal-day-stat-num">{doneTasks.length}</div>
                <div className="cal-day-stat-label">Tasks Done</div>
              </div>
              <div className="cal-day-stat-box">
                <div className="cal-day-stat-num">{poms}</div>
                <div className="cal-day-stat-label">Pomodoros</div>
              </div>
            </div>
            {level === 0 ? (
              <div className="cal-day-empty">
                <div className="cal-day-empty-icon">🌙</div>
                <div>{isToday ? "No activity yet today — let's study!" : 'Rest day'}</div>
              </div>
            ) : (
              <>
                {studied.length > 0 && (
                  <div className="cal-day-section">
                    <div className="cal-day-section-title">Topics Studied</div>
                    <div className="cal-day-chips">
                      {studied.map((f, i) => <span key={i} className="cal-day-chip">📚 {f}</span>)}
                    </div>
                  </div>
                )}
                {doneTasks.length > 0 && (
                  <div className="cal-day-section">
                    <div className="cal-day-section-title">Tasks Completed</div>
                    <div className="cal-day-chips">
                      {doneTasks.slice(0, 10).map((t, i) => <span key={i} className="cal-day-chip done">✓ {typeof t === 'string' ? t : t.text || t}</span>)}
                      {doneTasks.length > 10 && <span className="cal-day-chip">+{doneTasks.length - 10} more</span>}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )
      })()}

      {/* Tooltip (Year + Month) */}
      {tooltip && (tab === 'Year' || tab === 'Month') && (
        <TooltipContent day={tooltip.day} data={tooltip.data} />
      )}
    </div>
  )
}
