// NG Whot Game Engine — v2 (Corrected Rules & 54-Card Deck)

// ── CORRECT PER-SUIT CARD NUMBERS ────────────────────────────────────────────
// Circle:   12 cards | Triangle: 12 cards | Cross: 9 cards
// Square:    9 cards | Star:      7 cards | WHOT: 5×20 = 5 cards  → TOTAL: 54
const SUIT_NUMS = {
  circle:   [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14],
  triangle: [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14],
  cross:    [1, 2, 3, 5, 7, 10, 11, 13, 14],
  square:   [1, 2, 3, 5, 7, 10, 11, 13, 14],
  star:     [1, 2, 3, 4, 5, 7, 8],
};

const SUITS = ['circle','triangle','cross','square','star'];
const SUIT_ICONS = { circle:'⭕', triangle:'🔺', cross:'✚', square:'🟦', star:'⭐' };

// Special card definitions
// 1  = Hold On    → same player plays again (extra turn)
// 2  = Pick Two   → next player picks 2 (stackable if allowDefend)
// 5  = Pick Three → next player picks 3 (stackable if allowDefend)
// 8  = Suspension → next player is SKIPPED
// 14 = General Market → EVERYONE (including player) picks 1; player plays again
// 20 = WHOT wildcard → call any suit

const WhotEngine = {

  // ── DECK ──────────────────────────────────────────────────────────────────
  createDeck(opts = {}) {
    const deck = [];
    SUITS.forEach(suit => {
      SUIT_NUMS[suit].forEach(num => {
        deck.push({ suit, num, id: `${suit}-${num}-${Math.random().toString(36).slice(2)}` });
      });
    });
    if (opts.includeWhot !== false) {
      for (let i = 0; i < 5; i++) {
        deck.push({ suit: 'whot', num: 20, id: `whot-${i}` });
      }
    }
    return this.shuffle(deck);
  },

  deckSize(opts = {}) {
    // Quick calc: 12+12+9+9+7 = 49 + 5 whot = 54 (when includeWhot !== false)
    const base = Object.values(SUIT_NUMS).reduce((s, a) => s + a.length, 0);
    return opts.includeWhot === false ? base : base + 5;
  },

  shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  },

  // ── GAME STATE ─────────────────────────────────────────────────────────────
  createGame(playerCount = 2, opts = {}) {
    const deck = this.createDeck(opts);
    const handSize = playerCount === 2 ? 7 : 5;
    const players = [];
    for (let i = 0; i < playerCount; i++) {
      const name = i === 0 ? 'You' : `Player ${i + 1}`;
      players.push({ id: i, name, hand: deck.splice(0, handSize), isHuman: i === 0 });
    }

    // First top card must not be a special card
    let topCard = deck.splice(0, 1)[0];
    let tries = 0;
    while ([2, 5, 8, 14, 20].includes(topCard.num) && tries < 30) {
      deck.push(topCard);
      this.shuffle(deck);
      topCard = deck.splice(0, 1)[0];
      tries++;
    }

    return {
      players,
      deck,
      pile: [topCard],
      currentPlayer: 0,
      direction: 1,
      pendingPickup: 0,          // stacked pick-up count
      suspended: false,          // true when card 8 was played (skip next)
      generalMarket: false,      // true when card 14 played (player must play again)
      holdOn: false,             // true when card 1 played (same player again)
      calledSuit: null,          // suit called after WHOT 20
      gameOver: false,
      winner: null,
      eliminated: [],            // player indices eliminated by checkup
      opts: {
        holdOnCard: opts.holdOnCard || 1,
        allowDefend: opts.allowDefend !== false, // default: defend enabled
        includeWhot: opts.includeWhot !== false,
        ...opts,
      },
      log: [`Game started! Top card: ${topCard.num} of ${topCard.suit}`],
    };
  },

  // Start a fresh round for a tournament: re-deals only to non-eliminated
  // players (eliminated players keep an empty hand) and resets the pile,
  // pickups and call state. Player ids/names/scores carry over; only the
  // cards reset.
  dealNextRound(state) {
    const eliminated = state.eliminated || [];
    const activeIds = state.players.map(p => p.id).filter(id => !eliminated.includes(id));
    const deck = this.createDeck(state.opts);
    const handSize = activeIds.length === 2 ? 7 : 5;

    const players = state.players.map(p => ({ ...p, hand: [] }));
    activeIds.forEach(id => {
      players[id] = { ...players[id], hand: deck.splice(0, handSize) };
    });

    let topCard = deck.splice(0, 1)[0];
    let tries = 0;
    while ([2, 5, 8, 14, 20].includes(topCard.num) && tries < 30) {
      deck.push(topCard);
      deck.splice(0, deck.length, ...this.shuffle(deck));
      topCard = deck.splice(0, 1)[0];
      tries++;
    }

    return {
      ...state,
      players,
      deck,
      pile: [topCard],
      currentPlayer: activeIds[0],
      direction: 1,
      pendingPickup: 0,
      suspended: false,
      generalMarket: false,
      holdOn: false,
      calledSuit: null,
      gameOver: false,
      winner: null,
      log: [...state.log, `New round! Top card: ${topCard.num} of ${topCard.suit}`],
    };
  },

  // Helper to get card action name
  getCardAction(card, opts = {}) {
    const config = opts.cardConfig || {
      pickTwo:      { num: 2,  win: true,  defend: true },
      pickThree:    { num: 5,  win: true,  defend: true },
      genMarket:    { num: 14, win: true,  defend: true },
      holdOn:       { num: 1,  win: true,  defend: false },
      suspension:   { num: 8,  win: true,  defend: false },
      crown:        { num: 20, win: true,  defend: false }
    };
    if (card.suit === 'whot') return 'crown';
    for (const [actionName, actionOpts] of Object.entries(config)) {
      if (actionOpts.num === card.num) {
        return actionName;
      }
    }
    return null;
  },

  // Helper to check if winning with this action is allowed
  isWinAllowed(action, opts = {}) {
    if (!action) return true;
    const config = opts.cardConfig || {
      pickTwo:      { num: 2,  win: true,  defend: true },
      pickThree:    { num: 5,  win: true,  defend: true },
      genMarket:    { num: 14, win: true,  defend: true },
      holdOn:       { num: 1,  win: true,  defend: false },
      suspension:   { num: 8,  win: true,  defend: false },
      crown:        { num: 20, win: true,  defend: false }
    };
    return config[action] ? config[action].win !== false : true;
  },

  // ── CARD VALIDITY ──────────────────────────────────────────────────────────
  canPlay(card, topCard, calledSuit, opts = {}, handLength = 99) {
    if (handLength === 1) {
      const action = this.getCardAction(card, opts);
      if (action && !this.isWinAllowed(action, opts)) {
        return false;
      }
    }
    if (card.suit === 'whot') return true; // WHOT is always playable
    const top = calledSuit || topCard.suit;
    if (card.suit === top) return true;
    if (card.num === topCard.num) return true;
    return false;
  },

  // Can this card DEFEND a pending pickup?
  canDefend(card, pendingCard, opts = {}) {
    if (!opts.allowDefend) return false;
    if (!pendingCard) return false;
    
    const config = opts.cardConfig || {
      pickTwo:      { num: 2,  win: true,  defend: true },
      pickThree:    { num: 5,  win: true,  defend: true },
      genMarket:    { num: 14, win: true,  defend: true },
      holdOn:       { num: 1,  win: true,  defend: false },
      suspension:   { num: 8,  win: true,  defend: false },
      crown:        { num: 20, win: true,  defend: false }
    };

    const pendingAction = this.getCardAction(pendingCard, opts);
    if (!pendingAction) return false;

    const defendAction = this.getCardAction(card, opts);
    if (!defendAction) return false;

    if (pendingAction !== defendAction) return false;

    const actConfig = config[defendAction];
    return actConfig ? actConfig.defend === true : false;
  },

  // ── PLAY A CARD ────────────────────────────────────────────────────────────
  playCard(state, playerIdx, cardId, whotCall = null) {
    const player = state.players[playerIdx];
    const cardIdx = player.hand.findIndex(c => c.id === cardId);
    if (cardIdx === -1) return { ...state, error: 'Card not found' };

    const card = player.hand[cardIdx];
    const topCard = state.pile[state.pile.length - 1];

    if (state.pendingPickup > 0) {
      const pendingCard = state.pile[state.pile.length - 1];
      if (!this.canDefend(card, pendingCard, state.opts)) {
        return { ...state, error: 'You must defend or draw the pending cards!' };
      }
    } else {
      if (!this.canPlay(card, topCard, state.calledSuit, state.opts, player.hand.length)) {
        return { ...state, error: 'Cannot play that card' };
      }
    }

    const newHand = [...player.hand];
    newHand.splice(cardIdx, 1);
    const newPile = [...state.pile, card];

    let newState = {
      ...state,
      pile: newPile,
      calledSuit: null,
      suspended: false,
      generalMarket: false,
      holdOn: false,
      pendingPickup: state.pendingPickup,
      error: null,
      log: [...state.log, `${player.name} played ${card.num} of ${card.suit}`],
    };
    newState.players = state.players.map((p, i) =>
      i === playerIdx ? { ...p, hand: newHand } : p
    );

    // ── Win check ─────────────────────────────────────────────────
    if (newHand.length === 0) {
      const action = this.getCardAction(card, state.opts);
      if (action && !this.isWinAllowed(action, state.opts)) {
        return { ...state, error: 'You cannot win the game with a special card!' };
      }
      return { ...newState, gameOver: true, winner: playerIdx };
    }

    // ── Apply card effects ─────────────────────────────────────────
    const action = this.getCardAction(card, state.opts);

    if (action === 'crown') {
      newState.calledSuit = whotCall;
      newState.pendingPickup = 0;
      newState.log.push(`${player.name} calls ${whotCall}!`);
      newState.currentPlayer = this.nextPlayer(newState, playerIdx);

    } else if (action === 'pickTwo') {
      if (state.pendingPickup > 0 && state.opts && state.opts.defenseMode === 'block') {
        newState.pendingPickup = 0;
        newState.log.push(`Defended and blocked! Pick Two cancelled.`);
      } else {
        newState.pendingPickup = (state.pendingPickup > 0 ? state.pendingPickup : 0) + 2;
        newState.log.push(`Pick Two! Pending picks: ${newState.pendingPickup}`);
      }
      newState.currentPlayer = this.nextPlayer(newState, playerIdx);

    } else if (action === 'pickThree') {
      if (state.pendingPickup > 0 && state.opts && state.opts.defenseMode === 'block') {
        newState.pendingPickup = 0;
        newState.log.push(`Defended and blocked! Pick Three cancelled.`);
      } else {
        newState.pendingPickup = (state.pendingPickup > 0 ? state.pendingPickup : 0) + 3;
        newState.log.push(`Pick Three! Pending picks: ${newState.pendingPickup}`);
      }
      newState.currentPlayer = this.nextPlayer(newState, playerIdx);

    } else if (action === 'genMarket') {
      newState.pendingPickup = 0;
      newState = this._applyGeneralMarket(newState, playerIdx);
      newState.generalMarket = true;
      newState.log.push('General Market! Everyone picks 1 card. You play again.');
      newState.currentPlayer = playerIdx;

    } else if (action === 'holdOn') {
      newState.pendingPickup = 0;
      newState.holdOn = true;
      newState.log.push(`Hold On! ${player.name} plays again.`);
      newState.currentPlayer = playerIdx;

    } else if (action === 'suspension') {
      newState.pendingPickup = 0;
      const skippedIdx = (playerIdx + newState.direction + newState.players.length) % newState.players.length;
      newState.log.push(`Suspension! ${this._playerName(newState, skippedIdx)} is skipped.`);
      newState.suspended = true;
      newState.currentPlayer = this.nextPlayer(newState, playerIdx);
      newState.suspended = false; // already applied above — don't let it leak into later nextPlayer() calls

    } else {
      newState.pendingPickup = 0;
      newState.currentPlayer = this.nextPlayer(newState, playerIdx);
    }

    return newState;
  },

  _playerName(state, idx) {
    return state.players[idx] ? state.players[idx].name : '?';
  },

  // General market: every still-active player picks 1 card from deck (excluding the player who played)
  _applyGeneralMarket(state, skipIdx) {
    const eliminated = state.eliminated || [];
    let newState = { ...state, players: [...state.players] };
    newState.players = state.players.map((p, idx) => {
      if (idx === skipIdx) return p;
      if (eliminated.includes(idx)) return p;
      if (newState.deck.length === 0) return p;
      const [drawn, ...rest] = newState.deck;
      newState.deck = rest;
      return { ...p, hand: [...p.hand, drawn] };
    });
    return newState;
  },

  // ── DRAW CARD ─────────────────────────────────────────────────────────────
  drawCard(state, playerIdx) {
    // Reshuffle pile into deck if empty
    if (state.deck.length === 0) {
      if (state.opts && state.opts.emptyDeckBehavior === 'checkup') {
        // Stop reshuffling to trigger market-finish checkup
        return state;
      }
      const top = state.pile[state.pile.length - 1];
      const newDeck = this.shuffle(state.pile.slice(0, -1));
      state = { ...state, deck: newDeck, pile: [top], log: [...state.log, 'Deck reshuffled!'] };
    }

    const count = state.pendingPickup > 0 ? state.pendingPickup : 1;
    const safeCount = Math.min(count, state.deck.length);
    const cards = state.deck.slice(0, safeCount);
    const newDeck = state.deck.slice(safeCount);
    const player = state.players[playerIdx];
    const newPlayers = state.players.map((p, i) =>
      i === playerIdx ? { ...p, hand: [...p.hand, ...cards] } : p
    );
    const log = [...state.log, `${player.name} picks ${safeCount} card(s).`];

    // After drawing, clear pending, clear suspension, advance turn
    const nextState = {
      ...state,
      deck: newDeck,
      players: newPlayers,
      pendingPickup: 0,
      suspended: false,
      holdOn: false,
      generalMarket: false,
      log,
    };
    nextState.currentPlayer = this.nextPlayer(nextState, playerIdx);
    return nextState;
  },

  // ── NEXT PLAYER ───────────────────────────────────────────────────────────
  // suspended flag means the computed next is skipped (jump one more)
  nextPlayer(state, from) {
    const count = state.players.length;
    const eliminated = state.eliminated || [];

    let next = (from + state.direction + count) % count;

    // Skip suspended player
    if (state.suspended) {
      next = (next + state.direction + count) % count;
    }

    // Skip eliminated players (loop until non-eliminated)
    let safety = 0;
    while (eliminated.includes(next) && safety < count) {
      next = (next + state.direction + count) % count;
      safety++;
    }

    return next;
  },

  // ── AI ────────────────────────────────────────────────────────────────────
  aiChooseCard(hand, topCard, calledSuit, opts = {}, pendingPickup = 0) {
    if (pendingPickup > 0 && opts.allowDefend) {
      const defendCard = hand.find(c => this.canDefend(c, topCard, opts));
      if (defendCard) return defendCard;
      return null;
    }

    const playable = hand.filter(c => this.canPlay(c, topCard, calledSuit, opts, hand.length));
    if (playable.length === 0) return null;

    const order = ['genMarket', 'pickTwo', 'pickThree', 'suspension', 'holdOn', 'crown'];
    for (const act of order) {
      const found = playable.find(c => this.getCardAction(c, opts) === act);
      if (found) return found;
    }
    return playable[0];
  },

  // ── SCORING ───────────────────────────────────────────────────────────────
  getCardScore(hand) {
    return hand.reduce((sum, c) => sum + (c.suit === 'star' ? c.num * 2 : (c.num === 20 ? 20 : c.num)), 0);
  },

  handCount(hand) { return hand.length; },

  // ── CHECKUP ELIMINATION ───────────────────────────────────────────────────
  // Returns { winner, eliminated } after a single checkup round
  // Eliminates the player with the highest card score (or highest card count on tie)
  doCheckupElimination(state) {
    const active = state.players.filter((_, i) => !(state.eliminated || []).includes(i));
    if (active.length <= 2) {
      // Final: lowest score wins
      const scored = active.map(p => ({
        idx: p.id,
        score: this.getCardScore(p.hand),
        name: p.name,
      }));
      scored.sort((a, b) => a.score - b.score);
      return { winner: scored[0].idx, eliminatedNow: scored.slice(1).map(s => s.idx) };
    }

    // Eliminate the one with the highest score
    const scored = active.map(p => ({
      idx: p.id,
      score: this.getCardScore(p.hand),
      name: p.name,
    }));
    scored.sort((a, b) => b.score - a.score); // highest first
    const toElim = scored[0].idx;
    return { winner: null, eliminatedNow: [toElim], scores: scored };
  },
};

window.WhotEngine = WhotEngine;
window.SUIT_ICONS = SUIT_ICONS;
window.SUIT_NUMS = SUIT_NUMS;
