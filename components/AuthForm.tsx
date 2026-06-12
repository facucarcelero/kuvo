'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Building2, Eye, EyeOff, Loader2, Sparkles, UserRound } from 'lucide-react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import type { Role } from '@/lib/types';

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter();
  const [role, setRole] = useState<Role>('business');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    const data = new FormData(event.currentTarget);
    const email = String(data.get('email') || '').trim();
    const password = String(data.get('password') || '');
    const name = String(data.get('name') || '').trim();

    if (!isSupabaseConfigured()) {
      localStorage.setItem('kuvo_demo_session', JSON.stringify({ email, name: name || 'Cuenta demo', role }));
      setTimeout(() => router.push('/panel'), 350);
      return;
    }

    const supabase = createClient();
    if (!supabase) return;

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMessage(error.message);
        setLoading(false);
        return;
      }
      router.push('/panel');
      router.refresh();
      return;
    }

    const redirectTo = `${window.location.origin}/auth/callback`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectTo, data: { full_name: name, role } },
    });
    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }
    setMessage('Cuenta creada. Revisá tu correo para confirmar el registro.');
    setLoading(false);
  }

  return (
    <div className="authCard">
      <span className="eyebrow"><Sparkles size={15} /> {mode === 'login' ? 'Volvé a tu cuenta' : 'Creá tu cuenta gratis'}</span>
      <h1>{mode === 'login' ? 'Ingresá a KUVO' : 'Empezá a colaborar'}</h1>
      <p>{mode === 'login' ? 'Gestioná campañas, propuestas y resultados desde un solo lugar.' : 'Elegí cómo vas a usar la plataforma. Después podés completar tu perfil.'}</p>

      {mode === 'register' && (
        <div className="roleSelector" aria-label="Tipo de cuenta">
          <button type="button" className={role === 'business' ? 'active' : ''} onClick={() => setRole('business')}>
            <Building2 size={20} /><span><strong>Soy negocio</strong><small>Quiero contratar creadores</small></span>
          </button>
          <button type="button" className={role === 'creator' ? 'active' : ''} onClick={() => setRole('creator')}>
            <UserRound size={20} /><span><strong>Soy creador</strong><small>Quiero recibir campañas</small></span>
          </button>
        </div>
      )}

      <form onSubmit={submit} className="authForm">
        {mode === 'register' && <label>Nombre completo<input name="name" required minLength={2} placeholder="Tu nombre" /></label>}
        <label>Correo electrónico<input type="email" name="email" required placeholder="tu@email.com" autoComplete="email" /></label>
        <label>Contraseña<div className="passwordField"><input type={showPassword ? 'text' : 'password'} name="password" required minLength={8} placeholder="Mínimo 8 caracteres" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /><button type="button" onClick={() => setShowPassword(v => !v)} aria-label="Mostrar contraseña">{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></label>
        {message && <div className="formMessage">{message}</div>}
        <button className="primaryBtn full" disabled={loading}>{loading ? <Loader2 className="spin" size={18}/> : <><span>{mode === 'login' ? 'Ingresar' : 'Crear cuenta'}</span><ArrowRight size={18}/></>}</button>
      </form>

      <div className="authSwitch">
        {mode === 'login' ? <>¿Todavía no tenés cuenta? <Link href="/registro">Registrate</Link></> : <>¿Ya tenés una cuenta? <Link href="/login">Ingresá</Link></>}
      </div>
      {!isSupabaseConfigured() && <div className="demoNotice">Modo demostración activo: podés ingresar con cualquier correo y contraseña.</div>}
    </div>
  );
}
