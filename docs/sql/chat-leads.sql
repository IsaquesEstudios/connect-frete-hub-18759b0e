-- Tabela que guarda as respostas dos chats públicos (/chat/motorista e /chat/carga).
-- Execute uma vez no SQL Editor do banco externo.
create table if not exists public.chat_leads (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('motorista', 'carga')),
  nome text not null,
  whatsapp text not null,
  origem text,
  destino text,
  tipo_veiculo text,
  carroceria text,
  peso text,
  valor text,
  material text,
  forma_pagamento text,
  info_extra text,
  created_at timestamptz not null default now()
);
create index if not exists chat_leads_kind_created_idx on public.chat_leads(kind, created_at desc);

grant select, delete on public.chat_leads to authenticated;
grant all on public.chat_leads to service_role;

alter table public.chat_leads enable row level security;

-- Gravação é feita pelo servidor (chave de serviço). Leitura só para a equipe.
drop policy if exists chat_leads_staff_read on public.chat_leads;
create policy chat_leads_staff_read on public.chat_leads
  for select to authenticated using (private.is_staff((select auth.uid())));
drop policy if exists chat_leads_staff_delete on public.chat_leads;
create policy chat_leads_staff_delete on public.chat_leads
  for delete to authenticated using (private.is_staff((select auth.uid())));
