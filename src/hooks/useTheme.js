import { useState, useCallback } from 'react'

const STORAGE_KEY = 'faang_theme'

function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t)
  localStorage.setItem(STORAGE_KEY, t)
}

export function useTheme() {
  const [theme, _setTheme] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY) || 'dark'
    applyTheme(saved)   // apply synchronously on first load — no flash
    return saved
  })

  const setTheme = useCallback((t) => {
    applyTheme(t)       // DOM update is direct, not via effect — avoids StrictMode double-invoke
    _setTheme(t)
  }, [])

  // Non-functional update so StrictMode can't cancel it out
  const toggle = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }, [theme, setTheme])

  return { theme, setTheme, toggle }
}
