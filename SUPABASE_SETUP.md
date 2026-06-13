# Configuración de Supabase para KUVO

## 1. Ejecutar migraciones

### Proyecto NUEVO (Supabase vacío)

1. `supabase/migrations/001_schema.sql`
2. `supabase/migrations/003_security_hardening.sql`
3. `002_seed.sql` **solo en desarrollo** (no producción)

### Proyecto EXISTENTE (ya corriste 001 antes)

**No vuelvas a ejecutar 001.** Si ves `type "account_role" already exists`, es porque 001 ya está aplicado.

Ejecutá **solo** lo que falte, en este orden:

```
supabase/migrations/003_security_hardening.sql
supabase/migrations/004_add_campaign_in_progress.sql   ← sesión separada (commit)
supabase/migrations/005_production_hardening.sql
```

Validá con:

- `supabase/tests/verify_schema_003.sql`
- `supabase/tests/verify_schema_004.sql`
- `supabase/tests/verify_schema_005.sql`
- `npm run verify:post-migration` (requiere cuentas `VERIFY_*` incl. `VERIFY_BLOQUEADO_*`)

Alternativa instalación completa desde cero: `supabase/KUVO_DATABASE_COMPLETE.sql` (incluye 001+003+004+005; **no** usar si 001 ya existe).

## 2. Autenticación

En Authentication → Providers, mantener Email habilitado. Para producción se recomienda exigir confirmación de correo.

En Authentication → URL Configuration:

- Site URL: `https://tu-dominio.com`
- Redirect URLs:
  - `http://localhost:1000/auth/callback`
  - `https://tu-dominio.com/auth/callback`

## 3. Storage

La migración crea los buckets públicos `avatars` y `portfolio`. Los archivos deben subirse dentro de una carpeta cuyo nombre sea el `profile_id` del usuario:

- `avatars/<profile_id>/avatar.webp`
- `portfolio/<profile_id>/archivo.webp`

Las políticas impiden modificar carpetas pertenecientes a otros usuarios. Las cuentas con `profiles.active = false` no pueden subir archivos.

## 4. Seguridad

Nunca colocar la clave `service_role` en el frontend. KUVO usa solamente la clave pública `anon`; la seguridad efectiva depende de las políticas RLS incluidas en las migraciones.

Puntos clave de la migración 005:

- Campañas: crear siempre como `draft`, publicar con `business_publish_campaign`.
- Postulaciones: insert solo `pending`; cambios de estado vía RPC.
- Reports: usuarios crean; solo admins resuelven (`status`, `resolved_at`).
- `conversation_members`, `notifications` y `reviews`: UPDATE restringido por columna + triggers de inmutabilidad.

## 5. Administrador

La registración pública nunca permite crear administradores. El rol debe asignarse manualmente desde SQL con una cuenta ya registrada, preferentemente con:

```sql
select public.bootstrap_first_admin('tu-correo@dominio.com');
```

(solo funciona si aún no hay admin activo; ejecutar como `postgres` en SQL Editor).

## 6. Verificación funcional

Configurá `.env.local` con las variables de `.env.example`, incluyendo:

- Tres cuentas ofensivas: negocio, creador, tercero.
- Una cuenta bloqueada (`VERIFY_BLOQUEADO_*`) con `profiles.active = false`.

```bash
npm run verify:post-migration
```
