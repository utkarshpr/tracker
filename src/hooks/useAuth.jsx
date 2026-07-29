import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
} from 'firebase/auth'
import { auth, googleProvider, isFirebaseConfigured } from '../lib/firebase'
import {
  hydrateProgressFromCloud,
  setSyncUser,
  pushProgressNow,
} from '../lib/progressSync'

const AuthContext = createContext(null)

const GUEST_KEY = 'faang_guest_session'

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
    if (!isFirebaseConfigured || !auth) {
      setLoading(false)
      return undefined
    }

    let cancelled = false

    getRedirectResult(auth).catch(() => {})

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (cancelled) return
      setAuthError(null)

      if (firebaseUser) {
        setGuest(false)
        try { sessionStorage.removeItem(GUEST_KEY) } catch { /* ignore */ }
        setUser(firebaseUser)
        setSyncing(true)
        setSyncReady(false)
        try {
          setSyncUser(firebaseUser.uid)
          await hydrateProgressFromCloud(firebaseUser.uid)
        } catch (err) {
          console.warn('Cloud hydrate failed:', err)
        } finally {
          if (!cancelled) {
            setSyncing(false)
            setSyncReady(true)
            setLoading(false)
          }
        }
      } else {
        setSyncUser(null)
        setUser(null)
        setSyncReady(false)
        setSyncing(false)
        setLoading(false)
      }
    })

    return () => {
      cancelled = true
      unsub()
    }
  }, [])

  const signInWithGoogle = useCallback(async () => {
    if (!isFirebaseConfigured || !auth || !googleProvider) {
      throw new Error('Firebase is not configured. Add VITE_FIREBASE_* keys to .env')
    }
    setAuthError(null)
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (err) {
      if (err?.code === 'auth/popup-blocked') {
        await signInWithRedirect(auth, googleProvider)
        return
      }
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
        return
      }
      const message = err?.code === 'auth/unauthorized-domain'
        ? 'Add this domain in Firebase Console → Authentication → Settings → Authorized domains'
        : (err?.message || 'Google sign-in failed')
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
    if (isFirebaseConfigured && auth) {
      await signOut(auth)
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
    isFirebaseConfigured,
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
