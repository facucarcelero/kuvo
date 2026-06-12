import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { sanitizeInternalRedirect } from '@/lib/auth/redirect';

const PROTECTED_PREFIXES = ['/panel', '/admin'];

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;

  const needsAuth = PROTECTED_PREFIXES.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`));
  if (!needsAuth) return response;

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') return response;
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('next', sanitizeInternalRedirect(pathname));
    return NextResponse.redirect(loginUrl);
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('next', sanitizeInternalRedirect(pathname));
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith('/admin')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, active')
      .eq('account_id', user.id)
      .maybeSingle();

    if (profile?.role !== 'admin' || profile.active === false) {
      const denied = request.nextUrl.clone();
      denied.pathname = '/panel';
      denied.search = '';
      return NextResponse.redirect(denied);
    }
  }

  return response;
}

export const config = {
  matcher: ['/panel/:path*', '/admin/:path*'],
};
