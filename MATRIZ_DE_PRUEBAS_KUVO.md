# Matriz de pruebas KUVO

**Última ejecución post-migración:** 2026-06-12 · Proyecto `ukpollusdixthqyceahk`

## Automatizadas (Vitest) ✓

| Caso | Archivo | Estado |
|------|---------|--------|
| Redirect interno seguro | `tests/auth-redirect.test.ts` | ✓ PASS |
| Demo mode explícito | `tests/env.test.ts` | ✓ PASS |

## Build / CI ✓

| Caso | Comando | Estado |
|------|---------|--------|
| Lint | `npm run lint` | ✓ |
| Typecheck | `npm run typecheck` | ✓ |
| Build | `npm run build` | ✓ |
| Audit deps | `npm audit --audit-level=high` | ✓ |

## Esquema post-migración 003

Ejecutado vía `npm run verify:post-migration` contra Supabase remoto.

| ID | Caso | Esperado | Resultado | Estado |
|----|------|----------|-----------|--------|
| S1 | Tabla `platform_audit_logs` | Existe | Tabla no encontrada | **FAIL** |
| S2 | Columnas `followers_declared` | Existen | Columna no existe | **FAIL** |
| S3 | RPCs admin + postulaciones (5 funciones) | Existen | Funciones no encontradas | **FAIL** |

**Validación SQL alternativa:** `supabase/tests/verify_schema_003.sql` en SQL Editor.

## RLS ofensivo (requiere 003 aplicada)

| ID | Caso | Resultado esperado | Estado |
|----|------|-------------------|--------|
| R1 | Creador UPDATE `profiles.role=admin` | Error SQL/RLS | **PENDIENTE** (003 ausente) |
| R2 | Creador UPDATE `creator_profiles.score` | Error | **PENDIENTE** |
| R3 | Creador UPDATE `profiles.verified` | Error | **PENDIENTE** |
| R4 | Negocio UPDATE `business_profiles.verified` | Error | **PENDIENTE** |
| R5 | Negocio crea campaña open | OK | **PENDIENTE** |
| R6 | Creador crea postulación pending | OK | **PENDIENTE** |
| R7 | Creador auto-acepta postulación | Error | **PENDIENTE** |
| R8 | Negocio modifica propuesta/precio | Error | **PENDIENTE** |
| R9 | Negocio acepta vía RPC | OK + conversación | **PENDIENTE** |
| R10 | Tercero INSERT conversación | Error | **PENDIENTE** |
| R11 | Tercero SELECT conversaciones ajenas | 0 filas | **PENDIENTE** |
| R12 | Tercero SELECT mensajes ajenos | 0 filas | **PENDIENTE** |
| R13 | Tercero SELECT favoritos ajenos | 0 filas | **PENDIENTE** |
| R14 | Tercero SELECT notificaciones ajenas | Solo propias | **PENDIENTE** |
| R15 | No-admin RPC `admin_set_profile_verified` | Error | **PENDIENTE** |
| R16 | Admin accede `/admin`, tercero no | Redirect panel | **PENDIENTE** (manual con sesión) |

## Middleware / servidor ✓

| ID | Caso | Resultado | Estado |
|----|------|-----------|--------|
| M1 | `GET /panel` sin cookie | 307 → `/login?next=/panel` | **PASS** |
| M2 | `GET /admin` sin cookie | 307 → `/login?next=/admin` | **PASS** |

## Health check ✓

| ID | Caso | Resultado | Estado |
|----|------|-----------|--------|
| H1 | `GET /api/health` | 200, `ok: true` | **PASS** |
| H2 | DB conectada | `readiness: "ok"` | **PASS** |
| H3 | DB caída | 503 | **NO PROBADO** (requiere simular outage) |

## Modo demo ✓

| ID | Caso | Resultado | Estado |
|----|------|-----------|--------|
| D1 | `NEXT_PUBLIC_DEMO_MODE` unset/false | No demo silencioso | **PASS** |
| D2 | Marketplace sin demo flag | Lista vacía hasta fetch real | **PASS** (código) |

## E2E Playwright (pendiente — post 003)

### Flujo negocio
1. Registro → perfil → campaña → postulación → preseleccionar → aceptar → conversar

### Flujo creador
1. Registro → postular → retirar → aceptación → mensaje

### Flujo admin
1. Usuario normal → `/admin` redirect
2. Admin → verificar → pausar campaña

## Responsive (manual — pendiente)

| Resolución | Áreas | Estado |
|------------|-------|--------|
| 375×812 | Landing, explorar, login | Pendiente |
| 768×1024 | Panel sidebar | Pendiente |
| 1920×1080 | Admin tablas | Pendiente |

## Cómo re-ejecutar

```bash
# 1. Aplicar 003 en Supabase SQL Editor
# 2. Validar esquema:
#    supabase/tests/verify_schema_003.sql
# 3. Verificación API + RLS:
npm run verify:post-migration
```

Variables opcionales para evitar signUp (cuentas ya existentes):

```env
VERIFY_BUSINESS_EMAIL=
VERIFY_BUSINESS_PASSWORD=
VERIFY_CREATOR_EMAIL=
VERIFY_CREATOR_PASSWORD=
VERIFY_THIRD_EMAIL=
VERIFY_THIRD_PASSWORD=
```
