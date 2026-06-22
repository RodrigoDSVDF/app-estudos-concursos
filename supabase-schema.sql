-- ================================================================
-- ConcursoTrack — Schema Supabase (com Auth multi-usuário)
-- Execute este script no SQL Editor do Supabase:
-- https://supabase.com/dashboard/project/zryovbcyhecxwduzdpme/sql/new
--
-- Este schema ISOLA os dados por usuário: cada usuário só vê e
-- edita seus próprios dados (Row Level Security por auth.uid()).
-- ================================================================

-- Extensão para gen_random_uuid()
create extension if not exists "pgcrypto";

-- ================================================================
-- DROP TABELAS ANTIGAS (schema anterior incompatível)
-- ATENÇÃO: apaga todos os dados existentes. Faça backup antes.
-- ================================================================
drop table if exists anotacoes cascade;
drop table if exists revisoes cascade;
drop table if exists editais cascade;
drop table if exists sessoes cascade;
drop table if exists conteudos cascade;
drop table if exists materias cascade;
drop table if exists concursos cascade;
drop table if exists meta cascade;

-- ================================================================
-- TABELAS — todas com user_id para isolamento por usuário
-- ================================================================

-- Concursos
create table concursos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  nome text not null,
  orgao text,
  banca text,
  data_prova date,
  link_edital text,
  status text default 'planejado' check (status in ('planejado', 'em_andamento', 'finalizado')),
  criado_em timestamptz default now(),
  atualizado_em timestamptz default now()
);

-- Matérias
create table materias (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  concurso_id uuid not null references concursos(id) on delete cascade,
  nome text not null,
  peso int default 1,
  prioridade int default 3,
  carga_horaria_planejada int default 0,
  criado_em timestamptz default now(),
  atualizado_em timestamptz default now()
);

-- Conteúdos
create table conteudos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  materia_id uuid not null references materias(id) on delete cascade,
  nome text not null,
  status text default 'nao_iniciado' check (status in ('nao_iniciado', 'em_andamento', 'concluido')),
  dificuldade int default 3 check (dificuldade >= 1 and dificuldade <= 5),
  criado_em timestamptz default now(),
  atualizado_em timestamptz default now()
);

-- Sessões de estudo
create table sessoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  concurso_id uuid references concursos(id) on delete set null,
  materia_id uuid references materias(id) on delete set null,
  conteudo_id uuid references conteudos(id) on delete set null,
  data_inicio timestamptz,
  data_fim timestamptz,
  tempo_minutos int default 0,
  tipo_estudo text check (tipo_estudo in ('teoria', 'exercicios', 'revisao', 'simulado')),
  tecnica text check (tecnica in ('pomodoro', 'leitura_ativa', 'flashcards', 'resolucao_questoes', 'livre')),
  nivel_concentracao int check (nivel_concentracao is null or (nivel_concentracao >= 1 and nivel_concentracao <= 5)),
  nivel_energia int check (nivel_energia is null or (nivel_energia >= 1 and nivel_energia <= 5)),
  nivel_compreensao int check (nivel_compreensao is null or (nivel_compreensao >= 1 and nivel_compreensao <= 5)),
  humor_antes int check (humor_antes is null or (humor_antes >= 1 and humor_antes <= 5)),
  humor_depois int check (humor_depois is null or (humor_depois >= 1 and humor_depois <= 5)),
  criado_em timestamptz default now(),
  atualizado_em timestamptz default now()
);

-- Anotações
create table anotacoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  sessao_id uuid references sessoes(id) on delete cascade,
  materia_id uuid references materias(id) on delete set null,
  conteudo_id uuid references conteudos(id) on delete set null,
  resumo text,
  duvidas text,
  aprendizados text,
  erros_recorrentes text,
  proximos_passos text,
  tags text[] default '{}',
  criado_em timestamptz default now(),
  atualizado_em timestamptz default now()
);

-- Revisões
create table revisoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  conteudo_id uuid references conteudos(id) on delete cascade,
  materia_id uuid references materias(id) on delete set null,
  sessao_origem_id uuid references sessoes(id) on delete set null,
  descricao text,
  data_programada timestamptz not null,
  data_criacao timestamptz default now(),
  status text default 'pendente' check (status in ('pendente', 'concluida')),
  concluida_em timestamptz,
  atualizado_em timestamptz default now()
);

-- Editais (metadata; o arquivo PDF fica no Storage)
create table editais (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  concurso_id uuid not null references concursos(id) on delete cascade,
  nome_arquivo text not null,
  tamanho bigint,
  tipo text,
  caminho_storage text,
  url_publica text,
  data_upload timestamptz default now()
);

-- Metadados do app (por usuário)
create table meta (
  key text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  value jsonb,
  at timestamptz default now()
);

-- ================================================================
-- ÍNDICES
-- ================================================================
create index if not exists idx_concursos_user_id on concursos(user_id);
create index if not exists idx_materias_user_id on materias(user_id);
create index if not exists idx_materias_concurso_id on materias(concurso_id);
create index if not exists idx_conteudos_user_id on conteudos(user_id);
create index if not exists idx_conteudos_materia_id on conteudos(materia_id);
create index if not exists idx_conteudos_status on conteudos(status);
create index if not exists idx_sessoes_user_id on sessoes(user_id);
create index if not exists idx_sessoes_concurso_id on sessoes(concurso_id);
create index if not exists idx_sessoes_materia_id on sessoes(materia_id);
create index if not exists idx_sessoes_conteudo_id on sessoes(conteudo_id);
create index if not exists idx_sessoes_data_inicio on sessoes(data_inicio desc);
create index if not exists idx_anotacoes_user_id on anotacoes(user_id);
create index if not exists idx_anotacoes_sessao_id on anotacoes(sessao_id);
create index if not exists idx_anotacoes_conteudo_id on anotacoes(conteudo_id);
create index if not exists idx_revisoes_user_id on revisoes(user_id);
create index if not exists idx_revisoes_conteudo_id on revisoes(conteudo_id);
create index if not exists idx_revisoes_data_programada on revisoes(data_programada);
create index if not exists idx_revisoes_status on revisoes(status);
create index if not exists idx_editais_user_id on editais(user_id);
create index if not exists idx_editais_concurso_id on editais(concurso_id);
create index if not exists idx_meta_user_id on meta(user_id);

-- ================================================================
-- ROW LEVEL SECURITY — ISOLAMENTO POR USUÁRIO
-- Cada usuário só vê e edita seus próprios dados.
-- ================================================================
alter table concursos enable row level security;
alter table materias enable row level security;
alter table conteudos enable row level security;
alter table sessoes enable row level security;
alter table anotacoes enable row level security;
alter table revisoes enable row level security;
alter table editais enable row level security;
alter table meta enable row level security;

-- Remove policies antigas
drop policy if exists "owner_all_concursos" on concursos;
drop policy if exists "owner_all_materias" on materias;
drop policy if exists "owner_all_conteudos" on conteudos;
drop policy if exists "owner_all_sessoes" on sessoes;
drop policy if exists "owner_all_anotacoes" on anotacoes;
drop policy if exists "owner_all_revisoes" on revisoes;
drop policy if exists "owner_all_editais" on editais;
drop policy if exists "owner_all_meta" on meta;

-- Policies: dono pode tudo; sempre isolado por auth.uid() = user_id
create policy "owner_all_concursos" on concursos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "owner_all_materias" on materias
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "owner_all_conteudos" on conteudos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "owner_all_sessoes" on sessoes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "owner_all_anotacoes" on anotacoes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "owner_all_revisoes" on revisoes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "owner_all_editais" on editais
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "owner_all_meta" on meta
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ================================================================
-- STORAGE BUCKET para PDFs de editais
-- Caminho: editais/<user_id>/<concurso_id>/<arquivo>
-- ================================================================
insert into storage.buckets (id, name, public)
values ('editais', 'editais', true)
on conflict (id) do nothing;

-- Remove policies antigas
drop policy if exists "owner_select_editais" on storage.objects;
drop policy if exists "owner_insert_editais" on storage.objects;
drop policy if exists "owner_update_editais" on storage.objects;
drop policy if exists "owner_delete_editais" on storage.objects;
drop policy if exists "public_read_editais" on storage.objects;
drop policy if exists "public_insert_editais" on storage.objects;
drop policy if exists "public_update_editais" on storage.objects;
drop policy if exists "public_delete_editais" on storage.objects;

-- Storage isolado por user_id no caminho do arquivo.
-- O app sempre faz upload com path: <user_id>/<concurso_id>/<arquivo>
-- Assim, a policy consegue isolar por auth.uid() = (storage.foldername(path))[1]
create policy "owner_select_editais" on storage.objects for select
  using (bucket_id = 'editais' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "owner_insert_editais" on storage.objects for insert
  with check (bucket_id = 'editais' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "owner_update_editais" on storage.objects for update
  using (bucket_id = 'editais' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "owner_delete_editais" on storage.objects for delete
  using (bucket_id = 'editais' and auth.uid()::text = (storage.foldername(name))[1]);

-- ================================================================
-- TRIGGER para preencher user_id automaticamente em INSERT
-- (quando o app não enviar o user_id explicitamente)
-- ================================================================
create or replace function set_user_id()
returns trigger as $$
begin
  if new.user_id is null then
    new.user_id = auth.uid();
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_set_user_id_concursos on concursos;
drop trigger if exists trg_set_user_id_materias on materias;
drop trigger if exists trg_set_user_id_conteudos on conteudos;
drop trigger if exists trg_set_user_id_sessoes on sessoes;
drop trigger if exists trg_set_user_id_anotacoes on anotacoes;
drop trigger if exists trg_set_user_id_revisoes on revisoes;
drop trigger if exists trg_set_user_id_editais on editais;
drop trigger if exists trg_set_user_id_meta on meta;

create trigger trg_set_user_id_concursos before insert on concursos
  for each row execute function set_user_id();
create trigger trg_set_user_id_materias before insert on materias
  for each row execute function set_user_id();
create trigger trg_set_user_id_conteudos before insert on conteudos
  for each row execute function set_user_id();
create trigger trg_set_user_id_sessoes before insert on sessoes
  for each row execute function set_user_id();
create trigger trg_set_user_id_anotacoes before insert on anotacoes
  for each row execute function set_user_id();
create trigger trg_set_user_id_revisoes before insert on revisoes
  for each row execute function set_user_id();
create trigger trg_set_user_id_editais before insert on editais
  for each row execute function set_user_id();
create trigger trg_set_user_id_meta before insert on meta
  for each row execute function set_user_id();

-- ================================================================
-- TRIGGER para atualizar atualizado_em automaticamente
-- ================================================================
create or replace function update_atualizado_em()
returns trigger as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_concursos_updated on concursos;
drop trigger if exists trg_materias_updated on materias;
drop trigger if exists trg_conteudos_updated on conteudos;
drop trigger if exists trg_sessoes_updated on sessoes;
drop trigger if exists trg_anotacoes_updated on anotacoes;
drop trigger if exists trg_revisoes_updated on revisoes;

create trigger trg_concursos_updated before update on concursos
  for each row execute function update_atualizado_em();
create trigger trg_materias_updated before update on materias
  for each row execute function update_atualizado_em();
create trigger trg_conteudos_updated before update on conteudos
  for each row execute function update_atualizado_em();
create trigger trg_sessoes_updated before update on sessoes
  for each row execute function update_atualizado_em();
create trigger trg_anotacoes_updated before update on anotacoes
  for each row execute function update_atualizado_em();
create trigger trg_revisoes_updated before update on revisoes
  for each row execute function update_atualizado_em();

-- ================================================================
-- PRONTO!
-- Após executar:
-- 1. Vá em Authentication → Providers → Google
-- 2. Ative o provedor Google e cole Client ID + Client Secret
-- 3. Configure a URL de redirect para seu GitHub Pages
-- ================================================================
