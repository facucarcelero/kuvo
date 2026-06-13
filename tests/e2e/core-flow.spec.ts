import { expect, test } from '@playwright/test';
import {
  createConfirmedUser,
  deleteUserById,
  login,
  logout,
  openPanelTab,
  type E2EUser,
} from './helpers/auth';
import { getSupabaseConfig } from './helpers/env';

test.describe.configure({ mode: 'serial' });

test.describe('KUVO V1 — Happy path', () => {
  const runId = Date.now().toString(36);
  const password = `KuvoE2e!${runId}`;
  const campaignTitle = `E2E Campaña ${runId}`;
  const campaignDescription = 'Campaña automatizada Playwright para validar el flujo crítico V1.';
  const applicationMessage = 'Propuesta E2E: cobertura en reel e historias con enfoque local y CTA claro.';

  let business: E2EUser;
  let creator: E2EUser;

  test.beforeAll(async () => {
    const { serviceRoleKey, demoMode, url, anonKey } = getSupabaseConfig();

    test.skip(!url || !anonKey, 'Configurá NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.');
    test.skip(demoMode, 'Desactivá NEXT_PUBLIC_DEMO_MODE para correr E2E contra Supabase real.');
    test.skip(!serviceRoleKey, 'Configurá SUPABASE_SERVICE_ROLE_KEY para crear usuarios confirmados (sin colisión de email).');

    business = await createConfirmedUser({
      email: `e2e-business-${runId}@kuvo-e2e.test`,
      password,
      name: `Negocio E2E ${runId}`,
      role: 'business',
    });

    creator = await createConfirmedUser({
      email: `e2e-creator-${runId}@kuvo-e2e.test`,
      password,
      name: `Creador E2E ${runId}`,
      role: 'creator',
    });
  });

  test.afterAll(async () => {
    if (business?.userId) await deleteUserById(business.userId).catch(() => {});
    if (creator?.userId) await deleteUserById(creator.userId).catch(() => {});
  });

  test('negocio publica → creador postula → negocio acepta → conversación', async ({ page }) => {
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 30);
    const deadlineValue = deadline.toISOString().slice(0, 10);

    // —— Negocio: publicar campaña ——
    await login(page, business.email, password);
    await page.getByRole('button', { name: 'Nueva campaña' }).first().click();
    await expect(page.getByRole('heading', { name: 'Publicar campaña' })).toBeVisible();

    await page.getByLabel('Título').fill(campaignTitle);
    await page.getByLabel('Descripción').fill(campaignDescription);
    await page.getByLabel('Ciudad').fill('San Juan');
    await page.getByLabel('Presupuesto mínimo').fill('80000');
    await page.getByLabel('Presupuesto máximo').fill('150000');
    await page.getByLabel('Fecha límite').fill(deadlineValue);
    await page.getByLabel('Entregables').fill('1 reel, 3 historias');

    await page.getByRole('button', { name: /Publicar campaña/i }).click();
    await expect(page.getByRole('heading', { name: 'Publicar campaña' })).toBeHidden({ timeout: 30_000 });
    await expect(page.getByText(campaignTitle)).toBeVisible();
    await expect(page.getByText('Activa').first()).toBeVisible();
    await logout(page);

    // —— Creador: descubrir en marketplace y postular ——
    await login(page, creator.email, password);

    await page.goto('/explorar');
    await page.getByRole('button', { name: 'Ver campañas' }).click();
    await expect(page.getByRole('heading', { name: campaignTitle })).toBeVisible({ timeout: 60_000 });

    await openPanelTab(page, 'Campañas');
    const campaignCard = page.locator('article').filter({ has: page.getByRole('heading', { name: campaignTitle }) });
    await campaignCard.getByRole('button', { name: /Postularme/i }).click();

    await expect(page.locator('.campaignCreateModal').getByRole('heading', { name: campaignTitle })).toBeVisible();
    await page.getByLabel('Tu propuesta').fill(applicationMessage);
    await page.getByLabel('Precio propuesto').fill('120000');
    await page.getByRole('button', { name: /Enviar postulación/i }).click();
    await expect(page.getByRole('heading', { name: 'Mis postulaciones' })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Pendiente').first()).toBeVisible();
    await logout(page);

    // —— Negocio: aceptar postulación ——
    await login(page, business.email, password);
    await openPanelTab(page, 'Postulaciones');

    const applicationRow = page.locator('.tableRow').filter({ hasText: creator.name });
    await expect(applicationRow).toBeVisible({ timeout: 60_000 });
    await applicationRow.getByRole('button', { name: 'Aceptar' }).click();

    await expect(applicationRow.getByText('Aceptada')).toBeVisible({ timeout: 30_000 });

    // Campaña en curso
    await openPanelTab(page, 'Mis campañas');
    await expect(page.locator('article').filter({ has: page.getByRole('heading', { name: campaignTitle }) }).getByText('En curso')).toBeVisible();

    // Conversación disponible
    await openPanelTab(page, 'Mensajes');
    await expect(page.locator('.conversationList button').first()).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText('Campaña vinculada')).toBeVisible();
    await expect(page.locator('.chatPanel form input[name="message"]')).toBeVisible();
  });
});
