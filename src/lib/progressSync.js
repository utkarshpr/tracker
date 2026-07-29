import { supabase } from './supabase'

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

async function upsertProgress(uid, data, updatedAtMs) {
  const { error } = await supabase
    .from('user_progress')
    .upsert(
      {
        user_id: uid,
        data,
        updated_at_ms: updatedAtMs,
        updated_at: new Date(updatedAtMs).toISOString(),
      },
      { onConflict: 'user_id' }
    )
  if (error) throw error
}

/** Pull cloud progress; if empty, push local. If both exist, prefer newer updatedAt. */
export async function hydrateProgressFromCloud(uid) {
  if (!supabase || !uid) return { source: 'local' }

  const { data: row, error } = await supabase
    .from('user_progress')
    .select('data, updated_at_ms')
    .eq('user_id', uid)
    .maybeSingle()

  if (error) throw error

  const local = readLocalBundle()
  const localUpdated = Number(localStorage.getItem('faang_sync_updated_at') || 0)

  if (!row) {
    const now = Date.now()
    await upsertProgress(uid, local, now)
    localStorage.setItem('faang_sync_updated_at', String(now))
    return { source: 'local-pushed' }
  }

  const remoteMs = Number(row.updated_at_ms || 0)
  const remoteData = row.data || {}

  if (remoteMs >= localUpdated && Object.keys(remoteData).length) {
    writeLocalBundle(remoteData)
    localStorage.setItem('faang_sync_updated_at', String(remoteMs))
    return { source: 'cloud' }
  }

  const now = Date.now()
  await upsertProgress(uid, local, now)
  localStorage.setItem('faang_sync_updated_at', String(now))
  return { source: 'local-newer' }
}

let saveTimer = null

/** Debounced push of local progress to Supabase. */
export function scheduleProgressPush(uid) {
  if (!supabase || !uid) return
  clearTimeout(saveTimer)
  saveTimer = setTimeout(async () => {
    try {
      const data = readLocalBundle()
      const now = Date.now()
      localStorage.setItem('faang_sync_updated_at', String(now))
      await upsertProgress(uid, data, now)
    } catch (err) {
      console.warn('Progress sync failed:', err)
    }
  }, 800)
}

export function pushProgressNow(uid) {
  if (!supabase || !uid) return Promise.resolve()
  clearTimeout(saveTimer)
  const data = readLocalBundle()
  const now = Date.now()
  localStorage.setItem('faang_sync_updated_at', String(now))
  return upsertProgress(uid, data, now)
}
