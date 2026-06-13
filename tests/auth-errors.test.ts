import { describe, expect, it } from 'vitest';
import { loginQueryMessage, translateAuthError } from '@/lib/auth/errors';

describe('translateAuthError', () => {
  it('traduce credenciales invalidas', () => {
    expect(translateAuthError('Invalid login credentials')).toContain('incorrectos');
  });

  it('traduce cuenta bloqueada via query', () => {
    expect(loginQueryMessage(new URLSearchParams('error=blocked'))).toContain('suspendida');
  });
});
