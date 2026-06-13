import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sanitizeInternalRedirect } from '@/lib/auth/redirect';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error_description') || url.searchParams.get('error');
  const next = sanitizeInternalRedirect(url.searchParams.get('next'));

  if (error) {
    const loginUrl = new URL('/login', url.origin);
    loginUrl.searchParams.set('error', 'auth_callback_failed');
    return NextResponse.redirect(loginUrl);
  }

  if (!code) {
    return NextResponse.redirect(new URL('/login', url.origin));
  }

  const supabase = await createClient();
  if (!supabase) {
    const loginUrl = new URL('/login', url.origin);
    loginUrl.searchParams.set('error', 'auth_unavailable');
    return NextResponse.redirect(loginUrl);
  }

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    const loginUrl = new URL('/login', url.origin);
    loginUrl.searchParams.set('error', 'auth_callback_failed');
    return NextResponse.redirect(loginUrl);
  }

  if (next === '/nueva-contrasena') {
    return NextResponse.redirect(new URL('/nueva-contrasena', url.origin));
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
