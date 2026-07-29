import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null

/** Normalize Supabase user for the rest of the app. */
export function mapAuthUser(user) {
  if (!user) return null
  const meta = user.user_metadata || {}
  return {
    uid: user.id,
    id: user.id,
    email: user.email || '',
    displayName: meta.full_name || meta.name || user.email || 'User',
    photoURL: meta.avatar_url || meta.picture || null,
    raw: user,
  }
}
