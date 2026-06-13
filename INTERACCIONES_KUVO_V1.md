# Inventario de interacciones KUVO V1

Leyenda: **OK** = persistencia real Supabase | **PARCIAL** = funciona con límites conocidos | **PEND** = pendiente V1.1 | **DEMO** = solo con `NEXT_PUBLIC_DEMO_MODE=true`

Última actualización: cierre V1 (fases 2–14).

## Autenticación

| Pantalla | Elemento | Acción | Backend | Estado | Notas |
|----------|----------|--------|---------|--------|-------|
| /login | Ingresar | signInWithPassword | Auth | OK | Mensajes ES |
| /registro | Crear cuenta | signUp + confirmación email | Auth | OK | |
| /recuperar-contrasena | Enviar enlace | resetPasswordForEmail | Auth | OK | |
| /nueva-contrasena | Guardar | updateUser password | Auth | OK | |
| /auth/callback | OAuth/code | exchangeCodeForSession | Auth | OK | |
| Panel header | Cerrar sesión | signOut | Auth | OK | |
| Middleware | /panel, /admin | redirect + role | profiles | OK | admin requiere role=admin |

## Panel — Campañas (negocio)

| Elemento | Acción | Backend | Estado | Notas |
|----------|--------|---------|--------|-------|
| Nueva campaña | insert draft + publish RPC | campaigns + RPC | OK | |
| Pausar / Reabrir / Cancelar / Completar | RPC transition | campaigns RPC | OK | |
| Buscador campañas | filtrar en cliente | campaigns (ya cargadas) | OK | |
| Filtro estado | filtrar en cliente | campaigns | OK | open, in_progress, paused, completed |
| Ver postulaciones | nav | — | OK | |
| Dejar reseña | insert reviews | reviews | OK | campaña completed + postulación aceptada |

## Panel — Campañas (creador)

| Elemento | Acción | Backend | Estado |
|----------|--------|---------|--------|
| Listar abiertas | select campaigns open | campaigns | OK |
| Postularme | insert application | applications | OK |
| Buscador / filtro | cliente | — | OK |

## Panel — Postulaciones

| Elemento | Acción | Backend | Estado |
|----------|--------|---------|--------|
| Preseleccionar / Aceptar / Rechazar | RPC | applications RPC | OK |
| Retirar (creador) | creator_withdraw_application | OK | |
| Aceptar → Mensajes | nav + conversación RPC | conversations | OK | Redirige al chat |
| Traducción estados | labels | OK | |

## Panel — Mensajes

| Elemento | Backend | Estado | Notas |
|----------|---------|--------|-------|
| Lista conversaciones | messages + members | OK | |
| Enviar mensaje | messages insert | OK | |
| Realtime conversación activa | channel INSERT messages | OK | |
| Realtime sidebar/unread | member message inserts | OK | |
| Chat móvil volver | UI state | OK | botón ← en header |
| Buscador conversaciones | — | PEND | V1.1 |

## Panel — Notificaciones

| Elemento | Backend | Estado |
|----------|---------|--------|
| Campana panel | notifications select | OK |
| Marcar leída / todas | notifications.update | OK |
| Realtime | INSERT+UPDATE filtrado account | OK |
| Badge unread | read_at IS NULL | OK |

## Panel — Favoritos

| Elemento | Backend | Estado |
|----------|---------|--------|
| Listar | favorites + creator_profiles | OK |
| Quitar corazón | favorites delete | OK |
| Marketplace guardar | favorites insert/delete | OK | Requiere sesión; sin localStorage en prod |
| Link perfil público | /creadores/[username] | OK |

## Panel — Perfil

| Elemento | Backend | Estado |
|----------|---------|--------|
| Guardar nombre/bio/ciudad/usuario | profiles + business_profiles | OK |
| KUVO Score creador | creator_profiles.score | OK | Valor real de BD |
| % completado negocio | cálculo campos | OK | |
| Cambiar foto | storage | PEND | V1.1 |
| Campos creador (precio, categorías) | creator_profiles | PEND | V1.1 |

## Admin (/admin)

| Elemento | Backend | Estado |
|----------|---------|--------|
| Verificar perfil | admin_set_profile_verified | OK |
| Bloquear | admin_set_profile_active | OK |
| Pausar campaña | admin_pause_campaign RPC | OK |
| Reportes tab | reports paginados | OK |
| Resolver reporte | UPDATE status + resolved_at | OK |
| Auditoría | audit_logs | OK |
| Buscador/filtros avanzados | — | PARCIAL | paginación OK |

## Público

| Ruta | Backend | Estado |
|------|---------|--------|
| / | landing | OK |
| /explorar | creator_profiles + campaigns open | OK | Supabase real |
| /creadores/[username] | creator_profiles + profiles | OK |
| /campanas/[id] | campaigns + business | OK | draft → 404 |
| /negocios/[username] | business_profiles + campañas abiertas | OK |

## Reseñas

| Flujo | Backend | Estado |
|-------|---------|--------|
| UI post-campaña completed (negocio) | reviews insert | OK |
| RLS campaign parties | SQL | OK |

## Responsive

| Área | Estado |
|------|--------|
| Marketplace / landing | OK |
| Panel sidebar móvil | OK |
| Chat móvil lista ↔ conversación | OK |
| Admin móvil | PARCIAL | sidebar oculto |

## E2E

| Suite | Estado |
|-------|--------|
| Happy path negocio→creador→aceptar→chat | OK | Playwright + Supabase real |
| Admin / bloqueados | PEND | V1.1 |

---

Actualizar este archivo al cerrar cada interacción (**PEND → OK**).
