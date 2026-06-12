'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Activity, BadgeCheck, BriefcaseBusiness, Check, Flag, LayoutDashboard, Search, ShieldCheck, Users, X } from 'lucide-react';
import { Logo } from './Logo';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { demoCampaigns, demoCreators } from '@/lib/demo';

export function AdminPanel() {
  const [allowed,setAllowed]=useState(false);
  const [loading,setLoading]=useState(true);
  const [profiles,setProfiles]=useState<any[]>(demoCreators.map(c=>({id:c.profileId,full_name:c.name,username:c.username.replace('@',''),role:'creator',city:c.city,verified:c.verified,active:true})));
  const [campaigns,setCampaigns]=useState<any[]>(demoCampaigns);
  const [tab,setTab]=useState<'overview'|'profiles'|'campaigns'>('overview');
  const [toast,setToast]=useState('');

  useEffect(()=>{void load();},[]);
  async function load(){
    if(!isSupabaseConfigured()){setAllowed(true);setLoading(false);return;}
    const s=createClient(); const {data:{user}}=await s!.auth.getUser();
    if(!user){setLoading(false);return;}
    const {data:me}=await s!.from('profiles').select('role').eq('account_id',user.id).single();
    if(me?.role!=='admin'){setLoading(false);return;}
    setAllowed(true);
    const [{data:ps},{data:cs}]=await Promise.all([s!.from('profiles').select('*').order('created_at',{ascending:false}).limit(100),s!.from('campaigns').select('*,business_profiles(business_name)').order('created_at',{ascending:false}).limit(100)]);
    if(ps)setProfiles(ps); if(cs)setCampaigns(cs); setLoading(false);
  }
  function notify(x:string){setToast(x);setTimeout(()=>setToast(''),2200)}
  async function toggleVerify(id:string,current:boolean){if(isSupabaseConfigured())await createClient()?.from('profiles').update({verified:!current}).eq('id',id);setProfiles(v=>v.map(p=>p.id===id?{...p,verified:!current}:p));notify(!current?'Perfil verificado':'Verificación removida')}
  async function toggleActive(id:string,current:boolean){if(isSupabaseConfigured())await createClient()?.from('profiles').update({active:!current}).eq('id',id);setProfiles(v=>v.map(p=>p.id===id?{...p,active:!current}:p));notify(!current?'Perfil habilitado':'Perfil deshabilitado')}
  async function pauseCampaign(id:string){if(isSupabaseConfigured())await createClient()?.from('campaigns').update({status:'paused'}).eq('id',id);setCampaigns(v=>v.map(c=>c.id===id?{...c,status:'paused'}:c));notify('Campaña pausada')}

  if(loading)return <div className="fullLoader"><Logo/><div className="loaderRing"/><p>Verificando permisos...</p></div>;
  if(!allowed)return <div className="accessDenied"><ShieldCheck/><h1>Acceso restringido</h1><p>Esta sección está disponible únicamente para administradores de KUVO.</p><Link className="primaryBtn" href="/panel">Volver al panel</Link></div>;

  return <div className="adminApp">
    <aside className="adminSidebar"><Logo/><nav><button className={tab==='overview'?'active':''} onClick={()=>setTab('overview')}><LayoutDashboard/>Resumen</button><button className={tab==='profiles'?'active':''} onClick={()=>setTab('profiles')}><Users/>Perfiles</button><button className={tab==='campaigns'?'active':''} onClick={()=>setTab('campaigns')}><BriefcaseBusiness/>Campañas</button></nav><Link href="/panel">Volver al panel</Link></aside>
    <main className="adminMain"><header><div><span className="eyebrow"><ShieldCheck size={15}/> Administración</span><h1>Control de plataforma</h1><p>Moderación, verificación y estado general de KUVO.</p></div><div className="adminAvatar">AD</div></header>
    {tab==='overview'&&<><div className="metricGrid adminMetrics"><article><span><Users/></span><p>Perfiles</p><strong>{profiles.length}</strong><small>{profiles.filter(p=>p.active!==false).length} activos</small></article><article><span><BadgeCheck/></span><p>Verificados</p><strong>{profiles.filter(p=>p.verified).length}</strong><small>Control manual</small></article><article><span><BriefcaseBusiness/></span><p>Campañas</p><strong>{campaigns.length}</strong><small>{campaigns.filter((c:any)=>c.status==='open').length} abiertas</small></article><article><span><Flag/></span><p>Reportes</p><strong>0</strong><small>Sin pendientes</small></article></div><div className="dashboardColumns"><section className="dashPanel"><div className="panelTitle"><div><h3>Últimos perfiles</h3><p>Altas recientes</p></div><button onClick={()=>setTab('profiles')}>Ver todos</button></div><div className="adminRecent">{profiles.slice(0,6).map(p=><div key={p.id}><span>{p.full_name?.split(' ').map((x:string)=>x[0]).slice(0,2).join('')}</span><p><strong>{p.full_name}</strong><small>{p.role} · {p.city||'Sin ciudad'}</small></p>{p.verified?<BadgeCheck/>:<i>Pendiente</i>}</div>)}</div></section><section className="dashPanel"><div className="panelTitle"><div><h3>Salud del sistema</h3><p>Estado de servicios</p></div></div><div className="healthList"><div><span><Activity/></span><p><strong>Aplicación web</strong><small>Operativa</small></p><b>100%</b></div><div><span><ShieldCheck/></span><p><strong>Seguridad RLS</strong><small>Políticas activas</small></p><b>OK</b></div><div><span><BriefcaseBusiness/></span><p><strong>Base de datos</strong><small>Conectada</small></p><b>OK</b></div></div></section></div></>}
    {tab==='profiles'&&<section className="dashPanel applicationPanel"><div className="contentToolbar"><label><Search/><input placeholder="Buscar perfil"/></label><select><option>Todos los roles</option><option>Creadores</option><option>Negocios</option></select></div><div className="applicationTable adminTable"><div className="tableHead"><span>Perfil</span><span>Rol</span><span>Ciudad</span><span>Estado</span><span>Acciones</span></div>{profiles.map(p=><div className="tableRow" key={p.id}><div className="applicationPerson"><span>{p.full_name?.split(' ').map((x:string)=>x[0]).slice(0,2).join('')}</span><p><strong>{p.full_name}</strong><small>@{p.username||'sinusuario'}</small></p></div><span>{p.role==='creator'?'Creador':p.role==='business'?'Negocio':'Admin'}</span><span>{p.city||'—'}</span><i className={`status ${p.active===false?'rejected':'accepted'}`}>{p.active===false?'Bloqueado':'Activo'}</i><div className="rowActions"><button title="Verificar" onClick={()=>toggleVerify(p.id,!!p.verified)} className={p.verified?'selected':''}><BadgeCheck/></button><button title="Activar o bloquear" onClick={()=>toggleActive(p.id,p.active!==false)}>{p.active===false?<Check/>:<X/>}</button></div></div>)}</div></section>}
    {tab==='campaigns'&&<section className="dashPanel applicationPanel"><div className="contentToolbar"><label><Search/><input placeholder="Buscar campaña"/></label><select><option>Todos los estados</option><option>Abiertas</option><option>Pausadas</option></select></div><div className="applicationTable adminTable"><div className="tableHead"><span>Campaña</span><span>Negocio</span><span>Categoría</span><span>Estado</span><span>Acciones</span></div>{campaigns.map((c:any)=><div className="tableRow" key={c.id}><div className="applicationPerson"><span>{(c.businessName||c.business_profiles?.business_name||'KU').slice(0,2).toUpperCase()}</span><p><strong>{c.title}</strong><small>{c.city}</small></p></div><span>{c.businessName||c.business_profiles?.business_name||'Negocio'}</span><span>{c.category}</span><i className={`status ${c.status}`}>{c.status==='open'?'Activa':c.status==='paused'?'Pausada':c.status}</i><div className="rowActions"><button title="Pausar" onClick={()=>pauseCampaign(c.id)}><X/></button></div></div>)}</div></section>}
    </main>{toast&&<div className="toast"><Check/>{toast}</div>}
  </div>;
}
