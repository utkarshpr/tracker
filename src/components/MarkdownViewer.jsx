import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { extractTOC, extractTasksFromMd } from '../utils/parseFiles'

const TOC_DONE_KEY = 'faang_toc_done_v1'

function loadTocDone() {
  try { return JSON.parse(localStorage.getItem(TOC_DONE_KEY)) ?? {} }
  catch { return {} }
}
function saveTocDone(data) { localStorage.setItem(TOC_DONE_KEY, JSON.stringify(data)) }

export default function MarkdownViewer({
  file, isStudied, onMarkStudied, onUnmark,
  note, onNoteChange,
  problems,
  noteOpen, onToggleNotes,
}) {
  const contentRef   = useRef(null)
  const checkboxIdx  = useRef(0)
  const [activeId,   setActiveId] = useState('')
  const [tocOpen,    setTocOpen]  = useState(true)
  const [noteText,   setNoteText] = useState(note?.text || '')
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [tocDone, setTocDone] = useState(loadTocDone)

  const toc   = useMemo(() => extractTOC(file.content),         [file.content])
  const tasks = useMemo(() => extractTasksFromMd(file.content), [file.content])
  const { completed, total, pct: taskPct } = problems.getFileProgress(file.id, tasks)

  // TOC done helpers
  const tocKey = (id) => `${file.id}::toc::${id}`
  const isTocDone = (id) => !!tocDone[tocKey(id)]
  const toggleTocDone = (id) => {
    const k = tocKey(id)
    setTocDone(prev => {
      const next = { ...prev }
      if (next[k]) {
        delete next[k]
      } else {
        next[k] = true
      }
      saveTocDone(next)
      return next
    })
  }
  const tocDoneCount = toc.filter(h => isTocDone(h.id)).length

  useEffect(() => {
    window.scrollTo(0, 0)
    if (contentRef.current) contentRef.current.scrollTop = 0
    setNoteText(note?.text || '')
    setShowScrollTop(false)
  }, [file.id])                    // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    const onScroll = () => {
      const headings = el.querySelectorAll('h1,h2,h3,h4')
      let current = ''
      headings.forEach(h => { if (h.getBoundingClientRect().top < 200) current = h.id })
      setActiveId(current)
      setShowScrollTop(el.scrollTop > 300)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [file.id])

  const scrollTo = (id) => {
    const el = contentRef.current
    if (!el) return
    const target = el.querySelector(`#${CSS.escape(id)}`)
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const scrollToTop = () => {
    const el = contentRef.current
    if (el) el.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const notePanelRef = useRef(null)

  const handleNoteChange = useCallback((e) => {
    setNoteText(e.target.value)
    onNoteChange?.(file.id, e.target.value)
  }, [file.id, onNoteChange])

  // Focus textarea when drawer opens
  useEffect(() => {
    if (noteOpen) {
      setTimeout(() => notePanelRef.current?.querySelector('textarea')?.focus(), 60)
    }
  }, [noteOpen])

  // Reset checkbox counter before each ReactMarkdown render
  checkboxIdx.current = 0

  const components = {
    blockquote({ children }) {
      const text = extractText(children)
      const type = text.includes('💡') ? 'tip' : text.includes('⚠️') ? 'warning' : text.includes('🌍') ? 'example' : ''
      return <blockquote className={`callout${type ? ` callout-${type}` : ''}`}>{children}</blockquote>
    },
    code({ node, inline, className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '')
      if (!inline && match) {
        return (
          <SyntaxHighlighter
            style={vscDarkPlus}
            language={match[1]}
            PreTag="div"
            className="code-block"
            customStyle={{ borderRadius: '10px', fontSize: '0.82rem', margin: '1.2rem 0', border: '1px solid rgba(99,102,241,0.15)' }}
            {...props}
          >
            {String(children).replace(/\n$/, '')}
          </SyntaxHighlighter>
        )
      }
      return <code className="inline-code" {...props}>{children}</code>
    },

    input({ type, checked }) {
      if (type !== 'checkbox') return null
      const idx  = checkboxIdx.current++
      const task = tasks[idx]
      const key  = task
        ? `${file.id}::${task.text}`
        : `${file.id}::__idx__${idx}`
      const isDone = problems.isProblemDone(key)
      return (
        <span
          className={`task-checkbox ${isDone ? 'done' : ''}`}
          onClick={() => problems.toggleProblem(key)}
          role="checkbox"
          aria-checked={isDone}
          style={{ '--pc': file.color }}
        >
          {isDone && (
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </span>
      )
    },

    li({ children, className, ...props }) {
      const isTask = className === 'task-list-item'
      return (
        <li className={isTask ? 'task-list-item' : undefined} {...props}>
          {children}
        </li>
      )
    },

    h1: ({ children }) => <h1 id={toId(children)}>{children}</h1>,
    h2: ({ children }) => <h2 id={toId(children)}>{children}</h2>,
    h3: ({ children }) => <h3 id={toId(children)}>{children}</h3>,
    h4: ({ children }) => <h4 id={toId(children)}>{children}</h4>,
    a:  ({ href, children }) => {
      if (href?.startsWith('#')) {
        return (
          <a href={href} onClick={e => { e.preventDefault(); scrollTo(href.slice(1)) }}>
            {children}
          </a>
        )
      }
      return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
    },
    table: ({ children }) => <div className="table-wrap"><table>{children}</table></div>,
  }

  const updatedAt = note?.updatedAt
    ? new Date(note.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className="viewer-layout">
      <div className="viewer-content" ref={contentRef}>

        {/* File header */}
        <div className="viewer-file-header" style={{ '--fc': file.color }}>
          <div className="vfh-glow" style={{ background: file.color }} />
          <div className="vfh-top">
            <span className="vfh-icon">{file.icon}</span>
            <div className="vfh-info">
              <h1 className="vfh-title">{file.name}</h1>
              <div className="vfh-meta">
                <span>📖 {file.readTime} min read</span>
                <span>·</span>
                <span>{file.wordCount.toLocaleString()} words</span>
                <span>·</span>
                <span>{toc.length} sections</span>
                {total > 0 && (
                  <>
                    <span>·</span>
                    <span className="prob-meta" style={{ color: file.color }}>
                      {completed}/{total} problems
                    </span>
                  </>
                )}
                {toc.length > 0 && (
                  <>
                    <span>·</span>
                    <span
                      className="prob-meta sections-done-hint"
                      style={{ color: tocDoneCount > 0 ? file.color : 'var(--text3)' }}
                      title="Click the ✓ circle buttons next to each section in the TOC panel on the right to mark sections done"
                    >
                      {tocDoneCount > 0 ? (
                        <>{tocDoneCount}/{toc.length} sections done</>
                      ) : (
                        <><span style={{ color: file.color }}>0/{toc.length}</span> sections — <span className="toc-hint-arrow">mark via TOC →</span></>
                      )}
                    </span>
                  </>
                )}
              </div>
              {/* Problem progress bar */}
              {total > 0 && (
                <div className="prob-header-bar">
                  <div className="prob-header-fill" style={{ width: `${taskPct}%`, background: file.color }} />
                </div>
              )}
            </div>
            <div className="vfh-actions">
              {isStudied ? (
                <button className="studied-btn done" onClick={onUnmark}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Studied
                </button>
              ) : (
                <button className="studied-btn" onClick={() => onMarkStudied(file.id)}>
                  Mark Studied
                </button>
              )}
              <button className="toc-toggle-btn" onClick={() => setTocOpen(o => !o)}>
                {tocOpen ? 'Hide TOC' : 'TOC'}
              </button>
            </div>
          </div>
        </div>

        {/* Markdown content */}
        <div className="md-content">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
            {file.content}
          </ReactMarkdown>
        </div>

      </div>

      {/* Table of contents */}
      {toc.length > 0 && tocOpen && (
        <aside className="toc-panel">
          <div className="toc-title">
            On this page
            <span className="toc-done-badge">{tocDoneCount}/{toc.length}</span>
          </div>
          {tocDoneCount === 0 && (
            <div className="toc-mark-hint">Click ✓ to mark sections done</div>
          )}
          {total > 0 && (
            <div className="toc-prob-progress">
              <span>{completed}/{total}</span>
              <div className="toc-prob-bar">
                <div className="toc-prob-fill" style={{ width: `${taskPct}%`, background: file.color }} />
              </div>
              <span>{taskPct}%</span>
            </div>
          )}
          {/* TOC section progress bar */}
          {toc.length > 0 && (
            <div className="toc-prob-progress">
              <span>Sections</span>
              <div className="toc-prob-bar">
                <div className="toc-prob-fill" style={{ width: `${Math.round((tocDoneCount / toc.length) * 100)}%`, background: file.color }} />
              </div>
              <span>{Math.round((tocDoneCount / toc.length) * 100)}%</span>
            </div>
          )}
          <nav className="toc-nav">
            {toc.map((h, i) => (
              <div key={i} className={`toc-item-row ${isTocDone(h.id) ? 'toc-section-done' : ''}`}>
                <button
                  className={`toc-item level-${h.level} ${activeId === h.id ? 'active' : ''}`}
                  onClick={() => scrollTo(h.id)}
                  style={{ '--tc': file.color }}
                >
                  {h.text}
                </button>
                <button
                  className={`toc-check-btn ${isTocDone(h.id) ? 'done' : ''}`}
                  onClick={() => toggleTocDone(h.id)}
                  title={isTocDone(h.id) ? 'Mark undone' : 'Mark section done'}
                  aria-label={isTocDone(h.id) ? 'Unmark section' : 'Mark section done'}
                >
                  {isTocDone(h.id) ? (
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  ) : (
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="9"/>
                    </svg>
                  )}
                </button>
              </div>
            ))}
          </nav>
        </aside>
      )}

      {/* Notes drawer */}
      <div className={`notes-drawer ${noteOpen ? 'open' : ''}`} ref={notePanelRef}>
        <div className="notes-drawer-header">
          <span className="notes-title">📝 Notes — {file.name}</span>
          <div className="notes-meta">
            {updatedAt && <span className="notes-saved">Saved {updatedAt}</span>}
            <span className="notes-chars">{noteText.length} chars</span>
            <button className="notes-close-btn" onClick={onToggleNotes} aria-label="Close notes">✕</button>
          </div>
        </div>
        <textarea
          className="notes-textarea"
          value={noteText}
          onChange={handleNoteChange}
          placeholder={`Jot down key takeaways, questions, or revision points for ${file.name}…`}
          rows={5}
        />
      </div>

      {/* Scroll to top button */}
      {showScrollTop && (
        <button
          className="scroll-top-btn"
          onClick={scrollToTop}
          aria-label="Scroll to top"
          title="Back to top"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="18 15 12 9 6 15"/>
          </svg>
        </button>
      )}
    </div>
  )
}

function toId(children) {
  const text = extractText(children)
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-').replace(/^-|-$/g, '')
}

function extractText(node) {
  if (typeof node === 'string') return node
  if (Array.isArray(node)) return node.map(extractText).join('')
  if (node?.props?.children) return extractText(node.props.children)
  return ''
}
