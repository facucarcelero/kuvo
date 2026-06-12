# Plan de mejoras KUVO

## Fase 5 — Funcionalidades reales (prioridad alta)

- [ ] Mensajería: conversaciones reales, Realtime, paginación
- [ ] Favoritos panel sincronizados con Supabase
- [ ] Notificaciones UI + contador + marcar leídas
- [ ] Perfiles: upload Storage avatar/portfolio
- [ ] Campañas: draft, pausa, cancelación, conteo postulaciones
- [ ] Postulación: retiro vía RPC `creator_withdraw_application`
- [ ] Recuperación de contraseña Supabase
- [ ] Eliminación/anonimización de cuenta

## Fase 6 — UX, responsive, accesibilidad

- [ ] Auditoría visual 320px–4K
- [ ] Tablas → tarjetas móvil
- [ ] Focus trap modales, Escape, aria-live toasts
- [ ] `prefers-reduced-motion`

## Fase 7 — Testing

- [ ] Playwright flujos negocio/creador/admin
- [ ] pgTAP o scripts SQL RLS ofensivos
- [ ] Tests componentes AuthForm, Dashboard

## Fase 8 — CI/CD y docs

- [x] GitHub Actions lint/typecheck/test/build
- [ ] Playwright en CI
- [ ] Documentación despliegue Vercel/standalone unificada

## Fase 9 — Auditoría final

- [ ] Pentest lógico RLS
- [ ] Revisión legal términos/privacidad (profesional externo)
- [ ] Core Web Vitals

## Refactor arquitectura (incremental)

```
features/
  auth/
  marketplace/
  campaigns/
  applications/
  messages/
  profiles/
  admin/
lib/
  validation/   # Zod
  errors/
  permissions/
  score/        # KUVO Score documentado
```

## KUVO Score (diseño propuesto)

Factores (0–100, no editable por creador):

| Factor | Peso sugerido |
|--------|---------------|
| Perfil completado | 15% |
| Verificación KUVO | 20% |
| Campañas completadas | 25% |
| Promedio reseñas | 20% |
| Tasa respuesta | 10% |
| Cancelaciones/disputas | -10% |

Mostrar "Datos insuficientes" si < 2 señales.

## Pagos

**No implementar** hasta definición comercial. Arquitectura futura: Mercado Pago webhooks + idempotencia.
