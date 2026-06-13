# Entrega migraciones 004 + 005 — NO aplicar sin confirmación humana

## 1. Diff final (resumen)

Archivos canónicos:

- `supabase/migrations/004_add_campaign_in_progress.sql` — enum `in_progress`
- `supabase/migrations/005_production_hardening.sql` — endurecimiento V1
- `supabase/tests/verify_schema_004.sql`
- `supabase/tests/verify_schema_005.sql`
- `scripts/verify-post-migration.mjs`

Instalación **nueva** (vacía): `supabase/KUVO_DATABASE_COMPLETE.sql` (= 001 + 003 + 004 + 005).

Base **existente** (001 ya aplicado): solo 003 (si falta), luego 004 en sesión separada, luego 005.

### Cambios clave en 005

| Área | Medida |
|------|--------|
| Reports | UPDATE solo `status`, `resolved_at`; trigger inmutabilidad; RLS admin read/update |
| conversation_members | UPDATE solo `last_read_at`; trigger inmutabilidad |
| notifications | UPDATE solo `read_at`; trigger inmutabilidad |
| reviews | UPDATE solo `rating`, `comment`; trigger inmutabilidad; unique en 001 |
| applications | INSERT `pending` obligatorio; trigger; estados vía RPC |
| campaigns | INSERT solo `draft`; trigger anti-cambio de `status`; RPC publish/pause/complete/cancel |
| business_accept_application | Idempotente; valida conversación y 2 miembros; no devuelve conv inconsistente |
| Cuenta bloqueada | `is_active_account()` en lecturas/escrituras; perfil/creator/business update bloqueados |
| VERIFY_BLOQUEADO_* | Pruebas B1–B10 en verificador Node |

## 2. Riesgos

- **004** requiere commit antes de usar `in_progress` en 005.
- Si ya hay conversaciones huérfanas (sin app `accepted`), `business_accept_application` fallará con error explícito (comportamiento deseado).
- Índice parcial `applications_one_accepted_per_campaign` falla si hay dos `accepted` por campaña (revisar datos antes).
- `REVOKE` en funciones internas puede romper triggers personalizados si existieran.
- Reload de schema PostgREST obligatorio tras aplicar.

## 3. Backup recomendado

Antes de 005 en producción:

1. Supabase Dashboard → Database → Backups (o snapshot manual del proyecto).
2. Export SQL de tablas críticas: `campaigns`, `applications`, `conversations`, `profiles`.
3. Anotar estado enum `campaign_status` actual.

## 4. Orden exacto de ejecución

```text
1. (Solo si falta) supabase/migrations/003_security_hardening.sql
2. supabase/migrations/004_add_campaign_in_progress.sql   ← sesión SQL separada, commit
3. supabase/migrations/005_production_hardening.sql
4. supabase/tests/verify_schema_004.sql
5. supabase/tests/verify_schema_005.sql
6. Settings → API → Reload schema
7. npm run verify:post-migration  (cuentas VERIFY_* en .env.local)
```

## 5. Consultas de verificación manual

```sql
-- Enum in_progress
select enumlabel from pg_enum e
join pg_type t on t.oid = e.enumtypid
where t.typname = 'campaign_status';

-- Sin UPDATE global en campaigns.status para authenticated
select has_column_privilege('authenticated', 'public.campaigns', 'status', 'UPDATE');

-- Trigger campaña
select tgname from pg_trigger t
join pg_class c on c.oid = t.tgrelid
where c.relname = 'campaigns' and tgname = 'guard_campaigns_status';
```

## 6. Rollback posible

No hay rollback automático. Opciones:

- **Restaurar backup** del proyecto (recomendado ante fallo grave).
- Revertir políticas/grants manualmente desde copia pre-migración.
- No eliminar índices únicos parciales sin limpiar datos duplicados primero.

---

**Estado:** listo para revisión humana. **No ejecutado en remoto** desde este commit.
