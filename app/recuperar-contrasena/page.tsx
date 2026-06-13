import type { Metadata } from 'next';
import { ForgotPasswordForm } from '@/components/ForgotPasswordForm';
import { Logo } from '@/components/Logo';

export const metadata: Metadata = { title: 'Recuperar contraseña' };

export default function ForgotPasswordPage() {
  return (
    <main className="authPage single">
      <section className="authSide"><Logo/><ForgotPasswordForm /></section>
    </main>
  );
}
