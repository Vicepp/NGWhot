-- NG Whot — Live synced multiplayer state (run AFTER the other schema files)
-- Paste into Supabase Dashboard > SQL Editor > Run.
--
-- Online matches now store the actual WhotEngine game state here so every
-- paired client renders the same real game instead of each side quietly
-- falling back to a local solo match against bots.

alter table matches add column if not exists game_state jsonb;

-- Known limitation: game_state is readable by both seated players (and, per the
-- existing "matches are publicly readable" policy, by spectators too), which means
-- a player could open browser dev tools and inspect the opponent's hand from the
-- network payload. Closing that requires a trusted server (e.g. a Supabase Edge
-- Function) brokering moves instead of clients writing shared state directly —
-- a good follow-up, not something pure client+Postgres can fully prevent.
