import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PublicBusinessView } from '@/components/public/PublicBusinessView';
import { fetchOpenCampaignsByBusiness, fetchPublicBusinessByUsername } from '@/features/public/queries';
import { createClient } from '@/lib/supabase/server';

type PageProps = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username } = await params;
  const supabase = await createClient();
  if (!supabase) return { title: 'Negocio · KUVO' };
  const { data } = await fetchPublicBusinessByUsername(supabase, username.replace(/^@/, ''));
  if (!data) return { title: 'Negocio · KUVO' };
  const profile = Array.isArray(data.profiles) ? data.profiles[0] : data.profiles;
  return { title: `${data.business_name} · KUVO`, description: profile?.bio?.slice(0, 160) || `Perfil público de ${data.business_name} en KUVO.` };
}

export default async function PublicBusinessPage({ params }: PageProps) {
  const { username } = await params;
  const supabase = await createClient();
  if (!supabase) notFound();
  const slug = username.replace(/^@/, '');
  const { data, error } = await fetchPublicBusinessByUsername(supabase, slug);
  if (error || !data) notFound();
  const { data: campaigns } = await fetchOpenCampaignsByBusiness(supabase, data.id);
  return <PublicBusinessView business={data as any} campaigns={campaigns ?? []} />;
}
