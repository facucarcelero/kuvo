import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { AdminPanel } from '@/components/AdminPanel';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Administración' };

export default async function AdminPage() {
  const supabase = await createClient();
  if (!supabase) redirect('/login?next=/admin');

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/admin');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, active')
    .eq('account_id', user.id)
    .maybeSingle();

  if (profile?.role !== 'admin' || profile?.active === false) {
    redirect('/panel');
  }

  return <AdminPanel />;
}
