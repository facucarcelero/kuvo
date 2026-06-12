import { createBrowserClient } from '@supabase/ssr';

declare global {
  interface Window {
    __KUVO_CONFIG__?: { supabaseUrl?: string; supabaseAnonKey?: string };
  }
}

function getConfig() {
  const runtime = typeof window !== 'undefined' ? window.__KUVO_CONFIG__ : undefined;
  return {
    url: runtime?.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    key: runtime?.supabaseAnonKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  };
}

export function isSupabaseConfigured() {
  const { url, key } = getConfig();
  return Boolean(url && key);
}

export function createClient() {
  const { url, key } = getConfig();
  if (!url || !key) return null;
  return createBrowserClient(url, key);
}
