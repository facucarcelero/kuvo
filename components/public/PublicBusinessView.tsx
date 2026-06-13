import Link from 'next/link';
import { BadgeCheck, BriefcaseBusiness, ChevronRight } from 'lucide-react';
import { PublicLayout } from './PublicLayout';
import { campaignStatusLabel } from '@/lib/labels/campaign-status';

const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

type PublicBusinessViewProps = {
  business: {
    business_name: string;
    industry: string | null;
    website: string | null;
    location: string | null;
    verified: boolean;
    profiles: {
      full_name: string | null;
      username: string | null;
      city: string | null;
      bio: string | null;
    };
  };
  campaigns: Array<{
    id: string;
    title: string;
    category: string;
    city: string;
    status: string;
    budget_max: number;
  }>;
};

export function PublicBusinessView({ business, campaigns }: PublicBusinessViewProps) {
  const profile = business.profiles;
  const initials = business.business_name.slice(0, 2).toUpperCase();

  return (
    <PublicLayout>
      <article className="publicDetail">
        <div className="publicHero publicHero--business">
          <span className="campaignBrand large">{initials}</span>
          <div>
            <div className="creatorName"><h1>{business.business_name}</h1>{business.verified && <BadgeCheck size={22}/>}</div>
            <p className="creatorHandle">{profile.city || business.location || 'Argentina'}{business.industry ? ` · ${business.industry}` : ''}</p>
          </div>
        </div>
        {profile.bio && <p className="publicLead">{profile.bio}</p>}
        {business.website && (
          <p className="publicLead">
            <a href={business.website.startsWith('http') ? business.website : `https://${business.website}`} target="_blank" rel="noopener noreferrer">
              {business.website}
            </a>
          </p>
        )}
        <h2>Campañas publicadas</h2>
        {campaigns.length === 0 ? (
          <p className="publicNotice">Este negocio no tiene campañas abiertas en este momento.</p>
        ) : (
          <div className="publicCampaignList">
            {campaigns.map(campaign => (
              <Link key={campaign.id} href={`/campanas/${campaign.id}`} className="publicCampaignRow">
                <span><BriefcaseBusiness size={18}/></span>
                <p><strong>{campaign.title}</strong><small>{campaign.category} · {campaign.city}</small></p>
                <i className={`status ${campaign.status}`}>{campaignStatusLabel(campaign.status as any)}</i>
                <b>{money.format(campaign.budget_max)}</b>
                <ChevronRight size={16}/>
              </Link>
            ))}
          </div>
        )}
      </article>
    </PublicLayout>
  );
}
