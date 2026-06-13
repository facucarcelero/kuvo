# KUVO V1 — Guía de release

Producción: `https://ku-vo.netlify.app/`  
Supabase: proyecto `ukpollusdixthqyceahk`

## Requisitos previos

1. Migraciones SQL aplicadas en orden en Supabase remoto:
   - `001_schema.sql`
   - `003_security_hardening.sql`
   - `004_add_campaign_in_progress.sql`
   - `005_production_hardening.sql`
2. Verificación post-migración:
   ```bash
   npm run verify:post-migration
   ```
   O ejecutar manualmente `supabase/tests/verify_schema_004.sql` y `verify_schema_005.sql` en el SQL Editor.

## Variables de entorno (Netlify)

| Variable | Valor |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key |
| `NEXT_PUBLIC_DEMO_MODE` | `false` |
| `NEXT_PUBLIC_SITE_URL` | `https://ku-vo.netlify.app` |

Opcional local/E2E (no commitear):

| Variable | Uso |
|----------|-----|
| `SUPABASE_SERVICE_ROLE_KEY` | Solo tests E2E locales |

## Build y checks locales

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
```

E2E contra Supabase real (requiere service role en `.env.local`):

```bash
npm run test:e2e
```

Flujo validado: negocio publica campaña → creador postula → negocio acepta → conversación en Mensajes.

## Deploy Netlify

1. Merge de `finish/v1-public-release` → `main`
2. Push a remoto (Netlify build automático)
3. Confirmar en producción:
   - `/explorar` carga creadores/campañas reales
   - `/panel` login + campañas/postulaciones/mensajes
   - `/campanas/[id]`, `/creadores/[username]`, `/negocios/[username]` responden
   - `/admin` solo accesible con role admin

## Realtime (Supabase Dashboard)

Tablas en publicación `supabase_realtime` (migration 005):

- `messages`
- `notifications`

## Modo demo

`NEXT_PUBLIC_DEMO_MODE=true` activa datos locales en Auth/Dashboard. **No usar en producción.**

## Rollback

1. Revertir deploy Netlify al build anterior
2. Las migraciones SQL no se revierten automáticamente; documentar cambios manuales si aplica

## Soporte V1.1 (fuera de scope V1)

- Avatar / storage upload en perfil
- Campos extendidos creador en panel
- Buscador de conversaciones
- E2E admin y cuentas bloqueadas
- Redirect configurable tras aceptar postulación (ver `POST_V1.md`)
