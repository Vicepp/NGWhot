// NG Whot — Game Board (Part 1: Rendering & Card Design)
const GameBoard = {
  state: null,
  opts: null,
  selectedCardId: null,
  timers: {},
  timerSeconds: {},
  eliminated: [],
  avatars: ['🧑🏿','👩🏽','👨🏾','👩🏿','🧑🏽','👨🏿'],
  names: ['Adunola','ChukwuEmeka','Garba','Effiong','Amaka','Bello'],
  isWager: false,
  isSpectating: false,
  waitingForWatchChoice: false,

  // ── SVG SUIT BUILDER ──────────────────────────────────────────
  _star(cx,cy,R,r,n){
    const pts=[];
    for(let i=0;i<n*2;i++){
      const rad=i%2===0?R:r;
      const a=(i*Math.PI/n)-Math.PI/2;
      pts.push(`${cx+rad*Math.cos(a)},${cy+rad*Math.sin(a)}`);
    }
    return pts.join(' ');
  },

  suitSVG(suit, num){
    const C='#8B1A1A';
    const base='<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">';
    switch(suit){
      case 'circle':
        return `${base}<circle cx="50" cy="50" r="44" fill="${C}"/></svg>`;
      case 'triangle':
        return `${base}<polygon points="50,6 96,90 4,90" fill="${C}"/></svg>`;
      case 'cross':
        return `${base}<rect x="36" y="6" width="28" height="88" rx="5" fill="${C}"/>
          <rect x="6" y="36" width="88" height="28" rx="5" fill="${C}"/></svg>`;
      case 'square':
        return `${base}<rect x="8" y="8" width="84" height="84" rx="7" fill="${C}"/></svg>`;
      case 'star':{
        const sp=this._star(50,52,46,18,5);
        const fs=num>=10?'22':'28';
        return `${base}<polygon points="${sp}" fill="${C}"/>
          <text x="50" y="62" text-anchor="middle" dominant-baseline="middle"
            fill="white" font-family="Outfit,sans-serif" font-weight="900"
            font-size="${fs}">${num}</text></svg>`;}
      case 'whot':
        return `${base}
          <polygon points="15,82 24,38 38,56 50,12 62,56 76,38 85,82" fill="${C}"/>
          <rect x="15" y="79" width="70" height="13" rx="3" fill="${C}"/>
          <circle cx="32" cy="70" r="5" fill="#FFD700"/>
          <circle cx="50" cy="67" r="5" fill="#FFD700"/>
          <circle cx="68" cy="70" r="5" fill="#FFD700"/></svg>`;
      default: return `${base}</svg>`;
    }
  },

  suitMini(suit){
    return {circle:'⭕',triangle:'🔺',cross:'✚',square:'🟦',star:'⭐',whot:'👑'}[suit]||'';
  },

  // ── CARD ELEMENT BUILDERS ─────────────────────────────────────
  cardFaceHTML(card, selected=false, showMe=false, idx=null){
    const label = card.num===20 ? '20' : card.num;
    const mini  = this.suitMini(card.suit);
    const sel   = selected ? 'selected' : '';
    const meBadge = showMe ? '<div class="wcard-me-badge">Me</div>' : '';
    const idxLabel = idx!==null ? `<div class="wcard-index">${idx}</div>` : '';
    return `
      <div class="wcard-hand-wrap">
        ${idxLabel}
        <div class="wcard wcard-face ${sel}" data-id="${card.id}" onclick="GameBoard.onPlayCard('${card.id}')">
          <div class="wcard-corner tl">
            <div class="wcard-num">${label}</div>
            <div class="wcard-mini-suit">${mini}</div>
          </div>
          <div class="wcard-center">${this.suitSVG(card.suit,card.num)}</div>
          <div class="wcard-corner br">
            <div class="wcard-num">${label}</div>
            <div class="wcard-mini-suit">${mini}</div>
          </div>
          ${meBadge}
        </div>
      </div>`;
  },

  cardBackHTML(small=false){
    const cls = small ? 'wcard wcard-back' : 'wcard wcard-back';
    return `<div class="${cls}"><div class="wcard-back-inner"><span class="wcard-back-text">Whot</span></div></div>`;
  },

  topCardHTML(card){
    if(!card) return '';
    const label = card.num===20 ? '20' : card.num;
    const mini  = this.suitMini(card.suit);
    return `
      <div class="wcard wcard-face gb-top-card" id="gbTopCardEl">
        <div class="wcard-corner tl">
          <div class="wcard-num">${label}</div>
          <div class="wcard-mini-suit">${mini}</div>
        </div>
        <div class="wcard-center">${this.suitSVG(card.suit,card.num)}</div>
        <div class="wcard-corner br">
          <div class="wcard-num">${label}</div>
          <div class="wcard-mini-suit">${mini}</div>
        </div>
      </div>`;
  },

  // ── BOARD INIT ────────────────────────────────────────────────
  start(state, opts){
    if(this.online && this.online.unsub) this.online.unsub();
    this.online = null;
    this.state = state;
    this.opts  = opts||{};
    this.selectedCardId = null;
    this.eliminated = [];
    this.revealAllHands = false;
    this.inCheckupAnimation = false;
    this.inMarketAnimation = false;
    this.isWager = (opts&&opts.wager>0)||false;
    this.isSpectating = false;
    this.waitingForWatchChoice = false;
    this.timerSeconds = {};
    const tMap={bullet:60,blitz:180,rapid:600,classical:1800,unlimited:9999};
    const tSec = (opts && opts.timerBaseSec) || tMap[opts&&opts.timerMode||'rapid']||600;
    this.timerIncSec = (opts && opts.timerIncSec) || 0;
    state.players.forEach((_,i)=>this.timerSeconds[i]=tSec);

    // Build board DOM
    const container = document.getElementById('pageContainer');
    container.innerHTML = '';
    const board = document.createElement('div');
    board.className = 'game-board slide-up';
    board.id = 'gameBoard';
    board.innerHTML = this._boardHTML();
    container.appendChild(board);

    this.updateUI();
    this.startTimers();
    SoundEngine.play('deal');

    // Open a live match doc so this game can show up in the public "Watch Live" list
    // and accept spectators/chat — separate from the play-history doc written at game end.
    this.matchId = null;
    const u = Store.getUser();
    if (typeof Db !== 'undefined' && u && u.id && !String(u.id).startsWith('guest_')) {
      Db.createMatch({
        players: state.players.map(p => ({ uid: p.isHuman ? u.id : `cpu-${p.id}`, name: p.isHuman ? u.name : p.name })),
        allowSpectators: this.opts.allowSpectators !== false
      }).then(id => { this.matchId = id; }).catch(e => console.warn('Could not open live match doc:', e));
    }
  },

  // ── ONLINE (real opponent, state-synced via Supabase) ──────────
  //
  // The rest of this file always assumes "local seat 0 = me" — checkNextTurn,
  // onPlayCard, the hand-reveal logic, all of it. Rather than rewrite that,
  // each online client keeps its OWN rotated VIEW of one shared canonical
  // state (stored in matches.game_state, seats in a fixed absolute order),
  // where local index 0 always maps to whichever absolute seat is really me.
  // Local mutations get un-rotated back to canonical before being written back,
  // so the existing single-player code runs completely unaware it's online.
  _rotateState(state, offset) {
    const n = state.players.length;
    if (!offset) return state;
    const map = (i) => (i + offset) % n; // local index -> canonical index it holds
    const inv = (i) => (i - offset + n) % n; // canonical index -> local index
    return {
      ...state,
      players: state.players.map((_, localIdx) => ({ ...state.players[map(localIdx)], id: localIdx })),
      currentPlayer: inv(state.currentPlayer),
      winner: (state.winner !== null && state.winner !== undefined) ? inv(state.winner) : state.winner,
      eliminated: (state.eliminated || []).map(inv)
    };
  },
  _unrotateState(state, offset) {
    const n = state.players.length;
    return this._rotateState(state, (n - offset) % n);
  },
  _pushOnlineState() {
    if (!this.online) return;
    Db.setMatchState(this.online.matchId, this._unrotateState(this.state, this.online.mySeat))
      .catch(e => console.warn('Could not sync game state:', e));
  },

  startOnline(matchId, opts, mySeatAbsolute, playersInfo) {
    this.opts = opts || {};
    this.online = { matchId, mySeat: mySeatAbsolute, isHost: mySeatAbsolute === 0, playersInfo };
    this.selectedCardId = null;
    this.eliminated = [];
    this.revealAllHands = false;
    this.inCheckupAnimation = false;
    this.inMarketAnimation = false;
    this.isWager = (opts && opts.wager > 0) || false;
    this.isSpectating = false;
    this.waitingForWatchChoice = false;
    this.timerSeconds = {};
    this.timerIncSec = (opts && opts.timerIncSec) || 0;
    this.matchId = matchId;
    this._hostInitDone = false;
    this._onlineBoardBuilt = false;

    const container = document.getElementById('pageContainer');
    container.innerHTML = '';
    const board = document.createElement('div');
    board.className = 'game-board slide-up';
    board.id = 'gameBoard';
    board.innerHTML = '<div style="padding:5rem; text-align:center; font-size:1.2rem;">⏳ Connecting to your match...</div>';
    container.appendChild(board);

    this.online.unsub = Db.listenMatchState(matchId, (canonicalState) => {
      if (!canonicalState) {
        if (this.online.isHost) this._hostInitOnlineGame(playersInfo);
        return;
      }
      this._applyIncomingCanonicalState(canonicalState);
    });
  },

  _hostInitOnlineGame(playersInfo) {
    if (this._hostInitDone) return;
    this._hostInitDone = true;
    const state = WhotEngine.createGame(playersInfo.length, this.opts);
    state.players = state.players.map((p, i) => ({ ...p, name: playersInfo[i].name, isHuman: true }));
    Db.setMatchState(this.online.matchId, state).catch(e => console.warn('Could not start online game:', e));
  },

  _applyIncomingCanonicalState(canonicalState) {
    const prevEliminatedCount = this.state ? (this.state.eliminated || []).length : 0;
    this.state = this._rotateState(canonicalState, this.online.mySeat);
    this.eliminated = this.state.eliminated || [];

    if (!this._onlineBoardBuilt) {
      this._onlineBoardBuilt = true;
      document.getElementById('gameBoard').innerHTML = this._boardHTML();
      const tMap = { bullet:60, blitz:180, rapid:600, classical:1800, unlimited:9999 };
      const tSec = this.opts.timerBaseSec || tMap[this.opts.timerMode || 'rapid'] || 600;
      this.state.players.forEach((_, i) => { if (this.timerSeconds[i] === undefined) this.timerSeconds[i] = tSec; });
      this.startTimers();
      SoundEngine.play('deal');
    } else if (this.eliminated.length > prevEliminatedCount) {
      this.showToast('A player was eliminated — new round dealt.');
    }

    this.updateUI();
    // Only the host reacts to deck-empty here — otherwise every incoming sync
    // update while the deck stays empty would re-trigger the notice on the
    // non-host client while it waits for the host's checkup to resolve.
    if (!this.state.gameOver && this.online.isHost) this._checkEmptyDeck();
  },

  _boardHTML(){
    const user = Store.getUser()||{};
    return `
      <div class="gb-rotate-prompt" id="gbRotatePrompt">
        <div class="gb-rotate-icon">📱</div>
        <div style="font-size:1.1rem; font-weight:700;">Rotate your device to landscape</div>
        <div style="font-size:0.85rem; opacity:0.8;">The board fits much better sideways.</div>
      </div>
      <div class="gb-main-area">
        <!-- Top bar -->
        <div class="gb-topbar">
          <div style="display:flex; gap:8px; align-items:center;">
            <button class="gb-btn-icon gb-btn-menu" onclick="GameBoard.toggleSettings()">☰</button>
            <div class="gb-tip-pill" id="gbTips">⚡ Play by suit or number</div>
          </div>
          <div class="gb-turn-label" id="gbTurnLabel">Your turn</div>
          <div style="display:flex; gap:8px;">
            <button class="gb-btn-icon gb-btn-chat" onclick="GameBoard.toggleChat()">💬</button>
            <button class="gb-btn-icon gb-btn-exit" onclick="GameBoard.exitGame()">✕</button>
          </div>
        </div>

      <!-- Center table area: opponents + pile + hand -->
      <div class="gb-table">
        <!-- Opponents top row -->
        <div class="gb-opponents-row" id="gbOpponentsTop"></div>

        <!-- Side opponents -->
        <div class="gb-opponent-side left" id="gbOpponentLeft"></div>
        <div class="gb-opponent-side right" id="gbOpponentRight"></div>

        <!-- Center: deck + top card -->
        <div class="gb-center">
          <div class="gb-deck-area">
            <div class="gb-deck-label">DECK</div>
            <div class="gb-deck-wrap" onclick="GameBoard.onDraw()">
              ${this.cardBackHTML()}
              <div class="gb-deck-count-badge" id="gbDeckCount">?</div>
            </div>
          </div>
          <div class="gb-turn-col">
            <div class="gb-defend-badge hidden" id="gbDefendBadge">Defend!</div>
          </div>
          <div class="gb-pile-area">
            <div class="gb-deck-label">TOP CARD</div>
            <div class="gb-top-card-wrap" id="gbTopCardWrap"></div>
          </div>
        </div>

        <!-- Player hand (bottom) -->
        <div class="gb-player-section">
          <div class="gb-player-info-row">
            <div class="gb-player-self-avi" id="gbSelfAvi">${user.avi||'ME'}</div>
            <div class="gb-player-self-name">${user.name||'You'}</div>
            <div class="gb-card-count" id="gbMyCount">?</div>
            <div class="gb-timer-label" id="gbMyTimer" style="margin-left: 10px;">00:00</div>
          </div>
          <div class="gb-hand" id="gbHand"></div>
        </div>
      </div><!-- End table -->

      <!-- Bottom HUD -->
      <div class="gb-hud">
        <div style="display:flex;gap:6px;align-items:center;">
          <span style="font-size:0.7rem;color:rgba(255,255,255,0.6);">Rank:</span>
          <b id="gbRank" style="color:var(--gold);">0</b>
          <span style="font-size:0.7rem;color:rgba(255,255,255,0.6);margin-left:6px;">Wins:</span>
          <b id="gbWins" style="color:#00e676;">0</b>
        </div>
        <button class="gb-btn-refresh" title="Refresh" onclick="GameBoard.refreshHand()">&#8635;</button>
      </div>


      <!-- Settings panel -->
      <div class="gb-settings hidden" id="gbSettings">
        <h3>⚙️ In-Game Settings</h3>
        <div class="gb-setting-row">
          <span>🔊 Sound</span>
          <button class="gb-toggle on" id="toggleSound" onclick="GameBoard.toggleSound(this)"></button>
        </div>
        <div class="gb-setting-row">
          <span>🗣️ Voice</span>
          <button class="gb-toggle on" id="toggleVoice" onclick="GameBoard.toggleVoice(this)"></button>
        </div>
        <button class="gb-settings-btn" onclick="GameBoard.onCheckUp()">📋 Declare Check Up</button>
        <button class="gb-settings-btn" onclick="GameBoard.showRules()">📖 View Rules</button>
        <button class="gb-settings-btn" onclick="GameBoard.toggleSettings()">Close</button>
      </div>

      <!-- Suit selection -->
      <div class="gb-suit-modal hidden" id="gbSuitModal">
        <h3>Call a Suit (Whot 20)</h3>
        <div class="gb-suit-grid">
          <button class="gb-suit-btn" onclick="GameBoard.onWhotCall('circle')">
            <svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" fill="#8B1A1A"/></svg><span>Circle</span></button>
          <button class="gb-suit-btn" onclick="GameBoard.onWhotCall('triangle')">
            <svg viewBox="0 0 100 100"><polygon points="50,6 96,90 4,90" fill="#8B1A1A"/></svg><span>Triangle</span></button>
          <button class="gb-suit-btn" onclick="GameBoard.onWhotCall('cross')">
            <svg viewBox="0 0 100 100"><rect x="36" y="6" width="28" height="88" rx="5" fill="#8B1A1A"/><rect x="6" y="36" width="88" height="28" rx="5" fill="#8B1A1A"/></svg><span>Cross</span></button>
          <button class="gb-suit-btn" onclick="GameBoard.onWhotCall('square')">
            <svg viewBox="0 0 100 100"><rect x="8" y="8" width="84" height="84" rx="7" fill="#8B1A1A"/></svg><span>Square</span></button>
          <button class="gb-suit-btn" onclick="GameBoard.onWhotCall('star')">
            <svg viewBox="0 0 100 100"><polygon points="${this._star(50,52,46,18,5)}" fill="#8B1A1A"/></svg><span>Star</span></button>
        </div>
      </div>

      <!-- Rules modal -->
      <div class="gb-rules-modal hidden" id="gbRulesModal">
        <button class="gb-modal-close" onclick="document.getElementById('gbRulesModal').classList.add('hidden')">✕</button>
        <h2>Rules</h2>
        <p>NG Whot is played with 54 cards across 6 suits: Circle, Cross, Star, Triangle, Square, and Whot (wild).</p>
        <h3>How To Play</h3>
        <p>Match the top card by <b>suit</b> OR <b>number</b>. First player to empty their hand wins!</p>
        <h3>Special Cards</h3>
        <table>
          <tr><th>Card</th><th>Effect</th></tr>
          <tr><td>2</td><td>Next player picks 2 cards (stackable)</td></tr>
          <tr><td>5</td><td>Next player picks 3 cards (stackable)</td></tr>
          <tr><td>14</td><td>General Market — everyone else picks 1</td></tr>
          <tr><td>1 or 8</td><td>Hold On / Suspension (configurable)</td></tr>
          <tr><td>20 (Whot)</td><td>Wildcard — call any suit</td></tr>
        </table>
        <h3>Checkup</h3>
        <p>Declare checkup at any time. All players count their card values. Lowest score wins.</p>
        <h3>Star Cards</h3>
        <p>Star suit cards are worth double their face value in checkup scoring.</p>
      </div>

      <!-- Counting overlay -->
      <div class="gb-counting-overlay hidden" id="gbCountingOverlay">
        <div class="gb-counting-box">
          <h3 class="gb-counting-title" id="gbCountingTitle">Counting...</h3>
          <div class="gb-counting-cards" id="gbCountingCards"></div>
          <div class="gb-counting-sum" id="gbCountingSum">Sum: 0</div>
          <div class="gb-counting-results" id="gbCountingResults"></div>
        </div>
      </div>

      <!-- Game over overlay -->
      <div class="gb-gameover-overlay hidden" id="gbGameOver"></div>
      </div> <!-- End main area -->

      <!-- Chat Pane -->
      <div class="gb-chat-pane" id="gbChatPane">
        <div class="gb-chat-header">
          💬 Room Chat
          <button class="gb-chat-close" onclick="GameBoard.toggleChat()">✕</button>
        </div>
        <div class="gb-chat-msgs" id="gbChatMsgs">
          <div class="gb-msg gb-msg-system"><span class="who">System:</span> Welcome! Game has started.</div>
        </div>
        <div class="gb-chat-input-wrap">
          <input type="text" placeholder="Say something..." id="gbChatInput" onkeydown="if(event.key==='Enter') GameBoard.sendChatMessage()">
          <button onclick="GameBoard.sendChatMessage()">Send</button>
        </div>
      </div>
    `;
  },

  // ── UI UPDATE ─────────────────────────────────────────────
  updateUI(){
    if(!this.state) return;
    this._renderOpponents();
    this._renderCenter();
    this._renderHand();
    this._updateTurnLabel();
    // Update player self count
    const myCount = document.getElementById('gbMyCount');
    if(myCount) myCount.textContent = this.state.players[0].hand.length;

    // Update self timer
    const myTimer = document.getElementById('gbMyTimer');
    if(myTimer){
      const mySec = this.timerSeconds[0]||0;
      myTimer.textContent = this._fmtTime(mySec);
      if(mySec < 30) myTimer.classList.add('low');
      else myTimer.classList.remove('low');
    }

    const user = Store.getUser()||{};
    const rankEl=document.getElementById('gbRank'); if(rankEl) rankEl.textContent=user.rank||0;
    const winsEl=document.getElementById('gbWins'); if(winsEl) winsEl.textContent=user.won||0;
  },

  addActivity(text, color='#aaa'){
    const msgs = document.getElementById('gbChatMsgs');
    if(!msgs) return;
    msgs.insertAdjacentHTML('beforeend', `<div class="gb-msg gb-msg-activity" style="border-left:3px solid ${color};padding-left:8px;font-size:0.78rem;color:${color};">⏵ ${text}</div>`);
    msgs.scrollTop = msgs.scrollHeight;
  },

  _renderOpponents(){
    const players = this.state.players;
    const topEl   = document.getElementById('gbOpponentsTop');
    const leftEl  = document.getElementById('gbOpponentLeft');
    const rightEl = document.getElementById('gbOpponentRight');
    if(!topEl) return;

    const opponents = players.filter((_,i)=>i!==0);
    topEl.innerHTML=''; leftEl.innerHTML=''; rightEl.innerHTML='';

    opponents.forEach((p,oi)=>{
      const isElim = this.eliminated.includes(p.id);
      const isActive = this.state.currentPlayer===p.id;
      const avi = this.avatars[oi%this.avatars.length];
      const timerSec = this.timerSeconds[p.id]||0;
      const timerStr = this._fmtTime(timerSec);
      const timerLow = timerSec<30?'low':'';

      let fanHTML='';
      if(this.revealAllHands && !isElim){
        p.hand.forEach(c => {
          const label = c.num === 20 ? '20' : c.num;
          const mini = this.suitMini(c.suit);
          fanHTML += `
            <div class="wcard wcard-face wcard-mini wcard-flip" style="width:28px; height:40px; border-radius:3px; font-size:8px; margin-left:-6px;">
              <div class="wcard-corner tl" style="padding: 1px 2px;"><div class="wcard-num" style="font-size:7px;">${label}</div></div>
              <div class="wcard-center" style="transform: scale(0.5);">${this.suitSVG(c.suit, c.num)}</div>
            </div>`;
        });
      } else {
        const fanCards = Math.min(p.hand.length,4);
        for(let f=0;f<fanCards;f++) fanHTML+=`<div class="wcard wcard-back" style="width:36px;height:52px;border-radius:5px;"></div>`;
      }

      const scoreText = (this.revealAllHands && !isElim) ? `<div class="gb-timer-label" style="color:var(--gold);">⭐ Score: ${this.getCheckupScore(p.hand)}</div>` : `<div class="gb-timer-label ${timerLow}">${timerStr}</div>`;

      const html=`
        <div style="display:flex;flex-direction:column;align-items:center;gap:4px;" data-pidx="${p.id}">
          <div class="gb-fan">${fanHTML}</div>
          <div class="gb-avatar-wrap">
            <div class="gb-avatar ${isActive?'active':''} ${isElim?'eliminated':''}">${avi}</div>
            <div class="gb-card-count">${p.hand.length}</div>
            ${isElim?'<div class="gb-out-badge">OUT</div>':''}
          </div>
          <div class="gb-name-label">${p.name}</div>
          ${scoreText}
        </div>`;

      if (opponents.length === 1) {
        topEl.innerHTML = html;
      } else if (opponents.length === 2) {
        if (oi === 0) leftEl.innerHTML = html;
        else rightEl.innerHTML = html;
      } else {
        if (oi === 0) leftEl.innerHTML = html;
        else if (oi === 1) topEl.innerHTML = html;
        else rightEl.innerHTML = html;
      }
    });
  },

  _renderCenter(){
    const pile = this.state.pile;
    const topCard = pile[pile.length-1];
    const topWrap=document.getElementById('gbTopCardWrap');
    const deckCount=document.getElementById('gbDeckCount');
    const defendBadge=document.getElementById('gbDefendBadge');

    if(topWrap) topWrap.innerHTML=this.topCardHTML(topCard);
    if(deckCount) deckCount.textContent=this.state.deck.length;
    if(defendBadge){
      if(this.state.pendingPickup>0 && this.state.currentPlayer===0)
        defendBadge.classList.remove('hidden');
      else
        defendBadge.classList.add('hidden');
    }
  },

  _renderHand(){
    const hand=document.getElementById('gbHand');
    if(!hand||!this.state) return;
    const myCards=this.state.players[0].hand;
    const isMyTurn = this.state.currentPlayer===0;
    const hasPending = this.state.pendingPickup > 0;
    const topCard = this.state.pile[this.state.pile.length-1];
    hand.innerHTML='';
    myCards.forEach((c,i)=>{
      let canPlay = false;
      if(isMyTurn){
        if(hasPending){
          // Only defending cards are playable
          canPlay = WhotEngine.canDefend(c, topCard, this.state.opts);
        } else {
          canPlay = WhotEngine.canPlay(c, topCard, this.state.calledSuit, this.state.opts);
        }
      }
      const isSel=c.id===this.selectedCardId;
      const label = c.num===20 ? '20' : c.num;
      const mini  = this.suitMini(c.suit);
      const selCls = isSel ? 'selected' : '';
      const playableCls = canPlay ? 'playable' : (isMyTurn?'unplayable':'');
      const defendCls = (isMyTurn && hasPending && canPlay) ? 'defend-highlight' : '';
      hand.insertAdjacentHTML('beforeend', `
        <div class="wcard-hand-wrap">
          <div class="wcard wcard-face ${selCls} ${playableCls} ${defendCls}" data-id="${c.id}" onclick="GameBoard.onPlayCard('${c.id}')">
            <div class="wcard-corner tl"><div class="wcard-num">${label}</div><div class="wcard-mini-suit">${mini}</div></div>
            <div class="wcard-center">${this.suitSVG(c.suit,c.num)}</div>
            <div class="wcard-corner br"><div class="wcard-num">${label}</div><div class="wcard-mini-suit">${mini}</div></div>
          </div>
        </div>`);
    });
  },

  _updateTurnLabel(){
    const lbl=document.getElementById('gbTurnLabel');
    if(!lbl) return;
    const cur=this.state.currentPlayer;
    if(cur===0){
      if(this.state.pendingPickup>0){
        lbl.textContent=`⚠️ Pick ${this.state.pendingPickup} or Defend!`;
        lbl.style.color='#ff5252';
        lbl.style.textShadow='0 0 16px rgba(255,82,82,0.8)';
      } else if(this.state.generalMarket){
        lbl.textContent='🛒 General Market — Play again!';
        lbl.style.color='#ff4081';
        lbl.style.textShadow='0 0 16px rgba(255,64,129,0.8)';
      } else if(this.state.holdOn){
        lbl.textContent='🔁 Hold On — Play again!';
        lbl.style.color='#69f0ae';
        lbl.style.textShadow='0 0 16px rgba(105,240,174,0.8)';
      } else {
        lbl.textContent='Your Turn — Tap a card!';
        lbl.style.color='#FFD700';
        lbl.style.textShadow='0 0 16px rgba(255,215,0,0.8)';
      }
    } else {
      const name=this.state.players[cur]?this.state.players[cur].name:'...';
      lbl.textContent=`${name} is playing...`;
      lbl.style.color='rgba(255,255,255,0.7)';
      lbl.style.textShadow='none';
    }
  },

  _fmtTime(s){
    const m=Math.floor(s/60), sec=s%60;
    return `${m}:${sec.toString().padStart(2,'0')}`;
  },

  // ── USER INTERACTIONS ─────────────────────────────────────────
  toggleChat() {
    const pane = document.getElementById('gbChatPane');
    if (pane) pane.classList.toggle('open');
  },

  sendChatMessage() {
    const input = document.getElementById('gbChatInput');
    const msgs = document.getElementById('gbChatMsgs');
    if(!input || !msgs || !input.value.trim()) return;
    
    const text = input.value.trim();
    input.value = '';
    
    // Append my msg
    msgs.insertAdjacentHTML('beforeend', `<div class="gb-msg"><span class="who" style="color:#00ff88;">You:</span> ${text}</div>`);
    msgs.scrollTop = msgs.scrollHeight;
    
    // Simulate simple reply
    setTimeout(()=>{
      const ops = this.state.players.filter((_,i)=>i!==0);
      if(ops.length===0) return;
      const op = ops[Math.floor(Math.random()*ops.length)];
      const replies = ['Nice one!', 'Play your card!', 'Hold on...', 'General market is coming!'];
      const reply = replies[Math.floor(Math.random()*replies.length)];
      msgs.insertAdjacentHTML('beforeend', `<div class="gb-msg"><span class="who">${op.name}:</span> ${reply}</div>`);
      msgs.scrollTop = msgs.scrollHeight;
    }, 1500 + Math.random()*1500);
  },

  selectCard(id, el){
    // Deprecated for one-tap play, kept if needed
  },

  onDraw(){
    if(this.state.currentPlayer!==0 || this.state.gameOver || this.inMarketAnimation) return;
    this.selectedCardId = null;
    this._executeDraw(0);
  },

  onPlayCard(cardId){
    if(this.state.currentPlayer!==0 || this.state.gameOver || this.inCheckupAnimation || this.inMarketAnimation){
      this.showToast('Not your turn!'); return;
    }
    const card = this.state.players[0].hand.find(c=>c.id===cardId);
    if(!card) return;
    this.selectedCardId = cardId;

    if(this.state.pendingPickup>0){
      const topCard = this.state.pile[this.state.pile.length-1];
      if(!WhotEngine.canDefend(card, topCard, this.state.opts)){
        this.showToast('You must defend with the same number or draw!');
        this.selectedCardId = null;
        return;
      }
    } else {
      if(!WhotEngine.canPlay(card, this.state.pile[this.state.pile.length-1], this.state.calledSuit, this.state.opts)){
        this.showToast('Invalid card!'); this.selectedCardId = null; return;
      }
    }

    if(card.suit==='whot'){
      document.getElementById('gbSuitModal').classList.remove('hidden');
      return; // wait for suit call
    }

    this._executePlay(0, cardId, null);
  },

  onWhotCall(suit){
    document.getElementById('gbSuitModal').classList.add('hidden');
    this._executePlay(0, this.selectedCardId, suit);
  },

  getCheckupScore(hand){
    return WhotEngine.getCardScore(hand);
  },

  onCheckUp(force = false){
    if(!force && (this.state.currentPlayer!==0 || this.state.gameOver || this.inCheckupAnimation)) return;
    // Auto-triggered checkups (deck emptied, hand-emptying win) can fire on both
    // clients' copies of the same synced state at once — only the host actually
    // runs the counting/elimination sequence online; everyone else just gets the
    // resulting state once it's pushed.
    if(force && this.online && !this.online.isHost) return;

    this.inCheckupAnimation = true;
    this.revealAllHands = true;
    this.updateUI();

    this.showActionBanner('📋 CHECK UP!', '#FFD700');
    SoundEngine.play('deal'); // play general sound

    setTimeout(() => {
      this.runVisualCountingSequence();
    }, 1500);
  },

  _checkEmptyDeck(){
    if (this.state.deck.length === 0 && this.opts && this.opts.emptyDeckBehavior === 'checkup' && !this.inCheckupAnimation && !this.inMarketAnimation && !this.state.gameOver) {
      setTimeout(() => {
        this.showToast("🛒 Market finishes! Initiating Checkup.");
        this.onCheckUp(true);
      }, 800);
      return true;
    }
    return false;
  },

  runVisualCountingSequence() {
    const overlay = document.getElementById('gbCountingOverlay');
    const titleEl = document.getElementById('gbCountingTitle');
    const container = document.getElementById('gbCountingCards');
    const sumEl = document.getElementById('gbCountingSum');
    const resultsEl = document.getElementById('gbCountingResults');
    if (!overlay) return;

    overlay.classList.remove('hidden');
    if (resultsEl) resultsEl.innerHTML = '';

    // 1. Identify starting player
    let startIdx = this.state.winner !== null ? this.state.winner : this.state.currentPlayer;
    if (startIdx === null || startIdx === undefined) startIdx = 0;

    const count = this.state.players.length;
    const order = [];
    for (let i = 0; i < count; i++) {
      const idx = (startIdx + i) % count;
      if (!this.eliminated.includes(idx)) {
        order.push(idx);
      }
    }

    // Reset scores display on avatars
    this.state.players.forEach(p => {
      p.handScore = undefined;
    });
    this.updateUI();

    let orderIdx = 0;

    const processNextPlayer = () => {
      if (orderIdx >= order.length) {
        setTimeout(() => {
          overlay.classList.add('hidden');
          this.finishCheckupScoring();
        }, 1200);
        return;
      }

      const pIdx = order[orderIdx];
      const player = this.state.players[pIdx];
      titleEl.textContent = `📋 Counting: ${player.name}`;
      container.innerHTML = '';
      sumEl.textContent = '0';

      const hand = [...player.hand];
      let cardIdx = 0;
      let currentSum = 0;

      const processNextCard = () => {
        if (cardIdx >= hand.length) {
          player.handScore = currentSum;
          this.updateUI();

          if (resultsEl) {
            const row = document.createElement('div');
            row.className = 'gb-counting-result-row';
            row.innerHTML = `<span>${player.name}</span><span>${currentSum} pts</span>`;
            resultsEl.appendChild(row);
          }

          setTimeout(() => {
            orderIdx++;
            processNextPlayer();
          }, 900);
          return;
        }

        const card = hand[cardIdx];
        const isStar = card.suit === 'star';
        const cardVal = isStar ? card.num * 2 : (card.num === 20 ? 20 : card.num);

        const wrapper = document.createElement('div');
        wrapper.className = 'wcard-hand-wrap counting-card';
        wrapper.innerHTML = this.cardBackHTML();
        container.appendChild(wrapper);

        SoundEngine.play('card');

        setTimeout(() => {
          const mini = this.suitMini(card.suit);
          const label = card.num === 20 ? '20' : card.num;
          const starLabel = isStar ? `<div class="wcard-me-badge" style="background:#ff9800;font-size:7px;padding:2px 4px;border-radius:3px;">x2 Star</div>` : '';

          wrapper.innerHTML = `
            <div class="wcard wcard-face wcard-flip">
              <div class="wcard-corner tl">
                <div class="wcard-num">${label}</div>
                <div class="wcard-mini-suit">${mini}</div>
              </div>
              <div class="wcard-center">${this.suitSVG(card.suit, card.num)}</div>
              <div class="wcard-corner br">
                <div class="wcard-num">${label}</div>
                <div class="wcard-mini-suit">${mini}</div>
              </div>
              ${starLabel}
            </div>
          `;

          currentSum += cardVal;
          sumEl.textContent = `${currentSum}`;
          sumEl.classList.remove('bump');
          void sumEl.offsetWidth;
          sumEl.classList.add('bump');

          cardIdx++;
          setTimeout(processNextCard, 550);
        }, 350);
      };

      processNextCard();
    };

    processNextPlayer();
  },

  finishCheckupScoring() {
    const activePlayers = this.state.players.filter(p => !this.eliminated.includes(p.id));
    const scored = activePlayers.map(p => ({
      id: p.id,
      name: p.name,
      score: p.handScore !== undefined ? p.handScore : this.getCheckupScore(p.hand)
    }));

    const isFinal = activePlayers.length <= 2;

    if (isFinal && this.state.winner !== null && this.state.winner !== undefined) {
      this.revealAllHands = false;
      this.inCheckupAnimation = false;
      this.state.gameOver = true;
      this.showGameOver(this.state.winner, scored);
      this._pushOnlineState();
      return;
    }

    if (this.opts && this.opts.checkupStyle === 'classic') {
      const classicScored = [...scored].sort((a,b) => a.score - b.score);
      const minScore = classicScored[0].score;
      const classicCandidates = classicScored.filter(s => s.score === minScore);
      let classicWinner = classicCandidates[0].id;
      if (classicCandidates.length > 1) {
        classicCandidates.sort((a,b) => {
          const lenA = this.state.players[a.id].hand.length;
          const lenB = this.state.players[b.id].hand.length;
          return lenA - lenB; // ascending card count
        });
        classicWinner = classicCandidates[0].id;
      }
      this.revealAllHands = false;
      this.inCheckupAnimation = false;
      this.state.gameOver = true;
      this.state.winner = classicWinner;
      this.showGameOver(classicWinner, scored);
      this._pushOnlineState();
    } else {
      scored.sort((a,b) => b.score - a.score);
      const maxScore = scored[0].score;
      const candidates = scored.filter(s => s.score === maxScore);
      let toElim = candidates[0].id;
      if (candidates.length > 1) {
        candidates.sort((a,b) => {
          const lenA = this.state.players[a.id].hand.length;
          const lenB = this.state.players[b.id].hand.length;
          return lenB - lenA; // descending card count
        });
        toElim = candidates[0].id;
      }

      const targetName = this.state.players[toElim].name;
      this.showActionBanner(`❌ ${targetName} OUT!`, '#f44336');
      this.eliminatePlayer(toElim);

      setTimeout(() => {
        this.revealAllHands = false;
        this.inCheckupAnimation = false;
        if (this.state.gameOver) return; // eliminatePlayer() already concluded the match

        const remaining = this.state.players.filter(p => !this.eliminated.includes(p.id));
        if (remaining.length <= 1) {
          const winner = remaining.length === 1 ? remaining[0].id : 0;
          this.state.gameOver = true;
          this.state.winner = winner;
          this.showGameOver(winner, null);
          this._pushOnlineState();
        } else {
          this.state.players.forEach(p => {
            p.handScore = undefined;
          });
          this.state.winner = null;
          this.showActionBanner(`🏁 Round ${this.eliminated.length + 1} — New Deal!`, '#00BCD4');
          this.state = WhotEngine.dealNextRound(this.state);
          this._resetRoundTimers();
          this.updateUI();
          this._pushOnlineState();
          this.checkNextTurn();
        }
      }, 2000);
    }
  },

  _applyIncrement(pIdx){
    if (!this.timerIncSec || this.eliminated.includes(pIdx)) return;
    if (this.timerSeconds[pIdx] === undefined) return;
    this.timerSeconds[pIdx] += this.timerIncSec;
  },

  _resetRoundTimers(){
    if (!this.opts || this.opts.timerMode === 'unlimited') return;
    const tMap = { bullet:60, blitz:180, rapid:600, classical:1800, unlimited:9999 };
    const tSec = this.opts.timerBaseSec || tMap[this.opts.timerMode || 'rapid'] || 600;
    this.state.players.forEach(p => {
      if (!this.eliminated.includes(p.id)) this.timerSeconds[p.id] = tSec;
    });
  },

  _executePlay(pIdx, cardId, whotCall){
    const isMe = pIdx===0;
    let flyingCard = null;

    if (isMe) {
      const cardEl = document.querySelector(`.wcard-face[data-id="${cardId}"]`);
      if(cardEl) cardEl.parentElement.classList.add('wcard-playing');
    } else {
      const opContainer = document.querySelector(`[data-pidx="${pIdx}"]`);
      const tcWrap = document.getElementById('gbTopCardWrap');
      if (opContainer && tcWrap) {
        const fan = opContainer.querySelector('.gb-fan');
        if (fan) {
          const startRect = fan.getBoundingClientRect();
          const endRect = tcWrap.getBoundingClientRect();
          
          flyingCard = document.createElement('div');
          flyingCard.className = 'wcard-flying wcard wcard-back';
          flyingCard.innerHTML = `<div class="wcard-back-inner"><span class="wcard-back-text">Whot</span></div>`;
          flyingCard.style.top = startRect.top + 'px';
          flyingCard.style.left = startRect.left + 'px';
          document.body.appendChild(flyingCard);
          
          void flyingCard.offsetWidth; // trigger reflow
          
          flyingCard.style.top = endRect.top + 'px';
          flyingCard.style.left = endRect.left + 'px';
          flyingCard.style.transform = 'rotateY(180deg) scale(1.1)';
        }
      }
    }

    SoundEngine.play('card');
    
    setTimeout(()=>{
      if (flyingCard) flyingCard.remove();

      this.state = WhotEngine.playCard(this.state, pIdx, cardId, whotCall);
      this.selectedCardId = null;
      this._applyIncrement(pIdx);

      const tcWrap = document.getElementById('gbTopCardWrap');
      if(tcWrap){
        tcWrap.innerHTML = this.topCardHTML(this.state.pile[this.state.pile.length-1]);
        tcWrap.firstElementChild.classList.add('wcard-flip');
      }

      this._checkCardEffects(pIdx);
      this.updateUI();
      this._pushOnlineState();

      if(this.state.gameOver){
        const activeCount = this.state.players.filter(p => !this.eliminated.includes(p.id)).length;
        const isClassic = this.opts && this.opts.checkupStyle === 'classic';
        if (isClassic || activeCount <= 2) {
          // Head-to-head final (or classic mode): hand-emptier wins the match outright
          this.showGameOver(this.state.winner, null);
        } else {
          // Tournament round win with 3+ players still in: this player is safe,
          // but the match isn't over — count everyone else and eliminate the worst hand
          this.state.gameOver = false;
          this._pushOnlineState();
          this.onCheckUp(true);
        }
      } else if (!this.inMarketAnimation) {
        if (!this._checkEmptyDeck()) {
          this.checkNextTurn();
        }
      }
    }, isMe ? 350 : 400);
  },

  _executeDraw(pIdx) {
     const isMe = pIdx===0;
     let flyingCard = null;

     if (!isMe) {
       const opContainer = document.querySelector(`[data-pidx="${pIdx}"]`);
       const deckWrap = document.querySelector('.gb-deck-wrap');
       if (opContainer && deckWrap) {
         const fan = opContainer.querySelector('.gb-fan');
         if (fan) {
           const endRect = fan.getBoundingClientRect();
           const startRect = deckWrap.getBoundingClientRect();
           
           flyingCard = document.createElement('div');
           flyingCard.className = 'wcard-flying wcard wcard-back';
           flyingCard.innerHTML = `<div class="wcard-back-inner"><span class="wcard-back-text">Whot</span></div>`;
           flyingCard.style.top = startRect.top + 'px';
           flyingCard.style.left = startRect.left + 'px';
           document.body.appendChild(flyingCard);
           
           void flyingCard.offsetWidth;
           flyingCard.style.top = endRect.top + 'px';
           flyingCard.style.left = endRect.left + 'px';
           flyingCard.style.transform = 'scale(0.5)';
         }
       }
     }

     SoundEngine.play('draw');
     
     setTimeout(()=>{
        if(flyingCard) flyingCard.remove();
        this.state = WhotEngine.drawCard(this.state, pIdx);
        this._applyIncrement(pIdx);
        this.updateUI();
        this._pushOnlineState();
        if(!this.state.gameOver){
          if (!this._checkEmptyDeck()) {
            this.checkNextTurn();
          }
        }
     }, isMe ? 0 : 400);
  },

  _checkCardEffects(pIdx){
    const len = this.state.pile.length;
    const top = this.state.pile[len-1];
    const prev = len > 1 ? this.state.pile[len-2] : null;

    const action = WhotEngine.getCardAction(top, this.state.opts);
    const prevAction = prev ? WhotEngine.getCardAction(prev, this.state.opts) : null;

    // Check if defended with Block Mode (penalty cancelled)
    if((action === 'pickTwo' || action === 'pickThree') && prevAction === action && this.state.pendingPickup === 0) {
      this.showActionBanner('🛡️ Defended!', '#4caf50');
      SoundEngine.speak('defended');
      return;
    }

    if(action==='pickTwo'){
      const txt = this.state.pendingPickup>2 ? `Pick ${this.state.pendingPickup} (Stacked)!` : 'Pick Two!';
      this.showActionBanner(txt,'#00BCD4'); SoundEngine.announce('pick2', this.state.pendingPickup);
    } else if(action==='pickThree'){
      const txt = this.state.pendingPickup>3 ? `Pick ${this.state.pendingPickup} (Stacked)!` : 'Pick Three!';
      this.showActionBanner(txt,'#FF9800'); SoundEngine.announce('pick3', this.state.pendingPickup);
    } else if(action==='genMarket'){
      this.showActionBanner('🛒 General Market!','#E91E63'); SoundEngine.announce('market');
      this.runGeneralMarketSequence(pIdx);
    } else if(action==='holdOn'){
      this.showActionBanner('🔁 Hold On — Play Again!','#69f0ae'); SoundEngine.announce('holdon');
    } else if(action==='suspension'){
      this.showActionBanner('⏸️ Suspension — Next Skipped!','#f44336'); SoundEngine.announce('holdon');
    } else if(action==='crown'){
      this.showActionBanner(`👑 Whot! Need ${this.state.calledSuit}`,'#9C27B0');
      SoundEngine.play('whot');
      SoundEngine.speak(`I need ${this.state.calledSuit}`);
    }
  },

  // Animates every other active player individually drawing their 1 card
  // from the market (the cards were already dealt to state by the engine —
  // this just plays out the pickup one player at a time instead of silently).
  runGeneralMarketSequence(skipIdx){
    this.inMarketAnimation = true;
    const count = this.state.players.length;
    const order = [];
    for(let i=0;i<count;i++){
      const idx = (skipIdx + 1 + i) % count;
      if(idx !== skipIdx && !this.eliminated.includes(idx)) order.push(idx);
    }

    const deckWrap = document.querySelector('.gb-deck-wrap');
    let i = 0;

    const step = () => {
      if(i >= order.length){
        this.inMarketAnimation = false;
        if (!this._checkEmptyDeck()) this.checkNextTurn();
        return;
      }

      const pIdx = order[i];
      const name = this.state.players[pIdx].name;
      this.showToast(`🛒 ${name} picks from the market...`);
      SoundEngine.play('draw');

      const targetEl = pIdx === 0
        ? document.getElementById('gbHand')
        : document.querySelector(`[data-pidx="${pIdx}"] .gb-fan`);
      if(deckWrap && targetEl){
        const startRect = deckWrap.getBoundingClientRect();
        const endRect = targetEl.getBoundingClientRect();
        const flying = document.createElement('div');
        flying.className = 'wcard-flying wcard wcard-back';
        flying.innerHTML = `<div class="wcard-back-inner"><span class="wcard-back-text">Whot</span></div>`;
        flying.style.top = startRect.top + 'px';
        flying.style.left = startRect.left + 'px';
        document.body.appendChild(flying);
        void flying.offsetWidth;
        flying.style.top = endRect.top + 'px';
        flying.style.left = endRect.left + 'px';
        flying.style.transform = 'scale(0.5)';
        setTimeout(()=>flying.remove(), 500);
      }

      i++;
      setTimeout(step, 650);
    };

    step();
  },

  // ── GAME LOOP ─────────────────────────────────────────────────
  checkNextTurn(){
    if(this.state.gameOver) return;
    if(this.waitingForWatchChoice) return; // paused while showing watch prompt
    const cur = this.state.currentPlayer;

    // Safety: count active players
    const active = this.state.players.filter((_,i)=>!this.eliminated.includes(i));
    if(active.length === 0) return;
    if(active.length === 1){
      this.state.gameOver = true;
      this.showGameOver(active[0].id, null);
      this._pushOnlineState();
      return;
    }

    if(this.eliminated.includes(cur)){
      // Skip eliminated player
      this.state.currentPlayer = WhotEngine.nextPlayer(this.state, cur);
      this.updateUI();
      this._pushOnlineState();
      this.checkNextTurn();
      return;
    }

    // Online: every other seat is a real person on their own client — never simulate them.
    if(this.online) return;

    // In spectate mode, human (0) is treated as CPU — all turns run automatically
    if(cur !== 0 || this.isSpectating){
      setTimeout(()=>this.cpuTurn(), 1200 + Math.random()*800);
    }
  },

  cpuTurn(){
    if(this.state.gameOver || this.inCheckupAnimation || this.inMarketAnimation) return;
    const cur = this.state.currentPlayer;
    const hand = this.state.players[cur].hand;
    const topCard = this.state.pile[this.state.pile.length-1];

    if(this.state.pendingPickup>0){
      // Defend or pick
      if(this.state.opts && this.state.opts.allowDefend){
        const defCard = hand.find(c=>WhotEngine.canDefend(c, topCard, this.state.opts));
        if(defCard) {
          this._executePlay(cur, defCard.id, null);
          return;
        }
      }
      this._executeDraw(cur);
      return;
    }

    const cardToPlay = WhotEngine.aiChooseCard(hand, topCard, this.state.calledSuit, this.state.opts);
    if(cardToPlay){
      let call = null;
      if(cardToPlay.suit==='whot') call = ['circle','triangle','cross','square','star'][Math.floor(Math.random()*5)];
      this._executePlay(cur, cardToPlay.id, call);
    } else {
      this._executeDraw(cur);
    }
  },

  // ── TIMERS ────────────────────────────────────────────────────
  startTimers(){
    if(this.opts.timerMode==='unlimited') return;
    this.timers.main = setInterval(()=>{
      if(this.state.gameOver) return clearInterval(this.timers.main);
      // Pause the clock entirely while a checkup count or market draw is animating
      if(this.inCheckupAnimation || this.inMarketAnimation || this.waitingForWatchChoice) return;
      const cur = this.state.currentPlayer;
      if(this.timerSeconds[cur]>0){
        this.timerSeconds[cur]--;
        this.updateUI();
      } else {
        // Time out = eliminate. Online, only report your OWN timeout — both clients
        // tick down independently, so reporting an opponent's timeout too could race.
        if (this.online && cur !== 0) return;
        this.showToast(`${this.state.players[cur].name} timed out!`);
        this.eliminatePlayer(cur);
      }
    }, 1000);
  },

  eliminatePlayer(idx){
    if(!this.eliminated.includes(idx)){
      this.eliminated.push(idx);
      if(this.state){
        if(!this.state.eliminated) this.state.eliminated = [];
        if(!this.state.eliminated.includes(idx)) {
          this.state.eliminated.push(idx);
        }
      }
      SoundEngine.announce('out');
      
      const burst = document.createElement('div');
      burst.className = 'gb-elim-burst';
      burst.textContent = 'OUT!';
      document.body.appendChild(burst);
      setTimeout(()=>burst.remove(), 1000);

      // Check if only 1 active player remains
      const active = this.state.players.filter((_,i)=>!this.eliminated.includes(i));
      if(active.length===1){
        this.state.gameOver=true;
        this.showGameOver(active[0].id, null);
        this._pushOnlineState();
        return;
      }

      this.updateUI();

      // If the human player was eliminated, pause the loop and prompt
      if(idx === 0){
        this._pushOnlineState();
        this.waitingForWatchChoice = true;
        this.showWatchPrompt();
        // showWatchPrompt buttons will call acceptWatch() or exitGame()
        // acceptWatch() will resume the loop
        return;
      }

      // Advance turn if it was this player's turn
      if(this.state.currentPlayer === idx){
        this.state.currentPlayer = WhotEngine.nextPlayer(this.state, idx);
      }
      this._pushOnlineState();
      // Always resume the loop for remaining active players
      setTimeout(()=>this.checkNextTurn(), 400);
    }
  },

  // ── MODALS & OVERLAYS ─────────────────────────────────────────
  showActionBanner(text, color){
    const b = document.createElement('div');
    b.className = 'gb-banner';
    b.textContent = text;
    if(color) b.style.borderColor = color;
    document.getElementById('gameBoard').appendChild(b);
    setTimeout(()=>b.remove(), 1500);
  },

  showToast(msg){
    const tips = document.getElementById('gbTips');
    if(tips){
      const orig = tips.innerHTML;
      tips.innerHTML = `<b style="color:var(--gold);font-size:1.1rem;">${msg}</b>`;
      setTimeout(()=>tips.innerHTML=orig, 3000);
    }
  },

  showGameOver(winnerIdx, checkupScores=null){
    SoundEngine.announce(winnerIdx===0 ? 'win' : 'lose');
    const over = document.getElementById('gbGameOver');
    over.classList.remove('hidden');

    let scores = checkupScores;
    if(!scores){
      scores = this.state.players.map((p,i)=>({
        idx: i, score: p.hand.reduce((sum,c)=>sum+(c.suit==='star'?c.num*2:(c.num===20?20:c.num)),0), name: p.name
      }));
    }
    // Sort: winner first, then by score
    scores.sort((a,b)=>{
      if(a.idx===winnerIdx) return -1;
      if(b.idx===winnerIdx) return 1;
      return a.score - b.score;
    });

    const champ = this.state.players[winnerIdx].name;
    const baseCoins = 50000;

    let html = `
      <div class="gb-gameover-card slide-up">
        <div class="gb-gameover-title">Game Over</div>
        <div class="gb-gameover-champ">${champ} is the Champion</div>
    `;

    scores.forEach(s=>{
      const isW = s.idx===winnerIdx;
      const avi = s.idx===0 ? this.avatars[0] : this.avatars[(s.idx)%this.avatars.length];
      const coins = isW ? baseCoins+Math.floor(Math.random()*1000) : baseCoins-Math.floor(Math.random()*500);
      
      const coinsHtml = this.isWager ? `<div class="gb-score-coins">🪙 ${coins}</div>` : '';
      
      html += `
        <div class="gb-gameover-row ${isW?'winner':''}">
          <div class="gb-gameover-avi">${avi}</div>
          <div class="gb-gameover-info">
            <div class="gb-gameover-pname">${s.idx===0?'Me':s.name}</div>
            <div class="gb-gameover-scores">
              <div class="gb-score-stars">⭐ ${s.score}</div>
              ${coinsHtml}
            </div>
          </div>
          ${isW?'<div class="gb-winner-dot"></div>':''}
        </div>
      `;
    });

    html += `
        <div class="gb-gameover-btns">
          <button class="gb-gameover-btn secondary" onclick="GameBoard.exitGame()">Lobby</button>
          <button class="gb-gameover-btn primary" onclick="GameBoard.playAgain()">Play Again</button>
        </div>
      </div>
    `;
    over.innerHTML = html;

    const u = Store.getUser();
    if (u) {
      const won = winnerIdx === 0;
      u.won = (u.won || 0) + (won ? 1 : 0);
      u.lost = (u.lost || 0) + (won ? 0 : 1);
      u.played = (u.played || 0) + 1;
      const pointsDelta = won ? 100 : -25;
      u.points = (u.points || 0) + pointsDelta;
      Store.saveUser(u);

      if (typeof Db !== 'undefined' && u.id && !String(u.id).startsWith('guest_')) {
        let winnerId;
        if (this.online) {
          // Map the locally-rotated winner index back to whichever real account that seat is.
          const n = this.online.playersInfo.length;
          const canonicalWinnerIdx = (winnerIdx + this.online.mySeat) % n;
          winnerId = this.online.playersInfo[canonicalWinnerIdx].uid;
        } else {
          winnerId = winnerIdx === 0 ? u.id : `cpu-${winnerIdx}`;
        }

        const finish = (matchId) => Db.endMatch(matchId, {
          winnerId,
          resultByUid: { [u.id]: { result: won ? 'win' : 'loss', pointsDelta, name: u.name } },
          scores
        }).catch(e => console.warn('Could not record match to Supabase:', e));

        if (this.matchId) {
          finish(this.matchId);
        } else {
          Db.createMatch({
            players: this.state.players.map(p => ({ uid: p.isHuman ? u.id : `cpu-${p.id}`, name: p.isHuman ? u.name : p.name })),
            allowSpectators: false
          }).then(finish).catch(e => console.warn('Could not record match to Supabase:', e));
        }
      }
    }
  },

  // ── SETTINGS & UTILS ──────────────────────────────────────────
  toggleSettings(){ document.getElementById('gbSettings').classList.toggle('hidden'); },
  showRules(){ 
    document.getElementById('gbSettings').classList.add('hidden');
    document.getElementById('gbRulesModal').classList.remove('hidden');
  },
  toggleSound(btn){
    SoundEngine.enabled = !SoundEngine.enabled;
    btn.className = `gb-toggle ${SoundEngine.enabled?'on':'off'}`;
  },
  toggleVoice(btn){
    SoundEngine.voiceEnabled = !SoundEngine.voiceEnabled;
    btn.className = `gb-toggle ${SoundEngine.voiceEnabled?'on':'off'}`;
  },
  refreshHand(){ this.updateUI(); },
  exitGame(){
    if(this.timers.main) clearInterval(this.timers.main);
    if(this.online && this.online.unsub) { this.online.unsub(); this.online = null; }
    document.getElementById('gameBoard').remove();
    navigate('dashboard');
  },
  playAgain(){
    if(this.timers.main) clearInterval(this.timers.main);
    if(this.online){
      // No rematch flow yet for a real matched opponent — just head back to the lobby
      // to search again, rather than silently starting a solo bot game in its place.
      if(this.online.unsub) this.online.unsub();
      this.online = null;
      document.getElementById('gameBoard').remove();
      navigate('lobby');
      return;
    }
    document.getElementById('gameBoard').remove();
    const st = WhotEngine.createGame(this.state.players.length, this.opts);
    this.start(st, this.opts);
  },
  showWatchPrompt(){
    const overlay = document.createElement('div');
    overlay.className = 'gb-watch-modal-overlay';
    overlay.innerHTML = `
      <div class="gb-watch-modal">
        <h3>❌ You are Eliminated!</h3>
        <p>Would you like to watch the remaining players contest for the championship?</p>
        <div class="gb-watch-buttons">
          <button class="gb-watch-btn watch" onclick="GameBoard.acceptWatch()">👁️ Watch Game</button>
          <button class="gb-watch-btn leave" onclick="GameBoard.exitGame()">🚪 Leave Game</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  },
  acceptWatch(){
    const overlay = document.querySelector('.gb-watch-modal-overlay');
    if (overlay) overlay.remove();
    this.isSpectating = true;
    this.waitingForWatchChoice = false;
    this.showToast('👁️ Spectating — Watch the remaining players!');
    // Online, the other seats are real people on their own clients — just stop
    // blocking on the watch prompt and let incoming synced state keep rendering.
    if(this.online){
      this.checkNextTurn();
      return;
    }
    // Resume the CPU game loop
    if(this.state.currentPlayer===0){
      // Human's slot is now spectated — advance to next CPU
      this.state.currentPlayer = WhotEngine.nextPlayer(this.state, 0);
    }
    this.checkNextTurn();
  }
};

window.GameBoard = GameBoard;
