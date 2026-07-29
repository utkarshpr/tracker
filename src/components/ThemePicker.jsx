export const THEMES = [
  {
    id: 'dark',
    name: 'Dark',
    tag: 'Default',
    bg: '#111114', card: '#18181b',
    accent: '#8b5cf6', accent2: '#6366f1', accent3: '#22d3ee',
    gradient: 'linear-gradient(135deg,#8b5cf6,#6366f1,#22d3ee)',
  },
  {
    id: 'light',
    name: 'Light',
    tag: 'Classic',
    bg: '#fafafa', card: '#ffffff',
    accent: '#7c3aed', accent2: '#4f46e5', accent3: '#0891b2',
    gradient: 'linear-gradient(135deg,#7c3aed,#4f46e5,#0891b2)',
  },
  {
    id: 'ocean',
    name: 'Ocean',
    tag: 'Deep Teal',
    bg: '#071520', card: '#0d1e2e',
    accent: '#06b6d4', accent2: '#0284c7', accent3: '#38bdf8',
    gradient: 'linear-gradient(135deg,#06b6d4,#0284c7,#38bdf8)',
  },
  {
    id: 'sunset',
    name: 'Sunset',
    tag: 'Warm Fire',
    bg: '#180a06', card: '#1e100a',
    accent: '#f97316', accent2: '#ef4444', accent3: '#fbbf24',
    gradient: 'linear-gradient(135deg,#f97316,#ef4444,#fbbf24)',
  },
  {
    id: 'forest',
    name: 'Forest',
    tag: 'Emerald',
    bg: '#071510', card: '#0d1e18',
    accent: '#10b981', accent2: '#059669', accent3: '#34d399',
    gradient: 'linear-gradient(135deg,#10b981,#059669,#34d399)',
  },
  {
    id: 'rose',
    name: 'Rose',
    tag: 'Blossom',
    bg: '#18080d', card: '#1e0d14',
    accent: '#ec4899', accent2: '#f43f5e', accent3: '#fb923c',
    gradient: 'linear-gradient(135deg,#ec4899,#f43f5e,#fb923c)',
  },
  {
    id: 'midnight',
    name: 'Midnight',
    tag: 'Indigo',
    bg: '#07080f', card: '#0e1018',
    accent: '#6366f1', accent2: '#4f46e5', accent3: '#818cf8',
    gradient: 'linear-gradient(135deg,#6366f1,#4f46e5,#818cf8)',
  },
  {
    id: 'amber',
    name: 'Amber',
    tag: 'Gold',
    bg: '#120d04', card: '#1a1208',
    accent: '#f59e0b', accent2: '#d97706', accent3: '#fb923c',
    gradient: 'linear-gradient(135deg,#f59e0b,#d97706,#fb923c)',
  },
]

export default function ThemePicker({ isOpen, onClose, currentTheme, onSetTheme }) {
  if (!isOpen) return null

  return (
    <div className="theme-picker-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="theme-picker-panel">

        <div className="theme-picker-header">
          <div className="theme-picker-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="13.5" cy="6.5" r="0.5" fill="currentColor"/>
              <circle cx="17.5" cy="10.5" r="0.5" fill="currentColor"/>
              <circle cx="8.5" cy="7.5" r="0.5" fill="currentColor"/>
              <circle cx="6.5" cy="12.5" r="0.5" fill="currentColor"/>
              <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
            </svg>
            Themes
          </div>
          <button className="theme-picker-close" onClick={onClose}>✕</button>
        </div>

        <p className="theme-picker-sub">Choose a look that matches your vibe</p>

        <div className="theme-grid">
          {THEMES.map(t => (
            <button
              key={t.id}
              className={`theme-swatch ${currentTheme === t.id ? 'active' : ''}`}
              onClick={() => { onSetTheme(t.id); onClose() }}
              style={{ '--tg': t.gradient, '--ta': t.accent }}
            >
              {/* Mini UI preview */}
              <div className="theme-swatch-preview" style={{ background: t.bg }}>
                <div className="tsw-header" style={{ background: t.card, borderBottom: `1px solid ${t.accent}22` }}>
                  <div className="tsw-dot" style={{ background: t.accent }} />
                  <div className="tsw-bar" style={{ background: `${t.accent}55` }} />
                </div>
                <div className="tsw-body">
                  <div className="tsw-sidebar" style={{ background: t.card }} />
                  <div className="tsw-content">
                    <div className="tsw-line tsw-line-accent" style={{ background: t.gradient, backgroundClip: 'text', WebkitBackgroundClip: 'text' }} />
                    <div className="tsw-line" style={{ background: `${t.accent}33` }} />
                    <div className="tsw-line tsw-short" style={{ background: `${t.accent}22` }} />
                    <div className="tsw-pill" style={{ background: t.gradient }} />
                  </div>
                </div>
                <div className="tsw-progress">
                  <div className="tsw-progress-fill" style={{ background: t.gradient, width: '55%' }} />
                </div>
              </div>

              {/* Label */}
              <div className="theme-swatch-foot">
                <div className="theme-swatch-colors">
                  {[t.accent, t.accent2, t.accent3].map((c, i) => (
                    <span key={i} className="theme-color-dot" style={{ background: c }} />
                  ))}
                </div>
                <div className="theme-swatch-info">
                  <span className="theme-swatch-name">{t.name}</span>
                  <span className="theme-swatch-tag">{t.tag}</span>
                </div>
                {currentTheme === t.id && (
                  <span className="theme-swatch-check">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
