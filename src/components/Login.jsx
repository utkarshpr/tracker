import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'

const SYMBOLS = ['{ }', '</>', '()', '=>', '[]', '0x', '::', '&&', '++', '**', 'fn', '#!']

function FloatingSymbol({ symbol, style }) {
  return <span className="login-float-symbol" style={style}>{symbol}</span>
}

function GoogleIcon() {
  return (
    <svg className="login-google-icon" width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.5-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.8 1.1 8 3l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.3 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.3 4.1-4.1 5.4l.1.1 6.2 5.2C39.2 36.3 44 31 44 24c0-1.3-.1-2.5-.4-3.5z" />
    </svg>
  )
}

export default function Login() {
  const {
    signInWithGoogle,
    continueAsGuest,
    authError,
    isSupabaseConfigured: configured,
    syncing,
  } = useAuth()

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [shake, setShake] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 60)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (authError) {
      setError(authError)
      setShake(true)
      const t = setTimeout(() => setShake(false), 600)
      return () => clearTimeout(t)
    }
  }, [authError])

  const handleGoogle = async () => {
    setLoading(true)
    setError('')
    try {
      await signInWithGoogle()
      // OAuth redirects away; keep spinner if the page is navigating
    } catch {
      setShake(true)
      setTimeout(() => setShake(false), 600)
      setLoading(false)
    }
  }

  const symbols = SYMBOLS.map((sym, i) => ({
    sym,
    style: {
      left: `${(i * 8.5 + 3) % 95}%`,
      top: `${(i * 13 + 7) % 88}%`,
      animationDelay: `${i * 0.7}s`,
      animationDuration: `${8 + (i % 5) * 2}s`,
      fontSize: `${0.65 + (i % 3) * 0.15}rem`,
      opacity: 0.06 + (i % 4) * 0.025,
    },
  }))

  const busy = loading || syncing

  return (
    <div className="login-bg">
      <div className="login-orb login-orb-1" />
      <div className="login-orb login-orb-2" />
      <div className="login-orb login-orb-3" />
      <div className="login-orb login-orb-4" />

      {symbols.map((s, i) => (
        <FloatingSymbol key={i} symbol={s.sym} style={s.style} />
      ))}

      <div className="login-grid" aria-hidden="true" />

      <div className={`login-card ${ready ? 'login-card-ready' : ''} ${shake ? 'shake' : ''}`}>
        <div className="login-card-border" aria-hidden="true" />

        <div className="login-logo-wrap">
          <div className="login-logo-bg" />
          <div className="login-logo-ring">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </div>
          <div className="login-logo-orbit" aria-hidden="true">
            <div className="login-logo-dot" />
          </div>
        </div>

        <div className="login-header">
          <h1 className="login-title">
            <span className="login-title-gradient">FAANG</span>
            <span className="login-title-plain"> Prep</span>
          </h1>
          <p className="login-subtitle">Sign in to sync progress across devices</p>
          <div className="login-subtitle-line" />
        </div>

        <div className="login-form login-form-social">
          {configured ? (
            <>
              <button
                type="button"
                className={`login-google-btn ${busy ? 'loading' : ''}`}
                onClick={handleGoogle}
                disabled={busy}
              >
                <span className="login-btn-shine" aria-hidden="true" />
                {busy ? (
                  <span className="login-spinner" />
                ) : (
                  <>
                    <GoogleIcon />
                    <span>Continue with Google</span>
                  </>
                )}
              </button>

              <p className="login-sync-hint">
                Your streaks, notes, todos, and studied topics save to your Supabase account.
              </p>
            </>
          ) : (
            <div className="login-setup-box">
              <p className="login-setup-title">Google sign-in needs a quick Supabase setup</p>
              <ol className="login-setup-steps">
                <li>Create a project at supabase.com</li>
                <li>Enable Authentication → Providers → Google</li>
                <li>Run the SQL in <code>supabase/schema.sql</code></li>
                <li>Copy URL + anon key into <code>.env</code> (see <code>.env.example</code>)</li>
              </ol>
            </div>
          )}

          {error && (
            <div className="login-error">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          )}

          <div className="login-divider">
            <span>or</span>
          </div>

          <button
            type="button"
            className="login-guest-btn"
            onClick={continueAsGuest}
            disabled={busy}
          >
            Continue as guest
            <span className="login-guest-sub">Local only — progress won’t sync</span>
          </button>
        </div>

        <div className="login-footer-badges">
          <span className="login-badge">Supabase sync</span>
          <span className="login-badge">Google Auth</span>
          <span className="login-badge">Free tier</span>
        </div>
      </div>
    </div>
  )
}
