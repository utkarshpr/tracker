import { useState, useEffect, useCallback, useRef } from 'react'

const KEY = 'faang_todos_v1'

function loadReminders() {
  try { return JSON.parse(localStorage.getItem(KEY))?.reminders ?? [] }
  catch { return [] }
}

function patchReminders(updater) {
  try {
    const d = JSON.parse(localStorage.getItem(KEY)) ?? { todos: [], reminders: [] }
    const next = { ...d, reminders: updater(d.reminders ?? []) }
    localStorage.setItem(KEY, JSON.stringify(next))
    window.dispatchEvent(new CustomEvent('faang_todos_updated'))
  } catch {}
}

function playAlarm() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    // Three rising beeps
    ;[0, 0.28, 0.56].forEach((t, i) => {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(600 + i * 160, ctx.currentTime + t)
      gain.gain.setValueAtTime(0, ctx.currentTime + t)
      gain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + t + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.24)
      osc.start(ctx.currentTime + t)
      osc.stop(ctx.currentTime + t + 0.24)
    })
  } catch {}
}

export function useAlarm() {
  const [firedReminder, setFiredReminder] = useState(null)
  const timeoutsRef = useRef({})

  const schedule = useCallback(() => {
    Object.values(timeoutsRef.current).forEach(clearTimeout)
    timeoutsRef.current = {}

    const now = Date.now()
    loadReminders().forEach(r => {
      if (r.fired) return
      const delay = r.ts - now
      if (delay <= 0) return
      timeoutsRef.current[r.id] = setTimeout(() => {
        playAlarm()
        setFiredReminder({ id: r.id, text: r.text, ts: r.ts })
        patchReminders(all => all.map(x => x.id === r.id ? { ...x, fired: true } : x))
      }, delay)
    })
  }, [])

  useEffect(() => {
    schedule()
    const onUpdate = () => schedule()
    const onStorage = (e) => { if (e.key === KEY) schedule() }
    window.addEventListener('faang_todos_updated', onUpdate)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('faang_todos_updated', onUpdate)
      window.removeEventListener('storage', onStorage)
      Object.values(timeoutsRef.current).forEach(clearTimeout)
    }
  }, [schedule])

  const snooze = useCallback((id, minutes) => {
    const newTs = Date.now() + minutes * 60 * 1000
    patchReminders(all => all.map(r => r.id === id ? { ...r, ts: newTs, fired: false } : r))
    setFiredReminder(null)
    setTimeout(schedule, 50)
  }, [schedule])

  const complete = useCallback((id) => {
    patchReminders(all => all.filter(r => r.id !== id))
    setFiredReminder(null)
  }, [])

  const dismiss = useCallback((id) => {
    patchReminders(all => all.filter(r => r.id !== id))
    setFiredReminder(null)
  }, [])

  return { firedReminder, snooze, complete, dismiss }
}
