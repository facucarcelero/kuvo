import Link from 'next/link';
import { BadgeCheck, BriefcaseBusiness, Check, ChevronRight, MapPin } from 'lucide-react';
import { PublicLayout } from './PublicLayout';
import { campaignStatusLabel } from '@/lib/labels/campaign-status';

const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

type PublicCampaignViewProps = {
  campaign: {
    id: string;
    title: string;
    description: string;
    category: string;
    city: string;
    budget_min: number;
    budget_max: number;
    deliverables: string[];
    status: string;
    deadline: string | null;
    business_profiles: {
      business_name: string;
      verified: boolean;
      profiles: { username: string | null; full_name: string | null; city: string | null } | null;
    } | null;
  };
};

export function PublicCampaignView({ campaign }: PublicCampaignViewProps) {
  const business = campaign.business_profiles;
  const profile = business?.profiles;
  const businessSlug = profile?.username?.replace(/^@/, '') ?? '';
  const initials = (business?.business_name || profile?.full_name || 'KU').slice(0, 2).toUpperCase();

  return (
    <PublicLayout>
      <article className="publicDetail">
        <div className="publicHero publicHero--campaign">
          <span className="campaignBrand large">{initials}</span>
          <div>
            {business?.business_name && (
              businessSlug
                ? <Link href={`/negocios/${businessSlug}`} className="publicLink">{business.business_name}</Link>
                : <span>{business.business_name}</span>
            )}
            <h1>{campaign.title}</h1>
            <p><MapPin size={15}/>{campaign.city} · {campaign.category}</p>
            <i className={`status ${campaign.status}`}>{campaignStatusLabel(campaign.status as any)}</i>
          </div>
        </div>
        <p className="publicLead">{campaign.description}</p>
        {campaign.deliverables?.length > 0 && (
          <>
            <h2>Entregables</h2>
            <ul className="deliverables">
              {campaign.deliverables.map(item => <li key={item}><Check/>{item}</li>)}
            </ul>
          </>
        )}
        <div className="campaignDetails">
          <div><span>Presupuesto</span><strong>{money.format(campaign.budget_min)} – {money.format(campaign.budget_max)}</strong></div>
          <div><span>Fecha límite</span><strong>{campaign.deadline ? new Date(`${campaign.deadline}T12:00:00`).toLocaleDateString('es-AR') : 'A coordinar'}</strong></div>
        </div>
        {campaign.status === 'open' ? (
          <Link className="primaryBtn large" href="/login?next=/panel"><BriefcaseBusiness size={18}/> Postularme desde mi panel <ChevronRight size={18}/></Link>
        ) : (
          <p className="publicNotice">Esta campaña no acepta postulaciones en este momento.</p>
        )}
        {business?.verified && <p className="publicVerified"><BadgeCheck size={16}/> Negocio verificado en KUVO</p>}
      </article>
    </PublicLayout>
  );
}
