# Configuración de Supabase para KUVO

## 1. Ejecutar migraciones

Ejecutar `001_schema.sql` y luego `002_seed.sql` desde SQL Editor.

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
