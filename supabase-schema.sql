-- Supabase schema for Visionary persistent storage with Authentication
create extension if not exists "uuid-ossp";

-- Projects table with user ownership
create table if not exists public.projects (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
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

-- Project states table
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

-- User settings table (one row per user)
create table if not exists public.user_settings (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  elevenlabs_api_key text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

-- Auto-update timestamp function
create or replace function public.set_current_timestamp_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- Triggers for auto-updating timestamps
create trigger projects_set_updated_at
before update on public.projects
for each row execute procedure public.set_current_timestamp_updated_at();

create trigger project_states_set_updated_at
before update on public.project_states
for each row execute procedure public.set_current_timestamp_updated_at();

create trigger user_settings_set_updated_at
before update on public.user_settings
for each row execute procedure public.set_current_timestamp_updated_at();

-- Enable Row Level Security
alter table public.projects enable row level security;
alter table public.project_states enable row level security;
alter table public.user_settings enable row level security;

-- RLS Policies for projects (users can only access their own projects)
create policy "Users can view their own projects"
  on public.projects for select
  using (auth.uid() = user_id);

create policy "Users can create their own projects"
  on public.projects for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own projects"
  on public.projects for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own projects"
  on public.projects for delete
  using (auth.uid() = user_id);

-- RLS Policies for project_states (inherits access from projects table)
create policy "Users can view their own project states"
  on public.project_states for select
  using (
    exists (
      select 1 from public.projects
      where projects.id = project_states.project_id
      and projects.user_id = auth.uid()
    )
  );

create policy "Users can create their own project states"
  on public.project_states for insert
  with check (
    exists (
      select 1 from public.projects
      where projects.id = project_states.project_id
      and projects.user_id = auth.uid()
    )
  );

create policy "Users can update their own project states"
  on public.project_states for update
  using (
    exists (
      select 1 from public.projects
      where projects.id = project_states.project_id
      and projects.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects
      where projects.id = project_states.project_id
      and projects.user_id = auth.uid()
    )
  );

create policy "Users can delete their own project states"
  on public.project_states for delete
  using (
    exists (
      select 1 from public.projects
      where projects.id = project_states.project_id
      and projects.user_id = auth.uid()
    )
  );

-- RLS Policies for user_settings (users can only access their own settings)
create policy "Users can view their own settings"
  on public.user_settings for select
  using (auth.uid() = user_id);

create policy "Users can create their own settings"
  on public.user_settings for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own settings"
  on public.user_settings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own settings"
  on public.user_settings for delete
  using (auth.uid() = user_id);

-- Create index for faster user lookups
create index if not exists projects_user_id_idx on public.projects(user_id);
create index if not exists user_settings_user_id_idx on public.user_settings(user_id);
