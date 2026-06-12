-- Pruebas RLS ofensivas — ejecutar como usuarios de prueba en Supabase SQL Editor
-- Reemplazar UUIDs con IDs reales de tu entorno de staging

-- R1: Escalamiento de rol (debe fallar)
-- SET request.jwt.claim.sub = '<creator-account-uuid>';
-- UPDATE public.profiles SET role = 'admin' WHERE account_id = auth.uid();

-- R4: Auto-aceptación (debe fallar sin RPC)
-- UPDATE public.applications SET status = 'accepted' WHERE id = '<application-id>';

-- R6: Conversación arbitraria (debe fallar)
-- INSERT INTO public.conversations DEFAULT VALUES;

-- Verificar RPC aceptación (debe funcionar para dueño de campaña)
-- SELECT public.business_accept_application('<application-id>'::uuid);
