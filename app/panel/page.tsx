import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { Dashboard } from '@/components/Dashboard';
import { createClient } from '@/lib/supabase/server';
import { getPublicEnv, isDemoModeEnv, isSupabaseConfiguredEnv } from '@/lib/env';

export const metadata: Metadata = { title: 'Panel' };

export default async function PanelPage() {
  const env = getPublicEnv();

  if (isSupabaseConfiguredEnv(env) && !isDemoModeEnv(env)) {
    const supabase = await createClient();
    const { data: { user } } = await supabase?.auth.getUser() ?? { data: { user: null } };
    if (!user) redirect('/login?next=/panel');
  }

  return <Dashboard />;
}
