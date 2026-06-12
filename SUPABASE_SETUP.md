# Configuración de Supabase para KUVO

## 1. Ejecutar migraciones

### Proyecto NUEVO (Supabase vacío)

1. `supabase/migrations/001_schema.sql`
2. `supabase/migrations/003_security_hardening.sql`
3. `002_seed.sql` **solo en desarrollo** (no producción)

### Proyecto EXISTENTE (ya corriste 001 antes)

**No vuelvas a ejecutar 001.** Si ves `type "account_role" already exists`, es porque 001 ya está aplicado.

Ejecutá **solo**:

```
supabase/migrations/003_security_hardening.sql
```

Validá con `supabase/tests/verify_schema_003.sql` y luego `npm run verify:post-migration`.

Alternativa instalación completa desde cero: `supabase/KUVO_DATABASE_COMPLETE.sql` (incluye 001+003; **no** usar si 001 ya existe).

## 2. Autenticación

En Authentication → Providers, mantener Email habilitado. Para producción se recomienda exigir confirmación de correo.

En Authentication → URL Configuration:

- Site URL: `https://tu-dominio.com`
- Redirect URLs:
  - `http://localhost:3000/auth/callback`
  - `https://tu-dominio.com/auth/callback`

## 3. Storage

La migración crea los buckets públicos `avatars` y `portfolio`. Los archivos deben subirse dentro de una carpeta cuyo nombre sea el `profile_id` del usuario:

- `avatars/<profile_id>/avatar.webp`
- `portfolio/<profile_id>/archivo.webp`

Las políticas impiden modificar carpetas pertenecientes a otros usuarios.

## 4. Seguridad

Nunca colocar la clave `service_role` en el frontend. KUVO usa solamente la clave pública `anon`; la seguridad efectiva depende de las políticas RLS incluidas en la migración.

## 5. Administrador

La registración pública nunca permite crear administradores. El rol debe asignarse manualmente desde SQL con una cuenta ya registrada.
