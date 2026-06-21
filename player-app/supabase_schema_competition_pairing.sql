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

create or replace function pair_competition_players() returns void
language plpgsql
security definer
as $$
declare
  comp record;
  v_match_id uuid;
begin
  for comp in
    select * from competitions
    where status = 'upcoming'
      and array_length(players, 1) >= 2
      and (start_time is null or start_time <= now() or array_length(players, 1) >= max_players)
  loop
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
  end loop;
end;
$$;

-- Re-running this is safe — cron.schedule replaces a job with the same name.
select cron.schedule('pair-competition-players', '* * * * *', 'select pair_competition_players();');
