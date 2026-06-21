-- NG Whot — Supabase schema + Row Level Security policies
-- Run this in Supabase Dashboard > SQL Editor (or via `supabase db push` if you set up the CLI).

create extension if not exists pgcrypto;

-- ============================== PROFILES ==============================

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  email text,
  avi text,
  tribe text default 'None',
  rank text default 'player',
  points int default 0,
  won int default 0,
  lost int default 0,
  played int default 0,
  followers int default 0,
  following int default 0,
  wallet int default 2500,
  created_at timestamptz default now(),
  last_login timestamptz default now()
);

alter table profiles enable row level security;
create policy "profiles are publicly readable" on profiles for select using (true);
create policy "users can insert their own profile" on profiles for insert with check (auth.uid() = id);
create policy "users can update their own profile" on profiles for update using (auth.uid() = id);

-- ============================== TRIBES ==============================

create table if not exists tribes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text default '',
  creator_id uuid references profiles(id),
  creator_name text,
  members text[] default '{}',
  member_names jsonb default '{}',
  points int default 0,
  created_at timestamptz default now()
);

alter table tribes enable row level security;
create policy "tribes are publicly readable" on tribes for select using (true);
create policy "signed-in users can create a tribe" on tribes for insert with check (auth.uid() = creator_id);
create policy "signed-in users can update tribes (join/leave)" on tribes for update using (auth.uid() is not null);
create policy "creator can delete their tribe" on tribes for delete using (auth.uid() = creator_id);

create table if not exists tribe_chat (
  id uuid primary key default gen_random_uuid(),
  tribe_id uuid references tribes(id) on delete cascade,
  sender_id uuid references profiles(id),
  sender_name text,
  text text not null,
  created_at timestamptz default now()
);

alter table tribe_chat enable row level security;
create policy "tribe chat is publicly readable" on tribe_chat for select using (true);
create policy "signed-in users can post in tribe chat" on tribe_chat for insert with check (auth.uid() = sender_id);

-- ============================== COMPETITIONS ==============================

create table if not exists competitions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text default 'custom',
  creator_id uuid references profiles(id),
  creator_name text,
  creator_participates boolean default true,
  funded_by_creator boolean default false,
  allow_spectators boolean default true,
  max_players int default 8,
  entry_fee int default 0,
  prize_pool int default 0,
  players text[] default '{}',
  start_time timestamptz,
  join_cutoff_time timestamptz,
  tribe_id uuid references tribes(id),
  status text default 'upcoming', -- upcoming -> live -> completed
  created_at timestamptz default now()
);

alter table competitions enable row level security;
create policy "competitions are publicly readable" on competitions for select using (true);
create policy "signed-in users can create a competition" on competitions for insert with check (auth.uid() = creator_id);
-- Joining a competition arrives as an update to the players array; a full lockdown of
-- "only the players array changed" needs a Postgres function/trigger, which is a fine
-- follow-up but isn't required to get a working app running today.
create policy "signed-in users can update competitions (join/leave)" on competitions for update using (auth.uid() is not null);
create policy "creator can delete their competition" on competitions for delete using (auth.uid() = creator_id);

-- ============================== TOURNAMENTS ==============================

create table if not exists tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  competition_id uuid references competitions(id),
  creator_id uuid references profiles(id),
  players jsonb default '[]',       -- [{uid, name}]
  eliminated text[] default '{}',
  rounds jsonb default '[]',
  status text default 'live',       -- live -> completed
  winner_id text,
  created_at timestamptz default now(),
  ended_at timestamptz
);

alter table tournaments enable row level security;
create policy "tournaments are publicly readable" on tournaments for select using (true);
create policy "signed-in users can create a tournament" on tournaments for insert with check (auth.uid() = creator_id);
create policy "signed-in users can update tournaments" on tournaments for update using (auth.uid() is not null);
create policy "creator can delete their tournament" on tournaments for delete using (auth.uid() = creator_id);

-- ============================== MATCHES (live room + history + spectating + chat) ==============================

create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  players jsonb default '[]',       -- [{uid, name}] — uid is a real profile id, or "cpu-N" for bots
  competition_id uuid references competitions(id),
  tournament_id uuid references tournaments(id),
  status text default 'live',       -- live -> completed
  allow_spectators boolean default true,
  winner_id text,
  scores jsonb,
  started_at timestamptz default now(),
  ended_at timestamptz
);

alter table matches enable row level security;
create policy "matches are publicly readable" on matches for select using (true);
create policy "signed-in users can create matches" on matches for insert with check (auth.uid() is not null);
create policy "signed-in users can update matches" on matches for update using (auth.uid() is not null);

create table if not exists match_spectators (
  match_id uuid references matches(id) on delete cascade,
  user_id uuid references profiles(id),
  name text,
  joined_at timestamptz default now(),
  primary key (match_id, user_id)
);

alter table match_spectators enable row level security;
create policy "spectator presence is publicly readable" on match_spectators for select using (true);
create policy "users manage their own spectator presence" on match_spectators for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists match_chat (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references matches(id) on delete cascade,
  sender_id uuid references profiles(id),
  sender_name text,
  text text not null,
  created_at timestamptz default now()
);

alter table match_chat enable row level security;
create policy "match chat is publicly readable" on match_chat for select using (true);
create policy "signed-in users can post in match chat" on match_chat for insert with check (auth.uid() = sender_id);

create table if not exists match_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  match_id uuid references matches(id),
  result text,            -- 'win' | 'loss'
  points_delta int default 0,
  opponents text[] default '{}',
  played_at timestamptz default now()
);

alter table match_history enable row level security;
create policy "users can read their own play history" on match_history for select using (auth.uid() = user_id);
create policy "users can insert their own play history" on match_history for insert with check (auth.uid() = user_id);

-- ============================== REALTIME ==============================
-- Enable realtime change feeds for every table the client subscribes to via
-- supabase.channel(...).on('postgres_changes', ...) in db.js.
alter publication supabase_realtime add table profiles, tribes, tribe_chat, competitions, tournaments, matches, match_spectators, match_chat;
