import { useState, useEffect, useRef } from 'react'

const SALT = 'faang_prep_2024'
const STORED_USER_HASH = '519c0f556ff003a8b976542f683acb863458e6d33ba2d3e143d864605a3da858'
const STORED_PASS_HASH = '9cc60f78f9b371f7b0e46cdaa3675b2153eefa979bd64779e790590bc74d5f60'
const SESSION_KEY = 'faang_auth_session'

async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export function checkSession() {
  try {
    const s = sessionStorage.getItem(SESSION_KEY)
    if (!s) return false
    const { ts } = JSON.parse(s)
    return Date.now() - ts < 8 * 60 * 60 * 1000
  } catch { return false }
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY)
}

function setSession() {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ts: Date.now() }))
}

// Floating tech symbols that drift around the background
const SYMBOLS = ['{ }', '</>', '()', '=>', '[]', '0x', '::',  '&&', '++', '**', 'fn', '#!']

function FloatingSymbol({ symbol, style }) {
  return <span className="login-float-symbol" style={style}>{symbol}</span>
}

export default function Login({ onLogin }) {
  const [user, setUser]       = useState('')
  const [pass, setPass]       = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [shake, setShake]     = useState(false)
  const [ready, setReady]     = useState(false)
  const [focused, setFocused] = useState('')

  // Stagger in the card on mount
  useEffect(() => { const t = setTimeout(() => setReady(true), 60); return () => clearTimeout(t) }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!user.trim() || !pass.trim()) { setError('Enter both fields'); triggerShake(); return }
    setLoading(true); setError('')
    try {
      const [uh, ph] = await Promise.all([sha256(SALT + user.trim()), sha256(SALT + pass.trim())])
      if (uh === STORED_USER_HASH && ph === STORED_PASS_HASH) { setSession(); onLogin() }
      else { setError('Invalid credentials'); triggerShake(); setPass('') }
    } catch { setError('Auth error. Retry.') }
    finally { setLoading(false) }
  }

  const triggerShake = () => { setShake(true); setTimeout(() => setShake(false), 600) }

  // Generate consistent random symbols
  const symbols = SYMBOLS.map((sym, i) => ({
    sym,
    style: {
      left: `${(i * 8.5 + 3) % 95}%`,
      top: `${(i * 13 + 7) % 88}%`,
      animationDelay: `${i * 0.7}s`,
      animationDuration: `${8 + (i % 5) * 2}s`,
      fontSize: `${0.65 + (i % 3) * 0.15}rem`,
      opacity: 0.06 + (i % 4) * 0.025,
    }
  }))

  return (
    <div className="login-bg">

      {/* Aurora orbs */}
      <div className="login-orb login-orb-1" />
      <div className="login-orb login-orb-2" />
      <div className="login-orb login-orb-3" />
      <div className="login-orb login-orb-4" />

      {/* Floating code symbols */}
      {symbols.map((s, i) => <FloatingSymbol key={i} symbol={s.sym} style={s.style} />)}

      {/* Grid overlay */}
      <div className="login-grid" aria-hidden="true" />

      {/* Card */}
      <div className={`login-card ${ready ? 'login-card-ready' : ''} ${shake ? 'shake' : ''}`}>

        {/* Animated border glow */}
        <div className="login-card-border" aria-hidden="true" />

        {/* Logo */}
        <div className="login-logo-wrap">
          <div className="login-logo-bg" />
          <div className="login-logo-ring">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          </div>
          <div className="login-logo-orbit" aria-hidden="true">
            <div className="login-logo-dot" />
          </div>
        </div>

        {/* Header text */}
        <div className="login-header">
          <h1 className="login-title">
            <span className="login-title-gradient">FAANG</span>
            <span className="login-title-plain"> Prep</span>
          </h1>
          <p className="login-subtitle">Your elite study hub awaits</p>
          <div className="login-subtitle-line" />
        </div>

        <form className="login-form" onSubmit={handleSubmit} autoComplete="off">
          {/* Username */}
          <div className={`login-field ${focused === 'user' ? 'focused' : ''} ${user ? 'has-value' : ''}`}>
            <label className="login-label" htmlFor="login-user">Username</label>
            <div className="login-input-wrap">
              <svg className="login-input-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              <input
                id="login-user"
                className="login-input"
                type="text"
                placeholder="Enter username"
                value={user}
                onChange={e => { setUser(e.target.value); setError('') }}
                onFocus={() => setFocused('user')}
                onBlur={() => setFocused('')}
                autoFocus
                autoComplete="off"
                spellCheck={false}
              />
              {user && (
                <div className="login-field-check">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
              )}
            </div>
            <div className="login-field-bar" />
          </div>

          {/* Password */}
          <div className={`login-field ${focused === 'pass' ? 'focused' : ''} ${pass ? 'has-value' : ''}`}>
            <label className="login-label" htmlFor="login-pass">Password</label>
            <div className="login-input-wrap">
              <svg className="login-input-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <input
                id="login-pass"
                className="login-input"
                type={showPass ? 'text' : 'password'}
                placeholder="Enter password"
                value={pass}
                onChange={e => { setPass(e.target.value); setError('') }}
                onFocus={() => setFocused('pass')}
                onBlur={() => setFocused('')}
                autoComplete="off"
              />
              <button type="button" className="login-eye-btn" onClick={() => setShowPass(v => !v)} tabIndex={-1}>
                {showPass
                  ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                }
              </button>
            </div>
            <div className="login-field-bar" />
          </div>

          {/* Error */}
          {error && (
            <div className="login-error">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {error}
            </div>
          )}

          {/* Submit */}
          <button type="submit" className={`login-btn ${loading ? 'loading' : ''}`} disabled={loading}>
            <span className="login-btn-shine" aria-hidden="true" />
            {loading ? (
              <span className="login-spinner" />
            ) : (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                  <polyline points="10 17 15 12 10 7"/>
                  <line x1="15" y1="12" x2="3" y2="12"/>
                </svg>
                <span>Enter Study Hub</span>
              </>
            )}
          </button>
        </form>

        <div className="login-footer-badges">
          <span className="login-badge">🔒 Encrypted</span>
          <span className="login-badge">💾 Local only</span>
          <span className="login-badge">⚡ Instant</span>
        </div>
      </div>
    </div>
  )
}
