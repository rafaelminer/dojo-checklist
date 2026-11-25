-- Dojo Checklist: tabela única de registros usada pelo front-end.
-- Rode este SQL no SQL Editor do Supabase antes de preencher o .env.local.

create extension if not exists pgcrypto;

create table if not exists public.records (
  id text primary key default gen_random_uuid()::text,
  collection text not null,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists records_collection_idx on public.records (collection);
create index if not exists records_collection_id_idx on public.records (collection, id);

-- O app usa a chave anon (pública) e faz o controle de acesso na própria interface.
-- Se quiser restringir depois, troque estas políticas por regras com JWT.
alter table public.records enable row level security;

drop policy if exists "records_select" on public.records;
drop policy if exists "records_insert" on public.records;
drop policy if exists "records_update" on public.records;
drop policy if exists "records_delete" on public.records;

create policy "records_select" on public.records
  for select to anon, authenticated using (true);

create policy "records_insert" on public.records
  for insert to anon, authenticated with check (true);

create policy "records_update" on public.records
  for update to anon, authenticated using (true) with check (true);

create policy "records_delete" on public.records
  for delete to anon, authenticated using (true);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.records to anon, authenticated;
