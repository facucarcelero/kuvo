'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight, BadgeCheck, BarChart3, BriefcaseBusiness, Check, ChevronRight,
  Heart, MapPin, Menu, MessageCircle, Moon, Search, ShieldCheck,
  Sparkles, Sun, Target, Users, X, Zap
} from 'lucide-react';
import { Logo } from './Logo';
import { createClient, isDemoMode, isSupabaseConfigured } from '@/lib/supabase/client';
import { demoCampaigns, demoCreators } from '@/lib/demo';
import { listFavorites, addFavorite, removeFavorite } from '@/features/favorites/api';
import { formatScoreDisplay } from '@/lib/score/kuvo-score';
import type { Campaign, Creator } from '@/lib/types';

const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat('es-AR', { notation: 'compact', maximumFractionDigits: 1 });

function normalizeCreator(row: any): Creator {
  const profile = row.profiles || row.profile || {};
  const categories = row.categories || [];
  const colors: [string,string][] = [['#7c3aed','#ec4899'],['#2563eb','#06b6d4'],['#f97316','#f43f5e'],['#059669','#84cc16']];
  const gradient = colors[Math.abs(String(row.id).charCodeAt(0) || 0) % colors.length];
  const name = profile.full_name || 'Creador KUVO';
  return {
    id: row.id,
    profileId: row.profile_id,
    name,
    username: profile.username ? `@${profile.username}` : '@creador',
    city: profile.city || 'Argentina',
    category: categories[0] || 'Lifestyle',
    categories,
    followers: Number(row.followers_declared ?? row.followers ?? 0),
    engagement: Number(row.engagement_declared ?? row.engagement ?? 0),
    startingPrice: Number(row.starting_price || 0),
    score: row.score != null ? Number(row.score) : null,
    scoreLabel: formatScoreDisplay(row.score != null ? Number(row.score) : null),
    verified: Boolean(profile.verified),
    bio: profile.bio || 'Perfil profesional disponible para colaboraciones.',
    initials: name.split(' ').slice(0,2).map((x:string)=>x[0]).join('').toUpperCase(),
    gradient,
    portfolio: Array.isArray(row.portfolio) ? row.portfolio.map((x:any)=>x.title || x.type || 'Trabajo destacado') : [],
  };
}

function normalizeCampaign(row: any): Campaign {
  const business = row.business_profiles || row.business || {};
  const profile = business.profiles || {};
  const gradients: [string,string][] = [['#b45309','#ef4444'],['#7c3aed','#ec4899'],['#1d4ed8','#06b6d4'],['#059669','#84cc16']];
  const gradient = gradients[Math.abs(String(row.id).charCodeAt(0) || 0) % gradients.length];
  return {
    id: row.id,
    businessId: row.business_id,
    businessName: business.business_name || profile.full_name || 'Negocio KUVO',
    title: row.title,
    description: row.description,
    category: row.category,
    city: row.city || 'Argentina',
    budgetMin: Number(row.budget_min || 0),
    budgetMax: Number(row.budget_max || 0),
    deliverables: row.deliverables || [],
    deadline: row.deadline || '',
    status: row.status,
    applicants: row.applicants_count || 0,
    gradient,
  };
}

export function Marketplace() {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [view, setView] = useState<'creators'|'campaigns'>('creators');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Todas');
  const [city, setCity] = useState('Todas');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [selectedCreator, setSelectedCreator] = useState<Creator | null>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [toast, setToast] = useState('');
  const [dark, setDark] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('kuvo_theme');
    if (savedTheme === 'light') { setDark(false); document.documentElement.dataset.theme = 'light'; }
    if (isDemoMode()) {
      setCreators(demoCreators);
      setCampaigns(demoCampaigns);
      try { setFavorites(new Set(JSON.parse(localStorage.getItem('kuvo_favorites') || '[]'))); } catch {}
    }
  }, []);

  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (isDemoMode()) return;
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    if (!supabase) return;
    setLoading(true);
    setLoadError('');
    Promise.all([
      supabase.from('creator_profiles').select('id,profile_id,categories,followers,followers_declared,engagement,engagement_declared,starting_price,score,availability,portfolio,profiles!inner(id,full_name,username,city,bio,verified,active,avatar_url)').eq('availability', true).limit(48),
      supabase.from('campaigns').select('id,business_id,title,description,category,city,budget_min,budget_max,deliverables,status,deadline,created_at,business_profiles(id,business_name,verified,profiles(id,full_name,city,verified,active))').eq('status', 'open').limit(48),
    ]).then(([creatorResult, campaignResult]) => {
      if (creatorResult.error || campaignResult.error) {
        setLoadError('No pudimos cargar el marketplace. Intentá de nuevo en unos minutos.');
        return;
      }
      if (creatorResult.data?.length) setCreators(creatorResult.data.map(normalizeCreator));
      if (campaignResult.data?.length) setCampaigns(campaignResult.data.map(normalizeCampaign));
      supabase.auth.getUser().then(async ({ data: { user } }) => {
        if (!user) return;
        const { data: favRows } = await listFavorites(supabase, user.id);
        if (favRows?.length) setFavorites(new Set(favRows.map(row => row.creator_id)));
      });
    }).finally(() => setLoading(false));
  }, []);

  const categories = useMemo(() => ['Todas', ...Array.from(new Set([...creators.map(c=>c.category), ...campaigns.map(c=>c.category)]))], [creators, campaigns]);
  const cities = useMemo(() => ['Todas', ...Array.from(new Set([...creators.map(c=>c.city), ...campaigns.map(c=>c.city)]))], [creators, campaigns]);
  const filteredCreators = useMemo(() => creators.filter(c => {
    const text = `${c.name} ${c.username} ${c.city} ${c.categories.join(' ')}`.toLowerCase();
    return text.includes(search.toLowerCase()) && (category === 'Todas' || c.categories.includes(category)) && (city === 'Todas' || c.city === city);
  }), [creators, search, category, city]);
  const filteredCampaigns = useMemo(() => campaigns.filter(c => {
    const text = `${c.title} ${c.businessName} ${c.description} ${c.category} ${c.city}`.toLowerCase();
    return text.includes(search.toLowerCase()) && (category === 'Todas' || c.category === category) && (city === 'Todas' || c.city === city);
  }), [campaigns, search, category, city]);

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(''), 2600);
  }

  async function toggleFavorite(id: string) {
    if (isDemoMode()) {
      const next = new Set(favorites);
      if (next.has(id)) next.delete(id); else next.add(id);
      setFavorites(next);
      localStorage.setItem('kuvo_favorites', JSON.stringify([...next]));
      notify(next.has(id) ? 'Creador guardado en favoritos' : 'Creador quitado de favoritos');
      return;
    }
    if (!isSupabaseConfigured()) { notify('No pudimos conectar con la base de datos.'); return; }
    const supabase = createClient();
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { notify('Ingresá para guardar favoritos en tu cuenta.'); return; }
    const next = new Set(favorites);
    if (next.has(id)) {
      next.delete(id);
      setFavorites(next);
      const { data: rows } = await listFavorites(supabase, user.id);
      const fav = rows?.find(row => row.creator_id === id);
      if (fav) await removeFavorite(supabase, fav.id);
      notify('Creador quitado de favoritos');
    } else {
      next.add(id);
      setFavorites(next);
      await addFavorite(supabase, user.id, id);
      notify('Creador guardado en favoritos');
    }
  }

  function switchView(next: 'creators'|'campaigns') {
    setView(next); setSearch(''); setCategory('Todas'); setCity('Todas'); setMobileOpen(false);
    document.getElementById('marketplace')?.scrollIntoView({ behavior: 'smooth' });
  }

  function toggleTheme() {
    const next = !dark; setDark(next);
    document.documentElement.dataset.theme = next ? 'dark' : 'light';
    localStorage.setItem('kuvo_theme', next ? 'dark' : 'light');
  }

  return (
    <main>
      <header className="siteHeader">
        <div className="headerInner">
          <Logo />
          <nav className={mobileOpen ? 'mainNav open' : 'mainNav'}>
            <Link href="/" onClick={()=>setMobileOpen(false)}>Inicio</Link>
            <button onClick={() => switchView('creators')}>Creadores</button>
            <button onClick={() => switchView('campaigns')}>Campañas</button>
            <Link href="/login" onClick={()=>setMobileOpen(false)}>Mi panel</Link>
          </nav>
          <div className="headerActions">
            <button className="iconButton" onClick={toggleTheme} aria-label="Cambiar tema">{dark ? <Sun size={18}/> : <Moon size={18}/>}</button>
            <Link className="ghostBtn headerLogin" href="/login">Ingresar</Link>
            <Link className="primaryBtn headerRegister" href="/registro">Registrarse</Link>
            <button className="mobileMenu" onClick={()=>setMobileOpen(v=>!v)} aria-label="Abrir menú">{mobileOpen ? <X/> : <Menu/>}</button>
          </div>
        </div>
      </header>

      <section className="heroSection">
        <div className="heroGlow one"/><div className="heroGlow two"/>
        <div className="container heroGrid">
          <div className="heroCopy">
            <span className="eyebrow"><span className="liveDot"/> Marketplace público</span>
            <h1>Explorá <em>creadores</em> y <em>campañas</em> abiertas.</h1>
            <p>Esta sección es visible para todos. Para publicar campañas, postularte o ver tus mensajes, ingresá a tu panel privado.</p>
            <div className="heroButtons">
              <button className="primaryBtn large" onClick={()=>switchView('creators')}>Buscar creadores <ArrowRight size={19}/></button>
              <button className="ghostBtn large" onClick={()=>switchView('campaigns')}>Ver campañas</button>
            </div>
            <div className="trustRow">
              <span><Check/> Catálogo público</span><span><Check/> Perfiles verificados</span><Link href="/registro" className="trustLink">Registrate para gestionar lo tuyo →</Link>
            </div>
          </div>
          <div className="heroPreview" aria-label="Vista ilustrativa del panel">
            <div className="previewTop"><span/><span/><span/><b>Vista ilustrativa del panel</b></div>
            <div className="previewStats">
              <div><span>Ejemplo visual</span><strong>Panel</strong><small>Datos privados por usuario</small></div>
              <div><span>Catálogo público</span><strong>Marketplace</strong><small>Creadores y campañas abiertas</small></div>
            </div>
            <p className="previewNote">Ilustración de referencia. Los números reales aparecen en tu cuenta.</p>
          </div>
        </div>
      </section>

      <section className="statsBand">
        <div className="container statsGrid">
          <div><strong>{creators.length}</strong><span>creadores visibles</span></div>
          <div><strong>{campaigns.length}</strong><span>campañas abiertas</span></div>
          <div><strong>{categories.length - 1}</strong><span>categorías activas</span></div>
          <div><strong>{cities.length - 1}</strong><span>ciudades</span></div>
        </div>
      </section>

      <section id="marketplace" className="marketSection container">
        <div className="sectionHeading">
          <span className="eyebrow"><Sparkles size={15}/> Marketplace KUVO</span>
          <h2>{view === 'creators' ? 'Encontrá el creador ideal' : 'Descubrí campañas abiertas'}</h2>
          <p>{view === 'creators' ? 'Filtrá por categoría, ciudad, comunidad y rendimiento.' : 'Conectate con marcas que ya están buscando talento.'}</p>
        </div>
        <div className="viewTabs">
          <button className={view === 'creators' ? 'active' : ''} onClick={()=>switchView('creators')}><Users size={17}/> Creadores</button>
          <button className={view === 'campaigns' ? 'active' : ''} onClick={()=>switchView('campaigns')}><BriefcaseBusiness size={17}/> Campañas</button>
        </div>
        <div className="filterBar">
          <label className="searchBox"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder={view === 'creators' ? 'Buscar por nombre, categoría o ciudad' : 'Buscar campaña o negocio'}/></label>
          <select value={category} onChange={e=>setCategory(e.target.value)} aria-label="Categoría">{categories.map(x=><option key={x}>{x}</option>)}</select>
          <select value={city} onChange={e=>setCity(e.target.value)} aria-label="Ciudad">{cities.map(x=><option key={x}>{x}</option>)}</select>
        </div>

        {loadError && <div className="formMessage">{loadError}</div>}
        {loading && <div className="loadingLine"/>}
        {view === 'creators' ? (
          <div className="creatorGrid">
            {filteredCreators.map(c => <article className="creatorCard" key={c.id}>
              <div className="creatorCover" style={{background:`linear-gradient(135deg,${c.gradient[0]},${c.gradient[1]})`}}>
                <span>{c.category}</span><button onClick={()=>toggleFavorite(c.id)} aria-label="Favorito"><Heart fill={favorites.has(c.id)?'currentColor':'none'} size={19}/></button>
              </div>
              <div className="creatorContent">
                <div className="creatorAvatar" style={{background:`linear-gradient(135deg,${c.gradient[1]},${c.gradient[0]})`}}>{c.initials}</div>
                <div className="creatorName"><h3>{c.name}</h3>{c.verified && <BadgeCheck size={18}/>}</div>
                <p className="creatorHandle">{c.username} · {c.city}</p>
                <div className="creatorMetrics"><div><strong>{compact.format(c.followers)}</strong><span>Seguidores declarados</span></div><div><strong>{c.engagement}%</strong><span>Interacción declarada</span></div><div><strong>{c.scoreLabel ?? formatScoreDisplay(c.score)}</strong><span>KUVO Score</span></div></div>
                <div className="cardFooter"><p><span>Desde</span><strong>{money.format(c.startingPrice)}</strong></p><button className="smallBtn" onClick={()=>setSelectedCreator(c)}>Ver perfil</button></div>
              </div>
            </article>)}
          </div>
        ) : (
          <div className="campaignGrid">
            {filteredCampaigns.map(c => <article className="campaignCard" key={c.id}>
              <div className="campaignBrand" style={{background:`linear-gradient(135deg,${c.gradient[0]},${c.gradient[1]})`}}>{c.businessName.slice(0,2).toUpperCase()}</div>
              <div className="campaignHead"><div><span>{c.businessName}</span><h3>{c.title}</h3></div><span className="verifiedTag"><ShieldCheck size={14}/> Verificada</span></div>
              <p>{c.description}</p>
              <div className="tagRow"><span>{c.category}</span><span><MapPin size={13}/>{c.city}</span>{c.deliverables.slice(0,1).map(x=><span key={x}>{x}</span>)}</div>
              <div className="campaignFooter"><p><span>Presupuesto</span><strong>{money.format(c.budgetMin)} – {money.format(c.budgetMax)}</strong></p><button className="smallBtn" onClick={()=>setSelectedCampaign(c)}>Ver campaña</button></div>
            </article>)}
          </div>
        )}
        {((view==='creators' && filteredCreators.length===0)||(view==='campaigns' && filteredCampaigns.length===0)) && <div className="emptyState"><Search/><h3>No encontramos resultados</h3><p>Probá cambiando los filtros o la búsqueda.</p></div>}
      </section>

      <section id="como-funciona" className="howSection">
        <div className="container">
          <div className="sectionHeading centered"><span className="eyebrow"><Zap size={15}/> ¿Querés más?</span><h2>El marketplace es solo la parte pública</h2><p>Registrate para acceder a campañas, postulaciones, mensajes y panel privado con tus datos protegidos.</p></div>
          <div className="stepsGrid">
            <article><span>01</span><Search/><h3>Explorá</h3><p>Filtrá creadores y campañas abiertas sin cuenta.</p></article>
            <article><span>02</span><MessageCircle/><h3>Registrate</h3><p>Elegí rol negocio o creador y completá tu perfil.</p></article>
            <article><span>03</span><Target/><h3>Gestioná</h3><p>Publicá, postulate y seguí estados desde /panel.</p></article>
            <article><span>04</span><BarChart3/><h3>Medí</h3><p>Construí reputación con KUVO Score y reseñas.</p></article>
          </div>
        </div>
      </section>

      <section id="seguridad" className="securitySection container">
        <div className="securityCard">
          <div><span className="eyebrow"><ShieldCheck size={15}/> Lo público vs lo privado</span><h2>Acá ves el catálogo. En tu panel, lo tuyo.</h2><p>Postulaciones, mensajes y favoritos no son visibles para otros usuarios. Cada cuenta accede solo a su información.</p><ul><li><Check/> Perfiles y campañas abiertas: visibles para todos</li><li><Check/> Panel, mensajes y postulaciones: solo para vos</li><li><Check/> Protección con reglas de acceso en la base de datos</li></ul></div>
          <div className="securityVisual"><ShieldCheck size={80}/><strong>RLS</strong><span>Privacidad por usuario</span></div>
        </div>
      </section>

      <section className="ctaSection container"><div><span className="eyebrow"><Sparkles size={15}/> Crecé con mejores colaboraciones</span><h2>Tu próxima campaña puede empezar hoy.</h2><p>Registrate como negocio o creador y completá tu perfil profesional.</p><Link className="primaryBtn large" href="/registro">Crear cuenta gratis <ChevronRight size={19}/></Link></div></section>

      <footer><div className="container footerGrid"><div><Logo/><p>Marketplace público de KUVO. Para gestionar campañas y mensajes privados, ingresá a tu panel.</p></div><div><h4>Plataforma</h4><Link href="/">Inicio</Link><button onClick={()=>switchView('creators')}>Creadores</button><button onClick={()=>switchView('campaigns')}>Campañas</button></div><div><h4>Cuenta</h4><Link href="/login">Ingresar</Link><Link href="/registro">Registrarse</Link><Link href="/panel">Mi panel</Link></div><div><h4>Legal</h4><Link href="/privacidad">Privacidad</Link><Link href="/terminos">Términos</Link><a href="#seguridad">Seguridad</a></div></div><div className="container footerBottom"><span>© 2026 KUVO. Todos los derechos reservados.</span><span>Marketplace público · gestión privada en /panel</span></div></footer>

      {selectedCreator && <div className="modalBackdrop" onMouseDown={e=>e.target===e.currentTarget&&setSelectedCreator(null)}><section className="profileModal">
        <button className="modalClose" onClick={()=>setSelectedCreator(null)}><X/></button>
        <div className="profileHero" style={{background:`linear-gradient(135deg,${selectedCreator.gradient[0]},${selectedCreator.gradient[1]})`}}><div className="largeAvatar">{selectedCreator.initials}</div></div>
        <div className="profileBody"><div className="creatorName"><h2>{selectedCreator.name}</h2>{selectedCreator.verified&&<BadgeCheck/>}</div><p className="creatorHandle">{selectedCreator.username} · {selectedCreator.city}</p><p>{selectedCreator.bio}</p>
        <div className="profileStats"><div><strong>{compact.format(selectedCreator.followers)}</strong><span>Seguidores declarados</span></div><div><strong>{selectedCreator.engagement}%</strong><span>Interacción declarada</span></div><div><strong>{selectedCreator.scoreLabel ?? formatScoreDisplay(selectedCreator.score)}</strong><span>KUVO Score</span></div></div>
        <h3>Servicios y portfolio</h3><div className="portfolioGrid">{selectedCreator.portfolio.map((x,i)=><div key={x} style={{background:`linear-gradient(135deg,${i%2?selectedCreator.gradient[1]:selectedCreator.gradient[0]},${i%2?selectedCreator.gradient[0]:selectedCreator.gradient[1]})`}}>{x}</div>)}</div>
        <div className="modalActions"><p><span>Precio desde</span><strong>{money.format(selectedCreator.startingPrice)}</strong></p><Link className="ghostBtn" href={`/creadores/${selectedCreator.username.replace(/^@/,'')}`}>Ver perfil público</Link><Link className="primaryBtn" href="/login?next=/panel">Contactar <ArrowRight size={17}/></Link></div></div>
      </section></div>}

      {selectedCampaign && <div className="modalBackdrop" onMouseDown={e=>e.target===e.currentTarget&&setSelectedCampaign(null)}><section className="campaignModal">
        <button className="modalClose" onClick={()=>setSelectedCampaign(null)}><X/></button>
        <div className="campaignModalTop"><div className="campaignBrand large" style={{background:`linear-gradient(135deg,${selectedCampaign.gradient[0]},${selectedCampaign.gradient[1]})`}}>{selectedCampaign.businessName.slice(0,2).toUpperCase()}</div><div><span>{selectedCampaign.businessName}</span><h2>{selectedCampaign.title}</h2><p><MapPin size={15}/>{selectedCampaign.city} · {selectedCampaign.category}</p></div></div>
        <p>{selectedCampaign.description}</p><h3>Entregables</h3><ul className="deliverables">{selectedCampaign.deliverables.map(x=><li key={x}><Check/>{x}</li>)}</ul>
        <div className="campaignDetails"><div><span>Presupuesto</span><strong>{money.format(selectedCampaign.budgetMin)} – {money.format(selectedCampaign.budgetMax)}</strong></div><div><span>Fecha límite</span><strong>{selectedCampaign.deadline ? new Date(selectedCampaign.deadline+'T12:00:00').toLocaleDateString('es-AR') : 'A coordinar'}</strong></div></div>
        <Link className="ghostBtn full" href={`/campanas/${selectedCampaign.id}`}>Ver página pública</Link>
        <Link className="primaryBtn full" href="/login?next=/panel">Postularme desde mi panel <ArrowRight size={18}/></Link>
      </section></div>}
      {toast && <div className="toast"><Check size={17}/>{toast}</div>}
    </main>
  );
}
