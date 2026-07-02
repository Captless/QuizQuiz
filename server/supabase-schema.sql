-- ================================
-- QuikQuiz — Supabase Schema Setup
-- ================================
-- Run this in the Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql/new)

-- 1. Profiles table (syncs with auth.users via trigger)
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  name        text,
  avatar_url  text,
  stripe_customer_id text,
  subscription_status text default 'inactive',
  usage_count integer default 0,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. Quizzes table
create table if not exists public.quizzes (
  id           text primary key,
  user_id      uuid references public.profiles(id) on delete cascade,
  title        text default 'Untitled Quiz',
  topic        text,
  subject      text,
  difficulty   text default 'Easy',
  format       text default 'form',
  show_score   boolean default true,
  timer_seconds integer default 0,
  questions    jsonb not null,
  created_at   timestamptz default now()
);

-- 3. Results table
create table if not exists public.results (
  id           bigint generated always as identity primary key,
  quiz_id      text references public.quizzes(id) on delete cascade,
  answers      jsonb,
  correct      integer not null,
  total        integer not null,
  percentage   integer,
  submitted_at timestamptz default now()
);

-- Indexes
create index if not exists idx_quizzes_user_id on public.quizzes(user_id);
create index if not exists idx_results_quiz_id on public.results(quiz_id);

-- ================================
-- Row Level Security
-- ================================

alter table public.profiles enable row level security;
alter table public.quizzes enable row level security;
alter table public.results enable row level security;

-- Profiles: users can read/update their own
create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Quizzes: any authenticated user can read, insert, update, delete their own
create policy "Anyone can read shared quizzes"
  on public.quizzes for select
  using (true);

create policy "Authenticated users can create quizzes"
  on public.quizzes for insert
  with check (auth.role() = 'authenticated');

create policy "Users can update own quizzes"
  on public.quizzes for update
  using (auth.uid() = user_id);

create policy "Users can delete own quizzes"
  on public.quizzes for delete
  using (auth.uid() = user_id);

-- Results: anyone can insert, only quiz owner can read
create policy "Anyone can submit results"
  on public.results for insert
  with check (true);

create policy "Quiz owners can view results"
  on public.results for select
  using (
    exists (
      select 1 from public.quizzes
      where quizzes.id = results.quiz_id
        and quizzes.user_id = auth.uid()
    )
  );

-- ================================
-- Functions
-- ================================

create or replace function increment_usage(user_id uuid)
returns integer as $$
  update public.profiles
  set usage_count = usage_count + 1
  where id = user_id
  returning usage_count;
$$ language sql;

-- ================================
-- Storage: quiz-uploads bucket
-- ================================

-- Create bucket (run this once in Supabase Dashboard > Storage)
-- Name: quiz-uploads
-- Public: false
-- SQL alternative:
-- select storage.create_bucket('quiz-uploads', false);
