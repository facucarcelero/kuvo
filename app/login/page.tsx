import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { ArrowLeft, BarChart3, BriefcaseBusiness, ShieldCheck } from 'lucide-react';
import { AuthForm } from '@/components/AuthForm';
import { Logo } from '@/components/Logo';
export const metadata: Metadata = { title:'Ingresar' };
export default function LoginPage(){return <main className="authPage"><section className="authVisual"><div className="authVisualInner"><Logo/><Link href="/" className="backLink"><ArrowLeft/> Volver al inicio</Link><div className="authPitch"><span className="eyebrow">Todo en un solo lugar</span><h2>Gestioná mejores colaboraciones.</h2><p>Organizá campañas, propuestas, mensajes y resultados sin depender de planillas o conversaciones sueltas.</p><div className="authBenefits"><div><BriefcaseBusiness/><span><strong>Campañas ordenadas</strong><small>Estados, entregables y presupuestos</small></span></div><div><BarChart3/><span><strong>Métricas visibles</strong><small>Decisiones basadas en resultados</small></span></div><div><ShieldCheck/><span><strong>Acceso seguro</strong><small>Información protegida por rol</small></span></div></div></div></div></section><section className="authSide"><Suspense fallback={null}><AuthForm mode="login"/></Suspense></section></main>}
