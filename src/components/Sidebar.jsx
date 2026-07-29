import { useState, useEffect } from 'react'

export default function Sidebar({ fileTree, selectedFile, onSelectFile, isOpen, onClose, progress, notes, onMouseActivity }) {
  const [expanded, setExpanded] = useState({})
  const [search, setSearch]     = useState('')

  useEffect(() => {
    if (selectedFile) {
      fileTree.sections.forEach(s => {
        if (s.files.some(f => f.id === selectedFile.id)) {
          setExpanded(prev => ({ ...prev, [s.key]: true }))
        }
      })
    }
  }, [selectedFile])   // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-collapse all sections after 10s of no section interaction
  useEffect(() => {
    const hasOpen = Object.values(expanded).some(Boolean)
    if (!hasOpen) return
    const t = setTimeout(() => setExpanded({}), 10000)
    return () => clearTimeout(t)
  }, [expanded])

  const toggle = (key) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }))

  const filtered = search.trim().toLowerCase()

  const fileMap    = Object.fromEntries(fileTree.allFiles.map(f => [f.id, f]))
  const noteFiles  = notes
    ? Object.entries(notes)
        .filter(([, n]) => n?.text)
        .sort((a, b) => new Date(b[1].updatedAt) - new Date(a[1].updatedAt))
        .map(([id]) => fileMap[id])
        .filter(Boolean)
    : []
  const notesOpen = expanded['__notes__'] === true

  const selectFile = (file) => { onSelectFile(file); if (window.innerWidth < 768) onClose() }

  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}
      <aside
        className={`sidebar ${isOpen ? 'open' : 'closed'}`}
        onMouseMove={onMouseActivity}
      >
        <div className="sidebar-logo">
          <div className="logo-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="#8b5cf6" strokeWidth="1.5" fill="rgba(139,92,246,0.2)" />
              <path d="M2 17l10 5 10-5" stroke="#6366f1" strokeWidth="1.5" fill="none" />
              <path d="M2 12l10 5 10-5" stroke="#a855f7" strokeWidth="1.5" fill="none" />
            </svg>
          </div>
          <div>
            <div className="logo-title">FAANG Prep</div>
            <div className="logo-sub">3-Month SDE-3 Program</div>
          </div>
        </div>

        <div className="sidebar-search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search topics..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="search-clear" onClick={() => setSearch('')}>✕</button>
          )}
        </div>

        <nav className="sidebar-nav">
          {fileTree.sections.map((section, si) => {
            const visibleFiles = filtered
              ? section.files.filter(f => f.name.toLowerCase().includes(filtered))
              : section.files
            if (filtered && visibleFiles.length === 0) return null

            const { done, total } = progress.getMonthProgress(section.files)
            const isExpanded = expanded[section.key] === true

            return (
              <div key={section.key} className="nav-section" style={{ '--section-color': section.color, animationDelay: `${si * 0.05}s` }}>
                <button className="section-header" onClick={() => toggle(section.key)}>
                  <div className="section-label">
                    <span className="section-dot" style={{ background: section.color }} />
                    <span className="section-name">{section.label}</span>
                    {section.subtitle && <span className="section-sub">{section.subtitle}</span>}
                  </div>
                  <div className="section-meta">
                    <span className="section-progress">{done}/{total}</span>
                    <svg
                      className={`chevron ${isExpanded ? 'open' : ''}`}
                      width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </button>

                {isExpanded && (
                  <div className="section-files">
                    {visibleFiles.map((file, fi) => {
                      const studied = progress.isStudied(file.id)
                      const active  = selectedFile?.id === file.id
                      return (
                        <button
                          key={file.id}
                          className={`file-item ${active ? 'active' : ''} ${studied ? 'studied' : ''}`}
                          onClick={() => selectFile(file)}
                          style={{ '--file-color': file.color, animationDelay: `${fi * 0.03}s` }}
                        >
                          <span className="file-icon">{file.icon}</span>
                          <div className="file-info">
                            <span className="file-name">{file.name}</span>
                            <span className="file-meta">{file.readTime} min read</span>
                          </div>
                          {studied && (
                            <span className="file-check">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}

          {/* Notes section */}
          {noteFiles.length > 0 && (
            <div className="nav-section nav-notes-section" style={{ animationDelay: `${fileTree.sections.length * 0.05}s` }}>
              <button className="section-header" onClick={() => toggle('__notes__')}>
                <div className="section-label">
                  <span className="section-dot" style={{ background: '#fbbf24' }} />
                  <span className="section-name">Notes</span>
                  <span className="section-sub">Annotated</span>
                </div>
                <div className="section-meta">
                  <span className="section-progress">{noteFiles.length}</span>
                  <svg
                    className={`chevron ${notesOpen ? 'open' : ''}`}
                    width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </button>

              {notesOpen && (
                <div className="section-files">
                  {noteFiles.map((file, fi) => {
                    const active = selectedFile?.id === file.id
                    return (
                      <button
                        key={file.id}
                        className={`file-item ${active ? 'active' : ''}`}
                        onClick={() => selectFile(file)}
                        style={{ '--file-color': '#fbbf24', animationDelay: `${fi * 0.03}s` }}
                      >
                        <span className="file-icon">{file.icon}</span>
                        <div className="file-info">
                          <span className="file-name">{file.name}</span>
                          <span className="file-meta" style={{ color: '#fbbf24', opacity: .7 }}>📝 has notes</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="footer-total">
            <span>{fileTree.allFiles.length} topics</span>
            <span>·</span>
            <span>{Math.round(fileTree.allFiles.reduce((a, f) => a + f.wordCount, 0) / 1000)}k words</span>
          </div>
        </div>
      </aside>
    </>
  )
}
