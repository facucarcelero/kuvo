const ALLOWED_PREFIXES = ['/panel', '/admin', '/explorar', '/registro', '/login', '/privacidad', '/terminos'];

export function sanitizeInternalRedirect(next: string | null | undefined, fallback = '/panel'): string {
  if (!next) return fallback;
  const value = next.trim();
  if (!value.startsWith('/')) return fallback;
  if (value.startsWith('//')) return fallback;
  if (value.includes('://')) return fallback;
  if (value.includes('\\')) return fallback;
  if (value.includes('@')) return fallback;

  const pathOnly = value.split('?')[0]?.split('#')[0] ?? value;
  const allowed = ALLOWED_PREFIXES.some(prefix => pathOnly === prefix || pathOnly.startsWith(`${prefix}/`));
  return allowed ? value : fallback;
}
