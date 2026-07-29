import { useState, useCallback } from 'react'
import { touchProgress } from '../lib/progressSync'

const PROGRESS_KEY = 'faang_progress_v1'
const DAILY_KEY    = 'faang_daily_v1'
const PAUSE_KEY    = 'faang_pause_v1'

const DEFAULT_TASKS = [
  { id: 'morning-dsa',    text: 'Morning DSA Problems (2×)',     time: '8:00 AM',  duration: '90 min', icon: '🧮' },
  { id: 'morning-topic',  text: 'Core Topic Deep Dive',          time: '9:30 AM',  duration: '60 min', icon: '⚙️' },
  { id: 'lunch-flashcards', text: 'Lunch — Flashcard Revision',  time: '1:00 PM',  duration: '30 min', icon: '📖' },
  { id: 'evening-design', text: 'System Design / LLD Session',   time: '8:30 PM',  duration: '90 min', icon: '🏗️' },
  { id: 'night-revision', text: 'Night Revision & Notes',        time: '10:00 PM', duration: '60 min', icon: '📝' },
]

// Visual-only timeline blocks (not checkboxes)
export const ROUTINE_TIMELINE = [
  { time: '7:30 AM',  label: 'Wake Up & Freshen',            type: 'routine', duration: '30 min', icon: '🌅' },
  { time: '8:00 AM',  label: 'DSA Problems (2×)',             type: 'study',   taskId: 'morning-dsa',      duration: '90 min', icon: '🧮' },
  { time: '9:30 AM',  label: 'Core Topic Study',              type: 'study',   taskId: 'morning-topic',    duration: '60 min', icon: '⚙️' },
  { time: '10:30 AM', label: 'Get Ready + Commute',           type: 'routine', duration: '30 min', icon: '🚗' },
  { time: '11:00 AM', label: 'OFFICE',                        type: 'fixed',   duration: '7 hrs',  icon: '💼' },
  { time: '1:00 PM',  label: 'Lunch — Flashcard Revision',    type: 'study',   taskId: 'lunch-flashcards', duration: '30 min', icon: '📖', nested: true },
  { time: '6:00 PM',  label: 'Commute Home',                  type: 'routine', duration: '30 min', icon: '🚗' },
  { time: '6:30 PM',  label: 'GYM',                          type: 'fixed',   duration: '90 min', icon: '🏋️' },
  { time: '8:00 PM',  label: 'Shower + Dinner',               type: 'routine', duration: '30 min', icon: '🍽️' },
  { time: '8:30 PM',  label: 'System Design / LLD',           type: 'study',   taskId: 'evening-design',   duration: '90 min', icon: '🏗️' },
  { time: '10:00 PM', label: 'Revision & Notes',              type: 'study',   taskId: 'night-revision',   duration: '60 min', icon: '📝' },
  { time: '11:00 PM', label: 'Sleep',                         type: 'routine', duration: '—',      icon: '🌙' },
]

export const PAUSE_REASONS = [
  { id: 'sick',     label: 'Sick',          icon: '🤒' },
  { id: 'ooo',      label: 'OOO / Vacation',icon: '🏖️' },
  { id: 'leave',    label: 'Leave',         icon: '🗓️' },
  { id: 'other',    label: 'Other',         icon: '📦' },
]

function todayKey() {
  return new Date().toISOString().split('T')[0]
}

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback }
  catch { return fallback }
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
  touchProgress()
}

export function useProgress() {
  const [progress, setProgress] = useState(() => load(PROGRESS_KEY, {}))
  const [daily,    setDaily]    = useState(() => load(DAILY_KEY, {}))
  const [pauseMap, setPauseMap] = useState(() => load(PAUSE_KEY, {}))

  const isStudied = useCallback((fileId) => !!progress[fileId]?.completed, [progress])

  const markStudied = useCallback((fileId) => {
    const today = todayKey()
    setProgress(prev => {
      const next = { ...prev, [fileId]: { completed: true, lastStudied: today } }
      save(PROGRESS_KEY, next)
      return next
    })
    setDaily(prev => {
      const d = prev[today] || { tasks: DEFAULT_TASKS.map(t => ({ ...t, done: false })), studiedFiles: [] }
      if (d.studiedFiles.includes(fileId)) return prev
      const next = { ...prev, [today]: { ...d, studiedFiles: [...d.studiedFiles, fileId] } }
      save(DAILY_KEY, next)
      return next
    })
  }, [])

  const unmarkStudied = useCallback((fileId) => {
    setProgress(prev => {
      const next = { ...prev }
      delete next[fileId]
      save(PROGRESS_KEY, next)
      return next
    })
    // also remove from today's studiedFiles
    const today = todayKey()
    setDaily(prev => {
      const d = prev[today]
      if (!d) return prev
      const next = { ...prev, [today]: { ...d, studiedFiles: d.studiedFiles.filter(id => id !== fileId) } }
      save(DAILY_KEY, next)
      return next
    })
  }, [])

  const toggleDailyTask = useCallback((taskId) => {
    const today = todayKey()
    setDaily(prev => {
      const d = prev[today] || { tasks: DEFAULT_TASKS.map(t => ({ ...t, done: false })), studiedFiles: [] }
      const tasks = d.tasks.map(t => t.id === taskId ? { ...t, done: !t.done } : t)
      const next = { ...prev, [today]: { ...d, tasks } }
      save(DAILY_KEY, next)
      return next
    })
  }, [])

  const getTodayData = useCallback(() => {
    const d = daily[todayKey()]
    if (!d) return { tasks: DEFAULT_TASKS.map(t => ({ ...t, done: false })), studiedFiles: [] }
    if (!d.tasks || d.tasks.length === 0) return { ...d, tasks: DEFAULT_TASKS.map(t => ({ ...t, done: false })) }
    return d
  }, [daily])

  // pauseDays: pause `count` days starting from `startDate` (defaults to today, count defaults to 1)
  const pauseDays = useCallback((startDate, count = 1, reason = 'other') => {
    const base = startDate ? new Date(startDate) : new Date()
    setPauseMap(prev => {
      const next = { ...prev }
      for (let i = 0; i < count; i++) {
        const d = new Date(base)
        d.setDate(d.getDate() + i)
        const key = d.toISOString().split('T')[0]
        next[key] = { reason, pausedAt: new Date().toISOString() }
      }
      save(PAUSE_KEY, next)
      return next
    })
  }, [])

  const unpauseDay = useCallback((date) => {
    const key = date ?? todayKey()
    setPauseMap(prev => {
      const next = { ...prev }
      delete next[key]
      save(PAUSE_KEY, next)
      return next
    })
  }, [])

  const isPausedDay = useCallback((date) => {
    return !!pauseMap[date ?? todayKey()]
  }, [pauseMap])

  const getPauseInfo = useCallback((date) => {
    return pauseMap[date ?? todayKey()] ?? null
  }, [pauseMap])

  const getStreak = useCallback(() => {
    let streak = 0
    const check = new Date()
    while (true) {
      const key = check.toISOString().split('T')[0]
      const d = daily[key]
      const active = d && (d.studiedFiles?.length > 0 || d.tasks?.some(t => t.done))
      const paused = !!pauseMap[key]
      if (active) {
        streak++
        check.setDate(check.getDate() - 1)
      } else if (paused) {
        // paused day: skip without breaking the streak
        check.setDate(check.getDate() - 1)
      } else {
        break
      }
    }
    return streak
  }, [daily, pauseMap])

  const getMonthProgress = useCallback((files) => {
    const done = files.filter(f => progress[f.id]?.completed).length
    return { done, total: files.length, pct: files.length ? Math.round((done / files.length) * 100) : 0 }
  }, [progress])

  const getTotalProgress = useCallback((allFiles) => {
    const done = allFiles.filter(f => progress[f.id]?.completed).length
    return { done, total: allFiles.length, pct: allFiles.length ? Math.round((done / allFiles.length) * 100) : 0 }
  }, [progress])

  const logPomodoro = useCallback(() => {
    const today = todayKey()
    setDaily(prev => {
      const d = prev[today] || { tasks: DEFAULT_TASKS.map(t => ({ ...t, done: false })), studiedFiles: [], pomodoros: 0 }
      const next = { ...prev, [today]: { ...d, pomodoros: (d.pomodoros || 0) + 1 } }
      save(DAILY_KEY, next)
      return next
    })
  }, [])

  const getDailyMap = useCallback(() => daily, [daily])

  return {
    isStudied,
    markStudied,
    unmarkStudied,
    toggleDailyTask,
    getTodayData,
    getStreak,
    getMonthProgress,
    getTotalProgress,
    logPomodoro,
    getDailyMap,
    pauseDays,
    unpauseDay,
    isPausedDay,
    getPauseInfo,
    progress,
    daily,
    pauseMap,
  }
}

export { DEFAULT_TASKS, todayKey }
