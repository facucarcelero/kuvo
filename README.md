# KUVO — Plataforma completa de negocios y creadores

KUVO es un marketplace responsive para conectar negocios con influencers y creadores. El proyecto está preparado para funcionar en celular, tablet, notebook, escritorio y pantallas grandes.

## Incluye

- Landing pública profesional.
- Catálogo de creadores con búsqueda y filtros.
- Campañas públicas con presupuesto, entregables y ciudad.
- Registro e ingreso con correo y contraseña.
- Roles `business`, `creator` y `admin`.
- Panel adaptable según el rol.
- Creación y gestión de campañas.
- Postulaciones y estados: pendiente, preseleccionada, aceptada y rechazada.
- Favoritos persistentes.
- Mensajería y estructura de conversaciones.
- Perfiles, reputación, reseñas y KUVO Score.
- Panel de moderación y verificación.
- Base PostgreSQL/Supabase con RLS.
- Buckets para avatares y portfolio.
- PWA instalable, service worker, favicon, iconos y Open Graph.
- Tema oscuro/claro.
- Textos base de privacidad y términos.
- Dockerfile y configuración para Vercel.
- Modo demostración sin credenciales.

## Probar inmediatamente

```bash
npm install
npm run dev
```

Abrí `http://localhost:3000`. Sin variables de entorno, KUVO arranca en modo demostración. Podés registrarte o ingresar con cualquier correo y una contraseña de 8 caracteres.

## Activar la base de datos real

1. Creá un proyecto en Supabase.
2. Abrí **SQL Editor**.
3. Ejecutá, en este orden (proyecto existente: solo lo que falte):
   - `supabase/migrations/001_schema.sql`
   - `supabase/migrations/003_security_hardening.sql`
   - `supabase/migrations/004_add_campaign_in_progress.sql` (sesión separada)
   - `supabase/migrations/005_production_hardening.sql`
   - `supabase/migrations/002_seed.sql` (solo desarrollo)
4. Copiá `.env.example` como `.env.local`.
5. Completá las variables:

```env
SUPABASE_URL=https://TU-PROYECTO.supabase.co
SUPABASE_ANON_KEY=TU_CLAVE_ANON_PUBLICA
SITE_URL=http://localhost:3000
```

También se aceptan las variantes `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `NEXT_PUBLIC_SITE_URL`, pero las variables anteriores permiten usar el mismo build en distintos servidores.

6. En Supabase → Authentication → URL Configuration, configurá:
   - Site URL: tu dominio final.
   - Redirect URL: `https://tu-dominio.com/auth/callback`

No coloques nunca la clave `service_role`. La clave `anon` es pública por diseño y queda protegida por las políticas RLS.

## Crear el primer administrador

Primero registrá una cuenta normalmente. Después ejecutá en Supabase SQL Editor, reemplazando el correo:

```sql
select public.bootstrap_first_admin('admin@tu-dominio.com');
```

(solo si aún no hay administrador activo; ejecutar en SQL Editor como postgres).

El administrador entra desde `/admin`.

## Verificación de seguridad

Tras aplicar las migraciones en Supabase remoto:

1. Ejecutá los scripts SQL en `supabase/tests/` (003, 004, 005).
2. Configurá las cuentas `VERIFY_*` y `VERIFY_BLOQUEADO_*` en `.env.local`.
3. Corré `npm run verify:post-migration`.

Detalle completo en `SUPABASE_SETUP.md`.

## Subir a Vercel

1. Subí esta carpeta a un repositorio de GitHub.
2. Importá el repositorio en Vercel.
3. Cargá las tres variables de entorno del archivo `.env.example`.
4. Desplegá.
5. Actualizá `SITE_URL` y las URL de autenticación de Supabase con el dominio definitivo.

Vercel detecta Next.js automáticamente. También puede ejecutarse en cualquier servidor Node.js con:

```bash
npm run build
npm start
```

## Rutas principales

- `/` — Marketplace público.
- `/registro` — Alta de negocio o creador.
- `/login` — Ingreso.
- `/panel` — Panel por rol.
- `/admin` — Moderación.
- `/privacidad` — Política de privacidad base.
- `/terminos` — Términos de uso base.
- `/api/health` — Estado técnico.

## Identidad visual

Los archivos de marca están en `public/brand/`:

- `symbol.svg`
- `logo-horizontal.svg`
- `logo-white.svg`

Los iconos de pestaña y PWA están en `public/icons/`.

## Base de datos

Tablas principales:

- `profiles`
- `creator_profiles`
- `business_profiles`
- `campaigns`
- `applications`
- `favorites`
- `conversations`
- `conversation_members`
- `messages`
- `reviews`
- `notifications`

Todas las tablas privadas tienen Row Level Security. Las reglas permiten que cada usuario vea o modifique únicamente la información correspondiente a su cuenta, salvo los perfiles, campañas y reseñas expresamente públicos.

## Verificaciones realizadas

- `npm run build`: correcto.
- `npm run lint`: correcto.
- `npm audit --omit=dev`: 0 vulnerabilidades.
- TypeScript: correcto.
- Rutas generadas: correcto.
- Identidad: no contiene referencias a otros proyectos.
- Diseño responsive: breakpoints para móvil, tablet, desktop y pantallas 4K.

## Antes de vender o lanzar públicamente

- Reemplazá los datos de muestra por perfiles reales.
- Revisá términos y privacidad con un profesional.
- Definí correo de soporte y datos legales del titular.
- Configurá dominio, analítica, correo transaccional y monitoreo.
- Si vas a cobrar dentro de KUVO, integrá el proveedor de pagos correspondiente y definí reglas fiscales y de comisiones.
