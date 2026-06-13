'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { translateAuthError } from '@/lib/auth/errors';

export function ResetPasswordForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage('');

    if (!isSupabaseConfigured()) {
      setMessage('El servicio no está configurado.');
      setLoading(false);
      return;
    }

    const supabase = createClient();
    if (!supabase) {
      setMessage('No pudimos conectar con el servicio.');
      setLoading(false);
      return;
    }

    const data = new FormData(event.currentTarget);
    const password = String(data.get('password') || '');
    const confirm = String(data.get('confirm') || '');
    if (password.length < 8) {
      setMessage('La contraseña debe tener al menos 8 caracteres.');
      setLoading(false);
      return;
    }
    if (password !== confirm) {
      setMessage('Las contraseñas no coinciden.');
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setMessage(translateAuthError(error.message));
      return;
    }
    router.replace('/login?reset=ok');
    router.refresh();
  }

  return (
    <div className="authCard">
      <span className="eyebrow">Nueva clave</span>
      <h1>Elegí tu contraseña</h1>
      <p>Debe tener al menos 8 caracteres.</p>
      <form onSubmit={submit} className="authForm">
        <label>Nueva contraseña<input type="password" name="password" required minLength={8} autoComplete="new-password"/></label>
        <label>Confirmar contraseña<input type="password" name="confirm" required minLength={8} autoComplete="new-password"/></label>
        {message && <div className="formMessage">{message}</div>}
        <button className="primaryBtn full" disabled={loading}>{loading ? <Loader2 className="spin" size={18}/> : <>Guardar contraseña <ArrowRight size={18}/></>}</button>
      </form>
      <div className="authSwitch"><Link href="/login">Volver a ingresar</Link></div>
    </div>
  );
}
