import { useState, useCallback } from 'react'
import { touchProgress } from '../lib/progressSync'

const KEY = 'faang_problems_v1'

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {} }
  catch { return {} }
}

function persist(data) {
  localStorage.setItem(KEY, JSON.stringify(data))
  touchProgress()
}

export function useProblems() {
  const [done, setDone] = useState(load)

  const isProblemDone = useCallback((key) => !!done[key], [done])

  const toggleProblem = useCallback((key) => {
    setDone(prev => {
      const next = { ...prev, [key]: !prev[key] }
      if (!next[key]) delete next[key]
      persist(next)
      return next
    })
  }, [])

  const getFileProgress = useCallback((fileId, tasks) => {
    if (!tasks.length) return { completed: 0, total: 0, pct: 0 }
    const completed = tasks.filter(t => done[`${fileId}::${t.text}`]).length
    const total = tasks.length
    return { completed, total, pct: Math.round((completed / total) * 100) }
  }, [done])

  const getTotalSolved = useCallback(() => Object.values(done).filter(Boolean).length, [done])

  return { isProblemDone, toggleProblem, getFileProgress, getTotalSolved }
}
