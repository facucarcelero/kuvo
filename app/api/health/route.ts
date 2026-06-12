import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getPublicEnv, isSupabaseConfiguredEnv } from '@/lib/env';

export async function GET() {
  const env = getPublicEnv();
  const payload: Record<string, unknown> = {
    ok: true,
    service: 'kuvo',
    timestamp: new Date().toISOString(),
    liveness: 'ok',
  };

  if (!isSupabaseConfiguredEnv(env)) {
    payload.readiness = 'demo_or_unconfigured';
    return NextResponse.json(payload);
  }

  try {
    const supabase = await createClient();
    if (!supabase) {
      payload.ok = false;
      payload.readiness = 'supabase_client_unavailable';
      return NextResponse.json(payload, { status: 503 });
    }

    const { error } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).limit(1);
    if (error) {
      payload.ok = false;
      payload.readiness = 'database_unreachable';
      return NextResponse.json(payload, { status: 503 });
    }

    payload.readiness = 'ok';
    return NextResponse.json(payload);
  } catch {
    payload.ok = false;
    payload.readiness = 'unexpected_error';
    return NextResponse.json(payload, { status: 503 });
  }
}
