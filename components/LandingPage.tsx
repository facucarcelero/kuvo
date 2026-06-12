'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight, BadgeCheck, BarChart3, BriefcaseBusiness, Check, ChevronRight,
  Heart, Lock, Menu, MessageCircle, Moon, ShieldCheck, Sparkles, Sun, Target,
  UserCog, Users, X, Zap
} from 'lucide-react';
import { Logo } from './Logo';
import { isSupabaseConfigured } from '@/lib/supabase/client';

const features = [
  { icon: BriefcaseBusiness, title: 'Campañas propias', text: 'Los negocios publican, editan y cierran campañas con presupuesto, entregables y fechas desde su panel.' },
  { icon: Users, title: 'Postulaciones y estados', text: 'Cada propuesta queda registrada: pendiente, preseleccionada, aceptada o rechazada. Solo ven las partes involucradas.' },
  { icon: MessageCircle, title: 'Mensajería integrada', text: 'Conversaciones vinculadas a campañas, sin depender de WhatsApp o correos sueltos.' },
  { icon: Heart, title: 'Favoritos y seguimiento', text: 'Guardá perfiles, seguí oportunidades y retomá colaboraciones desde un solo lugar.' },
  { icon: BarChart3, title: 'KUVO Score y reputación', text: 'Métricas, reseñas y score visible para decidir con datos, no solo con intuición.' },
  { icon: UserCog, title: 'Panel por rol', text: 'Negocio, creador o administrador: cada uno entra a su espacio con la información que le corresponde.' },
];

const roles = [
  {
    tag: 'Negocio',
    title: 'Publicá y gestioná campañas',
    points: ['Creá campañas con presupuesto y entregables', 'Revisá postulaciones en tiempo real', 'Mensajes y acuerdos centralizados'],
    href: '/registro',
    cta: 'Registrar mi negocio',
  },
  {
    tag: 'Creador',
    title: 'Postulate y construí reputación',
    points: ['Perfil con portfolio y métricas', 'Postulaciones a campañas abiertas', 'Historial privado de colaboraciones'],
    href: '/registro',
    cta: 'Crear perfil de creador',
  },
  {
    tag: 'Administrador',
    title: 'Moderación y verificación',
    points: ['Verificación de perfiles', 'Supervisión de campañas y usuarios', 'Panel exclusivo en /admin'],
    href: '/login',
    cta: 'Acceder al panel admin',
  },
];

export function LandingPage() {
  const [dark, setDark] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const live = isSupabaseConfigured();

  useEffect(() => {
    const savedTheme = localStorage.getItem('kuvo_theme');
    if (savedTheme === 'light') {
      setDark(false);
      document.documentElement.dataset.theme = 'light';
    }
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? 'dark' : 'light';
    localStorage.setItem('kuvo_theme', next ? 'dark' : 'light');
  }

  return (
    <main>
      <header className="siteHeader">
        <div className="headerInner">
          <Logo />
          <nav className={mobileOpen ? 'mainNav open' : 'mainNav'}>
            <a href="#plataforma" onClick={() => setMobileOpen(false)}>Plataforma</a>
            <a href="#privacidad" onClick={() => setMobileOpen(false)}>Privacidad</a>
            <Link href="/explorar" onClick={() => setMobileOpen(false)}>Explorar</Link>
            <a href="#como-funciona" onClick={() => setMobileOpen(false)}>Cómo funciona</a>
          </nav>
          <div className="headerActions">
            <button className="iconButton" onClick={toggleTheme} aria-label="Cambiar tema">{dark ? <Sun size={18}/> : <Moon size={18}/>}</button>
            <Link className="ghostBtn headerLogin" href="/login">Ingresar</Link>
            <Link className="primaryBtn headerRegister" href="/registro">Registrarse</Link>
            <button className="mobileMenu" onClick={() => setMobileOpen(v => !v)} aria-label="Abrir menú">{mobileOpen ? <X/> : <Menu/>}</button>
          </div>
        </div>
      </header>

      <section className="heroSection">
        <div className="heroGlow one"/><div className="heroGlow two"/>
        <div className="container heroGrid">
          <div className="heroCopy">
            <span className="eyebrow">
              <span className="liveDot"/> {live ? 'Sistema conectado a Supabase' : 'Plataforma completa · modo demostración'}
            </span>
            <h1>Más que un directorio: <em>tu sistema</em> para colaboraciones.</h1>
            <p>KUVO reúne marketplace, paneles privados, campañas, postulaciones, mensajes y reputación en una sola plataforma. Cada usuario ve únicamente lo suyo.</p>
            <div className="heroButtons">
              <Link className="primaryBtn large" href="/registro">Empezar gratis <ArrowRight size={19}/></Link>
              <Link className="ghostBtn large" href="/explorar">Explorar creadores y campañas</Link>
            </div>
            <div className="trustRow">
              <span><Check/> Cuentas con rol propio</span>
              <span><Check/> Datos protegidos por usuario</span>
              <span><Check/> Panel, mensajes y campañas integrados</span>
            </div>
          </div>
          <div className="heroPreview" aria-label="Vista del sistema KUVO">
            <div className="previewTop"><span/><span/><span/><b>Tu panel privado</b></div>
            <div className="previewStats">
              <div><span>Campo visible solo para vos</span><strong>Panel</strong><small><Lock size={13}/> Acceso por rol</small></div>
              <div><span>Información compartida</span><strong>Marketplace</strong><small>Perfiles y campañas públicas</small></div>
            </div>
            <div className="systemPreviewList">
              <div><Lock size={16}/><p><b>Mis postulaciones</b><small>Solo el creador y el negocio de la campaña</small></p></div>
              <div><Lock size={16}/><p><b>Mis mensajes</b><small>Conversaciones privadas entre partes</small></p></div>
              <div><Users size={16}/><p><b>Catálogo público</b><small>Creadores y campañas abiertas para todos</small></p></div>
            </div>
          </div>
        </div>
      </section>

      <section className="statsBand">
        <div className="container statsGrid">
          <div><strong>1</strong><span>plataforma unificada</span></div>
          <div><strong>3</strong><span>roles con panel propio</span></div>
          <div><strong>RLS</strong><span>privacidad en base de datos</span></div>
          <div><strong>100%</strong><span>responsive</span></div>
        </div>
      </section>

      <section id="plataforma" className="platformSection">
        <div className="container">
          <div className="sectionHeading centered">
            <span className="eyebrow"><Sparkles size={15}/> Sistema propio</span>
            <h2>Todo conectado, nada suelto</h2>
            <p>No es solo una lista de perfiles. KUVO ya incluye registro, autenticación, paneles, campañas, postulaciones, favoritos, mensajes y moderación.</p>
          </div>
          <div className="featuresGrid">
            {features.map(f => (
              <article key={f.title}>
                <f.icon size={22}/>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="rolesSection container">
        <div className="sectionHeading centered">
          <span className="eyebrow"><Users size={15}/> Cada uno ve lo suyo</span>
          <h2>Tres roles, tres experiencias privadas</h2>
          <p>Al registrarte elegís si sos negocio o creador. El administrador modera por fuera del flujo público.</p>
        </div>
        <div className="rolesGrid">
          {roles.map(r => (
            <article key={r.tag}>
              <span className="roleTag">{r.tag}</span>
              <h3>{r.title}</h3>
              <ul>{r.points.map(p => <li key={p}><Check size={15}/>{p}</li>)}</ul>
              <Link className="smallBtn" href={r.href}>{r.cta} <ChevronRight size={16}/></Link>
            </article>
          ))}
        </div>
      </section>

      <section id="privacidad" className="securitySection container">
        <div className="securityCard">
          <div>
            <span className="eyebrow"><ShieldCheck size={15}/> Privacidad real</span>
            <h2>Tu información no es visible para otros usuarios.</h2>
            <p>KUVO separa lo público de lo privado. El marketplace muestra perfiles y campañas abiertas; el resto —postulaciones, mensajes, favoritos y panel— queda restringido a quien corresponde.</p>
            <ul>
              <li><Check/> Row Level Security en Supabase: cada cuenta accede solo a sus datos</li>
              <li><Check/> Negocios ven sus campañas y postulaciones recibidas</li>
              <li><Check/> Creadores ven sus propuestas, favoritos y conversaciones</li>
              <li><Check/> Administradores acceden solo desde /admin con rol asignado</li>
            </ul>
          </div>
          <div className="securityVisual"><Lock size={72}/><strong>Privado</strong><span>Por usuario y por rol</span></div>
        </div>
      </section>

      <section id="como-funciona" className="howSection">
        <div className="container">
          <div className="sectionHeading centered">
            <span className="eyebrow"><Zap size={15}/> Flujo completo</span>
            <h2>De la landing a la colaboración cerrada</h2>
            <p>Un recorrido pensado para que nada quede en chats externos ni planillas sueltas.</p>
          </div>
          <div className="stepsGrid">
            <article><span>01</span><Users/><h3>Registrate</h3><p>Elegí negocio o creador y completá tu perfil profesional.</p></article>
            <article><span>02</span><Target/><h3>Publicá o postulate</h3><p>Campañas para marcas, propuestas para creadores.</p></article>
            <article><span>03</span><MessageCircle/><h3>Gestioná en tu panel</h3><p>Estados, mensajes y entregables en un solo lugar.</p></article>
            <article><span>04</span><BadgeCheck/><h3>Construí reputación</h3><p>Reseñas, KUVO Score y historial para próximas colaboraciones.</p></article>
          </div>
        </div>
      </section>

      <section className="ctaSection container">
        <div>
          <span className="eyebrow"><Sparkles size={15}/> Listo para usar</span>
          <h2>Creá tu cuenta y entrá a tu panel privado.</h2>
          <p>Explorá el marketplace público o registrate para gestionar campañas, postulaciones y mensajes con privacidad.</p>
          <div className="ctaButtons">
            <Link className="primaryBtn large" href="/registro">Crear cuenta gratis <ChevronRight size={19}/></Link>
            <Link className="ghostBtn large ctaGhost" href="/explorar">Ver marketplace público</Link>
          </div>
        </div>
      </section>

      <footer>
        <div className="container footerGrid">
          <div><Logo/><p>Plataforma completa que conecta negocios con creadores. Marketplace público y gestión privada por usuario.</p></div>
          <div><h4>Plataforma</h4><Link href="/explorar">Explorar</Link><Link href="/panel">Mi panel</Link><a href="#plataforma">Funciones</a></div>
          <div><h4>Cuenta</h4><Link href="/login">Ingresar</Link><Link href="/registro">Registrarse</Link><Link href="/admin">Administración</Link></div>
          <div><h4>Legal</h4><Link href="/privacidad">Privacidad</Link><Link href="/terminos">Términos</Link><a href="#privacidad">Seguridad</a></div>
        </div>
        <div className="container footerBottom">
          <span>© 2026 KUVO. Todos los derechos reservados.</span>
          <span>Sistema propio · datos privados por usuario</span>
        </div>
      </footer>
    </main>
  );
}
