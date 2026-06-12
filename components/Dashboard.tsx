'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Activity, ArrowLeft, BadgeCheck, Bell, BriefcaseBusiness, Check, CheckCircle2,
  ChevronRight, CircleDollarSign, Clock3, FileText, Heart, LayoutDashboard, LogOut, Menu,
  MessageCircle, Plus, Search, Send, Settings, Sparkles, Target, TrendingUp,
  Users, X
} from 'lucide-react';
import { Logo } from './Logo';
import { createClient, isDemoMode, isSupabaseConfigured } from '@/lib/supabase/client';
import { demoApplications, demoCampaigns, demoCreators } from '@/lib/demo';
import type { Application, Campaign, Creator, Role } from '@/lib/types';
import { formatScoreDisplay } from '@/lib/score/kuvo-score';
import {
  loadChatMessages,
  loadConversations,
  loadFavoriteCreators,
  loadUnreadNotificationCount,
  postChatMessage,
  type ChatLine,
  type ConversationItem,
} from '@/features/dashboard/panel-data';

const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
type Tab = 'overview' | 'campaigns' | 'applications' | 'messages' | 'favorites' | 'profile';

type SessionProfile = {
  id: string;
  accountId?: string;
  name: string;
  email: string;
  role: Role;
  city: string;
  bio: string;
  username: string;
  businessName?: string;
  businessId?: string;
  creatorId?: string;
  category?: string;
};

const demoMessages = [
  { id:'m1', name:'Luz Herrera', initials:'LH', text:'Perfecto, puedo grabar el viernes por la noche.', time:'12:42', unread:2 },
  { id:'m2', name:'Marea', initials:'MA', text:'Nos gustó tu propuesta. ¿Coordinamos entregables?', time:'Ayer', unread:0 },
  { id:'m3', name:'Tomi Cáceres', initials:'TC', text:'Adjunté la versión final del video.', time:'Lun', unread:0 },
];

export function Dashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<SessionProfile | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebar, setSidebar] = useState(false);
  const [campaignModal, setCampaignModal] = useState(false);
  const [applyCampaign, setApplyCampaign] = useState<Campaign | null>(null);
  const [toast, setToast] = useState('');
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConversation, setActiveConversation] = useState<ConversationItem | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatLine[]>([]);
  const [favoriteCreators, setFavoriteCreators] = useState<Creator[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const demo = isDemoMode();

  useEffect(() => { void loadSession(); }, []);

  async function loadSession() {
    if (demo) {
      let demoSession: any = null;
      try { demoSession = JSON.parse(localStorage.getItem('kuvo_demo_session') || 'null'); } catch {}
      setProfile({ id:'demo-profile', name:demoSession?.name || 'Cuenta Demo', email:demoSession?.email || 'demo@kuvo.app', role:demoSession?.role || 'business', city:'San Juan', bio:'Perfil de demostración de KUVO.', username:'cuentademo', businessName:'Estudio Norte', businessId:'demo-business', creatorId:'cr-5', category:'Lifestyle' });
      setCampaigns(demoCampaigns.slice(0, 3));
      setApplications(demoApplications);
      setConversations(demoMessages.map(m => ({ id: m.id, title: m.name, initials: m.initials, preview: m.text, time: m.time, unread: m.unread })));
      setActiveConversation({ id: demoMessages[0].id, title: demoMessages[0].name, initials: demoMessages[0].initials, preview: demoMessages[0].text, time: demoMessages[0].time, unread: 0 });
      setChatMessages([
        { id: '1', mine: false, text: 'Hola, vi la campaña y tengo una idea.', time: '12:15' },
        { id: '2', mine: true, text: '¡Hola! Contame tu propuesta.', time: '12:19' },
      ]);
      setFavoriteCreators(demoCreators.slice(0, 4));
      setUnreadNotifications(0);
      setLoading(false);
      return;
    }

    const supabase = createClient();
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace('/login'); return; }
    const { data: p } = await supabase.from('profiles').select('*, creator_profiles(*), business_profiles(*)').eq('account_id', user.id).single();
    if (!p) { setLoading(false); return; }
    const creator = Array.isArray(p.creator_profiles) ? p.creator_profiles[0] : p.creator_profiles;
    const business = Array.isArray(p.business_profiles) ? p.business_profiles[0] : p.business_profiles;
    setProfile({ id:p.id, accountId:user.id, name:p.full_name, email:user.email || '', role:p.role, city:p.city || '', bio:p.bio || '', username:p.username || '', businessName:business?.business_name, businessId:business?.id, creatorId:creator?.id, category:creator?.categories?.[0] });

    if (p.role === 'business' && business?.id) {
      const [{ data: cs }, { data: aps }] = await Promise.all([
        supabase.from('campaigns').select('*').eq('business_id', business.id).order('created_at', { ascending:false }),
        supabase.from('applications').select('*, campaigns!inner(title,business_id), creator_profiles!inner(id,profiles(full_name))').eq('campaigns.business_id', business.id).order('created_at', { ascending:false }),
      ]);
      if (cs) setCampaigns(cs.map((c:any)=>({ id:c.id,businessId:c.business_id,businessName:business.business_name,title:c.title,description:c.description,category:c.category,city:c.city,budgetMin:c.budget_min,budgetMax:c.budget_max,deliverables:c.deliverables || [],deadline:c.deadline,status:c.status,applicants:0,gradient:['#7c3aed','#ec4899'] })));
      if (aps) setApplications(aps.map((a:any)=>({ id:a.id,campaignId:a.campaign_id,campaignTitle:a.campaigns.title,creatorId:a.creator_id,creatorName:a.creator_profiles?.profiles?.full_name || 'Creador',message:a.message,proposedPrice:a.proposed_price,status:a.status,createdAt:a.created_at })));
    } else if (p.role === 'creator' && creator?.id) {
      const { data: aps } = await supabase.from('applications').select('*, campaigns(*,business_profiles(business_name))').eq('creator_id', creator.id).order('created_at', { ascending:false });
      if (aps) setApplications(aps.map((a:any)=>({ id:a.id,campaignId:a.campaign_id,campaignTitle:a.campaigns.title,creatorId:a.creator_id,creatorName:p.full_name,message:a.message,proposedPrice:a.proposed_price,status:a.status,createdAt:a.created_at })));
      const { data: open } = await supabase.from('campaigns').select('*,business_profiles(business_name)').eq('status','open').limit(12);
      if (open) setCampaigns(open.map((c:any)=>({ id:c.id,businessId:c.business_id,businessName:c.business_profiles?.business_name || 'Negocio',title:c.title,description:c.description,category:c.category,city:c.city,budgetMin:c.budget_min,budgetMax:c.budget_max,deliverables:c.deliverables||[],deadline:c.deadline,status:c.status,gradient:['#1d4ed8','#06b6d4'] })));
    }

    const [{ items: convItems }, { creators: favs }, unread] = await Promise.all([
      loadConversations(supabase, p.id),
      loadFavoriteCreators(supabase, user.id),
      loadUnreadNotificationCount(supabase, user.id),
    ]);
    setConversations(convItems);
    setFavoriteCreators(favs);
    setUnreadNotifications(unread);
    if (convItems[0]) {
      setActiveConversation(convItems[0]);
      const { lines } = await loadChatMessages(supabase, convItems[0].id, p.id);
      setChatMessages(lines);
    }
    setLoading(false);
  }

  async function openConversation(conv: ConversationItem) {
    setActiveConversation(conv);
    if (demo || !profile) return;
    const supabase = createClient();
    if (!supabase) return;
    setMessagesLoading(true);
    const { lines, error } = await loadChatMessages(supabase, conv.id, profile.id);
    setMessagesLoading(false);
    if (error) { notify(error); return; }
    setChatMessages(lines);
  }

  const isBusiness = profile?.role === 'business' || profile?.role === 'admin';
  const metrics = useMemo(() => isBusiness ? [
    { label:'Campañas activas', value:String(campaigns.filter(c=>c.status==='open').length), change:'En tu cuenta', icon:BriefcaseBusiness },
    { label:'Postulaciones', value:String(applications.length), change:'Total registradas', icon:Users },
    { label:'Inversión estimada', value:money.format(campaigns.reduce((s,c)=>s+c.budgetMax,0)), change:'Presupuesto publicado', icon:CircleDollarSign },
    { label:'Pendientes', value:String(applications.filter(a=>a.status==='pending').length), change:'Por revisar', icon:TrendingUp },
  ] : [
    { label:'Postulaciones', value:String(applications.length), change:'Enviadas', icon:FileText },
    { label:'Aceptadas', value:String(applications.filter(a=>a.status==='accepted').length), change:'Confirmadas', icon:CheckCircle2 },
    { label:'Ingresos potenciales', value:money.format(applications.reduce((s,a)=>s+a.proposedPrice,0)), change:'Propuestas enviadas', icon:CircleDollarSign },
    { label:'Pendientes', value:String(applications.filter(a=>a.status==='pending').length), change:'En revisión', icon:TrendingUp },
  ], [isBusiness, campaigns, applications]);

  function notify(message:string) { setToast(message); setTimeout(()=>setToast(''),2500); }
  function nav(next:Tab) { setTab(next); setSidebar(false); }

  async function logout() {
    if (isSupabaseConfigured()) await createClient()?.auth.signOut();
    localStorage.removeItem('kuvo_demo_session');
    router.push('/'); router.refresh();
  }

  async function createCampaign(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const next:Campaign = {
      id:`campaign-${crypto.randomUUID()}`, businessId:'demo-business', businessName:profile?.businessName || profile?.name || 'Mi negocio',
      title:String(f.get('title')), description:String(f.get('description')), category:String(f.get('category')), city:String(f.get('city')),
      budgetMin:Number(f.get('budgetMin')), budgetMax:Number(f.get('budgetMax')), deliverables:String(f.get('deliverables')).split(',').map(x=>x.trim()).filter(Boolean),
      deadline:String(f.get('deadline')), status:'open', applicants:0, gradient:['#7c3aed','#ec4899']
    };
    if (isSupabaseConfigured()) {
      const supabase = createClient();
      const { data: business } = await supabase!.from('business_profiles').select('id').eq('profile_id', profile!.id).single();
      if (!business) { notify('Primero completá el perfil del negocio.'); return; }
      const { data, error } = await supabase!.from('campaigns').insert({ business_id:business.id,title:next.title,description:next.description,category:next.category,city:next.city,budget_min:next.budgetMin,budget_max:next.budgetMax,deliverables:next.deliverables,deadline:next.deadline,status:'open' }).select().single();
      if (error) { notify(error.message); return; }
      next.id = data.id;
    }
    setCampaigns(v=>[next,...v]); setCampaignModal(false); event.currentTarget.reset(); notify('Campaña publicada correctamente');
  }

  async function submitApplication(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!applyCampaign || !profile?.creatorId) return;
    const f = new FormData(event.currentTarget);
    const next:Application = {
      id:`application-${crypto.randomUUID()}`,
      campaignId:applyCampaign.id,
      campaignTitle:applyCampaign.title,
      creatorId:profile.creatorId,
      creatorName:profile.name,
      message:String(f.get('message')),
      proposedPrice:Number(f.get('proposedPrice')),
      status:'pending',
      createdAt:new Date().toISOString(),
    };
    if (isSupabaseConfigured()) {
      const { data, error } = await createClient()!.from('applications').insert({
        campaign_id:next.campaignId,
        creator_id:next.creatorId,
        message:next.message,
        proposed_price:next.proposedPrice,
      }).select().single();
      if (error) { notify(error.code === '23505' ? 'Ya te postulaste a esta campaña.' : error.message); return; }
      next.id = data.id;
    }
    setApplications(v=>[next,...v]);
    setApplyCampaign(null);
    setTab('applications');
    notify('Postulación enviada correctamente');
  }

  async function updateApplication(id:string, action:'accepted'|'rejected'|'shortlisted') {
    if (isSupabaseConfigured()) {
      const supabase = createClient();
      const rpcMap = {
        accepted: 'business_accept_application',
        rejected: 'business_reject_application',
        shortlisted: 'business_shortlist_application',
      } as const;
      const { error } = await supabase!.rpc(rpcMap[action], { p_application_id: id });
      if (error) { notify(error.message); return; }
    }
    setApplications(v=>v.map(a=>a.id===id?{...a,status:action}:a));
    notify(`Postulación ${action==='accepted'?'aceptada':action==='rejected'?'rechazada':'preseleccionada'}`);
  }

  async function saveProfile(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); const f = new FormData(event.currentTarget);
    const changes = { name:String(f.get('name')), username:String(f.get('username')), city:String(f.get('city')), bio:String(f.get('bio')), businessName:String(f.get('businessName')||'') };
    if (isSupabaseConfigured()) {
      const supabase=createClient();
      const { error }=await supabase!.from('profiles').update({full_name:changes.name,username:changes.username,city:changes.city,bio:changes.bio}).eq('id',profile!.id);
      if(error){notify(error.message);return;}
      if(isBusiness && changes.businessName) await supabase!.from('business_profiles').upsert({profile_id:profile!.id,business_name:changes.businessName},{onConflict:'profile_id'});
    }
    setProfile(p=>p?{...p,...changes}:p); notify('Perfil actualizado');
  }

  async function sendMessage(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const text = String(f.get('message')).trim();
    if (!text || !activeConversation || !profile) return;

    if (demo) {
      setChatMessages(v => [...v, { id: String(Date.now()), mine: true, text, time: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) }]);
      event.currentTarget.reset();
      return;
    }

    const supabase = createClient();
    if (!supabase) return;
    const { data, error } = await postChatMessage(supabase, activeConversation.id, profile.id, text);
    if (error) { notify(error.message); return; }
    setChatMessages(v => [...v, { id: data.id, mine: true, text: data.body, time: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) }]);
    event.currentTarget.reset();
  }

  const profileScoreLabel = formatScoreDisplay(null);

  if (loading) return <div className="fullLoader"><Logo/><div className="loaderRing"/><p>Cargando tu espacio...</p></div>;
  if (!profile) return <div className="fullLoader"><p>No pudimos cargar tu perfil.</p><Link className="primaryBtn" href="/login">Volver a ingresar</Link></div>;

  const menu:[Tab,string,any][] = [
    ['overview','Resumen',LayoutDashboard],['campaigns',isBusiness?'Mis campañas':'Campañas',BriefcaseBusiness],['applications','Postulaciones',FileText],['messages','Mensajes',MessageCircle],['favorites','Favoritos',Heart],['profile','Mi perfil',Settings]
  ];

  return <div className="dashboardApp">
    <aside className={sidebar?'dashSidebar open':'dashSidebar'}>
      <div className="dashLogo"><Logo/><button onClick={()=>setSidebar(false)}><X/></button></div>
      <nav>{menu.map(([key,label,Icon])=><button key={key} className={tab===key?'active':''} onClick={()=>nav(key)}><Icon size={19}/><span>{label}</span>{key==='messages'&&unreadNotifications>0&&<b>{unreadNotifications}</b>}</button>)}</nav>
      <div className="sidebarPromo"><Sparkles/><strong>Mejorá tu perfil</strong><p>Completá tus datos para recibir mejores oportunidades.</p><button onClick={()=>nav('profile')}>Completar ahora</button></div>
      <button className="logoutBtn" onClick={logout}><LogOut size={18}/> Cerrar sesión</button>
    </aside>
    <div className="dashMain">
      <header className="dashHeader">
        <button className="dashMenu" onClick={()=>setSidebar(true)}><Menu/></button>
        <div><h1>{menu.find(x=>x[0]===tab)?.[1]}</h1><p>{isBusiness?'Gestioná tu presencia y tus colaboraciones.':'Encontrá oportunidades y hacé crecer tu perfil.'}</p></div>
        <div className="dashHeaderActions"><Link href="/" className="iconButton" title="Volver al sitio"><ArrowLeft size={18}/></Link><button className="iconButton" aria-label="Notificaciones">{unreadNotifications > 0 && <i aria-hidden />}<Bell size={18}/></button><button className="accountPill" onClick={()=>nav('profile')}><span>{profile.name.split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase()}</span><p><strong>{profile.name}</strong><small>{isBusiness?'Negocio':'Creador'}</small></p></button></div>
      </header>

      <div className="dashContent">
        {tab==='overview'&&<>
          <div className="welcomeCard"><div><span className="eyebrow"><Sparkles size={14}/> Tu actividad en KUVO</span><h2>Hola, {profile.name.split(' ')[0]}.</h2><p>{isBusiness?'Gestioná campañas y postulaciones desde tu panel privado.':'Explorá oportunidades y seguí el estado de tus postulaciones.'}</p><button className="primaryBtn" onClick={()=>isBusiness?setCampaignModal(true):nav('campaigns')}>{isBusiness?<><Plus size={18}/> Nueva campaña</>:<>Explorar campañas <ChevronRight size={18}/></>}</button></div><div className="welcomeVisual"><Target size={78}/><span>{applications.length}</span><small>{isBusiness?'postulaciones':'movimientos'}</small></div></div>
          <div className="metricGrid">{metrics.map(({label,value,change,icon:Icon})=><article key={label}><span><Icon/></span><p>{label}</p><strong>{value}</strong><small>{change}</small></article>)}</div>
          <div className="dashboardColumns"><section className="dashPanel"><div className="panelTitle"><div><h3>{isBusiness?'Campañas recientes':'Oportunidades para vos'}</h3><p>Actividad actual de la cuenta</p></div><button onClick={()=>nav('campaigns')}>Ver todas</button></div><div className="compactCampaigns">{campaigns.slice(0,4).map(c=><button key={c.id} onClick={()=>nav('campaigns')}><span style={{background:`linear-gradient(135deg,${c.gradient[0]},${c.gradient[1]})`}}>{c.businessName.slice(0,2).toUpperCase()}</span><p><strong>{c.title}</strong><small>{c.category} · {c.city}</small></p><i className={`status ${c.status}`}>{c.status==='open'?'Activa':c.status}</i><b>{money.format(c.budgetMax)}</b><ChevronRight/></button>)}</div></section><section className="dashPanel"><div className="panelTitle"><div><h3>Resumen</h3><p>Datos de tu cuenta</p></div></div><div className="chartSummary"><div><strong>{applications.filter(a=>a.status==='accepted').length}</strong><span>Aceptadas</span></div><div><strong>{applications.filter(a=>a.status==='pending').length}</strong><span>Pendientes</span></div><div><strong>{campaigns.filter(c=>c.status==='open').length}</strong><span>Campañas abiertas</span></div></div></section></div>
        </>}

        {tab==='campaigns'&&<><div className="contentToolbar"><label><Search/><input placeholder="Buscar campañas"/></label><select><option>Todas</option><option>Activas</option><option>Pausadas</option><option>Completadas</option></select>{isBusiness&&<button className="primaryBtn" onClick={()=>setCampaignModal(true)}><Plus/> Nueva campaña</button>}</div><div className="dashCampaignGrid">{campaigns.map(c=><article key={c.id}><div className="dashCampaignTop"><span style={{background:`linear-gradient(135deg,${c.gradient[0]},${c.gradient[1]})`}}>{c.businessName.slice(0,2).toUpperCase()}</span><i className={`status ${c.status}`}>{c.status==='open'?'Activa':c.status}</i></div><small>{c.businessName}</small><h3>{c.title}</h3><p>{c.description}</p><div className="tagRow"><span>{c.category}</span><span>{c.city}</span></div><div className="campaignNumbers"><div><span>Presupuesto</span><strong>{money.format(c.budgetMax)}</strong></div><div><span>Postulantes</span><strong>{c.applicants ?? applications.filter(a=>a.campaignId===c.id).length}</strong></div></div><button className="ghostBtn full" onClick={()=>isBusiness?nav('applications'):setApplyCampaign(c)}>{isBusiness?'Ver postulaciones':'Postularme'}<ChevronRight/></button></article>)}</div></>}

        {tab==='applications'&&<section className="dashPanel applicationPanel"><div className="panelTitle"><div><h3>{isBusiness?'Postulaciones recibidas':'Mis postulaciones'}</h3><p>{applications.length} movimientos registrados</p></div></div><div className="applicationTable"><div className="tableHead"><span>{isBusiness?'Creador':'Campaña'}</span><span>Propuesta</span><span>Estado</span><span>Fecha</span><span>Acciones</span></div>{applications.map(a=><div className="tableRow" key={a.id}><div className="applicationPerson"><span>{(isBusiness?a.creatorName:a.campaignTitle).split(' ').map(x=>x[0]).slice(0,2).join('')}</span><p><strong>{isBusiness?a.creatorName:a.campaignTitle}</strong><small>{isBusiness?a.campaignTitle:a.message}</small></p></div><strong>{money.format(a.proposedPrice)}</strong><i className={`status ${a.status}`}>{a.status==='pending'?'Pendiente':a.status==='shortlisted'?'Preseleccionada':a.status==='accepted'?'Aceptada':'Rechazada'}</i><span>{new Date(a.createdAt).toLocaleDateString('es-AR')}</span><div className="rowActions">{isBusiness&&a.status!=='accepted'&&<><button title="Preseleccionar" onClick={()=>updateApplication(a.id,'shortlisted')}><BadgeCheck/></button><button title="Aceptar" onClick={()=>updateApplication(a.id,'accepted')}><Check/></button><button title="Rechazar" onClick={()=>updateApplication(a.id,'rejected')}><X/></button></>}<button title="Mensaje" onClick={()=>nav('messages')}><MessageCircle/></button></div></div>)}</div></section>}

        {tab==='messages'&&<div className="messagesLayout"><aside className="conversationList"><div className="conversationSearch"><Search/><input placeholder="Buscar conversación"/></div>{conversations.length===0&&<p className="emptyInline">Todavía no tenés conversaciones.</p>}{conversations.map(m=><button key={m.id} type="button" className={activeConversation?.id===m.id?'active':''} onClick={()=>void openConversation(m)}><span>{m.initials}</span><p><strong>{m.title}</strong><small>{m.preview}</small></p><time>{m.time}</time>{m.unread>0&&<b>{m.unread}</b>}</button>)}</aside><section className="chatPanel">{activeConversation?(<><header><span>{activeConversation.initials}</span><p><strong>{activeConversation.title}</strong><small>Campaña vinculada</small></p><button type="button"><FileText/></button></header><div className="chatBody">{messagesLoading&&<p className="loadingLine"/>}{chatMessages.map(m=><div key={m.id} className={m.mine?'mine':''}><p>{m.text}</p><time>{m.time}</time></div>)}</div><form onSubmit={sendMessage}><input name="message" placeholder="Escribí un mensaje..." autoComplete="off"/><button type="submit"><Send/></button></form></>):(<div className="emptyState compact"><MessageCircle/><p>Elegí una conversación de la lista.</p></div>)}</section></div>}

        {tab==='favorites'&&<><div className="sectionHeading compact"><h2>Creadores guardados</h2><p>Tu selección personal para futuras campañas.</p></div>{favoriteCreators.length===0?(<div className="emptyState"><Heart/><h3>Sin favoritos todavía</h3><p>Guardá creadores desde el marketplace para verlos acá.</p><Link href="/explorar" className="primaryBtn">Explorar creadores</Link></div>):(<div className="creatorGrid inDashboard">{favoriteCreators.map(c=><article className="creatorCard" key={c.id}><div className="creatorCover" style={{background:`linear-gradient(135deg,${c.gradient[0]},${c.gradient[1]})`}}><span>{c.category}</span><button type="button" aria-label="Quitar favorito"><Heart fill="currentColor"/></button></div><div className="creatorContent"><div className="creatorAvatar" style={{background:`linear-gradient(135deg,${c.gradient[1]},${c.gradient[0]})`}}>{c.initials}</div><div className="creatorName"><h3>{c.name}</h3>{c.verified&&<BadgeCheck/>}</div><p className="creatorHandle">{c.username} · {c.city}</p><div className="cardFooter"><p><span>Desde</span><strong>{money.format(c.startingPrice)}</strong></p><Link href="/explorar" className="smallBtn">Ver en marketplace</Link></div></div></article>)}</div>)}</>}

        {tab==='profile'&&<div className="profileSettings"><section className="dashPanel"><div className="profileBanner"><div>{profile.name.split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase()}</div><button className="ghostBtn">Cambiar foto</button></div><form onSubmit={saveProfile} className="settingsForm"><div className="formGrid"><label>Nombre completo<input name="name" defaultValue={profile.name} required/></label><label>Nombre de usuario<input name="username" defaultValue={profile.username}/></label>{isBusiness&&<label>Nombre del negocio<input name="businessName" defaultValue={profile.businessName}/></label>}<label>Ciudad<input name="city" defaultValue={profile.city}/></label><label className="span2">Descripción<textarea name="bio" defaultValue={profile.bio} rows={5}/></label></div><div className="settingsActions"><button type="submit" className="primaryBtn">Guardar cambios</button></div></form></section><aside className="dashPanel profileScore"><Activity/><strong>{profileScoreLabel}</strong><h3>{isBusiness?'Perfil completado':'KUVO Score'}</h3><p>Completá redes, portfolio y datos de contacto para mejorar tu visibilidad.</p><ul><li><Check/> Información principal</li><li><Check/> Correo verificado</li><li><Clock3/> Vincular redes sociales</li></ul></aside></div>}
      </div>
    </div>

    {applyCampaign&&<div className="modalBackdrop"><section className="campaignCreateModal"><button className="modalClose" onClick={()=>setApplyCampaign(null)}><X/></button><span className="eyebrow"><FileText size={15}/> Nueva postulación</span><h2>{applyCampaign.title}</h2><p>{applyCampaign.businessName} · {applyCampaign.city}. Presupuesto publicado: {money.format(applyCampaign.budgetMin)} – {money.format(applyCampaign.budgetMax)}.</p><form onSubmit={submitApplication} className="campaignForm"><label>Tu propuesta<textarea name="message" required minLength={10} rows={5} placeholder="Explicá tu idea, experiencia y entregables..."/></label><label>Precio propuesto<input name="proposedPrice" type="number" min="0" required defaultValue={applyCampaign.budgetMin}/></label><button className="primaryBtn full">Enviar postulación <Send/></button></form></section></div>}
    {campaignModal&&<div className="modalBackdrop"><section className="campaignCreateModal"><button className="modalClose" onClick={()=>setCampaignModal(false)}><X/></button><span className="eyebrow"><BriefcaseBusiness size={15}/> Nueva oportunidad</span><h2>Publicar campaña</h2><p>Definí lo esencial. Después podés gestionar propuestas y estados desde el panel.</p><form onSubmit={createCampaign} className="campaignForm"><label>Título<input name="title" required placeholder="Ej. Lanzamiento colección invierno"/></label><label>Descripción<textarea name="description" required rows={4} placeholder="Contá qué buscás y cuál es el objetivo..."/></label><div className="formGrid"><label>Categoría<select name="category"><option>Gastronomía</option><option>Moda</option><option>Belleza</option><option>Tecnología</option><option>Fitness</option><option>Viajes</option><option>Gaming</option><option>Lifestyle</option></select></label><label>Ciudad<input name="city" required defaultValue="San Juan"/></label><label>Presupuesto mínimo<input name="budgetMin" type="number" min="0" required defaultValue="80000"/></label><label>Presupuesto máximo<input name="budgetMax" type="number" min="0" required defaultValue="150000"/></label><label>Fecha límite<input name="deadline" type="date" required/></label><label>Entregables<input name="deliverables" required placeholder="1 reel, 3 historias"/></label></div><button className="primaryBtn full">Publicar campaña <ChevronRight/></button></form></section></div>}
    {toast&&<div className="toast"><Check/>{toast}</div>}
  </div>;
}
