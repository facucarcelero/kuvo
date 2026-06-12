import { createBrowserClient } from '@supabase/ssr';
import { getPublicEnv, isDemoModeEnv, isSupabaseConfiguredEnv } from '@/lib/env';

declare global {
  interface Window {
    __KUVO_CONFIG__?: { supabaseUrl?: string; supabaseAnonKey?: string; demoMode?: boolean };
  }
}

function getConfig() {
  const runtime = typeof window !== 'undefined' ? window.__KUVO_CONFIG__ : undefined;
  const env = getPublicEnv();
  return {
    url: runtime?.supabaseUrl || env.supabaseUrl,
    key: runtime?.supabaseAnonKey || env.supabaseAnonKey,
    demoMode: runtime?.demoMode ?? env.demoMode,
  };
}

export function isSupabaseConfigured() {
  return isSupabaseConfiguredEnv({
    supabaseUrl: getConfig().url,
    supabaseAnonKey: getConfig().key,
    siteUrl: getPublicEnv().siteUrl,
    demoMode: getConfig().demoMode,
  });
}

export function isDemoMode() {
  const config = getConfig();
  return isDemoModeEnv({
    supabaseUrl: config.url,
    supabaseAnonKey: config.key,
    siteUrl: getPublicEnv().siteUrl,
    demoMode: config.demoMode,
  });
}

export function createClient() {
  if (isDemoMode()) return null;
  const { url, key } = getConfig();
  if (!url || !key) return null;
  return createBrowserClient(url, key);
}
