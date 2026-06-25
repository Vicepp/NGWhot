// NG Whot — Supabase Data Layer
//
// Schema (see supabase_schema.sql for full DDL + RLS policies):
//
//   profiles                 user profile + cumulative analytics (points, won, lost, played, wallet)
//   match_history             one row per match a real user played — play history
//   tribes                    { name, creator_id, members: text[], points }
//   tribe_chat                tribe community chat rows
//   competitions              see createCompetition() for full shape
//   tournaments                bracket state for a tournament tied to a competition (optional)
//   matches                    one live/finished game room: players (jsonb), status, scores, viewer-facing fields
//   match_spectators          presence row per watcher — row count == live viewer count
//   match_chat                in-match live chat rows
//
// Realtime list helpers re-run their query on every change event rather than hand-merging
// deltas — simplest correct approach at this app's scale.

const Db = {
  _nowIso() { return new Date().toISOString(); },

  // Re-fetches `table` (optionally filtered by eqCol=eqVal) on load and on every
  // postgres_changes event, calling callback(rows) each time. Returns an unsubscribe fn.
  _realtimeList(table, { orderCol = null, ascending = false, eqCol = null, eqVal = null } = {}, callback) {
    const load = async () => {
      let q = supabaseClient.from(table).select('*');
      if (eqCol) q = q.eq(eqCol, eqVal);
      if (orderCol) q = q.order(orderCol, { ascending });
      const { data, error } = await q;
      if (error) { console.warn(`Realtime list load failed for ${table}:`, error); return; }
      callback(data || []);
    };
    load();

    const channelName = `${table}-${eqCol || 'all'}-${eqVal || 'x'}-${Math.random().toString(36).slice(2)}`;
    const changeOpts = { event: '*', schema: 'public', table };
    if (eqCol) changeOpts.filter = `${eqCol}=eq.${eqVal}`;
    const channel = supabaseClient.channel(channelName)
      .on('postgres_changes', changeOpts, load)
      .subscribe();

    return () => supabaseClient.removeChannel(channel);
  },

  // ============================== TRIBES ==============================

  async createTribe({ name, description, creatorId, creatorName }) {
    const { data, error } = await supabaseClient.from('tribes').insert({
      name, description: description || '',
      creator_id: creatorId, creator_name: creatorName,
      members: [creatorId], member_names: { [creatorId]: creatorName },
      points: 0
    }).select().single();
    if (error) throw error;
    await supabaseClient.from('profiles').update({ tribe: name }).eq('id', creatorId);
    return data.id;
  },

  async joinTribe(tribeId, uid, name) {
    const { data: tribe } = await supabaseClient.from('tribes').select('*').eq('id', tribeId).single();
    if (!tribe) throw new Error('Tribe not found.');
    const members = Array.from(new Set([...(tribe.members || []), uid]));
    const memberNames = { ...(tribe.member_names || {}), [uid]: name };
    await supabaseClient.from('tribes').update({ members, member_names: memberNames }).eq('id', tribeId);
    await supabaseClient.from('profiles').update({ tribe: tribe.name }).eq('id', uid);
  },

  async leaveTribe(tribeId, uid) {
    const { data: tribe } = await supabaseClient.from('tribes').select('*').eq('id', tribeId).single();
    if (!tribe) return;
    const members = (tribe.members || []).filter(m => m !== uid);
    await supabaseClient.from('tribes').update({ members }).eq('id', tribeId);
    await supabaseClient.from('profiles').update({ tribe: 'None' }).eq('id', uid);
  },

  listenTribes(callback) {
    return this._realtimeList('tribes', { orderCol: 'points', ascending: false }, callback);
  },

  async sendTribeChat(tribeId, uid, name, text) {
    const { error } = await supabaseClient.from('tribe_chat').insert({
      tribe_id: tribeId, sender_id: uid, sender_name: name, text
    });
    if (error) throw error;
  },

  listenTribeChat(tribeId, callback) {
    return this._realtimeList('tribe_chat', { orderCol: 'created_at', ascending: true, eqCol: 'tribe_id', eqVal: tribeId }, callback);
  },

  // ============================== COMPETITIONS ==============================

  // type: 'default' | 'weekly' | 'monthly' | 'tribe' | 'custom'
  // creatorParticipates=false is only valid when fundedByCreator=true — the creator
  // funds the prize pool so others can play/watch while they sit out.
  async createCompetition(opts) {
    const {
      name, type = 'custom', creatorId, creatorName,
      creatorParticipates = true, fundedByCreator = false,
      allowSpectators = true, maxPlayers = 8, entryFee = 0, prizePool = 0,
      startTime, joinCutoffTime, tribeId = null
    } = opts;

    if (!creatorParticipates && !fundedByCreator) {
      throw new Error('A non-participating creator must fund the competition.');
    }
    if (startTime && joinCutoffTime && new Date(joinCutoffTime) > new Date(startTime)) {
      throw new Error('Join cutoff time must be before the game start time.');
    }

    const { data, error } = await supabaseClient.from('competitions').insert({
      name, type,
      creator_id: creatorId, creator_name: creatorName,
      creator_participates: creatorParticipates, funded_by_creator: fundedByCreator, allow_spectators: allowSpectators,
      max_players: maxPlayers, entry_fee: entryFee, prize_pool: prizePool,
      players: creatorParticipates ? [creatorId] : [],
      start_time: startTime ? new Date(startTime).toISOString() : null,
      join_cutoff_time: joinCutoffTime ? new Date(joinCutoffTime).toISOString() : null,
      tribe_id: tribeId,
      status: 'upcoming'
    }).select().single();
    if (error) throw error;
    return data.id;
  },

  async joinCompetition(compId, uid) {
    const { data: comp } = await supabaseClient.from('competitions').select('*').eq('id', compId).single();
    if (!comp) throw new Error('Competition not found.');
    if (comp.join_cutoff_time && new Date(comp.join_cutoff_time) < new Date()) {
      throw new Error('Joining has closed for this competition.');
    }
    if ((comp.players || []).length >= comp.max_players) {
      throw new Error('Competition is full.');
    }
    const players = Array.from(new Set([...(comp.players || []), uid]));
    const { error } = await supabaseClient.from('competitions').update({ players }).eq('id', compId);
    if (error) throw error;
  },

  async leaveCompetition(compId, uid) {
    const { data: comp } = await supabaseClient.from('competitions').select('*').eq('id', compId).single();
    if (!comp) return;
    const players = (comp.players || []).filter(p => p !== uid);
    await supabaseClient.from('competitions').update({ players }).eq('id', compId);
  },

  setCompetitionStatus(compId, status) {
    return Promise.resolve(supabaseClient.from('competitions').update({ status }).eq('id', compId));
  },

  // Pairs a competition immediately if it's ready, instead of waiting up to a
  // minute for the server's cron sweep. Returns the match id, or null if not ready.
  async tryPairCompetitionNow(compId) {
    const { data, error } = await supabaseClient.rpc('try_pair_competition', { p_competition_id: compId });
    if (error) throw error;
    return data || null;
  },

  listenCompetitions(callback, { tribeId } = {}) {
    return this._realtimeList('competitions',
      tribeId ? { orderCol: 'created_at', eqCol: 'tribe_id', eqVal: tribeId } : { orderCol: 'created_at' },
      callback);
  },

  async getCompetition(compId) {
    const { data } = await supabaseClient.from('competitions').select('*').eq('id', compId).single();
    return data || null;
  },

  // ============================== TOURNAMENTS ==============================

  async createTournament({ name, competitionId = null, players, creatorId }) {
    const { data, error } = await supabaseClient.from('tournaments').insert({
      name, competition_id: competitionId, creator_id: creatorId,
      players, eliminated: [], rounds: [], status: 'live'
    }).select().single();
    if (error) throw error;
    return data.id;
  },

  async recordTournamentRound(tourId, roundEntry) {
    const { data: t } = await supabaseClient.from('tournaments').select('rounds').eq('id', tourId).single();
    const rounds = [...((t && t.rounds) || []), roundEntry];
    await supabaseClient.from('tournaments').update({ rounds }).eq('id', tourId);
  },

  async eliminateFromTournament(tourId, uid) {
    const { data: t } = await supabaseClient.from('tournaments').select('eliminated').eq('id', tourId).single();
    const eliminated = Array.from(new Set([...((t && t.eliminated) || []), uid]));
    await supabaseClient.from('tournaments').update({ eliminated }).eq('id', tourId);
  },

  finishTournament(tourId, winnerId) {
    return Promise.resolve(supabaseClient.from('tournaments').update({
      status: 'completed', winner_id: winnerId, ended_at: this._nowIso()
    }).eq('id', tourId));
  },

  listenLiveTournaments(callback) {
    return this._realtimeList('tournaments', { eqCol: 'status', eqVal: 'live' }, callback);
  },

  // ============================== MATCHES (live room + history + spectating + chat) ==============================

  // ============================== ONLINE MATCHMAKING ==============================
  // Pairing is by category + playerCount + mode + rated only — the exact preset/increment
  // within a category (e.g. "10+5" vs "15+10", both Rapid) doesn't affect who you're matched
  // with, mirroring how chess.com buckets people by Bullet/Blitz/Rapid rather than exact clock.

  async joinMatchmaking({ uid, name, category, baseSec, incSec, playerCount, mode, rated, poolAmount = 0 }) {
    const { data, error } = await supabaseClient.rpc('try_match_queue', {
      p_user_id: uid, p_name: name, p_category: category,
      p_base_sec: baseSec, p_inc_sec: incSec || 0,
      p_player_count: playerCount, p_mode: mode, p_rated: rated,
      p_pool_amount: poolAmount || 0
    });
    if (error) throw error;
    return data || null; // matchId if a full group formed immediately, else null
  },

  listenMyQueueStatus(uid, callback) {
    return this._realtimeList('matchmaking_queue', { eqCol: 'user_id', eqVal: uid }, rows => {
      callback(rows.find(r => r.status === 'waiting' || r.status === 'matched') || null);
    });
  },

  // Keeps the caller's waiting row marked as actively searching. The server purges
  // (and refuses to match) waiting rows that haven't been heartbeated recently, so a
  // searcher who closed their tab can no longer be matched as a "ghost" opponent.
  async heartbeatMatchmaking(uid) {
    const { error } = await supabaseClient.rpc('heartbeat_queue', { p_user_id: uid });
    if (error) throw error;
  },

  async cancelMatchmaking(uid) {
    const { error } = await supabaseClient.from('matchmaking_queue').delete().eq('user_id', uid).eq('status', 'waiting');
    if (error) throw error;
  },

  // --- Pre-game rules ("hook") negotiation ---

  async proposeRules(matchId, uid, opts) {
    const { data: m } = await supabaseClient.from('matches').select('rule_proposals').eq('id', matchId).single();
    const proposals = { ...((m && m.rule_proposals) || {}), [uid]: opts };
    const { error } = await supabaseClient.from('matches').update({ rule_proposals: proposals }).eq('id', matchId);
    if (error) throw error;
  },

  async agreeToRules(matchId, uid, chosenOpts) {
    const { data: m } = await supabaseClient.from('matches').select('agreed_by').eq('id', matchId).single();
    const agreedBy = Array.from(new Set([...((m && m.agreed_by) || []), uid]));
    const { error } = await supabaseClient.from('matches').update({
      agreed_rules: chosenOpts, agreed_by: agreedBy, phase: 'playing'
    }).eq('id', matchId);
    if (error) throw error;
  },

  async createMatch({ players, competitionId = null, tournamentId = null, allowSpectators = true }) {
    const { data, error } = await supabaseClient.from('matches').insert({
      players,
      competition_id: competitionId, tournament_id: tournamentId,
      status: 'live', allow_spectators: allowSpectators,
      winner_id: null, scores: null,
      started_at: this._nowIso(), ended_at: null
    }).select().single();
    if (error) throw error;
    return data.id;
  },

  // --- Live synced game state (real moves between real seated players) ---

  setMatchState(matchId, gameState) {
    return Promise.resolve(supabaseClient.from('matches').update({ game_state: gameState }).eq('id', matchId));
  },

  listenMatchState(matchId, callback) {
    return this.listenMatch(matchId, m => callback(m ? m.game_state : null, m));
  },

  async endMatch(matchId, { winnerId, resultByUid, scores = null }) {
    // resultByUid: { [uid]: { result: 'win'|'loss', pointsDelta: number, name } }
    const { error } = await supabaseClient.from('matches').update({
      status: 'completed', winner_id: winnerId, scores, ended_at: this._nowIso()
    }).eq('id', matchId);
    if (error) throw error;

    const writes = Object.entries(resultByUid || {}).map(async ([uid, r]) => {
      if (uid.startsWith('guest_') || uid.startsWith('cpu')) return; // skip non-account players

      await supabaseClient.from('match_history').insert({
        user_id: uid, match_id: matchId, result: r.result, points_delta: r.pointsDelta || 0,
        opponents: (resultByUid && Object.keys(resultByUid).filter(o => o !== uid)) || [],
        played_at: this._nowIso()
      });

      const { data: profile } = await supabaseClient.from('profiles').select('played,won,lost,points').eq('id', uid).single();
      if (!profile) return;
      await supabaseClient.from('profiles').update({
        played: (profile.played || 0) + 1,
        won: (profile.won || 0) + (r.result === 'win' ? 1 : 0),
        lost: (profile.lost || 0) + (r.result === 'loss' ? 1 : 0),
        points: (profile.points || 0) + (r.pointsDelta || 0)
      }).eq('id', uid);
    });
    await Promise.all(writes);
  },

  listenLiveMatches(callback) {
    const load = async () => {
      const { data } = await supabaseClient.from('matches').select('*').eq('status', 'live').eq('allow_spectators', true);
      callback(data || []);
    };
    load();
    const channel = supabaseClient.channel(`matches-live-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, load)
      .subscribe();
    return () => supabaseClient.removeChannel(channel);
  },

  listenMatch(matchId, callback) {
    const load = async () => {
      const { data } = await supabaseClient.from('matches').select('*').eq('id', matchId).single();
      callback(data || null);
    };
    load();
    const channel = supabaseClient.channel(`match-${matchId}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` }, load)
      .subscribe();
    return () => supabaseClient.removeChannel(channel);
  },

  async getUserHistory(uid, max = 50) {
    const { data } = await supabaseClient.from('match_history').select('*').eq('user_id', uid)
      .order('played_at', { ascending: false }).limit(max);
    return data || [];
  },

  // --- Spectating / live viewer count ---

  joinAsSpectator(matchId, uid, name) {
    return Promise.resolve(supabaseClient.from('match_spectators').upsert({
      match_id: matchId, user_id: uid, name, joined_at: this._nowIso()
    }));
  },

  leaveAsSpectator(matchId, uid) {
    return Promise.resolve(supabaseClient.from('match_spectators').delete().eq('match_id', matchId).eq('user_id', uid));
  },

  listenViewerCount(matchId, callback) {
    const load = async () => {
      const { count } = await supabaseClient.from('match_spectators').select('*', { count: 'exact', head: true }).eq('match_id', matchId);
      callback(count || 0);
    };
    load();
    const channel = supabaseClient.channel(`spectators-${matchId}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_spectators', filter: `match_id=eq.${matchId}` }, load)
      .subscribe();
    return () => supabaseClient.removeChannel(channel);
  },

  // --- In-match live chat ---

  async sendMatchChat(matchId, uid, name, text) {
    const { error } = await supabaseClient.from('match_chat').insert({
      match_id: matchId, sender_id: uid, sender_name: name, text
    });
    if (error) throw error;
  },

  listenMatchChat(matchId, callback) {
    return this._realtimeList('match_chat', { orderCol: 'created_at', ascending: true, eqCol: 'match_id', eqVal: matchId }, callback);
  },

  // ============================== LEADERBOARD / ANALYTICS ==============================

  listenLeaderboard(callback, max = 50) {
    const load = async () => {
      const { data } = await supabaseClient.from('profiles').select('*').order('points', { ascending: false }).limit(max);
      callback(data || []);
    };
    load();
    const channel = supabaseClient.channel(`leaderboard-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, load)
      .subscribe();
    return () => supabaseClient.removeChannel(channel);
  },

  setUserTribe(uid, tribeName) {
    return Promise.resolve(supabaseClient.from('profiles').update({ tribe: tribeName }).eq('id', uid));
  }
};

window.Db = Db;
