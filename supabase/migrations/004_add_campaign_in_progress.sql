-- KUVO 004 — Agregar estado in_progress al enum campaign_status
-- Ejecutar SOLO este archivo antes de 005_production_hardening.sql
-- PostgreSQL exige commit entre ADD VALUE y uso del nuevo valor.

do $$
begin
  alter type public.campaign_status add value if not exists 'in_progress';
exception
  when duplicate_object then null;
end $$;
