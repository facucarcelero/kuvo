'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { translateAuthError } from '@/lib/auth/errors';

export function ForgotPasswordForm() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [ok, setOk] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    setOk(false);

    if (!isSupabaseConfigured()) {
      setMessage('El servicio no está configurado. Contactá al administrador.');
      setLoading(false);
      return;
    }

    const supabase = createClient();
    if (!supabase) {
      setMessage('No pudimos conectar con el servicio. Intentá más tarde.');
      setLoading(false);
      return;
    }

    const email = String(new FormData(event.currentTarget).get('email') || '').trim();
    const redirectTo = `${window.location.origin}/auth/callback?next=/nueva-contrasena`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

    setLoading(false);
    if (error) {
      setMessage(translateAuthError(error.message));
      return;
    }
    setOk(true);
    setMessage('Si el correo existe en KUVO, recibirás un enlace para restablecer tu contraseña.');
  }

  return (
    <div className="authCard">
      <Link href="/login" className="backLink"><ArrowLeft size={16}/> Volver a ingresar</Link>
      <span className="eyebrow">Recuperación</span>
      <h1>Restablecer contraseña</h1>
      <p>Ingresá tu correo y te enviaremos un enlace para elegir una nueva contraseña.</p>
      <form onSubmit={submit} className="authForm">
        <label>Correo electrónico<input type="email" name="email" required placeholder="tu@email.com" autoComplete="email"/></label>
        {message && <div className={`formMessage${ok ? ' success' : ''}`}>{message}</div>}
        <button className="primaryBtn full" disabled={loading}>{loading ? <Loader2 className="spin" size={18}/> : <>Enviar enlace <ArrowRight size={18}/></>}</button>
      </form>
    </div>
  );
}
