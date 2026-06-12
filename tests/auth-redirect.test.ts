import { describe, expect, it } from 'vitest';
import { sanitizeInternalRedirect } from '@/lib/auth/redirect';

describe('sanitizeInternalRedirect', () => {
  it('acepta rutas internas seguras', () => {
    expect(sanitizeInternalRedirect('/panel')).toBe('/panel');
    expect(sanitizeInternalRedirect('/admin/users')).toBe('/admin/users');
  });

  it('rechaza URLs externas y protocol-relative', () => {
    expect(sanitizeInternalRedirect('https://evil.com')).toBe('/panel');
    expect(sanitizeInternalRedirect('//evil.com')).toBe('/panel');
    expect(sanitizeInternalRedirect('/\\evil.com')).toBe('/panel');
  });

  it('usa fallback cuando el valor es inválido', () => {
    expect(sanitizeInternalRedirect(null, '/login')).toBe('/login');
    expect(sanitizeInternalRedirect('/unknown', '/panel')).toBe('/panel');
  });
});
