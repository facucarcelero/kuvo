# AUDITORÍA KUVO — Informe integral

**Fecha:** 2026-06-12  
**Alcance:** Repositorio `kuvo` (Next.js 16 + Supabase)  
**Estado:** Auditoría Fase 1 completada · Correcciones P0 parciales implementadas

---

## Resumen ejecutivo

KUVO es una plataforma funcional para conectar negocios con creadores. Antes de esta intervención, el proyecto era **demostrable** pero **no apto para producción** por escalamiento de privilegios en PostgreSQL, rutas privadas protegidas solo en cliente, callback de auth vulnerable a open redirect, Service Worker cacheando rutas sensibles, métricas inventadas en UI y funcionalidades simuladas (mensajes, favoritos reales en panel, admin con datos ficticios).

Se implementaron correcciones **P0 prioritarias** en código y migración `003_security_hardening.sql`. Permanece trabajo pendiente en mensajería real, notificaciones, recuperación de contraseña, tests E2E/RLS automatizados y refactor modular completo.

**Preparación real para producción:** ~55% tras esta fase (seguridad base mejorada; funcionalidades core aún incompletas).

---

## Verificación post-migración (2026-06-12 20:04 UTC)

**Proyecto Supabase:** `ukpollusdixthqyceahk`  
**Script:** `node scripts/verify-post-migration.mjs`  
**Resultado global:** **BLOQUEADO — migración 003 NO detectada en la base remota**

### Esquema vs migraciones

| Check | Esperado (003) | Resultado real | Estado |
|-------|----------------|----------------|--------|
| Tabla `platform_audit_logs` | Existe | `Could not find the table` | **FAIL** |
| Columna `creator_profiles.followers_declared` | Existe | `column does not exist` | **FAIL** |
| RPC `admin_set_profile_verified` | Existe | `Could not find the function` | **FAIL** |
| RPC `business_accept_application` | Existe | `Could not find the function` | **FAIL** |
| RPC `business_reject_application` | Existe | `Could not find the function` | **FAIL** |
| RPC `business_shortlist_application` | Existe | `Could not find the function` | **FAIL** |
| RPC `creator_withdraw_application` | Existe | `Could not find the function` | **FAIL** |

**Conclusión:** La base conectada tiene **`001_schema.sql` (y posiblemente `002_seed.sql`)**, pero **no** `003_security_hardening.sql`. Probablemente se ejecutó el SQL antiguo (`001` o `KUVO_DATABASE_COMPLETE` sin la sección 003) antes de la actualización del repositorio.

**Acción requerida:** En Supabase → SQL Editor, ejecutar **completo** el archivo:

`supabase/migrations/003_security_hardening.sql`

Validar con:

`supabase/tests/verify_schema_003.sql` (debe mostrar `OK: esquema 003 presente`)

Luego re-ejecutar: `npm run verify:post-migration`

### RLS ofensivo (usuarios negocio / creador / tercero / admin)

| ID | Caso | Estado | Detalle |
|----|------|--------|---------|
| R1–R16 | Pruebas RLS con usuarios reales | **NO EJECUTADO** | Bloqueado: esquema 003 ausente; además rate limit en signUp |
| — | SignUp usuarios de prueba | **BLOQUEADO** | Supabase Auth: `email rate limit exceeded` |

### Controles de aplicación (sin depender de 003)

| ID | Caso | Resultado | Estado |
|----|------|-----------|--------|
| M1 | `GET /panel` sin sesión → redirect login | `307` → `/login?next=%2Fpanel` | **PASS** |
| M2 | `GET /admin` sin sesión → redirect login | `307` → `/login?next=%2Fadmin` | **PASS** |
| H1 | `GET /api/health` responde | `200` | **PASS** |
| H2 | `readiness` con DB conectada | `"ok"` | **PASS** |
| D1 | `NEXT_PUBLIC_DEMO_MODE` no activo | unset (≠ true) | **PASS** |

### Fase 5

**NO iniciada** — condición previa no cumplida: todas las verificaciones P0 de RLS deben pasar tras aplicar 003.

---

## Arquitectura actual

| Capa | Tecnología |
|------|------------|
| Frontend | Next.js 16 App Router, React 19, CSS propio |
| Auth | Supabase Auth (email/password) |
| Datos | PostgreSQL + RLS |
| Storage | Supabase buckets `avatars`, `portfolio` |
| Despliegue | Vercel / Node standalone |
| PWA | Service Worker + manifest |

**Rutas principales:** `/`, `/explorar`, `/login`, `/registro`, `/panel`, `/admin`, `/auth/callback`, `/api/health`

---

## Funcionalidades reales (antes y después)

| Funcionalidad | Estado previo | Estado actual |
|---------------|---------------|---------------|
| Landing + marketplace público | Real con fallback demo silencioso | Real; demo solo con `NEXT_PUBLIC_DEMO_MODE=true` |
| Registro / login Supabase | Real | Real + callback endurecido |
| Panel negocio/creador | Parcial (campañas/postulaciones básicas) | Parcial + RPC para aceptar/rechazar |
| Mensajería | **Simulada** | **Simulada** (pendiente Fase 5) |
| Favoritos marketplace | Parcial (localStorage + Supabase) | Parcial |
| Favoritos panel | **Demo hardcodeado** | **Demo hardcodeado** (pendiente) |
| Admin | Cliente-only + métricas falsas | Servidor + RPC admin + health real |
| KUVO Score | Valores fijos inventados | Parcialmente corregido en panel |
| Notificaciones | Esquema DB, sin UI real | Sin cambio |
| Recuperación contraseña | No implementada | No implementada |

---

## Problemas encontrados y correcciones

### P0 — Seguridad crítica

| ID | Problema | Archivo | Impacto | Explotación | Corrección | Estado |
|----|----------|---------|---------|-------------|------------|--------|
| P0-01 | Usuario podía UPDATE `role`, `verified`, `active` en `profiles` | `001_schema.sql` L222 | Escalamiento a admin | `update profiles set role='admin'` | Triggers + GRANT column-level + RPC admin | **Migración 003** |
| P0-02 | Creador podía modificar `score` | `001_schema.sql` L226 | Manipulación reputación | UPDATE directo | Trigger `guard_creator_profile_fields` | **003** |
| P0-03 | Negocio podía auto-verificarse | `001_schema.sql` L230 | Confianza falsa | UPDATE `verified=true` | Trigger + revocar columna | **003** |
| P0-04 | UPDATE genérico en postulaciones | `001_schema.sql` L248-252 | Creador se auto-acepta | UPDATE status | Trigger máquina estados + RPC | **003** |
| P0-05 | Conversaciones arbitrarias | L259, L263 | Lectura/escritura ajena | INSERT conversation + members | Bloqueo INSERT directo; RPC aceptación | **003** |
| P0-06 | Reseñas sin validar contraparte | L270-277 | Reseña a terceros | INSERT review incorrecto | Policy mejorada | **003** |
| P0-07 | Open redirect en callback | `app/auth/callback/route.ts` | Phishing post-login | `?next=https://evil.com` | `sanitizeInternalRedirect` | **Corregido** |
| P0-08 | `/panel` y `/admin` sin guard servidor | `app/panel/page.tsx` | Flash contenido privado | Acceso directo URL | Middleware + Server Components | **Corregido** |
| P0-09 | SW cachea todo GET | `public/sw.js` | Datos privados en caché | Navegación offline panel | SW v2 solo assets públicos | **Corregido** |
| P0-10 | `is_admin()` expuesto a `anon` | `001_schema.sql` L168 | Reconocimiento | N/A bajo RLS | REVOKE anon | **003** |
| P0-11 | SVG permitido en avatars | Storage buckets | XSS vector | SVG malicioso | MIME restringido | **003** |

### P1 — Funcionalidad / confianza

| ID | Problema | Severidad | Estado |
|----|----------|-----------|--------|
| P1-01 | Mensajes demo en Dashboard | P1 | Pendiente |
| P1-02 | Métricas inventadas (+28%, 92%, 100%) | P1 | Parcialmente corregido |
| P1-03 | Admin "RLS OK" sin verificar | P1 | Corregido |
| P1-04 | Health check no probaba DB | P1 | Corregido |
| P1-05 | Fallback silencioso a demo sin Supabase | P1 | Corregido (`NEXT_PUBLIC_DEMO_MODE`) |
| P1-06 | Sitemap con URLs relativas | P2 | Corregido (`app/sitemap.ts`) |

### P2/P3 — Pendientes

- Tests Playwright E2E completos
- pgTAP / pruebas RLS automatizadas
- Refactor `Dashboard.tsx`, `Marketplace.tsx` a features/
- Zod en todos los formularios
- Páginas públicas `/creadores/[username]`, `/campanas/[id]`
- Recuperación contraseña, eliminación cuenta
- KUVO Score algoritmo documentado
- CSP nonce para eliminar `unsafe-inline`

---

## Verificaciones ejecutadas

```text
npm install      ✓
npm run lint     ✓
npm run typecheck ✓
npm test         ✓ (5 tests)
npm run build    ✓
npm audit        ✓ 0 high/critical
```

**No ejecutado aún:** Playwright E2E, pgTAP RLS contra Supabase local.

---

## Riesgos pendientes

1. **Mensajería simulada** — usuarios pueden creer que chatean en producción.
2. **Migración 003** debe aplicarse en Supabase existente manualmente.
3. **Middleware deprecated warning** en Next.js 16 — migrar a `proxy` cuando estabilice API.
4. **CSP `unsafe-inline`** — necesario por script runtime config; evaluar nonce.
5. **Favoritos panel** siguen siendo demo.
6. **002_seed.sql** no debe correr en producción.

---

## Archivos modificados (esta intervención)

- `supabase/migrations/003_security_hardening.sql` (nuevo)
- `supabase/KUVO_DATABASE_COMPLETE.sql`, `KUVO_DATABASE_COMPLETE.sql`
- `middleware.ts`, `lib/env.ts`, `lib/auth/redirect.ts`, `lib/supabase/client.ts`
- `app/auth/callback/route.ts`, `app/api/health/route.ts`
- `app/panel/page.tsx`, `app/admin/page.tsx`
- `app/sitemap.ts`, `app/robots.ts`
- `components/Dashboard.tsx`, `components/AdminPanel.tsx`, `components/Marketplace.tsx`, `components/AuthForm.tsx`
- `public/sw.js`, `public/offline.html`
- `next.config.ts`, `package.json`, `.env.example`
- `tests/*`, `vitest.config.ts`, `.github/workflows/ci.yml`

---

## Instrucciones post-auditoría

### Instalación nueva (Supabase vacío)

1. Ejecutar `001_schema.sql`
2. Ejecutar `003_security_hardening.sql`
3. **No** ejecutar `002_seed.sql` en producción
4. Configurar `.env.local` (sin `NEXT_PUBLIC_DEMO_MODE` o `false`)
5. `npm ci && npm run build`

### Base existente

1. Ejecutar solo `003_security_hardening.sql`
2. Redeploy aplicación
3. Verificar `/api/health` → `readiness: ok`

### Rollback

1. Revertir deploy frontend al commit anterior
2. **No** revertir SQL sin backup — triggers/policies son aditivos; rollback DB requiere script inverso manual

---

## Referencias cruzadas

- `PLAN_DE_MEJORAS_KUVO.md` — roadmap fases 5-9
- `SEGURIDAD_KUVO.md` — modelo de amenazas y RLS
- `MATRIZ_DE_PRUEBAS_KUVO.md` — casos de prueba
