-- Kör en gång i Supabase SQL Editor. Servern når tabellen med
-- service role-nyckeln, så ingen RLS-policy behövs för anon.
create table if not exists documents (
  collection text not null,
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (collection, id)
);

alter table documents enable row level security;

-- Bara servern får röra tabellen. Behövs när projektet inte exponerar nya
-- tabeller automatiskt; anon och authenticated får ingen åtkomst alls.
grant select, insert, update, delete on documents to service_role;
