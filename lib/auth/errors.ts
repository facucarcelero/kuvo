/** Mensajes de auth en español — sin exponer detalles técnicos de Supabase. */

const MAP: Record<string, string> = {
  'Invalid login credentials': 'Correo o contraseña incorrectos.',
  'Email not confirmed': 'Confirmá tu correo antes de ingresar. Revisá tu bandeja de entrada.',
  'User already registered': 'Ya existe una cuenta con ese correo.',
  'Password should be at least 6 characters': 'La contraseña debe tener al menos 8 caracteres.',
  'Signup requires a valid password': 'Ingresá una contraseña válida de al menos 8 caracteres.',
  'Unable to validate email address: invalid format': 'El formato del correo no es válido.',
  'Email rate limit exceeded': 'Demasiados intentos. Esperá unos minutos e intentá de nuevo.',
  'For security purposes, you can only request this once every 60 seconds': 'Por seguridad, podés solicitar esto una vez cada 60 segundos.',
  auth_callback_failed: 'No pudimos completar el ingreso. Intentá nuevamente.',
  auth_unavailable: 'El servicio de autenticación no está disponible. Intentá más tarde.',
};

export function translateAuthError(codeOrMessage: string | null | undefined, fallback = 'Ocurrió un error. Intentá de nuevo.'): string {
  if (!codeOrMessage) return fallback;
  const trimmed = codeOrMessage.trim();
  if (MAP[trimmed]) return MAP[trimmed];
  if (/invalid login credentials/i.test(trimmed)) return MAP['Invalid login credentials'];
  if (/email not confirmed/i.test(trimmed)) return MAP['Email not confirmed'];
  if (/already registered|already exists/i.test(trimmed)) return MAP['User already registered'];
  if (/rate limit/i.test(trimmed)) return MAP['Email rate limit exceeded'];
  return fallback;
}

export function loginQueryMessage(searchParams: URLSearchParams): string {
  const error = searchParams.get('error');
  if (error === 'blocked') return 'Tu cuenta fue suspendida. Contactá a soporte si creés que es un error.';
  if (error) return translateAuthError(error);
  if (searchParams.get('confirmed') === '1') return 'Correo confirmado. Ya podés ingresar.';
  if (searchParams.get('reset') === 'sent') return 'Te enviamos un enlace para restablecer tu contraseña.';
  if (searchParams.get('reset') === 'ok') return 'Contraseña actualizada. Ingresá con tu nueva clave.';
  return '';
}
