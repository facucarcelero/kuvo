'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Activity, ArrowLeft, BadgeCheck, BriefcaseBusiness, Check, CheckCircle2,
  ChevronRight, CircleDollarSign, Clock3, FileText, Heart, LayoutDashboard, LogOut, Menu,
  MessageCircle, Plus, Search, Send, Settings, Sparkles, Target, TrendingUp,
  Users, X
} from 'lucide-react';
import { Logo } from './Logo';
import { NotificationPanel } from './NotificationPanel';
import { createClient, isDemoMode, isSupabaseConfigured } from '@/lib/supabase/client';
import { demoApplications, demoCampaigns, demoCreators } from '@/lib/demo';
import type { Application, Campaign, Creator, Role } from '@/lib/types';
import { formatScoreDisplay } from '@/lib/score/kuvo-score';
import {
  loadChatMessages,
  loadConversations,
  loadFavoriteCreators,
  postChatMessage,
  totalUnreadMessages,
  type ChatLine,
  type ConversationItem,
} from '@/features/dashboard/panel-data';
import {
  appendChatMessage,
  formatMessageTime,
  mapMessageRow,
  subscribeToConversationMessages,
  subscribeToMemberMessageInserts,
} from '@/features/messages/api';
import {
  insertDraftCampaign,
  publishCampaign,
  transitionCampaign,
  type CampaignTransition,
} from '@/features/campaigns/api';
import {
  insertApplication,
  updateApplicationStatus,
  withdrawApplication as withdrawApplicationRpc,
} from '@/features/applications/api';
import {
  applicationStatusLabel,
  businessCanAccept,
  businessCanReject,
  businessCanShortlist,
  creatorCanWithdraw,
} from '@/lib/labels/application-status';
import {
  businessCanCancel,
  businessCanComplete,
  businessCanPause,
  businessCanReopen,
  campaignStatusLabel,
} from '@/lib/labels/campaign-status';
import { removeFavorite } from '@/features/favorites/api';
import { insertReview } from '@/features/reviews/api';

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
  creatorScore?: number | null;
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
  const [favoriteByCreatorId, setFavoriteByCreatorId] = useState<Record<string, string>>({});
  const [campaignSearch, setCampaignSearch] = useState('');
  const [campaignStatusFilter, setCampaignStatusFilter] = useState('all');
  const [reviewedCampaigns, setReviewedCampaigns] = useState<Set<string>>(new Set());
  const [reviewTarget, setReviewTarget] = useState<{ campaignId: string; creatorProfileId: string; creatorName: string } | null>(null);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const activeConversationIdRef = useRef<string | null>(null);
  const demo = isDemoMode();

  useEffect(() => { void loadSession(); }, []);

  async function loadSession() {
    if (demo) {
      let demoSession: any = null;
      try { demoSession = JSON.parse(localStorage.getItem('kuvo_demo_session') || 'null'); } catch {}
      setProfile({ id:'demo-profile', name:demoSession?.name || 'Cuenta Demo', email:demoSession?.email || 'demo@kuvo.app', role:demoSession?.role || 'business', city:'San Juan', bio:'Perfil de demostración de KUVO.', username:'cuentademo', businessName:'Estudio Norte', businessId:'demo-business', creatorId:'cr-5', category:'Lifestyle' });
      setCampaigns(demoCampaigns.slice(0, 3));
      setApplications(demoApplications);
      setConversations(demoMessages.map(m => ({ id: m.id, title: m.name, initials: m.initials, preview: m.text, time: m.time, unread: m.unread, lastMessageAt: null })));
      setActiveConversation({ id: demoMessages[0].id, title: demoMessages[0].name, initials: demoMessages[0].initials, preview: demoMessages[0].text, time: demoMessages[0].time, unread: 0, lastMessageAt: null });
      setChatMessages([
        { id: '1', mine: false, text: 'Hola, vi la campaña y tengo una idea.', time: '12:15' },
        { id: '2', mine: true, text: '¡Hola! Contame tu propuesta.', time: '12:19' },
      ]);
      setFavoriteCreators(demoCreators.slice(0, 4));
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
    setProfile({ id:p.id, accountId:user.id, name:p.full_name, email:user.email || '', role:p.role, city:p.city || '', bio:p.bio || '', username:p.username || '', businessName:business?.business_name, businessId:business?.id, creatorId:creator?.id, creatorScore: creator?.score != null ? Number(creator.score) : null, category:creator?.categories?.[0] });

    if (p.role === 'business' && business?.id) {
      const [{ data: cs }, { data: aps }] = await Promise.all([
        supabase.from('campaigns').select('*').eq('business_id', business.id).order('created_at', { ascending:false }),
        supabase.from('applications').select('*, campaigns!inner(title,business_id), creator_profiles!inner(id,profile_id,profiles(full_name))').eq('campaigns.business_id', business.id).order('created_at', { ascending:false }),
      ]);
      if (cs) {
        setCampaigns(cs.map((c:any)=>({ id:c.id,businessId:c.business_id,businessName:business.business_name,title:c.title,description:c.description,category:c.category,city:c.city,budgetMin:c.budget_min,budgetMax:c.budget_max,deliverables:c.deliverables || [],deadline:c.deadline,status:c.status,applicants:0,gradient:['#7c3aed','#ec4899'] })));
        const { data: revs } = await supabase.from('reviews').select('campaign_id').eq('reviewer_profile_id', p.id).in('campaign_id', cs.map((c: any) => c.id));
        setReviewedCampaigns(new Set(revs?.map(r => r.campaign_id) ?? []));
      }
      if (aps) setApplications(aps.map((a:any)=>({ id:a.id,campaignId:a.campaign_id,campaignTitle:a.campaigns.title,creatorId:a.creator_id,creatorProfileId:a.creator_profiles?.profile_id,creatorName:a.creator_profiles?.profiles?.full_name || 'Creador',message:a.message,proposedPrice:a.proposed_price,status:a.status,createdAt:a.created_at })));
    } else if (p.role === 'creator' && creator?.id) {
      const { data: aps } = await supabase.from('applications').select('*, campaigns(*,business_profiles(business_name))').eq('creator_id', creator.id).order('created_at', { ascending:false });
      if (aps) setApplications(aps.map((a:any)=>({ id:a.id,campaignId:a.campaign_id,campaignTitle:a.campaigns.title,creatorId:a.creator_id,creatorName:p.full_name,message:a.message,proposedPrice:a.proposed_price,status:a.status,createdAt:a.created_at })));
      const { data: open } = await supabase.from('campaigns').select('*,business_profiles(business_name)').eq('status','open').limit(12);
      if (open) setCampaigns(open.map((c:any)=>({ id:c.id,businessId:c.business_id,businessName:c.business_profiles?.business_name || 'Negocio',title:c.title,description:c.description,category:c.category,city:c.city,budgetMin:c.budget_min,budgetMax:c.budget_max,deliverables:c.deliverables||[],deadline:c.deadline,status:c.status,gradient:['#1d4ed8','#06b6d4'] })));
    }

    const [{ items: convItems }, favResult] = await Promise.all([
      loadConversations(supabase, p.id),
      loadFavoriteCreators(supabase, user.id),
    ]);
    setConversations(convItems);
    setUnreadMessages(totalUnreadMessages(convItems));
    setFavoriteCreators(favResult.creators);
    setFavoriteByCreatorId(favResult.favoriteByCreatorId);
    if (convItems[0]) {
      setActiveConversation(convItems[0]);
      const { lines } = await loadChatMessages(supabase, convItems[0].id, p.id);
      setChatMessages(lines);
    }
    setLoading(false);
  }

  useEffect(() => {
    activeConversationIdRef.current = activeConversation?.id ?? null;
  }, [activeConversation?.id]);

  useEffect(() => {
    if (demo || !profile?.id || !isSupabaseConfigured()) return;
    const supabase = createClient();
    if (!supabase) return;
    const profileId = profile.id;

    const unsubscribe = subscribeToMemberMessageInserts(supabase, profileId, (row) => {
      const mine = row.sender_profile_id === profileId;
      const isActive = activeConversationIdRef.current === row.conversation_id;

      setConversations(prev => {
        const next = prev.map(c => {
          if (c.id !== row.conversation_id) return c;
          return {
            ...c,
            preview: row.body,
            time: formatMessageTime(row.created_at),
            lastMessageAt: row.created_at,
            unread: isActive || mine ? c.unread : c.unread + 1,
          };
        });
        setUnreadMessages(totalUnreadMessages(next));
        return [...next].sort((a, b) => {
          const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
          const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
          return bTime - aTime;
        });
      });
    });

    return unsubscribe;
  }, [demo, profile?.id]);

  useEffect(() => {
    if (demo || !profile?.id || !activeConversation?.id || !isSupabaseConfigured()) return;
    const supabase = createClient();
    if (!supabase) return;
    const conversationId = activeConversation.id;
    const profileId = profile.id;

    const unsubscribe = subscribeToConversationMessages(
      supabase,
      conversationId,
      profileId,
      (line) => {
        setChatMessages(prev => appendChatMessage(prev, line));
      },
    );

    return unsubscribe;
  }, [demo, profile?.id, activeConversation?.id]);

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
    setConversations(prev => {
      const next = prev.map(c => c.id === conv.id ? { ...c, unread: 0 } : c);
      setUnreadMessages(totalUnreadMessages(next));
      return next;
    });
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

  const filteredCampaigns = useMemo(() => campaigns.filter(c => {
    const q = campaignSearch.trim().toLowerCase();
    const matchSearch = !q || `${c.title} ${c.description} ${c.category} ${c.city} ${c.businessName}`.toLowerCase().includes(q);
    const matchStatus = campaignStatusFilter === 'all' || c.status === campaignStatusFilter;
    return matchSearch && matchStatus;
  }), [campaigns, campaignSearch, campaignStatusFilter]);

  const profileCompletionPct = useMemo(() => {
    if (!profile) return 0;
    const fields = isBusiness
      ? [profile.name, profile.username, profile.city, profile.bio, profile.businessName]
      : [profile.name, profile.username, profile.city, profile.bio, profile.category];
    return Math.round((fields.filter(Boolean).length / fields.length) * 100);
  }, [profile, isBusiness]);

  const profileScoreLabel = isBusiness ? `${profileCompletionPct}%` : formatScoreDisplay(profile?.creatorScore ?? null);

  function notify(message:string) { setToast(message); setTimeout(()=>setToast(''),2500); }
  function nav(next:Tab) { setTab(next); setSidebar(false); }

  async function logout() {
    if (isSupabaseConfigured()) await createClient()?.auth.signOut();
    localStorage.removeItem('kuvo_demo_session');
    router.push('/'); router.refresh();
  }

  async function createCampaign(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const f = new FormData(form);
    const payload = {
      title:String(f.get('title')), description:String(f.get('description')), category:String(f.get('category')), city:String(f.get('city')),
      budgetMin:Number(f.get('budgetMin')), budgetMax:Number(f.get('budgetMax')), deliverables:String(f.get('deliverables')).split(',').map(x=>x.trim()).filter(Boolean),
      deadline:String(f.get('deadline')),
    };

    if (demo) {
      const next:Campaign = {
        id:`campaign-${crypto.randomUUID()}`, businessId:'demo-business', businessName:profile?.businessName || profile?.name || 'Mi negocio',
        ...payload, status:'open', applicants:0, gradient:['#7c3aed','#ec4899'],
      };
      setCampaigns(v=>[next,...v]); form?.reset(); setCampaignModal(false); notify('Campaña publicada correctamente');
      return;
    }

    if (!isSupabaseConfigured() || !profile) {
      notify('No pudimos conectar con la base de datos. Intentá de nuevo.');
      return;
    }

    const supabase = createClient();
    if (!supabase) { notify('No pudimos conectar con la base de datos. Intentá de nuevo.'); return; }
    const { data: business } = await supabase.from('business_profiles').select('id').eq('profile_id', profile.id).single();
    if (!business) { notify('Primero completá el perfil del negocio.'); return; }
    const { data, error } = await insertDraftCampaign(supabase, {
      businessId: business.id,
      ...payload,
    });
    if (error || !data) { notify(error?.message ?? 'No pudimos crear la campaña.'); return; }
    const { error: publishErr } = await publishCampaign(supabase, data.id);
    if (publishErr) { notify(publishErr.message); return; }
    const next:Campaign = {
      id:data.id, businessId:business.id, businessName:profile.businessName || profile.name,
      ...payload, status:'open', applicants:0, gradient:['#7c3aed','#ec4899'],
    };
    setCampaigns(v=>[next,...v]); form?.reset(); setCampaignModal(false); notify('Campaña publicada correctamente');
  }

  async function submitApplication(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!applyCampaign || !profile?.creatorId) return;
    const f = new FormData(event.currentTarget);
    const message = String(f.get('message'));
    const proposedPrice = Number(f.get('proposedPrice'));

    if (demo) {
      const next:Application = {
        id:`application-${crypto.randomUUID()}`,
        campaignId:applyCampaign.id,
        campaignTitle:applyCampaign.title,
        creatorId:profile.creatorId,
        creatorName:profile.name,
        message,
        proposedPrice,
        status:'pending',
        createdAt:new Date().toISOString(),
      };
      setApplications(v=>[next,...v]);
      setApplyCampaign(null);
      setTab('applications');
      notify('Postulación enviada correctamente');
      return;
    }

    if (!isSupabaseConfigured()) {
      notify('No pudimos conectar con la base de datos. Intentá de nuevo.');
      return;
    }

    const supabase = createClient();
    if (!supabase) { notify('No pudimos conectar con la base de datos. Intentá de nuevo.'); return; }
    const { data, error } = await insertApplication(supabase, {
      campaignId: applyCampaign.id,
      creatorId: profile.creatorId,
      message,
      proposedPrice,
    });
    if (error || !data) { notify(error?.code === '23505' ? 'Ya te postulaste a esta campaña.' : error?.message ?? 'No pudimos enviar la postulación.'); return; }
    const next:Application = {
      id:data.id,
      campaignId:applyCampaign.id,
      campaignTitle:applyCampaign.title,
      creatorId:profile.creatorId,
      creatorName:profile.name,
      message,
      proposedPrice,
      status:'pending',
      createdAt:data.created_at ?? new Date().toISOString(),
    };
    setApplications(v=>[next,...v]);
    setApplyCampaign(null);
    setTab('applications');
    notify('Postulación enviada correctamente');
  }

  async function updateApplication(id:string, action:'accepted'|'rejected'|'shortlisted') {
    const app = applications.find(a => a.id === id);
    if (!app) return;

    if (demo) {
      setApplications(v => v.map(a => {
        if (a.id === id) return { ...a, status: action };
        if (action === 'accepted' && a.campaignId === app.campaignId && (a.status === 'pending' || a.status === 'shortlisted')) {
          return { ...a, status: 'rejected' };
        }
        return a;
      }));
      if (action === 'accepted') {
        setCampaigns(v => v.map(c => c.id === app.campaignId ? { ...c, status: 'in_progress' } : c));
      }
      notify(`Postulación ${applicationStatusLabel(action)}`);
      return;
    }
    if (!isSupabaseConfigured()) { notify('No pudimos conectar con la base de datos.'); return; }
    const supabase = createClient();
    if (!supabase) { notify('No pudimos conectar con la base de datos.'); return; }
    const { nextStatus, conversationId, error } = await updateApplicationStatus(supabase, id, action);
    if (error) { notify(error.message); return; }
    setApplications(v => v.map(a => {
      if (a.id === id) return { ...a, status: nextStatus };
      if (action === 'accepted' && a.campaignId === app.campaignId && (a.status === 'pending' || a.status === 'shortlisted')) {
        return { ...a, status: 'rejected' };
      }
      return a;
    }));
    if (action === 'accepted') {
      setCampaigns(v => v.map(c => c.id === app.campaignId ? { ...c, status: 'in_progress' } : c));
      if (profile?.id && conversationId) {
        const { items } = await loadConversations(supabase, profile.id);
        setConversations(items);
        setUnreadMessages(totalUnreadMessages(items));
        const conv = items.find(c => c.id === conversationId);
        if (conv) {
          setActiveConversation(conv);
          const { lines } = await loadChatMessages(supabase, conv.id, profile.id);
          setChatMessages(lines);
        }
        nav('messages');
      }
    }
    notify(`Postulación ${applicationStatusLabel(nextStatus)}`);
  }

  async function withdrawApplication(id: string) {
    if (demo) {
      setApplications(v => v.map(a => a.id === id ? { ...a, status: 'withdrawn' } : a));
      notify('Postulación retirada');
      return;
    }
    if (!isSupabaseConfigured()) { notify('No pudimos conectar con la base de datos.'); return; }
    const supabase = createClient();
    if (!supabase) { notify('No pudimos conectar con la base de datos.'); return; }
    const { error } = await withdrawApplicationRpc(supabase, id);
    if (error) { notify(error.message); return; }
    setApplications(v => v.map(a => a.id === id ? { ...a, status: 'withdrawn' } : a));
    notify('Postulación retirada');
  }

  const CAMPAIGN_TRANSITION_LABELS: Record<CampaignTransition, string> = {
    pause: 'pausada',
    reopen: 'reabierta',
    cancel: 'cancelada',
    complete: 'completada',
  };

  async function handleCampaignTransition(campaignId: string, action: CampaignTransition) {
    const demoNext: Record<CampaignTransition, Campaign['status']> = {
      pause: 'paused',
      reopen: 'open',
      cancel: 'cancelled',
      complete: 'completed',
    };

    if (demo) {
      setCampaigns(v => v.map(c => c.id === campaignId ? { ...c, status: demoNext[action] } : c));
      notify(`Campaña ${CAMPAIGN_TRANSITION_LABELS[action]}`);
      return;
    }
    if (!isSupabaseConfigured()) { notify('No pudimos conectar con la base de datos.'); return; }
    const supabase = createClient();
    if (!supabase) { notify('No pudimos conectar con la base de datos.'); return; }
    const { nextStatus, error } = await transitionCampaign(supabase, campaignId, action);
    if (error) { notify(error.message); return; }
    setCampaigns(v => v.map(c => c.id === campaignId ? { ...c, status: nextStatus } : c));
    notify(`Campaña ${CAMPAIGN_TRANSITION_LABELS[action]}`);
  }

  async function removeFavoriteCreator(creatorId: string) {
    const favoriteId = favoriteByCreatorId[creatorId];
    if (demo) {
      setFavoriteCreators(v => v.filter(c => c.id !== creatorId));
      setFavoriteByCreatorId(v => { const next = { ...v }; delete next[creatorId]; return next; });
      notify('Creador quitado de favoritos');
      return;
    }
    if (!favoriteId || !isSupabaseConfigured()) { notify('No pudimos quitar el favorito.'); return; }
    const supabase = createClient();
    if (!supabase) { notify('No pudimos conectar con la base de datos.'); return; }
    const { error } = await removeFavorite(supabase, favoriteId);
    if (error) { notify(error.message); return; }
    setFavoriteCreators(v => v.filter(c => c.id !== creatorId));
    setFavoriteByCreatorId(v => { const next = { ...v }; delete next[creatorId]; return next; });
    notify('Creador quitado de favoritos');
  }

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reviewTarget || !profile) return;
    const form = event.currentTarget;
    const f = new FormData(form);
    const rating = Number(f.get('rating'));
    const comment = String(f.get('comment') || '').trim();

    if (demo) {
      setReviewedCampaigns(v => new Set([...v, reviewTarget.campaignId]));
      setReviewTarget(null);
      notify('Reseña publicada');
      return;
    }
    if (!isSupabaseConfigured()) { notify('No pudimos conectar con la base de datos.'); return; }
    const supabase = createClient();
    if (!supabase) { notify('No pudimos conectar con la base de datos.'); return; }
    const { error } = await insertReview(supabase, {
      campaignId: reviewTarget.campaignId,
      reviewerProfileId: profile.id,
      reviewedProfileId: reviewTarget.creatorProfileId,
      rating,
      comment: comment || undefined,
    });
    if (error) { notify(error.code === '23505' ? 'Ya dejaste una reseña para esta campaña.' : error.message); return; }
    setReviewedCampaigns(v => new Set([...v, reviewTarget.campaignId]));
    setReviewTarget(null);
    form.reset();
    notify('Reseña publicada');
  }

  function acceptedCreatorForCampaign(campaignId: string) {
    const app = applications.find(a => a.campaignId === campaignId && a.status === 'accepted');
    if (!app?.creatorProfileId) return null;
    return { creatorProfileId: app.creatorProfileId, creatorName: app.creatorName };
  }

  async function saveProfile(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); const f = new FormData(event.currentTarget);
    const changes = { name:String(f.get('name')), username:String(f.get('username')), city:String(f.get('city')), bio:String(f.get('bio')), businessName:String(f.get('businessName')||'') };
    if (demo) {
      setProfile(p=>p?{...p,...changes}:p); notify('Perfil actualizado');
      return;
    }
    if (!isSupabaseConfigured() || !profile) { notify('No pudimos conectar con la base de datos.'); return; }
    const supabase=createClient();
    if (!supabase) { notify('No pudimos conectar con la base de datos.'); return; }
    const { error }=await supabase.from('profiles').update({full_name:changes.name,username:changes.username,city:changes.city,bio:changes.bio}).eq('id',profile.id);
    if(error){notify(error.message);return;}
    if(isBusiness && changes.businessName) {
      const { error: bizErr } = await supabase.from('business_profiles').upsert({profile_id:profile.id,business_name:changes.businessName},{onConflict:'profile_id'});
      if (bizErr) { notify(bizErr.message); return; }
    }
    setProfile(p=>p?{...p,...changes}:p); notify('Perfil actualizado');
  }

  async function sendMessage(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const f = new FormData(form);
    const text = String(f.get('message')).trim();
    if (!text || !activeConversation || !profile) return;

    if (demo) {
      setChatMessages(v => [...v, { id: crypto.randomUUID(), mine: true, text, time: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) }]);
      form?.reset();
      return;
    }

    if (!isSupabaseConfigured()) { notify('No pudimos conectar con la base de datos.'); return; }
    const supabase = createClient();
    if (!supabase) { notify('No pudimos conectar con la base de datos.'); return; }
    const { data, error } = await postChatMessage(supabase, activeConversation.id, profile.id, text);
    if (error) { notify(error.message); return; }
    if (!data) { notify('No pudimos enviar el mensaje.'); return; }
    setChatMessages(v => appendChatMessage(v, mapMessageRow(data, profile.id)));
    form?.reset();
  }

  if (loading) return <div className="fullLoader"><Logo/><div className="loaderRing"/><p>Cargando tu espacio...</p></div>;
  if (!profile) return <div className="fullLoader"><p>No pudimos cargar tu perfil.</p><Link className="primaryBtn" href="/login">Volver a ingresar</Link></div>;

  const menu:[Tab,string,any][] = [
    ['overview','Resumen',LayoutDashboard],['campaigns',isBusiness?'Mis campañas':'Campañas',BriefcaseBusiness],['applications','Postulaciones',FileText],['messages','Mensajes',MessageCircle],['favorites','Favoritos',Heart],['profile','Mi perfil',Settings]
  ];

  return <div className="dashboardApp">
    <aside className={sidebar?'dashSidebar open':'dashSidebar'}>
      <div className="dashLogo"><Logo/><button onClick={()=>setSidebar(false)}><X/></button></div>
      <nav>{menu.map(([key,label,Icon])=><button key={key} className={tab===key?'active':''} onClick={()=>nav(key)}><Icon size={19}/><span>{label}</span>{key==='messages'&&unreadMessages>0&&<b>{unreadMessages}</b>}</button>)}</nav>
      <div className="sidebarPromo"><Sparkles/><strong>Mejorá tu perfil</strong><p>Completá tus datos para recibir mejores oportunidades.</p><button onClick={()=>nav('profile')}>Completar ahora</button></div>
      <button className="logoutBtn" onClick={logout}><LogOut size={18}/> Cerrar sesión</button>
    </aside>
    <div className="dashMain">
      <header className="dashHeader">
        <button className="dashMenu" onClick={()=>setSidebar(true)}><Menu/></button>
        <div><h1>{menu.find(x=>x[0]===tab)?.[1]}</h1><p>{isBusiness?'Gestioná tu presencia y tus colaboraciones.':'Encontrá oportunidades y hacé crecer tu perfil.'}</p></div>
        <div className="dashHeaderActions"><Link href="/" className="iconButton" title="Volver al sitio"><ArrowLeft size={18}/></Link>{profile.accountId && <NotificationPanel accountId={profile.accountId} demo={demo} onError={notify} />}<button className="accountPill" onClick={()=>nav('profile')}><span>{profile.name.split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase()}</span><p><strong>{profile.name}</strong><small>{isBusiness?'Negocio':'Creador'}</small></p></button></div>
      </header>

      <div className="dashContent">
        {tab==='overview'&&<>
          <div className="welcomeCard"><div><span className="eyebrow"><Sparkles size={14}/> Tu actividad en KUVO</span><h2>Hola, {profile.name.split(' ')[0]}.</h2><p>{isBusiness?'Gestioná campañas y postulaciones desde tu panel privado.':'Explorá oportunidades y seguí el estado de tus postulaciones.'}</p><button className="primaryBtn" onClick={()=>isBusiness?setCampaignModal(true):nav('campaigns')}>{isBusiness?<><Plus size={18}/> Nueva campaña</>:<>Explorar campañas <ChevronRight size={18}/></>}</button></div><div className="welcomeVisual"><Target size={78}/><span>{applications.length}</span><small>{isBusiness?'postulaciones':'movimientos'}</small></div></div>
          <div className="metricGrid">{metrics.map(({label,value,change,icon:Icon})=><article key={label}><span><Icon/></span><p>{label}</p><strong>{value}</strong><small>{change}</small></article>)}</div>
          <div className="dashboardColumns"><section className="dashPanel"><div className="panelTitle"><div><h3>{isBusiness?'Campañas recientes':'Oportunidades para vos'}</h3><p>Actividad actual de la cuenta</p></div><button onClick={()=>nav('campaigns')}>Ver todas</button></div><div className="compactCampaigns">{campaigns.slice(0,4).map(c=><button key={c.id} onClick={()=>nav('campaigns')}><span style={{background:`linear-gradient(135deg,${c.gradient[0]},${c.gradient[1]})`}}>{c.businessName.slice(0,2).toUpperCase()}</span><p><strong>{c.title}</strong><small>{c.category} · {c.city}</small></p><i className={`status ${c.status}`}>{campaignStatusLabel(c.status)}</i><b>{money.format(c.budgetMax)}</b><ChevronRight/></button>)}</div></section><section className="dashPanel"><div className="panelTitle"><div><h3>Resumen</h3><p>Datos de tu cuenta</p></div></div><div className="chartSummary"><div><strong>{applications.filter(a=>a.status==='accepted').length}</strong><span>Aceptadas</span></div><div><strong>{applications.filter(a=>a.status==='pending').length}</strong><span>Pendientes</span></div><div><strong>{campaigns.filter(c=>c.status==='open').length}</strong><span>Campañas abiertas</span></div></div></section></div>
        </>}

        {tab==='campaigns'&&<><div className="contentToolbar"><label><Search/><input placeholder="Buscar campañas" value={campaignSearch} onChange={e=>setCampaignSearch(e.target.value)}/></label><select value={campaignStatusFilter} onChange={e=>setCampaignStatusFilter(e.target.value)} aria-label="Estado"><option value="all">Todas</option><option value="open">Activas</option><option value="in_progress">En curso</option><option value="paused">Pausadas</option><option value="completed">Completadas</option></select>{isBusiness&&<button className="primaryBtn" onClick={()=>setCampaignModal(true)}><Plus/> Nueva campaña</button>}</div><div className="dashCampaignGrid">{filteredCampaigns.map(c=>{const reviewTargetCreator=acceptedCreatorForCampaign(c.id);return <article key={c.id}><div className="dashCampaignTop"><span style={{background:`linear-gradient(135deg,${c.gradient[0]},${c.gradient[1]})`}}>{c.businessName.slice(0,2).toUpperCase()}</span><i className={`status ${c.status}`}>{campaignStatusLabel(c.status)}</i></div><small>{c.businessName}</small><h3>{c.title}</h3><p>{c.description}</p><div className="tagRow"><span>{c.category}</span><span>{c.city}</span></div><div className="campaignNumbers"><div><span>Presupuesto</span><strong>{money.format(c.budgetMax)}</strong></div><div><span>Postulantes</span><strong>{c.applicants ?? applications.filter(a=>a.campaignId===c.id).length}</strong></div></div>{isBusiness&&<div className="rowActions">{businessCanPause(c.status)&&<button type="button" title="Pausar" onClick={()=>void handleCampaignTransition(c.id,'pause')}><Clock3/></button>}{businessCanReopen(c.status)&&<button type="button" title="Reabrir" onClick={()=>void handleCampaignTransition(c.id,'reopen')}><ChevronRight/></button>}{businessCanComplete(c.status)&&<button type="button" title="Completar" onClick={()=>void handleCampaignTransition(c.id,'complete')}><CheckCircle2/></button>}{businessCanCancel(c.status)&&<button type="button" title="Cancelar" onClick={()=>void handleCampaignTransition(c.id,'cancel')}><X/></button>}</div>}<button className="ghostBtn full" onClick={()=>isBusiness?nav('applications'):setApplyCampaign(c)}>{isBusiness?'Ver postulaciones':'Postularme'}<ChevronRight/></button>{isBusiness&&c.status==='completed'&&reviewTargetCreator&&!reviewedCampaigns.has(c.id)&&<button type="button" className="ghostBtn full" onClick={()=>setReviewTarget({ campaignId:c.id, creatorProfileId:reviewTargetCreator.creatorProfileId, creatorName:reviewTargetCreator.creatorName })}>Dejar reseña a {reviewTargetCreator.creatorName}<ChevronRight/></button>}</article>;})}</div></>}

        {tab==='applications'&&<section className="dashPanel applicationPanel"><div className="panelTitle"><div><h3>{isBusiness?'Postulaciones recibidas':'Mis postulaciones'}</h3><p>{applications.length} movimientos registrados</p></div></div><div className="applicationTable"><div className="tableHead"><span>{isBusiness?'Creador':'Campaña'}</span><span>Propuesta</span><span>Estado</span><span>Fecha</span><span>Acciones</span></div>{applications.map(a=><div className="tableRow" key={a.id}><div className="applicationPerson"><span>{(isBusiness?a.creatorName:a.campaignTitle).split(' ').map(x=>x[0]).slice(0,2).join('')}</span><p><strong>{isBusiness?a.creatorName:a.campaignTitle}</strong><small>{isBusiness?a.campaignTitle:a.message}</small></p></div><strong>{money.format(a.proposedPrice)}</strong><i className={`status ${a.status}`}>{applicationStatusLabel(a.status)}</i><span>{new Date(a.createdAt).toLocaleDateString('es-AR')}</span><div className="rowActions">{isBusiness&&businessCanShortlist(a.status)&&<button title="Preseleccionar" onClick={()=>updateApplication(a.id,'shortlisted')}><BadgeCheck/></button>}{isBusiness&&businessCanAccept(a.status)&&<button title="Aceptar" onClick={()=>updateApplication(a.id,'accepted')}><Check/></button>}{isBusiness&&businessCanReject(a.status)&&<button title="Rechazar" onClick={()=>updateApplication(a.id,'rejected')}><X/></button>}{!isBusiness&&creatorCanWithdraw(a.status)&&<button title="Retirar" onClick={()=>void withdrawApplication(a.id)}><X/></button>}{a.status==='accepted'&&<button title="Mensaje" onClick={()=>nav('messages')}><MessageCircle/></button>}</div></div>)}</div></section>}

        {tab==='messages'&&<div className={`messagesLayout${activeConversation ? ' messagesLayout--chatOpen' : ''}`}><aside className="conversationList">{conversations.length===0&&<p className="emptyInline">Todavía no tenés conversaciones.</p>}{conversations.map(m=><button key={m.id} type="button" className={activeConversation?.id===m.id?'active':''} onClick={()=>void openConversation(m)}><span>{m.initials}</span><p><strong>{m.title}</strong><small>{m.preview}</small></p><time>{m.time}</time>{m.unread>0&&<b>{m.unread}</b>}</button>)}</aside><section className="chatPanel">{activeConversation?(<><header><button type="button" className="chatBackBtn" aria-label="Volver a conversaciones" onClick={()=>setActiveConversation(null)}><ArrowLeft size={18}/></button><span>{activeConversation.initials}</span><p><strong>{activeConversation.title}</strong><small>Campaña vinculada</small></p></header><div className="chatBody">{messagesLoading&&<p className="loadingLine"/>}{chatMessages.map(m=><div key={m.id} className={m.mine?'mine':''}><p>{m.text}</p><time>{m.time}</time></div>)}</div><form onSubmit={sendMessage}><input name="message" placeholder="Escribí un mensaje..." autoComplete="off"/><button type="submit"><Send/></button></form></>):(<div className="emptyState compact"><MessageCircle/><p>Elegí una conversación de la lista.</p></div>)}</section></div>}

        {tab==='favorites'&&<><div className="sectionHeading compact"><h2>Creadores guardados</h2><p>Tu selección personal para futuras campañas.</p></div>{favoriteCreators.length===0?(<div className="emptyState"><Heart/><h3>Sin favoritos todavía</h3><p>Guardá creadores desde el marketplace para verlos acá.</p><Link href="/explorar" className="primaryBtn">Explorar creadores</Link></div>):(<div className="creatorGrid inDashboard">{favoriteCreators.map(c=><article className="creatorCard" key={c.id}><div className="creatorCover" style={{background:`linear-gradient(135deg,${c.gradient[0]},${c.gradient[1]})`}}><span>{c.category}</span><button type="button" onClick={()=>void removeFavoriteCreator(c.id)} aria-label="Quitar de favoritos"><Heart fill="currentColor" size={19}/></button></div><div className="creatorContent"><div className="creatorAvatar" style={{background:`linear-gradient(135deg,${c.gradient[1]},${c.gradient[0]})`}}>{c.initials}</div><div className="creatorName"><h3>{c.name}</h3>{c.verified&&<BadgeCheck/>}</div><p className="creatorHandle">{c.username} · {c.city}</p><div className="cardFooter"><p><span>Desde</span><strong>{money.format(c.startingPrice)}</strong></p><Link href={`/creadores/${c.username.replace(/^@/,'')}`} className="smallBtn">Ver perfil público</Link></div></div></article>)}</div>)}</>}

        {tab==='profile'&&<div className="profileSettings"><section className="dashPanel"><div className="profileBanner"><div>{profile.name.split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase()}</div></div><form onSubmit={saveProfile} className="settingsForm"><div className="formGrid"><label>Nombre completo<input name="name" defaultValue={profile.name} required/></label><label>Nombre de usuario<input name="username" defaultValue={profile.username}/></label>{isBusiness&&<label>Nombre del negocio<input name="businessName" defaultValue={profile.businessName}/></label>}<label>Ciudad<input name="city" defaultValue={profile.city}/></label><label className="span2">Descripción<textarea name="bio" defaultValue={profile.bio} rows={5}/></label></div><div className="settingsActions"><button type="submit" className="primaryBtn">Guardar cambios</button></div></form></section><aside className="dashPanel profileScore"><Activity/><strong>{profileScoreLabel}</strong><h3>{isBusiness?'Perfil completado':'KUVO Score'}</h3><p>{isBusiness?'Completá nombre, usuario, ciudad, bio y datos del negocio.':'Tu score se calcula con datos reales de perfil, campañas y reseñas.'}</p>{isBusiness&&<div><i style={{width:`${profileCompletionPct}%`}}/></div>}<ul><li><Check/> Información principal</li><li><Check/> Correo verificado</li><li>{profile?.creatorScore != null || profileCompletionPct >= 80 ? <Check/> : <Clock3/>} {isBusiness ? 'Perfil comercial completo' : 'Score disponible en perfil'}</li></ul></aside></div>}
      </div>
    </div>

    {applyCampaign&&<div className="modalBackdrop"><section className="campaignCreateModal"><button className="modalClose" onClick={()=>setApplyCampaign(null)}><X/></button><span className="eyebrow"><FileText size={15}/> Nueva postulación</span><h2>{applyCampaign.title}</h2><p>{applyCampaign.businessName} · {applyCampaign.city}. Presupuesto publicado: {money.format(applyCampaign.budgetMin)} – {money.format(applyCampaign.budgetMax)}.</p><form onSubmit={submitApplication} className="campaignForm"><label>Tu propuesta<textarea name="message" required minLength={10} rows={5} placeholder="Explicá tu idea, experiencia y entregables..."/></label><label>Precio propuesto<input name="proposedPrice" type="number" min="0" required defaultValue={applyCampaign.budgetMin}/></label><button className="primaryBtn full">Enviar postulación <Send/></button></form></section></div>}
    {campaignModal&&<div className="modalBackdrop"><section className="campaignCreateModal"><button className="modalClose" onClick={()=>setCampaignModal(false)}><X/></button><span className="eyebrow"><BriefcaseBusiness size={15}/> Nueva oportunidad</span><h2>Publicar campaña</h2><p>Definí lo esencial. Después podés gestionar propuestas y estados desde el panel.</p><form onSubmit={createCampaign} className="campaignForm"><label>Título<input name="title" required placeholder="Ej. Lanzamiento colección invierno"/></label><label>Descripción<textarea name="description" required rows={4} placeholder="Contá qué buscás y cuál es el objetivo..."/></label><div className="formGrid"><label>Categoría<select name="category"><option>Gastronomía</option><option>Moda</option><option>Belleza</option><option>Tecnología</option><option>Fitness</option><option>Viajes</option><option>Gaming</option><option>Lifestyle</option></select></label><label>Ciudad<input name="city" required defaultValue="San Juan"/></label><label>Presupuesto mínimo<input name="budgetMin" type="number" min="0" required defaultValue="80000"/></label><label>Presupuesto máximo<input name="budgetMax" type="number" min="0" required defaultValue="150000"/></label><label>Fecha límite<input name="deadline" type="date" required/></label><label>Entregables<input name="deliverables" required placeholder="1 reel, 3 historias"/></label></div><button className="primaryBtn full">Publicar campaña <ChevronRight/></button></form></section></div>}
    {reviewTarget&&<div className="modalBackdrop"><section className="campaignCreateModal"><button className="modalClose" onClick={()=>setReviewTarget(null)}><X/></button><span className="eyebrow"><Sparkles size={15}/> Reseña</span><h2>Calificá a {reviewTarget.creatorName}</h2><p>Tu reseña queda vinculada a la campaña completada y ayuda a construir reputación real en KUVO.</p><form onSubmit={submitReview} className="campaignForm"><label>Calificación<select name="rating" required defaultValue="5"><option value="5">5 — Excelente</option><option value="4">4 — Muy bueno</option><option value="3">3 — Bueno</option><option value="2">2 — Regular</option><option value="1">1 — Malo</option></select></label><label>Comentario<textarea name="comment" rows={4} placeholder="Contá cómo fue la colaboración..." maxLength={1500}/></label><button className="primaryBtn full">Publicar reseña <ChevronRight/></button></form></section></div>}
    {toast&&<div className="toast"><Check/>{toast}</div>}
  </div>;
}
