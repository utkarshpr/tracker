import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'

/** Keys we persist locally and mirror to the cloud per user. */
export const SYNC_KEYS = [
  'faang_progress_v1',
  'faang_daily_v1',
  'faang_pause_v1',
  'faang_notes_v1',
  'faang_problems_v1',
  'faang_todos_v1',
  'faang_toc_done_v1',
]

let syncUid = null

export function setSyncUser(uid) {
  syncUid = uid || null
}

/** Call after any localStorage write of progress-related data. */
export function touchProgress() {
  if (syncUid) scheduleProgressPush(syncUid)
}

function readLocalBundle() {
  const data = {}
  for (const key of SYNC_KEYS) {
    try {
      const raw = localStorage.getItem(key)
      data[key] = raw ? JSON.parse(raw) : null
    } catch {
      data[key] = null
    }
  }
  return data
}

function writeLocalBundle(data = {}) {
  for (const key of SYNC_KEYS) {
    if (data[key] == null) continue
    try {
      localStorage.setItem(key, JSON.stringify(data[key]))
    } catch { /* ignore quota */ }
  }
}

function userDoc(uid) {
  return doc(db, 'users', uid)
}

/** Pull cloud progress; if empty, push local. If both exist, prefer newer updatedAt. */
export async function hydrateProgressFromCloud(uid) {
  if (!db || !uid) return { source: 'local' }
  const snap = await getDoc(userDoc(uid))
  const local = readLocalBundle()
  const localUpdated = Number(localStorage.getItem('faang_sync_updated_at') || 0)

  if (!snap.exists()) {
    await setDoc(userDoc(uid), {
      data: local,
      updatedAt: serverTimestamp(),
      updatedAtMs: Date.now(),
    }, { merge: true })
    return { source: 'local-pushed' }
  }

  const remote = snap.data() || {}
  const remoteMs = remote.updatedAtMs || 0
  const remoteData = remote.data || {}

  if (remoteMs >= localUpdated && Object.keys(remoteData).length) {
    writeLocalBundle(remoteData)
    localStorage.setItem('faang_sync_updated_at', String(remoteMs))
    return { source: 'cloud' }
  }

  await setDoc(userDoc(uid), {
    data: local,
    updatedAt: serverTimestamp(),
    updatedAtMs: Date.now(),
  }, { merge: true })
  return { source: 'local-newer' }
}

let saveTimer = null

/** Debounced push of local progress to Firestore. */
export function scheduleProgressPush(uid) {
  if (!db || !uid) return
  clearTimeout(saveTimer)
  saveTimer = setTimeout(async () => {
    try {
      const data = readLocalBundle()
      const now = Date.now()
      localStorage.setItem('faang_sync_updated_at', String(now))
      await setDoc(userDoc(uid), {
        data,
        updatedAt: serverTimestamp(),
        updatedAtMs: now,
      }, { merge: true })
    } catch (err) {
      console.warn('Progress sync failed:', err)
    }
  }, 800)
}

export function pushProgressNow(uid) {
  if (!db || !uid) return Promise.resolve()
  clearTimeout(saveTimer)
  const data = readLocalBundle()
  const now = Date.now()
  localStorage.setItem('faang_sync_updated_at', String(now))
  return setDoc(userDoc(uid), {
    data,
    updatedAt: serverTimestamp(),
    updatedAtMs: now,
  }, { merge: true })
}
