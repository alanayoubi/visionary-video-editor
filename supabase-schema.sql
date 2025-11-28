-- Supabase schema for Visionary persistent storage
create extension if not exists "uuid-ossp";

create table if not exists public.projects (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  video_storage_path text,
  video_file_name text,
  video_mime_type text,
  video_file_uri text,
  master_audio_storage_path text,
  master_audio_mime_type text,
  has_master_audio boolean default false,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  last_opened_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.project_states (
  project_id uuid primary key references public.projects(id) on delete cascade,
  messages jsonb not null default '[]'::jsonb,
  clips jsonb not null default '[]'::jsonb,
  timeline_events jsonb not null default '[]'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  master_audio_meta jsonb,
  editor_meta jsonb,
  has_analyzed boolean default false,
  active_clip_id text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create or replace function public.set_current_timestamp_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

create trigger projects_set_updated_at
before update on public.projects
for each row execute procedure public.set_current_timestamp_updated_at();

create trigger project_states_set_updated_at
before update on public.project_states
for each row execute procedure public.set_current_timestamp_updated_at();

alter table public.projects enable row level security;
alter table public.project_states enable row level security;

create policy "Public read access" on public.projects
for select using (true);

create policy "Public write access" on public.projects
for insert with check (true);

create policy "Public update access" on public.projects
for update using (true) with check (true);

create policy "Public read access" on public.project_states
for select using (true);

create policy "Public write access" on public.project_states
for insert with check (true);

create policy "Public update access" on public.project_states
for update using (true) with check (true);
