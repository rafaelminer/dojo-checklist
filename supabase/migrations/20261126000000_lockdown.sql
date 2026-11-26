-- Segurança: bloquear acesso direto anon/authenticated à tabela records.
-- Depois de rodar, todo acesso passa pelo proxy /api/actions com service_role.
-- Rode este SQL somente depois de configurar SUPABASE_SERVICE_ROLE_KEY e o proxy na Vercel.

alter table public.records enable row level security;

drop policy if exists "records_select" on public.records;
drop policy if exists "records_insert" on public.records;
drop policy if exists "records_update" on public.records;
drop policy if exists "records_delete" on public.records;

revoke all on public.records from anon, authenticated;
grant select, insert, update, delete on public.records to service_role;

-- service_role não é afetado por RLS; anon/authenticated não têm mais acesso.
