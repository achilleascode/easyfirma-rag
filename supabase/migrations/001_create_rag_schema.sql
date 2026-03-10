-- Enable pgvector extension
create extension if not exists vector;

-- Source documents (one row per MD file or scraped page)
create table documents (
  id            uuid primary key default gen_random_uuid(),
  source_type   text not null check (source_type in ('markdown', 'web_scrape')),
  file_path     text,
  url           text,
  title         text not null,
  category      text,
  raw_content   text not null,
  content_hash  text not null,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create unique index idx_documents_content_hash on documents(content_hash);

-- Chunks with embeddings
create table chunks (
  id            uuid primary key default gen_random_uuid(),
  document_id   uuid not null references documents(id) on delete cascade,
  chunk_index   int not null,
  content       text not null,
  heading       text,
  token_count   int,
  embedding     vector(1536) not null,
  metadata      jsonb default '{}',
  created_at    timestamptz default now()
);

create index idx_chunks_document on chunks(document_id);
create index idx_chunks_embedding on chunks
  using ivfflat (embedding vector_cosine_ops) with (lists = 10);

-- Chat sessions
create table chat_sessions (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  metadata      jsonb default '{}'
);

-- Chat messages
create table chat_messages (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references chat_sessions(id) on delete cascade,
  role          text not null check (role in ('user', 'assistant')),
  content       text not null,
  sources       jsonb default '[]',
  token_count   int,
  created_at    timestamptz default now()
);

create index idx_messages_session on chat_messages(session_id, created_at);

-- RPC function for vector similarity search
create or replace function match_chunks(
  query_embedding vector(1536),
  match_threshold float default 0.7,
  match_count int default 5
)
returns table (
  chunk_id      uuid,
  document_id   uuid,
  content       text,
  heading       text,
  title         text,
  url           text,
  file_path     text,
  category      text,
  similarity    float
)
language sql stable
as $$
  select
    c.id as chunk_id,
    d.id as document_id,
    c.content,
    c.heading,
    d.title,
    d.url,
    d.file_path,
    d.category,
    1 - (c.embedding <=> query_embedding) as similarity
  from chunks c
  join documents d on d.id = c.document_id
  where 1 - (c.embedding <=> query_embedding) > match_threshold
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

-- RLS policies
alter table documents enable row level security;
alter table chunks enable row level security;
alter table chat_sessions enable row level security;
alter table chat_messages enable row level security;

-- Allow read access for anon (chatbot reads)
create policy "Allow public read on documents" on documents for select using (true);
create policy "Allow public read on chunks" on chunks for select using (true);

-- Chat sessions: anyone can create and read their own
create policy "Allow public insert on chat_sessions" on chat_sessions for insert with check (true);
create policy "Allow public read on chat_sessions" on chat_sessions for select using (true);

-- Chat messages: anyone can insert and read
create policy "Allow public insert on chat_messages" on chat_messages for insert with check (true);
create policy "Allow public read on chat_messages" on chat_messages for select using (true);
