-- NG Whot — Automatic Competition Pairing (run AFTER supabase_schema.sql and
-- supabase_schema_matchmaking.sql)
-- Paste into Supabase Dashboard > SQL Editor > Run.
--
-- Mirrors the chess.com Arena/tournament idea: once a competition is ready (its
-- start_time has arrived, or it has filled up before then) AND has at least 2
-- joined players, the database itself pairs everyone up into a match — no app
-- needs to be open for this to happen, because it runs as a Postgres cron job,
-- not client-side code.

create extension if not exists pg_cron;

alter table competitions add column if not exists match_id uuid references matches(id);

-- Pairs ONE specific competition right now if it's ready (>= 2 joined players,
-- and either full or its start_time has passed). Callable directly by the client
-- the instant someone accepts a shared invite, instead of waiting up to a minute
-- for the cron tick below. Returns the new match id, or null if not ready yet.
create or replace function try_pair_competition(p_competition_id uuid) returns uuid
language plpgsql
security definer
as $$
declare
  comp record;
  v_match_id uuid;
begin
  select * into comp from competitions
    where id = p_competition_id and status = 'upcoming'
    for update skip locked;

  if comp is null then
    return (select match_id from competitions where id = p_competition_id);
  end if;

  if array_length(comp.players, 1) is null or array_length(comp.players, 1) < 2 then
    return null;
  end if;
  if not (comp.start_time is null or comp.start_time <= now() or array_length(comp.players, 1) >= comp.max_players) then
    return null;
  end if;

  v_match_id := gen_random_uuid();

  insert into matches (id, players, status, allow_spectators, phase, competition_id)
  values (
    v_match_id,
    (select jsonb_agg(jsonb_build_object('uid', p, 'name', coalesce(
       (select username from profiles where id = p::uuid), 'Player')))
     from unnest(comp.players) as p),
    'live', comp.allow_spectators, 'negotiating', comp.id
  );

  update competitions set status = 'live', match_id = v_match_id where id = comp.id;
  return v_match_id;
end;
$$;

-- Cron sweep for competitions nobody happened to accept-trigger directly (e.g. it
-- became ready purely because start_time passed, with no fresh client action).
create or replace function pair_competition_players() returns void
language plpgsql
security definer
as $$
declare
  comp record;
begin
  for comp in
    select id from competitions
    where status = 'upcoming'
      and array_length(players, 1) >= 2
      and (start_time is null or start_time <= now() or array_length(players, 1) >= max_players)
  loop
    perform try_pair_competition(comp.id);
  end loop;
end;
$$;

-- Re-running this is safe — cron.schedule replaces a job with the same name.
select cron.schedule('pair-competition-players', '* * * * *', 'select pair_competition_players();');
