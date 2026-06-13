import type { Metadata } from 'next';
import { ResetPasswordForm } from '@/components/ResetPasswordForm';
import { Logo } from '@/components/Logo';

export const metadata: Metadata = { title: 'Nueva contraseña' };

export default function ResetPasswordPage() {
  return (
    <main className="authPage single">
      <section className="authSide"><Logo/><ResetPasswordForm /></section>
    </main>
  );
}
