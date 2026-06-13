import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { getSupabaseConfig } from './env';

export type E2EUser = {
  email: string;
  password: string;
  name: string;
  role: 'business' | 'creator';
  userId?: string;
};

export function createAdminClient(): SupabaseClient {
  const { url, serviceRoleKey } = getSupabaseConfig();
  if (!url || !serviceRoleKey) {
    throw new Error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY para crear usuarios E2E.');
  }
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function createConfirmedUser(user: E2EUser): Promise<E2EUser> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
    user_metadata: { full_name: user.name, role: user.role },
  });

  if (error || !data.user) {
    throw new Error(`No se pudo crear usuario E2E (${user.role}): ${error?.message ?? 'sin user'}`);
  }

  return { ...user, userId: data.user.id };
}

export async function deleteUserById(userId: string) {
  const admin = createAdminClient();
  await admin.auth.admin.deleteUser(userId);
}

export async function waitForPanelReady(page: Page) {
  await page.waitForURL(/\/panel(?:\?.*)?$/);
  await page.getByText('Cargando tu espacio').waitFor({ state: 'hidden', timeout: 60_000 }).catch(() => {});
  await expect(page.locator('.dashContent')).toBeVisible({ timeout: 60_000 });
}

export async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await waitForPanelReady(page);
}

export async function logout(page: Page) {
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await page.waitForURL(/\/(?:\?.*)?$/);
}

export async function openPanelTab(page: Page, tabName: string | RegExp) {
  if (!/\/panel(?:\?.*)?$/.test(new URL(page.url()).pathname + new URL(page.url()).search)) {
    await page.goto('/panel');
    await waitForPanelReady(page);
  }

  const tabButton = page.locator('.dashSidebar nav').getByRole('button', { name: tabName });
  if (!(await tabButton.isVisible())) {
    await page.locator('.dashMenu').click();
  }
  await tabButton.click();
  await expect(page.locator('.dashContent')).toBeVisible();
}
