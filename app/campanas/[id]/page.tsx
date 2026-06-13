import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PublicCampaignView } from '@/components/public/PublicCampaignView';
import { fetchPublicCampaign } from '@/features/public/queries';
import { createClient } from '@/lib/supabase/server';

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  if (!supabase) return { title: 'Campaña · KUVO' };
  const { data } = await fetchPublicCampaign(supabase, id);
  if (!data || data.status === 'draft') return { title: 'Campaña · KUVO' };
  return { title: `${data.title} · KUVO`, description: data.description.slice(0, 160) };
}

export default async function PublicCampaignPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  if (!supabase) notFound();
  const { data, error } = await fetchPublicCampaign(supabase, id);
  if (error || !data || data.status === 'draft') notFound();
  return <PublicCampaignView campaign={data as any} />;
}
