import { describe, expect, it } from 'vitest';
import { isDemoModeEnv, isSupabaseConfiguredEnv } from '@/lib/env';

describe('env demo mode', () => {
  it('solo activa demo cuando está explícito y sin Supabase', () => {
    expect(isDemoModeEnv({
      supabaseUrl: '',
      supabaseAnonKey: '',
      siteUrl: 'http://localhost:1000',
      demoMode: true,
    })).toBe(true);

    expect(isDemoModeEnv({
      supabaseUrl: 'https://abc.supabase.co',
      supabaseAnonKey: 'key',
      siteUrl: 'http://localhost:1000',
      demoMode: true,
    })).toBe(false);
  });

  it('detecta Supabase configurado', () => {
    expect(isSupabaseConfiguredEnv({
      supabaseUrl: 'https://abc.supabase.co',
      supabaseAnonKey: 'anon',
      siteUrl: 'http://localhost:1000',
      demoMode: false,
    })).toBe(true);
  });
});
