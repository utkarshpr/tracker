import { useCallback, useMemo } from 'react'
import ProgressRing from './ProgressRing'
import { extractTOC, extractTasksFromMd } from '../utils/parseFiles'

function loadTocDone() {
  try { return JSON.parse(localStorage.getItem('faang_toc_done_v1')) ?? {} }
  catch { return {} }
}

export default function MonthView({ month, progress, problems, onSelectFile }) {
  const { done: filesDone, total: filesTotal } = progress.getMonthProgress(month.files)

  const tocDone = useMemo(loadTocDone, [])

  // Per-file section stats (for the mini progress bar in each row)
  const fileTocStats = useMemo(() => {
    return month.files.map(file => {
      const toc = extractTOC(file.content)
      const doneSections = toc.filter(h => !!tocDone[`${file.id}::toc::${h.id}`]).length
      return { doneSections, totalSections: toc.length }
    })
  }, [month.files, tocDone])

  // Per-month problem stats (same metric as Dashboard "problems")
  const { monthProblemsDone, monthProblemsTotal } = useMemo(() => {
    let total = 0, done = 0
    for (const file of month.files) {
      const tasks = extractTasksFromMd(file.content)
      total += tasks.length
      done += tasks.filter(t => problems.isProblemDone(`${file.id}::${t.text}`)).length
    }
    return { monthProblemsDone: done, monthProblemsTotal: total }
  }, [month.files, problems])

  // Month-scoped section stats
  const monthSectionsTotal = fileTocStats.reduce((s, f) => s + f.totalSections, 0)
  const monthSectionsDone  = fileTocStats.reduce((s, f) => s + f.doneSections, 0)

  // Combined metric (mirrors Dashboard: topics + sections + problems)
  const combinedTotal = filesTotal + monthSectionsTotal + monthProblemsTotal
  const combinedDone  = filesDone  + monthSectionsDone  + monthProblemsDone
  const combinedPct   = combinedTotal ? Math.round((combinedDone / combinedTotal) * 100) : 0

  const handleMove = useCallback((e) => {
    const el = e.currentTarget
    const { left, top } = el.getBoundingClientRect()
    el.style.setProperty('--mx', `${e.clientX - left}px`)
    el.style.setProperty('--my', `${e.clientY - top}px`)
  }, [])

  return (
    <div className="month-view">
      {/* Hero header */}
      <div className="mv-hero" style={{ '--mc': month.color }}>
        <div className="mv-hero-accent" style={{ background: month.color }} />
        <div className="mv-hero-content">
          <div className="mv-hero-badge" style={{ color: month.color, borderColor: `${month.color}40`, background: `${month.color}10` }}>
            {month.label}
          </div>
          <h1 className="mv-hero-title">{month.label}: <span style={{ color: month.color }}>{month.subtitle}</span></h1>
          <div className="mv-hero-stats">
            <div className="mv-stat">
              <span className="mv-stat-val" style={{ color: month.color }}>{filesDone}</span>
              <span className="mv-stat-label">Topics Done</span>
            </div>
            <div className="mv-stat-div" />
            <div className="mv-stat">
              <span className="mv-stat-val" style={{ color: monthProblemsDone > 0 ? month.color : undefined }}>{monthProblemsDone}</span>
              <span className="mv-stat-label">Problems Solved</span>
            </div>
            <div className="mv-stat-div" />
            <div className="mv-stat">
              <span className="mv-stat-val">{filesTotal} <span style={{ fontSize: '.65em', opacity: .6 }}>+{monthSectionsTotal}+{monthProblemsTotal}</span></span>
              <span className="mv-stat-label">Topics + Sections + Problems</span>
            </div>
          </div>
          <div className="mv-pbar">
            <div className="mv-pbar-fill" style={{ width: `${combinedPct}%`, background: month.color }} />
          </div>
          <div className="mv-pbar-label">
            <span style={{ color: month.color, fontWeight: 600 }}>{combinedPct}% complete</span>
            <span>{filesDone}/{filesTotal} topics · {monthSectionsDone}/{monthSectionsTotal} sections · {monthProblemsDone}/{monthProblemsTotal} problems</span>
          </div>
        </div>
        <div className="mv-ring-wrap">
          <ProgressRing pct={combinedPct} size={120} stroke={8} color={month.color} />
          <div className="mv-ring-inner">
            <div className="mv-ring-pct" style={{ color: month.color }}>{combinedPct}%</div>
            <div className="mv-ring-sub">done</div>
          </div>
        </div>
      </div>

      {/* Topic list */}
      <div className="mv-body">
        <div className="section-title-row" style={{ marginBottom: '1rem' }}>
          <h2 className="section-title">{month.label} Topics</h2>
          <span className="section-subtitle">{filesTotal} topics · {monthProblemsTotal} problems</span>
        </div>
        <div className="mv-list">
          {month.files.map((file, i) => {
            const studied = progress.isStudied(file.id)
            const { doneSections, totalSections } = fileTocStats[i] ?? { doneSections: 0, totalSections: 0 }
            const sectionPct = totalSections ? Math.round((doneSections / totalSections) * 100) : 0
            return (
              <button
                key={file.id}
                className={`mv-row ${studied ? 'studied' : ''}`}
                onClick={() => onSelectFile(file)}
                onMouseMove={handleMove}
                style={{ '--tc': file.color, animationDelay: `${i * 0.04}s` }}
              >
                <span className="mv-row-icon">{file.icon}</span>
                <div className="mv-row-body">
                  <div className="mv-row-name">{file.name}</div>
                  <div className="mv-row-meta">
                    <span>{file.readTime} min read</span>
                    <span>·</span>
                    <span>{file.wordCount.toLocaleString()} words</span>
                    {doneSections > 0 && totalSections > 0 && (
                      <>
                        <span>·</span>
                        <span style={{ color: file.color }}>{doneSections}/{totalSections} sections</span>
                      </>
                    )}
                  </div>
                  {totalSections > 0 && sectionPct > 0 && (
                    <div className="mv-row-secbar">
                      <div className="mv-row-secbar-fill" style={{ width: `${sectionPct}%`, background: file.color }} />
                    </div>
                  )}
                  <div className="mv-row-desc">{file.description.slice(0, 120)}{file.description.length > 120 ? '…' : ''}</div>
                </div>
                <div className="mv-row-status">
                  {studied ? (
                    <span className="mv-row-done" style={{ color: '#34d399', borderColor: 'rgba(52,211,153,.3)', background: 'rgba(52,211,153,.08)' }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Done
                    </span>
                  ) : (
                    <span className="mv-row-arrow" style={{ color: file.color }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
