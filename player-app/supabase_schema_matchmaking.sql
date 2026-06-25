-- NG Whot — Online Matchmaking schema (run AFTER supabase_schema.sql)
-- Paste into Supabase Dashboard > SQL Editor > Run.

create extension if not exists pgcrypto;

-- ============================== MATCHMAKING QUEUE ==============================
-- A row per player currently searching. category groups players the same way
-- chess.com does: irrespective of the exact preset/increment picked, anyone in the
-- same category (bullet/blitz/rapid/daily/custom) + player_count + mode + rated
-- is eligible to be paired together.

create table if not exists matchmaking_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) not null,
  name text not null,
  category text not null,        -- 'bullet' | 'blitz' | 'rapid' | 'daily' | 'custom'
  base_sec int not null,
  inc_sec int default 0,
  player_count int not null default 2,
  mode text not null default 'points',   -- 'points' | 'competition' | 'friends' | 'pricepool'
  pool_amount int not null default 0,    -- only relevant when mode = 'pricepool'
  rated boolean default true,
  status text not null default 'waiting', -- 'waiting' | 'matched' | 'cancelled'
  match_id uuid,
  created_at timestamptz default now(),
  last_seen timestamptz default now()     -- refreshed by the searching client's heartbeat
);

-- Idempotent for existing deployments that created the table before last_seen existed.
alter table matchmaking_queue add column if not exists last_seen timestamptz default now();

alter table matchmaking_queue enable row level security;
drop policy if exists "queue rows are publicly readable" on matchmaking_queue;
create policy "queue rows are publicly readable" on matchmaking_queue for select using (true);
drop policy if exists "users manage their own queue row" on matchmaking_queue;
create policy "users manage their own queue row" on matchmaking_queue for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter publication supabase_realtime add table matchmaking_queue;

-- ============================== RULES NEGOTIATION ON MATCHES ==============================

alter table matches add column if not exists phase text default 'playing'; -- 'negotiating' | 'playing' | 'completed'
alter table matches add column if not exists rule_proposals jsonb default '{}'; -- { [uid]: optsObject }
alter table matches add column if not exists agreed_rules jsonb;
alter table matches add column if not exists agreed_by text[] default '{}';

-- ============================== MATCHING FUNCTION ==============================
-- Atomically enqueues the caller (if not already queued) and tries to fill a
-- group of player_count waiting rows in the same category/mode/rated bucket.
-- Uses FOR UPDATE SKIP LOCKED so two simultaneous callers can't double-claim the
-- same waiting rows. Returns the new match id if a full group was formed, else null.

-- Postgres treats a function with a different parameter list as a new overload
-- rather than replacing the old one, so drop the original 8-arg signature first
-- (idempotent — safe to re-run even if it's already gone or already updated).
drop function if exists try_match_queue(uuid, text, text, int, int, int, text, boolean);

create or replace function try_match_queue(
  p_user_id uuid,
  p_name text,
  p_category text,
  p_base_sec int,
  p_inc_sec int,
  p_player_count int,
  p_mode text,
  p_rated boolean,
  p_pool_amount int default 0
) returns uuid
language plpgsql
security definer
as $$
declare
  v_queue_id uuid;
  v_group_ids uuid[];
  v_group_users uuid[];
  v_group_names text[];
  v_match_id uuid;
begin
  -- Purge abandoned searches. A client that is genuinely still on the "Searching..."
  -- screen heartbeats its last_seen every ~20s (see Db.heartbeatMatchmaking); a client
  -- whose tab was closed stops heartbeating. Without this, a fresh searcher would
  -- instantly "match" with someone who left days ago — landing on a Match Found screen
  -- whose opponent never shows up (the exact bug users reported). 90s gives lots of
  -- slack over the 20s heartbeat while still dropping ghosts fast.
  delete from matchmaking_queue
    where status = 'waiting' and last_seen < now() - interval '90 seconds';

  -- Re-use an existing waiting row for this user instead of creating duplicates,
  -- and refresh its last_seen so this caller counts as actively searching right now.
  select id into v_queue_id from matchmaking_queue
    where user_id = p_user_id and status = 'waiting'
    limit 1;

  if v_queue_id is null then
    insert into matchmaking_queue (user_id, name, category, base_sec, inc_sec, player_count, mode, rated, pool_amount, last_seen)
    values (p_user_id, p_name, p_category, p_base_sec, p_inc_sec, p_player_count, p_mode, p_rated, p_pool_amount, now())
    returning id into v_queue_id;
  else
    update matchmaking_queue set last_seen = now() where id = v_queue_id;
  end if;

  -- Try to lock enough matching, *recently-seen* waiting rows (including this one)
  -- to fill the group.
  select array_agg(id), array_agg(user_id), array_agg(name)
    into v_group_ids, v_group_users, v_group_names
  from (
    select id, user_id, name from matchmaking_queue
    where status = 'waiting'
      and category = p_category
      and player_count = p_player_count
      and mode = p_mode
      and rated = p_rated
      and pool_amount = p_pool_amount
      and last_seen >= now() - interval '90 seconds'
    order by created_at asc
    limit p_player_count
    for update skip locked
  ) candidates;

  if array_length(v_group_ids, 1) is null or array_length(v_group_ids, 1) < p_player_count then
    return null; -- not enough players yet — caller stays in 'waiting' state
  end if;

  v_match_id := gen_random_uuid();

  insert into matches (id, players, status, allow_spectators, phase)
  values (
    v_match_id,
    (select jsonb_agg(jsonb_build_object('uid', u, 'name', n))
       from unnest(v_group_users, v_group_names) as t(u, n)),
    'live', true, 'negotiating'
  );

  update matchmaking_queue set status = 'matched', match_id = v_match_id
    where id = any(v_group_ids);

  return v_match_id;
end;
$$;

-- ============================== HEARTBEAT ==============================
-- The searching client calls this on a short interval while the "Searching..."
-- screen is open, marking the player as still actively waiting. Rows that stop
-- being heartbeated are treated as abandoned by try_match_queue above.
create or replace function heartbeat_queue(p_user_id uuid) returns void
language sql
security definer
as $$
  update matchmaking_queue set last_seen = now()
    where user_id = p_user_id and status = 'waiting';
$$;
