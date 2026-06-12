import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, BadgeCheck, MessageCircle, Target } from 'lucide-react';
import { AuthForm } from '@/components/AuthForm';
import { Logo } from '@/components/Logo';
export const metadata: Metadata = { title:'Registrarse' };
export default function RegisterPage(){return <main className="authPage"><section className="authVisual register"><div className="authVisualInner"><Logo/><Link href="/" className="backLink"><ArrowLeft/> Volver al inicio</Link><div className="authPitch"><span className="eyebrow">Tu perfil profesional</span><h2>Conectá con oportunidades reales.</h2><p>KUVO ayuda a negocios y creadores a encontrarse, acordar condiciones y construir reputación.</p><div className="authBenefits"><div><BadgeCheck/><span><strong>Perfil verificable</strong><small>Experiencia, portfolio y reputación</small></span></div><div><Target/><span><strong>Mejores coincidencias</strong><small>Filtros por rubro, ciudad y objetivo</small></span></div><div><MessageCircle/><span><strong>Comunicación centralizada</strong><small>Todo el historial dentro de KUVO</small></span></div></div></div></div></section><section className="authSide"><AuthForm mode="register"/></section></main>}
