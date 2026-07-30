import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { supabase, isSupabaseConfigured, mapAuthUser } from '../lib/supabase'
import {
  hydrateProgressFromCloud,
  setSyncUser,
  pushProgressNow,
} from '../lib/progressSync'

const AuthContext = createContext(null)

const GUEST_KEY = 'faang_guest_session'
let lastHydratedUid = null

async function hydrateForUser(mapped, { cancelled, setUser, setGuest, setSyncing, setSyncReady, setLoading }) {
  if (lastHydratedUid === mapped.uid) {
    setUser(mapped)
    setSyncReady(true)
    setLoading(false)
    return
  }
  lastHydratedUid = mapped.uid
  setGuest(false)
  try { sessionStorage.removeItem(GUEST_KEY) } catch { /* ignore */ }
  setUser(mapped)
  setSyncing(true)
  setSyncReady(false)
  try {
    setSyncUser(mapped.uid)
    await hydrateProgressFromCloud(mapped.uid)
  } catch (err) {
    console.warn('Cloud hydrate failed:', err)
  } finally {
    if (!cancelled()) {
      setSyncing(false)
      setSyncReady(true)
      setLoading(false)
    }
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [guest, setGuest] = useState(() => {
    try { return sessionStorage.getItem(GUEST_KEY) === '1' } catch { return false }
  })
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncReady, setSyncReady] = useState(false)
  const [authError, setAuthError] = useState(null)

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false)
      return undefined
    }

    let active = true
    const cancelled = () => !active

    const boot = async () => {
      const { data, error } = await supabase.auth.getSession()
      if (cancelled()) return
      if (error) {
        console.warn('Supabase session error:', error)
        setLoading(false)
        return
      }

      const mapped = mapAuthUser(data.session?.user)
      if (mapped) {
        await hydrateForUser(mapped, {
          cancelled,
          setUser,
          setGuest,
          setSyncing,
          setSyncReady,
          setLoading,
        })
      } else {
        setLoading(false)
      }
    }

    boot()

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (cancelled()) return
      setAuthError(null)

      // INITIAL_SESSION is handled by getSession() above to avoid double hydrate
      if (event === 'INITIAL_SESSION') return

      const mapped = mapAuthUser(session?.user)
      if (mapped && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED')) {
        if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          setUser(mapped)
          return
        }
        await hydrateForUser(mapped, {
          cancelled,
          setUser,
          setGuest,
          setSyncing,
          setSyncReady,
          setLoading,
        })
      } else if (event === 'SIGNED_OUT') {
        lastHydratedUid = null
        setSyncUser(null)
        setUser(null)
        setSyncReady(false)
        setSyncing(false)
        setLoading(false)
      }
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const signInWithGoogle = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env')
    }
    setAuthError(null)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          // Must match an allow-listed Redirect URL in Supabase Auth settings
          redirectTo: `${window.location.origin}/`,
          queryParams: { prompt: 'select_account' },
        },
      })
      if (error) throw error
    } catch (err) {
      const message = err?.message || 'Google sign-in failed'
      setAuthError(message)
      throw err
    }
  }, [])

  const continueAsGuest = useCallback(() => {
    try { sessionStorage.setItem(GUEST_KEY, '1') } catch { /* ignore */ }
    setGuest(true)
    setSyncUser(null)
    setSyncReady(true)
  }, [])

  const logout = useCallback(async () => {
    if (user?.uid) {
      try { await pushProgressNow(user.uid) } catch { /* ignore */ }
    }
    setSyncUser(null)
    try { sessionStorage.removeItem(GUEST_KEY) } catch { /* ignore */ }
    setGuest(false)
    setSyncReady(false)
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut()
    } else {
      setUser(null)
    }
  }, [user])

  const value = useMemo(() => ({
    user,
    guest,
    isAuthenticated: Boolean(user) || guest,
    loading,
    syncing,
    syncReady,
    authError,
    isSupabaseConfigured,
    signInWithGoogle,
    continueAsGuest,
    logout,
  }), [
    user, guest, loading, syncing, syncReady, authError,
    signInWithGoogle, continueAsGuest, logout,
  ])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
