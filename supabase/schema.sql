-- Run this in the Supabase SQL editor.
-- Auth users are created via the admin API using a fake email
-- (username@gymarc.internal). This table extends that with the
-- app-specific bits: username, recovery code, admin flag, units.

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  recovery_code text not null,
  is_admin boolean not null default false,
  units text not null default 'kg' check (units in ('kg', 'lbs')),
  reset_attempts int not null default 0,
  reset_locked_until timestamptz,
  daily_water_target_ml int not null default 3000,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "profiles are readable by any logged-in user"
  on profiles for select using (auth.role() = 'authenticated');

create policy "users can update their own profile"
  on profiles for update using (auth.uid() = id);

-- Everything below follows the same pattern: owner can write,
-- any logged-in user can read (needed for the open feed).

create table goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  goal_type text not null check (goal_type in ('bulk','cut','maintenance')),
  start_date date not null default current_date,
  end_date date not null,
  target_weight numeric,
  target_calories int,
  target_protein int,
  target_carbs int,
  target_fat int,
  status text not null default 'active' check (status in ('active','completed')),
  created_at timestamptz not null default now()
);

create table weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  weight numeric not null,
  logged_at date not null default current_date,
  created_at timestamptz not null default now(),
  unique (user_id, logged_at)
);

create table water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  ml int not null,
  logged_at date not null default current_date,
  created_at timestamptz not null default now()
);

create table supplements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  name text not null,
  dose text not null
);

create table supplement_logs (
  id uuid primary key default gen_random_uuid(),
  supplement_id uuid references supplements(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  logged_at date not null default current_date,
  unique (supplement_id, logged_at)
);

create table foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  name text not null,
  calories int not null,
  protein numeric not null default 0,
  carbs numeric not null default 0,
  fat numeric not null default 0,
  custom_fields jsonb not null default '{}',
  is_favorite boolean not null default false
);

create table food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  food_id uuid references foods(id),
  name text not null,
  calories int not null,
  protein numeric not null default 0,
  carbs numeric not null default 0,
  fat numeric not null default 0,
  custom_fields jsonb not null default '{}',
  logged_at date not null default current_date,
  created_at timestamptz not null default now()
);

create table exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade, -- null = global library
  name text not null,
  muscle_group text
);

create table splits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  name text not null,
  is_active boolean not null default true
);

create table split_days (
  id uuid primary key default gen_random_uuid(),
  split_id uuid references splits(id) on delete cascade not null,
  name text not null,
  sort_order int not null default 0
);

create table day_exercises (
  id uuid primary key default gen_random_uuid(),
  split_day_id uuid references split_days(id) on delete cascade not null,
  exercise_id uuid references exercises(id) not null,
  sort_order int not null default 0,
  is_alternate boolean not null default false
);

create table workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  split_day_id uuid references split_days(id) on delete set null,
  day_name text not null, -- snapshot, in case the split changes later
  is_rest_day boolean not null default false,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  notes text
);

create table workout_sets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references workout_sessions(id) on delete cascade not null,
  exercise_id uuid references exercises(id) not null,
  set_number int not null,
  weight numeric not null,
  reps int not null,
  set_type text not null default 'working' check (set_type in ('warmup','working','drop','failure')),
  rpe numeric,
  is_pr boolean not null default false
);

create table measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  logged_at date not null default current_date,
  chest numeric, waist numeric, hips numeric,
  arms numeric, thighs numeric, calves numeric
);

create table photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  image_url text not null,
  is_public boolean not null default false,
  taken_at date not null default current_date,
  created_at timestamptz not null default now()
);

create table likes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references workout_sessions(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  unique (session_id, user_id)
);

create table comments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references workout_sessions(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  body text not null,
  created_at timestamptz not null default now()
);

-- RLS: enable on every remaining table, then apply the same pattern —
-- any logged-in user can read (needed for the open feed / profiles),
-- only the owner can write. Tables with no user_id column (split_days,
-- day_exercises, workout_sets) check ownership through their parent.

alter table goals enable row level security;
alter table weight_logs enable row level security;
alter table water_logs enable row level security;
alter table supplements enable row level security;
alter table supplement_logs enable row level security;
alter table foods enable row level security;
alter table food_logs enable row level security;
alter table exercises enable row level security;
alter table splits enable row level security;
alter table split_days enable row level security;
alter table day_exercises enable row level security;
alter table workout_sessions enable row level security;
alter table workout_sets enable row level security;
alter table measurements enable row level security;
alter table photos enable row level security;
alter table likes enable row level security;
alter table comments enable row level security;

-- Simple owner-column tables
create policy "read all" on goals for select using (auth.role() = 'authenticated');
create policy "write own" on goals for all using (auth.uid() = user_id);

create policy "read all" on weight_logs for select using (auth.role() = 'authenticated');
create policy "write own" on weight_logs for all using (auth.uid() = user_id);

create policy "read all" on water_logs for select using (auth.role() = 'authenticated');
create policy "write own" on water_logs for all using (auth.uid() = user_id);

create policy "read all" on supplements for select using (auth.role() = 'authenticated');
create policy "write own" on supplements for all using (auth.uid() = user_id);

create policy "read all" on supplement_logs for select using (auth.role() = 'authenticated');
create policy "write own" on supplement_logs for all using (auth.uid() = user_id);

create policy "read all" on foods for select using (auth.role() = 'authenticated');
create policy "write own" on foods for all using (auth.uid() = user_id);

create policy "read all" on food_logs for select using (auth.role() = 'authenticated');
create policy "write own" on food_logs for all using (auth.uid() = user_id);

-- Exercises: user_id null = global library (readable by all, writable by no one
-- from the client); user_id set = a personal custom exercise.
create policy "read all" on exercises for select using (auth.role() = 'authenticated');
create policy "write own custom exercises" on exercises for all using (auth.uid() = user_id);

create policy "read all" on splits for select using (auth.role() = 'authenticated');
create policy "write own" on splits for all using (auth.uid() = user_id);

create policy "read all" on measurements for select using (auth.role() = 'authenticated');
create policy "write own" on measurements for all using (auth.uid() = user_id);

create policy "read all" on photos for select using (
  auth.role() = 'authenticated' and (is_public or auth.uid() = user_id)
);
create policy "write own" on photos for all using (auth.uid() = user_id);

create policy "read all" on likes for select using (auth.role() = 'authenticated');
create policy "write own" on likes for all using (auth.uid() = user_id);

create policy "read all" on comments for select using (auth.role() = 'authenticated');
create policy "write own" on comments for all using (auth.uid() = user_id);

create policy "read all" on workout_sessions for select using (auth.role() = 'authenticated');
create policy "write own" on workout_sessions for all using (auth.uid() = user_id);

-- Ownership through parent split
create policy "read all" on split_days for select using (auth.role() = 'authenticated');
create policy "write own via split" on split_days for all using (
  exists (select 1 from splits where splits.id = split_days.split_id and splits.user_id = auth.uid())
);

create policy "read all" on day_exercises for select using (auth.role() = 'authenticated');
create policy "write own via split" on day_exercises for all using (
  exists (
    select 1 from split_days
    join splits on splits.id = split_days.split_id
    where split_days.id = day_exercises.split_day_id and splits.user_id = auth.uid()
  )
);

-- Ownership through parent workout session
create policy "read all" on workout_sets for select using (auth.role() = 'authenticated');
create policy "write own via session" on workout_sets for all using (
  exists (
    select 1 from workout_sessions
    where workout_sessions.id = workout_sets.session_id and workout_sessions.user_id = auth.uid()
  )
);
