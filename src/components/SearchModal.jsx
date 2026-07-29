import { useState, useEffect, useRef, useMemo } from 'react'

function highlightMatch(text, query) {
  if (!query.trim()) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="search-highlight">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}

function buildResults(query, allFiles) {
  if (!query.trim()) {
    return allFiles.slice(0, 8).map(f => ({ file: f, type: 'name', excerpt: null }))
  }
  const q = query.toLowerCase()
  const seen = new Set()
  const out = []

  for (const file of allFiles) {
    const nameMatch = file.name.toLowerCase().includes(q)
    if (nameMatch) {
      seen.add(file.id)
      out.push({ file, type: 'name', excerpt: null, score: 20 })
    }
  }

  for (const file of allFiles) {
    if (out.length >= 14) break
    const idx = file.content.toLowerCase().indexOf(q)
    if (idx !== -1 && !seen.has(file.id)) {
      seen.add(file.id)
      const start = Math.max(0, idx - 55)
      const end   = Math.min(file.content.length, idx + 110)
      const raw   = file.content.slice(start, end).replace(/[#*`>\n]/g, ' ').replace(/\s+/g, ' ').trim()
      out.push({ file, type: 'content', excerpt: raw, score: 8 })
    }
  }

  return out.sort((a, b) => b.score - a.score).slice(0, 12)
}

export default function SearchModal({ isOpen, onClose, fileTree, onSelectFile }) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef  = useRef(null)
  const listRef   = useRef(null)

  const results = useMemo(
    () => buildResults(query, fileTree.allFiles),
    [query, fileTree.allFiles]
  )

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setActive(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [isOpen])

  useEffect(() => { setActive(0) }, [query])

  useEffect(() => {
    if (!listRef.current) return
    const el = listRef.current.children[active]
    el?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const pick = (file) => { onSelectFile(file); onClose() }

  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)) }
    else if (e.key === 'Enter')  { if (results[active]) pick(results[active].file) }
    else if (e.key === 'Escape') onClose()
  }

  if (!isOpen) return null

  return (
    <div className="sm-overlay" onClick={onClose}>
      <div className="sm-modal" onClick={e => e.stopPropagation()}>
        <div className="sm-input-row">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="sm-icon">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            ref={inputRef}
            className="sm-input"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKey}
            placeholder="Search topics and content…"
            autoComplete="off"
          />
          {query && (
            <button className="sm-clear" onClick={() => setQuery('')}>✕</button>
          )}
        </div>

        {results.length > 0 && (
          <div className="sm-results" ref={listRef}>
            {results.map((r, i) => (
              <button
                key={r.file.id + i}
                className={`sm-result ${i === active ? 'active' : ''}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(r.file)}
              >
                <span className="sm-r-icon">{r.file.icon}</span>
                <div className="sm-r-body">
                  <div className="sm-r-name">{highlightMatch(r.file.name, query)}</div>
                  {r.excerpt && (
                    <div className="sm-r-excerpt">{highlightMatch(r.excerpt, query)}</div>
                  )}
                </div>
                <div className="sm-r-right">
                  <span className="sm-r-tag">{r.type === 'content' ? 'content' : 'topic'}</span>
                  <span className="sm-r-time">{r.file.readTime}m</span>
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="sm-footer">
          <span><kbd>↑↓</kbd> navigate</span>
          <span><kbd>↵</kbd> open</span>
          <span><kbd>esc</kbd> close</span>
          <span className="sm-count">{fileTree.allFiles.length} topics</span>
        </div>
      </div>
    </div>
  )
}
