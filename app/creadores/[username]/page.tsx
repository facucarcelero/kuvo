import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PublicCreatorView } from '@/components/public/PublicCreatorView';
import { fetchPublicCreatorByUsername } from '@/features/public/queries';
import { createClient } from '@/lib/supabase/server';

type PageProps = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username } = await params;
  const supabase = await createClient();
  if (!supabase) return { title: 'Creador · KUVO' };
  const { data } = await fetchPublicCreatorByUsername(supabase, username.replace(/^@/, ''));
  if (!data) return { title: 'Creador · KUVO' };
  const profile = Array.isArray(data.profiles) ? data.profiles[0] : data.profiles;
  const name = profile?.full_name || 'Creador KUVO';
  return { title: `${name} · KUVO`, description: profile?.bio?.slice(0, 160) || `Perfil público de ${name} en KUVO.` };
}

export default async function PublicCreatorPage({ params }: PageProps) {
  const { username } = await params;
  const supabase = await createClient();
  if (!supabase) notFound();
  const { data, error } = await fetchPublicCreatorByUsername(supabase, username.replace(/^@/, ''));
  if (error || !data) notFound();
  return <PublicCreatorView creator={data as any} />;
}
