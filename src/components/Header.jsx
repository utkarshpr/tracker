import { useState } from 'react'

export default function Header({
  selectedFile, selectedMonth, onBack, onToggleSidebar,
  onOpenDaily, onOpenSearch, onToggleNotes, noteOpen, hasNote,
  streak, theme, onToggleTheme, onOpenThemePicker, onLock, onOpenTodo,
  user,
}) {
  const backLabel = selectedFile && selectedMonth ? selectedMonth.label : 'Home'
  const [lockConfirm, setLockConfirm] = useState(false)

  const handleLockClick = () => {
    if (lockConfirm) {
      onLock?.()
    } else {
      setLockConfirm(true)
      setTimeout(() => setLockConfirm(false), 2500)
    }
  }

  return (
    <header className="header">
      <div className="header-left">
        <button className="icon-btn menu-btn" onClick={onToggleSidebar} title="Toggle sidebar">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        {(selectedFile || selectedMonth) ? (
          <div className="breadcrumb">
            <button className="breadcrumb-back" onClick={onBack}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              {backLabel}
            </button>
            <span className="breadcrumb-sep">/</span>
            <span className="breadcrumb-current">
              {selectedFile ? `${selectedFile.icon} ${selectedFile.name}` : selectedMonth.label}
            </span>
          </div>
        ) : (
          <div className="header-brand">
            <span className="brand-dot" />
            <span className="brand-text">FAANG Prep</span>
          </div>
        )}
      </div>

      <div className="header-right">
        {streak > 0 && (
          <div className="streak-badge">
            <span>🔥</span>
            <span>{streak}d streak</span>
          </div>
        )}

        {selectedFile && (
          <button
            className={`icon-btn notes-header-btn ${noteOpen ? 'active' : ''} ${hasNote ? 'has-note' : ''}`}
            onClick={onToggleNotes}
            title="Toggle notes"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
            <span className="btn-label">{hasNote ? 'Notes •' : 'Notes'}</span>
          </button>
        )}

        <button className="icon-btn" onClick={onOpenTodo} title="Todos & Timers">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 11 12 14 22 4"/>
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
          </svg>
          <span className="btn-label">Tasks</span>
        </button>

        <button className="icon-btn search-btn" onClick={onOpenSearch} title="Search (⌘K)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <span className="btn-label">Search</span>
          <kbd className="header-kbd">⌘K</kbd>
        </button>

        <button className="icon-btn daily-btn" onClick={onOpenDaily} title="Today's routine">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span className="btn-label">Today</span>
        </button>

        <button className="icon-btn theme-btn" onClick={onOpenThemePicker} title="Choose theme">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="13.5" cy="6.5" r="0.5" fill="currentColor"/>
            <circle cx="17.5" cy="10.5" r="0.5" fill="currentColor"/>
            <circle cx="8.5"  cy="7.5"  r="0.5" fill="currentColor"/>
            <circle cx="6.5"  cy="12.5" r="0.5" fill="currentColor"/>
            <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
          </svg>
        </button>

        {/* Panic Lock / Sign out */}
        <button
          className={`icon-btn lock-btn ${lockConfirm ? 'lock-confirm' : ''}`}
          onClick={handleLockClick}
          title={lockConfirm ? 'Click again to sign out' : (user ? 'Sign out' : 'Lock')}
        >
          {user?.photoURL ? (
            <img src={user.photoURL} alt="" className="header-avatar" referrerPolicy="no-referrer" />
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          )}
          <span className="btn-label lock-label">{lockConfirm ? 'Confirm?' : (user ? 'Sign out' : 'Lock')}</span>
        </button>
      </div>
    </header>
  )
}
