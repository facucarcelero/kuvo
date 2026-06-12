export type PublicEnv = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  siteUrl: string;
  demoMode: boolean;
};

function read(name: string): string {
  return process.env[name]?.trim() ?? '';
}

export function getPublicEnv(): PublicEnv {
  const supabaseUrl = read('SUPABASE_URL') || read('NEXT_PUBLIC_SUPABASE_URL');
  const supabaseAnonKey = read('SUPABASE_ANON_KEY') || read('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  const siteUrl = read('SITE_URL') || read('NEXT_PUBLIC_SITE_URL') || 'http://localhost:1000';
  const demoMode = read('NEXT_PUBLIC_DEMO_MODE') === 'true';

  return { supabaseUrl, supabaseAnonKey, siteUrl, demoMode };
}

export function isSupabaseConfiguredEnv(env: PublicEnv = getPublicEnv()): boolean {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey);
}

export function isDemoModeEnv(env: PublicEnv = getPublicEnv()): boolean {
  return env.demoMode && !isSupabaseConfiguredEnv(env);
}

export function assertServerEnv(): void {
  if (process.env.NODE_ENV !== 'production') return;
  const env = getPublicEnv();
  if (isDemoModeEnv(env)) {
    console.warn('[KUVO] NEXT_PUBLIC_DEMO_MODE está activo. No usar en producción.');
  }
}
