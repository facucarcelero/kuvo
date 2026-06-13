import Link from 'next/link';
import { ArrowRight, BadgeCheck } from 'lucide-react';
import { PublicLayout } from './PublicLayout';
import { formatScoreDisplay } from '@/lib/score/kuvo-score';

const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat('es-AR', { notation: 'compact', maximumFractionDigits: 1 });

type PublicCreatorViewProps = {
  creator: {
    id: string;
    categories: string[];
    followers_declared: number | null;
    engagement_declared: number | null;
    starting_price: number | null;
    score: number | null;
    portfolio: unknown;
    experience: string | null;
    profiles: {
      full_name: string | null;
      username: string | null;
      city: string | null;
      bio: string | null;
      verified: boolean;
    };
  };
};

export function PublicCreatorView({ creator }: PublicCreatorViewProps) {
  const profile = creator.profiles;
  const name = profile.full_name || 'Creador KUVO';
  const username = profile.username ? `@${profile.username}` : '@creador';
  const initials = name.split(' ').slice(0, 2).map(x => x[0]).join('').toUpperCase();
  const portfolio = Array.isArray(creator.portfolio)
    ? creator.portfolio.map((item: any) => item?.title || item?.type || 'Trabajo destacado')
    : [];

  return (
    <PublicLayout>
      <article className="publicDetail">
        <div className="publicHero publicHero--creator">
          <div className="largeAvatar">{initials}</div>
          <div>
            <div className="creatorName"><h1>{name}</h1>{profile.verified && <BadgeCheck size={22}/>}</div>
            <p className="creatorHandle">{username} · {profile.city || 'Argentina'}</p>
            <span className="roleTag">{creator.categories?.[0] || 'Lifestyle'}</span>
          </div>
        </div>
        {profile.bio && <p className="publicLead">{profile.bio}</p>}
        {creator.experience && <p className="publicLead">{creator.experience}</p>}
        <div className="profileStats">
          <div><strong>{compact.format(Number(creator.followers_declared ?? 0))}</strong><span>Seguidores declarados</span></div>
          <div><strong>{Number(creator.engagement_declared ?? 0)}%</strong><span>Interacción declarada</span></div>
          <div><strong>{formatScoreDisplay(creator.score != null ? Number(creator.score) : null)}</strong><span>KUVO Score</span></div>
        </div>
        {portfolio.length > 0 && (
          <>
            <h2>Portfolio</h2>
            <div className="portfolioGrid">
              {portfolio.map((item, index) => <div key={`${item}-${index}`}>{item}</div>)}
            </div>
          </>
        )}
        <div className="modalActions">
          <p><span>Precio desde</span><strong>{money.format(Number(creator.starting_price ?? 0))}</strong></p>
          <Link className="primaryBtn" href="/login?next=/explorar">Contactar desde KUVO <ArrowRight size={17}/></Link>
        </div>
      </article>
    </PublicLayout>
  );
}
