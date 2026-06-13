# Inventario de interacciones KUVO V1

Leyenda: **OK** = persistencia real | **PARCIAL** = funciona a medias | **PEND** = decorativo o sin backend | **DEMO** = solo modo demo

## Autenticación

| Pantalla | Elemento | Acción | Backend | Estado | Notas |
|----------|----------|--------|---------|--------|-------|
| /login | Ingresar | signInWithPassword | Auth | OK | Mensajes ES |
| /registro | Crear cuenta | signUp + confirmación email | Auth | OK | |
| /recuperar-contrasena | Enviar enlace | resetPasswordForEmail | Auth | OK | Fase 3 |
| /nueva-contrasena | Guardar | updateUser password | Auth | OK | Fase 3 |
| /auth/callback | OAuth/code | exchangeCodeForSession | Auth | OK | |
| Panel header | Cerrar sesión | signOut | Auth | OK | |
| Middleware | /panel bloqueado | redirect login | profiles.active | OK | |

## Panel — Campañas (negocio)

| Elemento | Acción | Backend | Estado | Notas |
|----------|--------|---------|--------|-------|
| Nueva campaña | insert draft + publish RPC | campaigns + RPC | PARCIAL | Falta editar/pausar/completar UI |
| Buscador campañas | filtrar | — | PEND | Input sin lógica |
| Filtro estado | filtrar | — | PEND | Select sin lógica |
| Ver postulaciones | nav | — | OK | |

## Panel — Postulaciones

| Elemento | Acción | Backend | Estado |
|----------|--------|---------|--------|
| Preseleccionar / Aceptar / Rechazar | RPC | applications RPC | OK |
| Retirar (creador) | creator_withdraw_application | OK | Dashboard parcial commit |
| Traducción estados | labels | OK | |

## Panel — Mensajes

| Elemento | Backend | Estado | Notas |
|----------|---------|--------|-------|
| Lista conversaciones | messages + members | PARCIAL | Último msg/unread en panel-data |
| Enviar mensaje | messages insert | OK | |
| Realtime | supabase channel | PARCIAL | INSERT messages |
| Buscador conversaciones | — | PEND | |
| Chat móvil volver | — | PEND | Fase 13 |

## Panel — Notificaciones

| Elemento | Backend | Estado |
|----------|---------|--------|
| Campana panel | notifications | PARCIAL |
| Marcar leída / todas | notifications.update | PARCIAL |
| Realtime | notifications channel | PARCIAL |

## Panel — Favoritos

| Elemento | Backend | Estado |
|----------|---------|--------|
| Listar | favorites | OK prod |
| Quitar corazón | favorites delete | PEND | Botón sin handler |
| Marketplace guardar | favorites insert | PARCIAL | Revisar Marketplace |

## Panel — Perfil

| Elemento | Backend | Estado |
|----------|---------|--------|
| Guardar nombre/bio | profiles | PARCIAL | Falta avatar/storage/campos creador |
| Cambiar foto | storage | PEND | |
| KUVO Score % fijo | — | PEND | Ocultar o calcular real |

## Admin (/admin)

| Elemento | Backend | Estado |
|----------|---------|--------|
| Verificar perfil | admin_set_profile_verified | OK |
| Bloquear | admin_set_profile_active | OK |
| Pausar campaña | direct update | **BUG** | Debe usar RPC |
| Reportes tab | reports | PEND | Contador "—" |
| Buscador/filtros | — | PEND | |

## Público

| Ruta | Estado |
|------|--------|
| / | OK landing |
| /explorar | PARCIAL datos reales si Supabase |
| /creadores/[username] | **NO EXISTE** |
| /campanas/[id] | **NO EXISTE** |
| /negocios/[slug] | **NO EXISTE** |

## Reseñas

| Flujo | Estado |
|-------|--------|
| UI post-campaña completed | PEND |
| insert reviews | SQL OK |

## E2E

| Suite | Estado |
|-------|--------|
| Recorrido negocio/creador/tercero/admin/bloqueado | PEND Fase 14 |

---

Actualizar este archivo al cerrar cada interacción (**PEND → OK**).
