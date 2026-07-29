import { useState, useCallback, useRef } from 'react'

const NOTES_KEY = 'faang_notes_v1'

function load() {
  try { return JSON.parse(localStorage.getItem(NOTES_KEY)) || {} }
  catch { return {} }
}

export function useNotes() {
  const [notes, setNotes] = useState(load)
  const timers = useRef({})

  const getNote = useCallback((fileId) => notes[fileId] || { text: '', updatedAt: null }, [notes])

  const saveNote = useCallback((fileId, text) => {
    clearTimeout(timers.current[fileId])
    timers.current[fileId] = setTimeout(() => {
      setNotes(prev => {
        const next = { ...prev, [fileId]: { text, updatedAt: new Date().toISOString() } }
        localStorage.setItem(NOTES_KEY, JSON.stringify(next))
        return next
      })
    }, 500)
  }, [])

  const deleteNote = useCallback((fileId) => {
    setNotes(prev => {
      const next = { ...prev }
      delete next[fileId]
      localStorage.setItem(NOTES_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  return { notes, getNote, saveNote, deleteNote }
}
