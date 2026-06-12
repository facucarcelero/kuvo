# Seguridad KUVO

## Modelo de confianza

- **Cliente (anon key):** solo operaciones permitidas por RLS/RPC
- **Servidor Next.js:** middleware + Server Components para rutas privadas
- **PostgreSQL:** última barrera; nunca confiar solo en UI

## Controles implementados (2026-06-12)

### Perfiles
- Usuario: UPDATE solo `full_name`, `username`, `city`, `avatar_url`, `bio`
- Admin: RPC `admin_set_profile_role|verified|active` + audit log

### Creadores
- Bloqueo UPDATE de `score` por no-admin
- Métricas declaradas: `followers_declared`, `engagement_declared`

### Postulaciones
- Máquina de estados en trigger
- RPC: `business_accept_application`, `business_reject_application`, `business_shortlist_application`, `creator_withdraw_application`
- Aceptación transaccional: rechaza otras + crea conversación + notifica

### Conversaciones
- Sin INSERT directo por usuarios
- Solo vía RPC de aceptación o admin

### Auth
- Callback: `sanitizeInternalRedirect` — solo rutas internas allowlist
- Middleware: `/panel`, `/admin`

### Storage
- Carpetas por `profile_id`
- Sin SVG en avatars
- Límites: avatars 5MB, portfolio 15MB

### Headers (next.config.ts)
- CSP, X-Frame-Options DENY, HSTS en producción
- `connect-src` limitado a Supabase

## Variables de entorno

| Variable | Exposición | Uso |
|----------|------------|-----|
| `SUPABASE_URL` | Servidor / runtime config | OK |
| `SUPABASE_ANON_KEY` | Runtime config (público por diseño) | OK con RLS |
| `NEXT_PUBLIC_DEMO_MODE` | Público | Solo local, nunca prod |
| `service_role` | **PROHIBIDO** en frontend | — |

## Pruebas RLS recomendadas (manual/SQL)

Ver `supabase/tests/rls_offensive.sql` (pendiente) o `MATRIZ_DE_PRUEBAS_KUVO.md`.

## Incidentes

Registrar en `platform_audit_logs` vía funciones admin.
