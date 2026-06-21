// NG Whot — Player App Controller & Views
let activeTimer = null;
let gameTimerSeconds = { 0: 600, 1: 600, 2: 600, 3: 600 };
let currentTurnTimer = null;

function showToast(msg) {
  const t = document.getElementById('toast');
  t.innerText = msg;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 3000);
}

// Persistent "share this with friends" popup — used whenever the user creates a
// joinable game (a friends room or a competition) so the link doesn't just flash
// by in a toast and disappear.
function showShareModal(title, url, note) {
  const existing = document.getElementById('shareLinkModal');
  if (existing) existing.remove();

  const shareText = `Join my NG Whot game: ${title}`;
  const waUrl = `https://wa.me/?text=${encodeURIComponent(shareText + ' ' + url)}`;
  const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
  const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`;
  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(shareText)}`;

  const div = document.createElement('div');
  div.className = 'modal-overlay';
  div.id = 'shareLinkModal';
  div.innerHTML = `
    <div class="modal-box">
      <h3>🔗 ${title}</h3>
      ${note ? `<p class="text-muted text-xs mb-2">${note}</p>` : ''}
      <div class="form-group mt-2">
        <input type="text" id="shareLinkInput" value="${url}" readonly onclick="this.select()">
      </div>
      <div class="flex gap-2 mt-2">
        <button class="btn-primary btn-sm" style="flex:1;" onclick="copyShareLink()">📋 Copy Link</button>
        <a class="btn-primary btn-sm" style="flex:1; background:#25D366; text-align:center; text-decoration:none;" href="${waUrl}" target="_blank" rel="noopener">🟢 WhatsApp</a>
      </div>
      <div class="flex gap-2 mt-2">
        <a class="btn-ghost btn-sm" style="flex:1; text-align:center; text-decoration:none;" href="${fbUrl}" target="_blank" rel="noopener">Facebook</a>
        <a class="btn-ghost btn-sm" style="flex:1; text-align:center; text-decoration:none;" href="${xUrl}" target="_blank" rel="noopener">X / Twitter</a>
        <a class="btn-ghost btn-sm" style="flex:1; text-align:center; text-decoration:none;" href="${telegramUrl}" target="_blank" rel="noopener">Telegram</a>
      </div>
      <button class="btn-ghost btn-sm mt-2" id="shareNativeBtn" style="width:100%; display:none;" onclick="shareNative()">📤 More Share Options...</button>
      <button class="btn-ghost btn-sm mt-2" style="width:100%;" onclick="document.getElementById('shareLinkModal').remove()">Close</button>
    </div>
  `;
  document.body.appendChild(div);

  _pendingShareData = { title, text: shareText, url };
  if (navigator.share) {
    document.getElementById('shareNativeBtn').style.display = 'block';
  }
}

let _pendingShareData = null;

function copyShareLink() {
  const input = document.getElementById('shareLinkInput');
  input.select();
  navigator.clipboard?.writeText(input.value).then(
    () => showToast('Link copied!'),
    () => document.execCommand('copy')
  );
}

function shareNative() {
  if (_pendingShareData) navigator.share(_pendingShareData).catch(() => {});
}

function joinLinkFor(competitionId) {
  return `${window.location.origin}${window.location.pathname}?join=${competitionId}`;
}

// Used by the ?join=<id> deep link — fetches the competition directly instead of
// relying on Store.state.liveCompetitions, which is only populated once the
// Competitions page's realtime subscription has had time to load.
function joinViaSharedLink(compId) {
  const user = Store.getUser();
  Db.getCompetition(compId).then(comp => {
    if (!comp) { showToast('That game link is no longer valid.'); return; }
    if (comp.entry_fee && user.wallet < comp.entry_fee) {
      showToast('Insufficient wallet balance to join this monetized competition.');
      return;
    }
    return Db.joinCompetition(compId, user.id).then(() => {
      showToast(`Joined "${comp.name}"!`);
    });
  }).catch(err => showToast(err.message));
}

// Router
function navigate(page, arg = null) {
  Store.state.page = page;
  Store.state.pageArg = arg;
  updateNavbar();
  
  // Close notification panel if open
  document.getElementById('notifPanel').classList.add('hidden');

  // Stop any background game timers
  if (currentTurnTimer) clearInterval(currentTurnTimer);

  const container = document.getElementById('pageContainer');
  container.innerHTML = '';

  // Render view
  switch(page) {
    case 'landing':
      container.appendChild(renderLanding());
      break;
    case 'auth':
      container.appendChild(renderAuth(arg));
      break;
    case 'dashboard':
      if (!Store.isLoggedIn()) { navigate('auth'); return; }
      container.appendChild(renderDashboard());
      break;
    case 'profile':
      container.appendChild(renderProfile(arg));
      break;
    case 'lobby':
      if (!Store.isLoggedIn()) { navigate('auth'); return; }
      container.appendChild(renderLobby());
      break;
    case 'game': {
      if (!Store.isLoggedIn()) { navigate('auth'); return; }
      const opts = Store.getGameOpts();
      GameBoard.start(WhotEngine.createGame(opts.playerCount, opts), opts);
      break;
    }
    case 'tournaments':
      container.appendChild(renderTournaments());
      break;
    case 'competitions':
      container.appendChild(renderCompetitions());
      break;
    case 'leaderboard':
      container.appendChild(renderLeaderboard());
      break;
    case 'wallet':
      if (!Store.isLoggedIn()) { navigate('auth'); return; }
      container.appendChild(renderWallet());
      break;
    case 'offline':
      container.appendChild(renderOffline());
      break;
    default:
      container.appendChild(renderLanding());
  }
  window.scrollTo(0, 0);
}

function updateNavbar() {
  const user = Store.getUser();
  const actions = document.getElementById('navActions');
  const navUser = document.getElementById('navUser');
  const links = document.getElementById('navLinks');

  if (user) {
    actions.classList.add('hidden');
    navUser.classList.remove('hidden');
    document.getElementById('walletBal').innerText = `₦${user.wallet.toLocaleString()}`;
    document.getElementById('navAvi').innerText = user.avi;
    // Show play/tournaments etc links in navbar
    links.classList.remove('hidden');
  } else {
    actions.classList.remove('hidden');
    navUser.classList.add('hidden');
  }
}

// Notification Panel
function toggleNotifs() {
  const p = document.getElementById('notifPanel');
  p.classList.toggle('hidden');
  if (!p.classList.contains('hidden')) {
    const list = document.getElementById('notifList');
    list.innerHTML = '';
    const notifs = Store.getNotifications();
    if (notifs.length === 0) {
      list.innerHTML = '<div class="notif-item text-muted">No new notifications</div>';
      return;
    }
    notifs.forEach(n => {
      const item = document.createElement('div');
      item.className = 'notif-item';
      item.innerHTML = `
        <div>${n.text}</div>
        <div class="text-xs text-muted mt-1">${n.time}</div>
      `;
      list.appendChild(item);
    });
  }
}

function clearNotifs() {
  Store.clearNotifications();
  document.getElementById('notifBadge').classList.add('hidden');
  toggleNotifs();
  showToast('Notifications cleared');
}

// Views: Landing
function renderLanding() {
  const div = document.createElement('div');
  div.className = 'page fade-in';
  div.innerHTML = `
    <section class="hero">
      <div class="hero-bg"></div>
      <div class="container" style="position:relative; z-index:2;">
        <h1>NIGERIA'S NO. 1<br><span class="accent">WHOT GAME</span> ONLINE</h1>
        <p>Play with millions of Nigerians. Compete in Yoruba, Igbo, Hausa, and Efik Tribe rooms. Claim Weekly prizes and bet on matches chess.com style.</p>
        <div class="hero-btns">
          <button class="btn-primary" onclick="navigate('lobby')">Play Free Practice</button>
          <button class="btn-ghost" onclick="navigate('auth', 'register')">Create Wallet & Account</button>
        </div>
      </div>
    </section>
    
    <section class="features">
      <div class="container">
        <h2 style="text-align:center; font-family:var(--font-display); margin-bottom:3rem;">PLATFORM FEATURES</h2>
        <div class="grid-3">
          <div class="feature-card">
            <div class="feature-icon">🏆</div>
            <h3>Cash Tournaments</h3>
            <p>Buy points or fund wagers. Create your own private tournaments. Winner takes all prize pool!</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">🛡️</div>
            <h3>Tribe Communities</h3>
            <p>Join Igbo, Yoruba, Hausa, or Efik chatrooms and represent your tribe in weekly rankings.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">⚡</div>
            <h3>Chess-Style Clocks</h3>
            <p>Customize timers (Bullet, Blitz, Rapid) and rules (Hold On card 1 or 8, toggle Whot 20 wild card).</p>
          </div>
        </div>
      </div>
    </section>
  `;
  return div;
}

// Views: Auth
function renderAuth(mode = 'login') {
  const div = document.createElement('div');
  div.className = 'auth-page fade-in';
  
  const isReg = mode === 'register';
  div.innerHTML = `
    <div class="auth-box" style="position: relative;">
      <h2>${isReg ? 'Create Account' : 'Welcome Back'}</h2>
      <p class="text-muted text-sm mt-1" style="margin-bottom:1.5rem;">
        ${isReg ? 'Already have an account?' : 'New to NG Whot?'} 
        <a href="#" onclick="navigate('auth', '${isReg ? 'login' : 'register'}')" class="text-accent fw-700">
          ${isReg ? 'Log In' : 'Sign Up'}
        </a>
      </p>

      <button onclick="Auth.loginGoogle()" class="btn-primary" style="width:100%; background: linear-gradient(135deg, #db4437, #c53929); margin-bottom:1rem; display:flex; align-items:center; justify-content:center; gap:10px;">
        <span style="background:#fff; border-radius:50%; width:24px; height:24px; display:inline-flex; align-items:center; justify-content:center; color:#db4437; font-weight:bold;">G</span>
        ${isReg ? 'Sign Up' : 'Log In'} with Google
      </button>

      <div style="display:flex; align-items:center; margin: 1rem 0; color:var(--text-muted);">
        <hr style="flex:1; border-color:rgba(255,255,255,0.1);">
        <span style="padding:0 10px; font-size:0.85rem;">OR</span>
        <hr style="flex:1; border-color:rgba(255,255,255,0.1);">
      </div>

      <form id="authForm">
        ${isReg ? `
        <div class="form-group">
          <label>Username</label>
          <input type="text" id="authUsername" placeholder="e.g. Olasunkanmi" required>
        </div>
        <div class="form-group">
          <label>Default Community Tribe</label>
          <select id="authTribe">
            <option value="None">None / Skip</option>
            <option value="Igbo">Igbo</option>
            <option value="Yoruba">Yoruba</option>
            <option value="Hausa">Hausa</option>
            <option value="Efik">Efik</option>
          </select>
        </div>
        ` : ''}
        <div class="form-group">
          <label>Email Address</label>
          <input type="email" id="authEmail" placeholder="you@example.com" required>
        </div>
        <div class="form-group">
          <label>Password</label>
          <input type="password" id="authPassword" placeholder="••••••••" required minlength="6">
        </div>
        <button type="submit" class="btn-primary" style="width:100%; margin-top:1rem;">
          ${isReg ? 'Register with Email' : 'Log In with Email'}
        </button>
      </form>

      <div style="margin-top: 1.5rem; text-align:center;">
        <button onclick="Auth.loginGuest()" class="btn-ghost" style="font-size:0.85rem;">
          Play as Guest (Offline/CPU)
        </button>
      </div>
    </div>
  `;

  div.querySelector('#authForm').onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const origText = btn.innerText;
    btn.innerText = 'Please wait...';
    btn.disabled = true;

    const email = div.querySelector('#authEmail').value;
    const password = div.querySelector('#authPassword').value;

    let success = false;
    if (isReg) {
      const username = div.querySelector('#authUsername').value;
      const tribe = div.querySelector('#authTribe').value;
      success = await Auth.signUpEmail(email, password, username, tribe);
    } else {
      success = await Auth.loginEmail(email, password);
    }

    if (success) {
      navigate('dashboard');
    } else {
      btn.innerText = origText;
      btn.disabled = false;
    }
  };

  return div;
}

// Views: Dashboard
function renderDashboard() {
  const user = Store.getUser();
  const players = Store.getPlayers();
  const tribeComps = Store.getCompetitions().filter(c => c.tribe === user.tribe);
  
  // mock followers
  const followersList = players.filter(p => p.id !== 'me').slice(0, 3);

  const html = `
    <div class="profile-header">
      <div class="profile-avi">${user.avi}</div>
      <div>
        <div style="display:flex; align-items:center; gap:10px;">
          <h2 style="font-size:2rem; font-weight:800;">${user.name}</h2>
          <span class="rank-badge rank-${user.rank}">${user.rank}</span>
          <span class="tribe-tag tribe-${user.tribe.toLowerCase()}">${user.tribe} Tribe</span>
        </div>
        <div class="text-muted text-sm mt-1" style="display:flex; gap:1.5rem;">
          <span>🏆 <strong>${user.points.toLocaleString()}</strong> pts</span>
          <span>💪 Record: <strong>${user.won}W</strong> - <strong>${user.lost}L</strong> (${user.played} games)</span>
          <span>👥 <strong>${user.followers}</strong> followers</span>
        </div>
      </div>
    </div>

    <div class="grid-3 mt-3">
      <!-- Fast Play Card -->
      <div class="panel flex-between" style="grid-column: span 2; background: linear-gradient(135deg, var(--card), var(--bg3)); border-color: var(--accent);">
        <div>
          <h3 style="font-size:1.3rem; font-weight:700;">Ready for a Match?</h3>
          <p class="text-muted text-sm mt-1">Jump into quick play, configure rules & timers, or wager coins.</p>
          <button class="btn-primary mt-2" onclick="navigate('lobby')">Configure & Start Game</button>
        </div>
        <div style="font-size:4rem; opacity:0.8;">🎴</div>
      </div>

      <!-- Tribe Wars info -->
      <div class="panel">
        <div class="comp-card-type text-accent">Represent Your Tribe</div>
        <h3 style="margin-top:0.25rem;">${user.tribe} Tribal Room</h3>
        <p class="text-muted text-sm mt-1">Chat live with other ${user.tribe} players and stack tribe points.</p>
        <button class="btn-ghost btn-sm mt-2" onclick="navigate('competitions')">Join Tribe Comp</button>
      </div>
    </div>

    <div class="grid-2 mt-3">
      <!-- Follow requests and social -->
      <div class="panel">
        <div class="flex-between" style="border-bottom:1px solid var(--border); padding-bottom:0.75rem; margin-bottom:1rem;">
          <h3 style="font-size:1.1rem; font-weight:700;">Follow Requests</h3>
          <span class="badge" style="position:static; padding:4px 8px; font-size:0.7rem;">2 New</span>
        </div>
        <div class="f-request" style="display:flex; flex-direction:column; gap:1rem;">
          <div class="flex-between">
            <div class="flex gap-2 align-center">
              <div class="avi" style="background:#581c87; color:#fff;">AD</div>
              <div>
                <div class="text-sm fw-700">Adunola</div>
                <div class="text-xs text-muted">Wants to follow you</div>
              </div>
            </div>
            <div class="flex gap-1">
              <button class="btn-primary btn-sm" onclick="showToast('Accepted follow request')">Accept</button>
              <button class="btn-ghost btn-sm" onclick="showToast('Declined request')">Decline</button>
            </div>
          </div>
          <div class="flex-between" style="border-top:1px solid var(--border); padding-top:1rem;">
            <div class="flex gap-2 align-center">
              <div class="avi" style="background:#15803d; color:#fff;">GB</div>
              <div>
                <div class="text-sm fw-700">Garba</div>
                <div class="text-xs text-muted">Wants to follow you</div>
              </div>
            </div>
            <div class="flex gap-1">
              <button class="btn-primary btn-sm" onclick="showToast('Accepted follow request')">Accept</button>
              <button class="btn-ghost btn-sm" onclick="showToast('Declined request')">Decline</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Social feed / active friends -->
      <div class="panel">
        <h3 style="font-size:1.1rem; font-weight:700; border-bottom:1px solid var(--border); padding-bottom:0.75rem; margin-bottom:1rem;">Followers & Rivals</h3>
        <div style="display:flex; flex-direction:column; gap:0.75rem;">
          ${followersList.map(f => `
            <div class="flex-between" style="cursor:pointer;" onclick="navigate('profile', '${f.id}')">
              <div class="flex gap-2">
                <div class="avi">${f.avi}</div>
                <div>
                  <div class="text-sm fw-700">${f.name} <span class="online-dot" style="${f.online ? '' : 'background:gray; animation:none;'}"></span></div>
                  <div class="text-xs text-muted">${f.tribe} Tribe • H2H (3-2)</div>
                </div>
              </div>
              <button class="btn-ghost btn-sm">Profile</button>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
  return renderDashLayout(html, 'dash');
}

// Side bar layout helper
function renderDashLayout(contentHtml, activeItem) {
  const div = document.createElement('div');
  div.className = 'dash-layout page fade-in';
  
  div.innerHTML = `
    <aside class="sidebar">
      <div class="sidebar-item ${activeItem === 'dash' ? 'active' : ''}" onclick="navigate('dashboard')">
        <span class="icon">🏠</span> Dashboard
      </div>
      <div class="sidebar-item ${activeItem === 'lobby' ? 'active' : ''}" onclick="navigate('lobby')">
        <span class="icon">🎮</span> Game Lobby
      </div>
      <div class="sidebar-item ${activeItem === 'tournaments' ? 'active' : ''}" onclick="navigate('tournaments')">
        <span class="icon">🏆</span> Tournaments
      </div>
      <div class="sidebar-item ${activeItem === 'competitions' ? 'active' : ''}" onclick="navigate('competitions')">
        <span class="icon">⚔️</span> Tribe Wars & Comps
      </div>
      <div class="sidebar-item ${activeItem === 'leaderboard' ? 'active' : ''}" onclick="navigate('leaderboard')">
        <span class="icon">📈</span> Leaderboard
      </div>
      <div class="sidebar-item ${activeItem === 'wallet' ? 'active' : ''}" onclick="navigate('wallet')">
        <span class="icon">💰</span> Wallet
      </div>
      <div class="sidebar-item ${activeItem === 'offline' ? 'active' : ''}" onclick="navigate('offline')">
        <span class="icon">📶</span> Offline Play
      </div>
      <div class="sidebar-item" onclick="Auth.logout();" style="margin-top:auto;">
        <span class="icon">🚪</span> Logout
      </div>
    </aside>
    <main class="dash-main">
      ${contentHtml}
    </main>
  `;
  return div;
}

// Views: Lobby
function renderLobby() {
  const opts = Store.getGameOpts();
  Presence.ensureStarted();
  const online = Presence.getOnlineUsers();

  const html = `
    <div class="flex-between">
      <div>
        <h2>Lobby</h2>
        <p class="text-muted text-sm mt-1">Play instantly against bots, or get matched with real players online.</p>
      </div>
      <button class="btn-ghost btn-sm" onclick="MatchLobby.open()" title="Play Online">⚡ Play Online</button>
    </div>

    <div class="panel mt-3" style="display:flex; align-items:center; gap:1rem;">
      <div style="display:flex;">
        ${online.slice(0, 4).map(u => `<div class="avi" style="background:#2c2c54; color:#fff; margin-left:-8px; border:2px solid var(--bg2);">${(u.avi || u.name || '?').slice(0,2).toUpperCase()}</div>`).join('') || '<span class="text-xs text-muted">No one else online right now</span>'}
      </div>
      <div class="text-sm text-muted">🟢 ${online.length} player${online.length===1?'':'s'} online now</div>
    </div>

    <div class="grid-2 mt-3">
      <div class="panel" style="text-align:center; cursor:pointer;" onclick="document.getElementById('botConfigPanel').classList.remove('hidden'); document.getElementById('onlineEntryPanel').classList.add('hidden');">
        <div style="font-size:2.2rem;">🤖</div>
        <h3 class="mt-1">Play with Bot</h3>
        <p class="text-xs text-muted mt-1">Practice offline against CPU opponents with full rule customization.</p>
      </div>
      <div class="panel" id="onlineEntryPanel" style="text-align:center; cursor:pointer;" onclick="MatchLobby.open()">
        <div style="font-size:2.2rem;">🌐</div>
        <h3 class="mt-1">Play Online</h3>
        <p class="text-xs text-muted mt-1">Get matched with real players by time control, player count, and points or competition mode.</p>
      </div>
    </div>

    <div class="mt-3 hidden" id="botConfigPanel">
    <div class="grid-2">
      <!-- Settings Panel -->
      <div class="panel">
        <h3 style="font-size:1.1rem; font-weight:700; border-bottom:1px solid var(--border); padding-bottom:0.75rem;">Match Config (vs Bot)</h3>

        <div class="form-group mt-2">
          <label>Player Count</label>
          <select id="lobbyPlayerCount">
            <option value="2" ${opts.playerCount === 2 ? 'selected' : ''}>2 Players (1v1)</option>
            <option value="3" ${opts.playerCount === 3 ? 'selected' : ''}>3 Players</option>
            <option value="4" ${opts.playerCount === 4 ? 'selected' : ''}>4 Players</option>
          </select>
        </div>

        <div class="form-group">
          <label>Timer Setting (chess.com-style)</label>
          <select id="lobbyTimer">
            <option value="bullet" ${opts.timerMode === 'bullet' ? 'selected' : ''}>Bullet (1 min + 0s increment)</option>
            <option value="blitz" ${opts.timerMode === 'blitz' ? 'selected' : ''}>Blitz (3 min + 2s increment)</option>
            <option value="rapid" ${opts.timerMode === 'rapid' ? 'selected' : ''}>Rapid (10 min + 5s increment)</option>
            <option value="classical" ${opts.timerMode === 'classical' ? 'selected' : ''}>Classical (30 min + 10s increment)</option>
            <option value="unlimited" ${opts.timerMode === 'unlimited' ? 'selected' : ''}>Unlimited (No timer)</option>
          </select>
        </div>

        <div class="toggle-wrap">
          <div>
            <div class="text-sm fw-700">Include Whot 20 (Wildcard)</div>
            <div class="text-xs text-muted">Toggle whether wildcards are dealt.</div>
          </div>
          <label class="toggle">
            <input type="checkbox" id="lobbyIncludeWhot" ${opts.includeWhot ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        </div>

        <div class="toggle-wrap">
          <div>
            <div class="text-sm fw-700">Allow Defending (Pick 2/3)</div>
            <div class="text-xs text-muted">Defend Pick 2 with a 2, or Pick 3 with a 5.</div>
          </div>
          <label class="toggle">
            <input type="checkbox" id="lobbyAllowDefend" ${opts.allowDefend !== false ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        </div>

        <div class="form-group mt-2">
          <label>Defense Style</label>
          <select id="lobbyDefenseMode">
            <option value="stack" ${opts.defenseMode !== 'block' ? 'selected' : ''}>Stack Penalty (Increment)</option>
            <option value="block" ${opts.defenseMode === 'block' ? 'selected' : ''}>Block Penalty (Stop Pick)</option>
          </select>
        </div>

        <div class="form-group mt-2">
          <label>Checkup Style</label>
          <select id="lobbyCheckupStyle">
            <option value="tournament" ${opts.checkupStyle !== 'classic' ? 'selected' : ''}>Tournament Style (Elimination Contest)</option>
            <option value="classic" ${opts.checkupStyle === 'classic' ? 'selected' : ''}>Classic Style (Lowest Score Wins Instantly)</option>
          </select>
        </div>

        <div class="form-group mt-2">
          <label>When Market Finishes (Deck Empty)</label>
          <select id="lobbyEmptyDeckBehavior">
            <option value="reshuffle" ${opts.emptyDeckBehavior !== 'checkup' ? 'selected' : ''}>Reshuffle Pile & Continue</option>
            <option value="checkup" ${opts.emptyDeckBehavior === 'checkup' ? 'selected' : ''}>Count Cards & Eliminate / End Game</option>
          </select>
        </div>

        <div class="form-group mt-2">
          <label>Suspension / Hold On Card</label>
          <select id="lobbyHoldOn">
            <option value="1" ${opts.holdOnCard === 1 ? 'selected' : ''}>Card 1 (Hold On) / Card 8 (Suspension)</option>
            <option value="8" ${opts.holdOnCard === 8 ? 'selected' : ''}>Card 8 (Hold On) / Card 1 (Suspension)</option>
          </select>
        </div>

        <div class="form-group">
          <label>Wager / Buy-In Entry Fee</label>
          <select id="lobbyWager">
            <option value="0">Free Practice</option>
            <option value="500">₦500 Buy-in</option>
            <option value="1000">₦1,000 Buy-in</option>
            <option value="2000">₦2,000 Buy-in</option>
            <option value="5000">₦5,000 Buy-in</option>
          </select>
        </div>

        <div class="form-group" style="border-top: 1px solid var(--border); padding-top: 1rem; margin-top: 0.5rem;">
          <label style="display:flex; justify-content:space-between; align-items:center;">
            <span>🃏 Card Actions Config</span>
            <button class="btn-ghost btn-sm" onclick="openCardConfigModal()" style="font-size:0.8rem; padding:4px 10px;">⚙️ Configure</button>
          </label>
          <div class="text-xs text-muted mt-1">Customize action number, win & defend rules per card type.</div>
        </div>

        <button class="btn-primary mt-2" style="width:100%;" onclick="openRulesModal()">Play Game</button>
      </div>

      <!-- Live Public Matches & Invites -->
      <div class="panel">
        <h3 style="font-size:1.1rem; font-weight:700; border-bottom:1px solid var(--border); padding-bottom:0.75rem; margin-bottom:1rem;">Active Custom Matches</h3>
        <div style="display:flex; flex-direction:column; gap:1rem;">
          <div class="flex-between">
            <div>
              <div class="text-sm fw-700">Chukwu's Rapid 1v1</div>
              <div class="text-xs text-muted">Timer: Rapid | Wager: ₦1,000 | Slots: 1/2</div>
            </div>
            <button class="btn-ghost btn-sm" onclick="showWagerAlertAndJoin(1000, 2)">Join</button>
          </div>
          <div class="flex-between" style="border-top:1px solid var(--border); padding-top:1rem;">
            <div>
              <div class="text-sm fw-700">Yoruba Weekly Lobby</div>
              <div class="text-xs text-muted">Timer: Blitz | Wager: Free | Slots: 2/4</div>
            </div>
            <button class="btn-ghost btn-sm" onclick="showWagerAlertAndJoin(0, 4)">Join</button>
          </div>
        </div>
      </div>
    </div>
    </div>

    ${MatchLobby.modalHTML()}

    <!-- Rules Modal Overlay -->
    <div class="modal-overlay hidden" id="rulesModal">
      <div class="modal-box">
        <h2>⚠️ Pre-Match Rules & Mechanics</h2>
        <p class="text-muted text-sm" style="margin-bottom:1rem;">Ensure you understand the game rules before starting.</p>
        
        <div class="rule-item">
          <span class="rule-icon">🎴</span>
          <div>
            <strong>Whot Card Rules</strong>
            <p class="text-xs text-muted mt-1">Match cards by number or suit (Circle, Triangle, Cross, Square, Star). Whot 20 matches any card.</p>
          </div>
        </div>

        <div class="rule-item">
          <span class="rule-icon">🕒</span>
          <div>
            <strong>Game Timeouts</strong>
            <p class="text-xs text-muted mt-1">If your clock runs out, you lose! On timeout or checkup, the player with the highest sum of cards is eliminated.</p>
          </div>
        </div>

        <div class="rule-item">
          <span class="rule-icon">⚡</span>
          <div>
            <strong>Special Cards Action</strong>
            <p class="text-xs text-muted mt-1">
              Card 1: Hold On (play again).<br>
              Card 2: Pick 2 (can defend with another 2).<br>
              Card 5: Pick 3 (can defend with another 5).<br>
              Card 8: Suspension (skips next player).<br>
              Card 14: General market (everyone except the player who played draws 1, same player plays again).<br>
              <strong>⭐ Star cards:</strong> Double score value in checkup.
            </p>
          </div>
        </div>

        <div class="flex gap-2 mt-3" style="justify-content:flex-end;">
          <button class="btn-ghost btn-sm" onclick="closeRulesModal()">Cancel</button>
          <button class="btn-primary btn-sm" onclick="startConfiguredGame()">I Agree, Join Match</button>
        </div>
      </div>
    </div>

    <!-- Card Configuration Modal -->
    <div class="modal-overlay hidden" id="cardConfigModal">
      <div class="modal-box" style="max-width:500px; max-height:85vh; overflow-y:auto;">
        <h2 style="font-size:1.2rem;">🃏 Card Action Configuration</h2>
        <p class="text-muted text-xs mt-1" style="margin-bottom:1rem;">Set the number, win-ability, and defend-ability for each card action.</p>

        <div class="card-cfg-table">
          <div class="card-cfg-header">
            <span>Action</span>
            <span>Number</span>
            <span>Win?</span>
            <span>Defend?</span>
          </div>

          ${['pickTwo','pickThree','genMarket','holdOn','suspension','crown'].map(action => {
            const cfg = (opts.cardConfig && opts.cardConfig[action]) || { pickTwo:{num:2,win:true,defend:true}, pickThree:{num:5,win:true,defend:true}, genMarket:{num:14,win:true,defend:true}, holdOn:{num:1,win:true,defend:false}, suspension:{num:8,win:true,defend:false}, crown:{num:20,win:true,defend:false} }[action];
            const labels = { pickTwo:'Pick Two', pickThree:'Pick Three', genMarket:'General Market', holdOn:'Hold On', suspension:'Suspension', crown:'Crown (Whot 20)' };
            const icons  = { pickTwo:'🟦', pickThree:'🟧', genMarket:'🛒', holdOn:'🔁', suspension:'⏸️', crown:'👑' };
            const numOpts = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,20].map(n => `<option value="${n}" ${cfg.num===n?'selected':''}>${n}</option>`).join('');
            return `
              <div class="card-cfg-row">
                <span class="card-cfg-label">${icons[action]} ${labels[action]}</span>
                <select class="card-cfg-num" data-action="${action}" id="cfg-num-${action}">${numOpts}</select>
                <label class="toggle" style="transform:scale(0.8);">
                  <input type="checkbox" id="cfg-win-${action}" ${cfg.win!==false?'checked':''}>
                  <span class="slider"></span>
                </label>
                <label class="toggle" style="transform:scale(0.8);">
                  <input type="checkbox" id="cfg-def-${action}" ${cfg.defend===true?'checked':''}>
                  <span class="slider"></span>
                </label>
              </div>`;
          }).join('')}
        </div>

        <div class="flex gap-2 mt-3" style="justify-content:flex-end;">
          <button class="btn-ghost btn-sm" onclick="resetCardConfig()">↩ Reset Defaults</button>
          <button class="btn-ghost btn-sm" onclick="closeCardConfigModal()">Cancel</button>
          <button class="btn-primary btn-sm" onclick="saveCardConfig()">Save Config</button>
        </div>
      </div>
    </div>
  `;
  return renderDashLayout(html, 'lobby');
}

function openRulesModal() {
  document.getElementById('rulesModal').classList.remove('hidden');
}

function closeRulesModal() {
  document.getElementById('rulesModal').classList.add('hidden');
}

function openCardConfigModal() {
  const modal = document.getElementById('cardConfigModal');
  if (modal) modal.classList.remove('hidden');
}

function closeCardConfigModal() {
  const modal = document.getElementById('cardConfigModal');
  if (modal) modal.classList.add('hidden');
}

function saveCardConfig() {
  const actions = ['pickTwo','pickThree','genMarket','holdOn','suspension','crown'];
  const cardConfig = {};
  actions.forEach(action => {
    const numEl = document.getElementById(`cfg-num-${action}`);
    const winEl = document.getElementById(`cfg-win-${action}`);
    const defEl = document.getElementById(`cfg-def-${action}`);
    if (numEl) {
      cardConfig[action] = {
        num: parseInt(numEl.value),
        win: winEl ? winEl.checked : true,
        defend: defEl ? defEl.checked : false
      };
    }
  });
  Store.setGameOpts({ cardConfig });
  closeCardConfigModal();
  showToast('✅ Card configuration saved!');
}

function resetCardConfig() {
  const defaults = {
    pickTwo:    { num: 2,  win: true,  defend: true },
    pickThree:  { num: 5,  win: true,  defend: true },
    genMarket:  { num: 14, win: true,  defend: true },
    holdOn:     { num: 1,  win: true,  defend: false },
    suspension: { num: 8,  win: true,  defend: false },
    crown:      { num: 20, win: true,  defend: false }
  };
  Object.entries(defaults).forEach(([action, cfg]) => {
    const numEl = document.getElementById(`cfg-num-${action}`);
    const winEl = document.getElementById(`cfg-win-${action}`);
    const defEl = document.getElementById(`cfg-def-${action}`);
    if (numEl) numEl.value = cfg.num;
    if (winEl) winEl.checked = cfg.win;
    if (defEl) defEl.checked = cfg.defend;
  });
  showToast('↩ Defaults restored. Press Save to apply.');
}

function showWagerAlertAndJoin(wager, playersCount) {
  const user = Store.getUser();
  if (user.wallet < wager) {
    showToast('Insufficient wallet balance. Please fund your wallet first.');
    navigate('wallet');
    return;
  }
  Store.setGameOpts({ wager, playerCount: playersCount });
  openRulesModal();
}

function startConfiguredGame() {
  closeRulesModal();

  // Read choices
  const timer = document.getElementById('lobbyTimer').value;
  const count = parseInt(document.getElementById('lobbyPlayerCount').value);
  const includeWhot = document.getElementById('lobbyIncludeWhot').checked;
  const holdOn = parseInt(document.getElementById('lobbyHoldOn').value);
  const allowDefend = document.getElementById('lobbyAllowDefend').checked;
  const defenseMode = document.getElementById('lobbyDefenseMode').value;
  const checkupStyle = document.getElementById('lobbyCheckupStyle').value;
  const emptyDeckBehavior = document.getElementById('lobbyEmptyDeckBehavior').value;
  const wager = parseInt(document.getElementById('lobbyWager') ? document.getElementById('lobbyWager').value : 0);

  // Carry over saved cardConfig from Store (set by saveCardConfig)
  const existingOpts = Store.getGameOpts();
  const cardConfig = existingOpts.cardConfig || {
    pickTwo:    { num: 2,  win: true,  defend: true },
    pickThree:  { num: 5,  win: true,  defend: true },
    genMarket:  { num: 14, win: true,  defend: true },
    holdOn:     { num: 1,  win: true,  defend: false },
    suspension: { num: 8,  win: true,  defend: false },
    crown:      { num: 20, win: true,  defend: false }
  };

  const user = Store.getUser();
  if (wager > 0 && user.wallet < wager) {
    showToast('Insufficient wallet balance. Please fund your wallet first.');
    navigate('wallet');
    return;
  }

  if (wager > 0) {
    user.wallet -= wager;
    showToast(`₦${wager} wagered from wallet`);
  }

  Store.setGameOpts({
    timerMode: timer,
    playerCount: count,
    includeWhot,
    holdOnCard: holdOn,
    allowDefend,
    defenseMode,
    checkupStyle,
    emptyDeckBehavior,
    wager,
    cardConfig
  });

  navigate('game');
}

// ============================== ONLINE PRESENCE ("who's online" widget) ==============================

const Presence = {
  _started: false,
  _online: [],
  ensureStarted() {
    if (this._started || typeof supabaseClient === 'undefined') return;
    const user = Store.getUser();
    if (!user || String(user.id).startsWith('guest_')) return;
    this._started = true;

    const channel = supabaseClient.channel('lobby-presence', { config: { presence: { key: user.id } } });
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      this._online = Object.values(state).map(arr => arr[0]).filter(p => p.user_id !== user.id);
      if (Store.state.page === 'lobby') navigate('lobby');
    });
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ user_id: user.id, name: user.name, avi: user.avi });
      }
    });
  },
  getOnlineUsers() { return this._online; }
};

// ============================== ONLINE MATCH POPUP ("Play Online") ==============================

const TIME_CONTROLS = {
  bullet:  { icon: '🚀', label: 'Bullet',  unit: 'min', defaultBase: 60,    defaultInc: 0 },
  blitz:   { icon: '⚡', label: 'Blitz',   unit: 'min', defaultBase: 300,   defaultInc: 0 },
  rapid:   { icon: '⏱️', label: 'Rapid',   unit: 'min', defaultBase: 600,   defaultInc: 0 },
  daily:   { icon: '☀️', label: 'Daily',   unit: 'day', defaultBase: 86400, defaultInc: 0 },
  custom:  { icon: '⚙️', label: 'Custom',  unit: 'min', defaultBase: 600,   defaultInc: 0 }
};

const PRICE_POOL_AMOUNTS = [15, 100, 200, 500, 1000, 3000, 5000, 10000];

const MatchLobby = {
  step: 'pick', // 'pick' -> 'searching' -> 'negotiating'
  category: 'rapid',
  baseSec: 600,
  incSec: 0,
  rated: true,
  playerCount: 2,
  gameType: 'points', // 'points' | 'competition' | 'friends' | 'pricepool'
  poolAmount: 0,
  wager: 0,
  friendsCount: 1,
  friendsBetting: false,
  friendsWager: 500,
  includeWhot: true,
  allowDefend: true,
  defenseMode: 'stack',
  checkupStyle: 'tournament',
  emptyDeckBehavior: 'reshuffle',
  holdOnCard: 1,
  matchId: null,
  _matchUnsub: null,
  _queueUnsub: null,
  _previewCard: null,

  open() {
    this.step = 'pick';
    const overlay = document.getElementById('matchPopupOverlay');
    if (overlay) overlay.classList.remove('hidden');
    this.refresh();
  },
  close() {
    const overlay = document.getElementById('matchPopupOverlay');
    if (overlay) overlay.classList.add('hidden');
    if (this.step === 'searching' && Store.getUser()) {
      Db.cancelMatchmaking(Store.getUser().id).catch(() => {});
    }
    if (this._queueUnsub) { this._queueUnsub(); this._queueUnsub = null; }
    if (this._matchUnsub) { this._matchUnsub(); this._matchUnsub = null; }
    this.step = 'pick';
  },
  refresh() {
    const body = document.getElementById('matchPopupBody');
    if (body) body.innerHTML = this._bodyHTML();
  },

  selectCategory(cat) {
    this.category = cat;
    const def = TIME_CONTROLS[cat];
    this.baseSec = def.defaultBase;
    this.incSec = def.defaultInc;
    this.refresh();
  },
  setBaseFromUnit(v) {
    const unit = TIME_CONTROLS[this.category].unit;
    this.baseSec = Math.max(0, parseFloat(v) || 0) * (unit === 'day' ? 86400 : 60);
  },
  setIncSec(v) { this.incSec = parseInt(v) || 0; },
  setPlayerCount(n) { this.playerCount = n; this.refresh(); },
  setRated(rated) { this.rated = rated; },
  setGameType(t) { this.gameType = t; this.refresh(); },
  setPoolAmount(a) { this.poolAmount = a; this.refresh(); },
  setFriendsBetting(b) { this.friendsBetting = b; this.refresh(); },

  // --- Lobby preview card (purely decorative "today's card" widget) ---
  _rollPreviewCard() {
    const suits = ['circle', 'triangle', 'cross', 'square', 'star'];
    const suit = suits[Math.floor(Math.random() * suits.length)];
    const num = suit === 'star' ? [1,2,3,4,5,7,8][Math.floor(Math.random()*7)] : Math.floor(Math.random()*14)+1;
    this._previewCard = { suit, num };
  },
  _previewCardInnerHTML() {
    const c = this._previewCard;
    const label = c.num === 20 ? '20' : c.num;
    return `
      <div class="wcard-corner tl"><div class="wcard-num">${label}</div></div>
      <div class="wcard-center">${GameBoard.suitSVG(c.suit, c.num)}</div>
      <div class="wcard-corner br"><div class="wcard-num">${label}</div></div>
    `;
  },
  rerollPreview() {
    this._rollPreviewCard();
    const wrap = document.getElementById('mlPreviewCardWrap');
    if (wrap) wrap.innerHTML = this._previewCardInnerHTML();
  },

  modalHTML() {
    if (!this._previewCard) this._rollPreviewCard();
    return `
    <div class="hidden mt-3" id="matchPopupOverlay">
      <div class="grid-2">
        <div class="panel" id="matchPopupBody">${this._bodyHTML()}</div>
        <div class="panel" style="text-align:center;">
          <div class="text-xs text-muted mb-2">🎴 Your Card Today</div>
          <div class="wcard wcard-face" style="margin:0 auto; cursor:pointer;" id="mlPreviewCardWrap" onclick="MatchLobby.rerollPreview()">
            ${this._previewCardInnerHTML()}
          </div>
          <p class="text-xs text-muted mt-2">Tap the card for a new one. Your live match board will appear here once synced online play ships.</p>
        </div>
      </div>
    </div>
    ${this.gameRuleModalHTML()}`;
  },

  _bodyHTML() {
    if (this.step === 'searching') return this._searchingHTML();
    if (this.step === 'negotiating') return this._negotiatingHTML();
    return this._pickHTML();
  },

  _pickHTML() {
    const tc = TIME_CONTROLS[this.category];
    const unitLabel = tc.unit === 'day' ? 'Days' : 'Minutes';
    const baseDisplay = tc.unit === 'day' ? Math.round(this.baseSec / 86400) : Math.round(this.baseSec / 60);

    return `
      <h3>Play Online</h3>

      <div class="form-group mt-2">
        <label>Time Control</label>
        <div class="flex gap-2" style="flex-wrap:wrap;">
          ${Object.entries(TIME_CONTROLS).map(([cat, def]) => `
            <button class="btn-ghost btn-sm" style="${this.category===cat?'border:2px solid var(--accent);':''}" onclick="MatchLobby.selectCategory('${cat}')">${def.icon} ${def.label}</button>
          `).join('')}
        </div>
      </div>

      <div class="form-group">
        <label>${unitLabel} / Increment (sec)</label>
        <div class="flex gap-2">
          <input type="number" id="mlBaseUnit" value="${baseDisplay}" min="0" style="flex:1;" onchange="MatchLobby.setBaseFromUnit(this.value)">
          <input type="number" id="mlIncSec" value="${this.incSec}" min="0" style="flex:1;" onchange="MatchLobby.setIncSec(this.value)">
        </div>
      </div>

      <div class="toggle-wrap">
        <div class="text-sm fw-700">Rated</div>
        <label class="toggle">
          <input type="checkbox" ${this.rated ? 'checked' : ''} onchange="MatchLobby.setRated(this.checked)">
          <span class="slider"></span>
        </label>
      </div>

      <div class="form-group">
        <label>Players</label>
        <div class="flex gap-2">
          ${[2,3,4].map(n => `<button class="btn-ghost btn-sm" style="flex:1; ${this.playerCount===n?'border:2px solid var(--accent);':''}" onclick="MatchLobby.setPlayerCount(${n})">${n} Players</button>`).join('')}
        </div>
      </div>

      <div class="form-group">
        <label>Game Type</label>
        <select id="mlGameType" onchange="MatchLobby.setGameType(this.value)">
          <option value="points" ${this.gameType==='points'?'selected':''}>🏆 Quick Match (Points)</option>
          <option value="competition" ${this.gameType==='competition'?'selected':''}>🏅 Competition</option>
          <option value="friends" ${this.gameType==='friends'?'selected':''}>🤝 Play with Friend(s)</option>
          <option value="pricepool" ${this.gameType==='pricepool'?'selected':''}>💰 Price Pool</option>
        </select>
      </div>

      ${this.gameType === 'pricepool' ? this._pricePoolHTML() : ''}
      ${this.gameType === 'competition' ? this._competitionFormHTML() : ''}
      ${this.gameType === 'friends' ? this._friendsFormHTML() : ''}

      ${(this.gameType === 'points' || this.gameType === 'pricepool') ? `
        <button class="btn-primary mt-2" style="width:100%;" onclick="MatchLobby.startSearching()">Start Game</button>
      ` : ''}

      <div class="flex gap-2 mt-2">
        <button class="btn-ghost btn-sm" style="flex:1;" onclick="MatchLobby.openRulesModal()">⚙️ Game Rule</button>
        <button class="btn-ghost btn-sm" style="flex:1;" onclick="MatchLobby.close(); navigate('tournaments');">Tournaments</button>
      </div>
      <button class="btn-ghost btn-sm mt-2" style="width:100%;" onclick="MatchLobby.close()">Cancel</button>
    `;
  },

  _pricePoolHTML() {
    return `
      <div class="form-group">
        <label>Price Pool Amount</label>
        <div class="flex gap-2" style="flex-wrap:wrap;">
          ${PRICE_POOL_AMOUNTS.map(a => `
            <button class="btn-ghost btn-sm" style="${this.poolAmount===a?'border:2px solid var(--accent);':''}" onclick="MatchLobby.setPoolAmount(${a})">₦${a.toLocaleString()}</button>
          `).join('')}
        </div>
        <p class="text-xs text-muted mt-1">You're matched with someone who picked the same time control AND the same pool amount — ₦${this.poolAmount.toLocaleString()} stays in your wallet until the match starts.</p>
      </div>
    `;
  },

  _competitionFormHTML() {
    return `
      <div class="panel mt-2">
        <h4 style="font-size:1rem;">Create Customized Competition</h4>
        <p class="text-muted text-xs mb-2">Monetize your own games. Fund the prize pool or let everyone contribute entry fees!</p>
        <div class="form-group mt-2">
          <label>Competition Name</label>
          <input type="text" id="mlCompName" placeholder="e.g. Saturday Night Showdown">
        </div>
        <div class="form-group">
          <label>Monetization Model</label>
          <select id="mlCompMonetization">
            <option value="funded">I will fund the prize pool myself</option>
            <option value="buyin">Wager Match (All players fund the prize pool)</option>
            <option value="free">Free / Just points prize</option>
          </select>
        </div>
        <div class="form-group">
          <label>Entry Fee (or self funding amount)</label>
          <select id="mlCompEntry">
            <option value="500">₦500</option>
            <option value="1000">₦1,000</option>
            <option value="2000">₦2,000</option>
            <option value="5000">₦5,000</option>
          </select>
        </div>
        <div class="form-group">
          <label>Join Restrictions</label>
          <select id="mlCompPrivacy">
            <option value="public">Public (Anyone can search & join)</option>
            <option value="approval">By Approval (Host approves requests)</option>
          </select>
        </div>
        <div class="form-group">
          <label>Max Players</label>
          <select id="mlCompMaxPlayers">
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4" selected>4</option>
            <option value="6">6</option>
            <option value="8">8</option>
          </select>
        </div>
        <div class="form-group">
          <label>Will you play in this competition?</label>
          <select id="mlCompParticipates">
            <option value="yes">Yes, I'm playing too</option>
            <option value="no">No, I'm only funding it (host & watch)</option>
          </select>
        </div>
        <div class="form-group">
          <label>Allow Spectators?</label>
          <select id="mlCompSpectators">
            <option value="yes">Yes — anyone can watch live</option>
            <option value="no">No — players only</option>
          </select>
        </div>
        <div class="form-group">
          <label>Game Start Time</label>
          <input type="datetime-local" id="mlCompStartTime">
        </div>
        <div class="form-group">
          <label>Join Cutoff Time (must be before start)</label>
          <input type="datetime-local" id="mlCompCutoffTime">
        </div>
        <button class="btn-primary mt-2" style="width:100%;" onclick="MatchLobby.submitCompetition()">Create & Open Room</button>
      </div>
    `;
  },

  submitCompetition() {
    const name = document.getElementById('mlCompName').value || 'Custom Cup';
    const entry = parseInt(document.getElementById('mlCompEntry').value);
    const monetization = document.getElementById('mlCompMonetization').value;
    const maxPlayers = parseInt(document.getElementById('mlCompMaxPlayers').value);
    const participates = document.getElementById('mlCompParticipates').value === 'yes';
    const allowSpectators = document.getElementById('mlCompSpectators').value === 'yes';
    const startTimeRaw = document.getElementById('mlCompStartTime').value;
    const cutoffTimeRaw = document.getElementById('mlCompCutoffTime').value;

    const user = Store.getUser();
    const fundedByCreator = monetization === 'funded';

    if (!participates && !fundedByCreator) { showToast('To sit out, you must fund the prize pool.'); return; }
    if (fundedByCreator && user.wallet < entry) { showToast('Insufficient wallet balance to fund this competition.'); return; }
    if (!startTimeRaw) { showToast('Please set a game start time.'); return; }

    Db.createCompetition({
      name, type: 'custom', creatorId: user.id, creatorName: user.name,
      creatorParticipates: participates, fundedByCreator, allowSpectators, maxPlayers,
      entryFee: monetization === 'free' ? 0 : entry,
      prizePool: fundedByCreator ? entry : (monetization === 'buyin' ? entry * maxPlayers : 0),
      startTime: startTimeRaw, joinCutoffTime: cutoffTimeRaw || null
    }).then(compId => {
      if (fundedByCreator) { user.wallet -= entry; showToast(`₦${entry} funded to competition prize pool!`); }
      this.close();
      navigate('competitions');
      showShareModal(`"${name}" is live!`, joinLinkFor(compId), 'Share this link with friends — opening it takes them straight to joining this competition.');
    }).catch(err => showToast(err.message));
  },

  _friendsFormHTML() {
    return `
      <div class="form-group">
        <label>How many friends?</label>
        <input type="number" id="mlFriendsCount" min="1" value="${this.friendsCount}" onchange="MatchLobby.friendsCount = parseInt(this.value)||1;">
      </div>
      <div class="form-group">
        <label>Play Style</label>
        <div class="flex gap-2">
          <button class="btn-ghost btn-sm" style="flex:1; ${!this.friendsBetting?'border:2px solid var(--accent);':''}" onclick="MatchLobby.setFriendsBetting(false)">🏆 By Points</button>
          <button class="btn-ghost btn-sm" style="flex:1; ${this.friendsBetting?'border:2px solid var(--accent);':''}" onclick="MatchLobby.setFriendsBetting(true)">💰 By Betting</button>
        </div>
      </div>
      ${this.friendsBetting ? `
        <div class="form-group">
          <label>Bet Amount (every friend must fund this exact amount to join)</label>
          <select id="mlFriendsWager" onchange="MatchLobby.friendsWager = parseInt(this.value);">
            <option value="500">₦500</option>
            <option value="1000">₦1,000</option>
            <option value="2000">₦2,000</option>
            <option value="5000">₦5,000</option>
          </select>
        </div>
      ` : ''}
      <button class="btn-primary mt-2" style="width:100%;" onclick="MatchLobby.createFriendsRoom()">Create Room</button>
    `;
  },

  createFriendsRoom() {
    const user = Store.getUser();
    if (!user || String(user.id).startsWith('guest_')) { showToast('Create a real account to host a friends match.'); return; }
    const count = this.friendsCount || 1;
    const wager = this.friendsBetting ? (this.friendsWager || 500) : 0;
    if (this.friendsBetting && user.wallet < wager) { showToast(`Wallet is below ₦${wager} — fund your wallet first.`); return; }

    Db.createCompetition({
      name: `${user.name}'s Friends Match`,
      type: 'custom', creatorId: user.id, creatorName: user.name,
      creatorParticipates: true, fundedByCreator: false,
      allowSpectators: true, maxPlayers: count + 1,
      entryFee: wager, prizePool: wager * (count + 1),
      startTime: new Date(Date.now() + 10 * 60000).toISOString(), joinCutoffTime: null
    }).then(compId => {
      this.close();
      navigate('competitions');
      showShareModal('Friends Room Created!', joinLinkFor(compId),
        this.friendsBetting
          ? `Share this link — each friend must fund ₦${wager} to join.`
          : 'Share this link with your friends to join.');
    }).catch(err => showToast(err.message));
  },

  // --- Game Rule modal: mechanics that aren't time/player-count, proposed once matched ---
  gameRuleModalHTML() {
    return `
      <div class="modal-overlay hidden" id="mlRuleModal">
        <div class="modal-box">
          <h3>⚙️ Game Rule</h3>
          <p class="text-muted text-xs mb-2">These settings become your proposed rules once matched online.</p>

          <div class="toggle-wrap">
            <div class="text-sm fw-700">Include Whot 20 (Wildcard)</div>
            <label class="toggle"><input type="checkbox" id="mlIncludeWhot" ${this.includeWhot ? 'checked' : ''}><span class="slider"></span></label>
          </div>
          <div class="toggle-wrap">
            <div class="text-sm fw-700">Allow Defending (Pick 2/3)</div>
            <label class="toggle"><input type="checkbox" id="mlAllowDefend" ${this.allowDefend ? 'checked' : ''}><span class="slider"></span></label>
          </div>
          <div class="form-group mt-2">
            <label>Defense Style</label>
            <select id="mlDefenseMode">
              <option value="stack" ${this.defenseMode !== 'block' ? 'selected' : ''}>Stack Penalty (Increment)</option>
              <option value="block" ${this.defenseMode === 'block' ? 'selected' : ''}>Block Penalty (Stop Pick)</option>
            </select>
          </div>
          <div class="form-group">
            <label>Checkup Style</label>
            <select id="mlCheckupStyle">
              <option value="tournament" ${this.checkupStyle !== 'classic' ? 'selected' : ''}>Tournament Style (Elimination Contest)</option>
              <option value="classic" ${this.checkupStyle === 'classic' ? 'selected' : ''}>Classic Style (Lowest Score Wins Instantly)</option>
            </select>
          </div>
          <div class="form-group">
            <label>When Market Finishes (Deck Empty)</label>
            <select id="mlEmptyDeckBehavior">
              <option value="reshuffle" ${this.emptyDeckBehavior !== 'checkup' ? 'selected' : ''}>Reshuffle Pile & Continue</option>
              <option value="checkup" ${this.emptyDeckBehavior === 'checkup' ? 'selected' : ''}>Count Cards & Eliminate / End Game</option>
            </select>
          </div>
          <div class="form-group">
            <label>Suspension / Hold On Card</label>
            <select id="mlHoldOnCard">
              <option value="1" ${this.holdOnCard === 1 ? 'selected' : ''}>Card 1 (Hold On) / Card 8 (Suspension)</option>
              <option value="8" ${this.holdOnCard === 8 ? 'selected' : ''}>Card 8 (Hold On) / Card 1 (Suspension)</option>
            </select>
          </div>
          <div class="form-group" style="border-top:1px solid var(--border); padding-top:1rem;">
            <label style="display:flex; justify-content:space-between; align-items:center;">
              <span>🃏 Card Actions Config</span>
              <button class="btn-ghost btn-sm" onclick="openCardConfigModal()" style="font-size:0.8rem; padding:4px 10px;">⚙️ Configure</button>
            </label>
          </div>

          <div class="flex gap-2 mt-3" style="justify-content:flex-end;">
            <button class="btn-ghost btn-sm" onclick="MatchLobby.closeRulesModal()">Cancel</button>
            <button class="btn-primary btn-sm" onclick="MatchLobby.saveRulesModal()">Save</button>
          </div>
        </div>
      </div>
    `;
  },
  openRulesModal() {
    const modal = document.getElementById('mlRuleModal');
    if (modal) modal.classList.remove('hidden');
  },
  closeRulesModal() {
    const modal = document.getElementById('mlRuleModal');
    if (modal) modal.classList.add('hidden');
  },
  saveRulesModal() {
    this.includeWhot = document.getElementById('mlIncludeWhot').checked;
    this.allowDefend = document.getElementById('mlAllowDefend').checked;
    this.defenseMode = document.getElementById('mlDefenseMode').value;
    this.checkupStyle = document.getElementById('mlCheckupStyle').value;
    this.emptyDeckBehavior = document.getElementById('mlEmptyDeckBehavior').value;
    this.holdOnCard = parseInt(document.getElementById('mlHoldOnCard').value);
    this.closeRulesModal();
    showToast('Game rules saved for your next online match.');
  },

  _searchingHTML() {
    const tc = TIME_CONTROLS[this.category];
    return `
      <h3>🔎 Searching for opponents...</h3>
      <p class="text-muted text-sm mt-1">Matching you with ${this.playerCount - 1} other player${this.playerCount>2?'s':''} in ${tc.label}${this.gameType === 'pricepool' ? ` · ₦${this.poolAmount.toLocaleString()} pool` : ''}.</p>
      <div class="mt-3" style="text-align:center;">
        <div class="gb-deck-wrap" style="margin:0 auto; cursor:default;"><div class="wcard wcard-back"><div class="wcard-back-inner"><span class="wcard-back-text">Whot</span></div></div></div>
      </div>
      <button class="btn-ghost btn-sm mt-3" style="width:100%;" onclick="MatchLobby.close()">Cancel Search</button>
    `;
  },

  async startSearching() {
    const user = Store.getUser();
    if (!user || String(user.id).startsWith('guest_')) {
      showToast('Create a real account to play online — guests can only play vs bots.');
      return;
    }
    if (this.gameType === 'pricepool') {
      this.wager = this.poolAmount;
      if (this.poolAmount > 0 && user.wallet < this.poolAmount) {
        showToast(`Wallet is below ₦${this.poolAmount.toLocaleString()} — fund your wallet first.`);
        return;
      }
    } else {
      this.wager = 0;
    }

    this.step = 'searching';
    this.refresh();

    try {
      const matchId = await Db.joinMatchmaking({
        uid: user.id, name: user.name, category: this.category,
        baseSec: this.baseSec, incSec: this.incSec,
        playerCount: this.playerCount, mode: this.gameType, rated: this.rated,
        poolAmount: this.gameType === 'pricepool' ? this.poolAmount : 0
      });

      if (matchId) {
        this.enterNegotiation(matchId);
      } else {
        this._queueUnsub = Db.listenMyQueueStatus(user.id, row => {
          if (row && row.status === 'matched' && row.match_id) {
            if (this._queueUnsub) { this._queueUnsub(); this._queueUnsub = null; }
            this.enterNegotiation(row.match_id);
          }
        });
      }
    } catch (err) {
      showToast(err.message);
      this.step = 'pick';
      this.refresh();
    }
  },

  enterNegotiation(matchId) {
    this.matchId = matchId;
    this.step = 'negotiating';
    this.refresh();

    const user = Store.getUser();
    const myOpts = {
      timerMode: this.category === 'custom' ? 'rapid' : this.category,
      timerBaseSec: this.baseSec, timerIncSec: this.incSec,
      playerCount: this.playerCount,
      includeWhot: this.includeWhot, holdOnCard: this.holdOnCard, allowDefend: this.allowDefend,
      defenseMode: this.defenseMode, checkupStyle: this.checkupStyle, emptyDeckBehavior: this.emptyDeckBehavior,
      wager: this.wager,
      cardConfig: Store.getGameOpts().cardConfig
    };
    Db.proposeRules(matchId, user.id, myOpts).catch(e => console.warn('Could not propose rules:', e));

    this._matchUnsub = Db.listenMatch(matchId, m => {
      if (!m) return;
      this._lastMatch = m;
      this.refresh();
      if (m.agreed_rules && m.phase === 'playing') {
        if (this._matchUnsub) { this._matchUnsub(); this._matchUnsub = null; }
        const opponent = (m.players || []).find(p => p.uid !== user.id);
        setTimeout(() => this.launchLocalGame(m.agreed_rules, opponent ? opponent.name : 'Opponent'), 1200);
      }
    });
  },

  _negotiatingHTML() {
    const user = Store.getUser();
    const m = this._lastMatch;

    if (m && m.agreed_rules) {
      return `
        <h3>🤝 Match Found!</h3>
        <p class="text-muted text-sm mt-1">Rules agreed — starting your match...</p>
      `;
    }

    const players = (m && m.players) || [];
    const opponent = players.find(p => p.uid !== user.id);
    const proposals = (m && m.rule_proposals) || {};
    const myProposal = proposals[user.id];
    const theirProposal = opponent ? proposals[opponent.uid] : null;

    return `
      <h3>🤝 Match Found!</h3>
      <p class="text-muted text-sm mt-1">Opponent: ${opponent ? opponent.name : 'waiting...'}</p>
      <p class="text-xs text-muted mt-1">Whoever's rules get picked decide the timer, Hold On card, defending, and card actions for this match.</p>

      ${myProposal && theirProposal ? `
        <div class="flex gap-2 mt-3">
          <button class="btn-primary btn-sm" style="flex:1;" onclick="MatchLobby.chooseRules('${this.matchId}', MatchLobby._lastMatch.rule_proposals['${user.id}'])">Use My Rules</button>
          <button class="btn-ghost btn-sm" style="flex:1;" onclick="MatchLobby.chooseRules('${this.matchId}', MatchLobby._lastMatch.rule_proposals['${opponent.uid}'])">Use ${opponent.name}'s Rules</button>
        </div>
      ` : `<p class="text-xs text-muted mt-2">Waiting for both players' rule preferences...</p>`}

      <button class="btn-ghost btn-sm mt-3" style="width:100%;" onclick="MatchLobby.close()">Leave Match</button>
    `;
  },

  chooseRules(matchId, whichOpts) {
    const user = Store.getUser();
    Db.agreeToRules(matchId, user.id, whichOpts).catch(e => showToast(e.message));
  },

  launchLocalGame(agreedOpts, opponentName) {
    this.close();
    showToast(`Match starting with ${opponentName}'s lobby — agreed rules applied. (Live synced play is coming soon; starting your match now.)`);
    Store.setGameOpts({
      timerMode: agreedOpts.timerMode,
      playerCount: agreedOpts.playerCount,
      includeWhot: agreedOpts.includeWhot,
      holdOnCard: agreedOpts.holdOnCard,
      allowDefend: agreedOpts.allowDefend,
      defenseMode: agreedOpts.defenseMode,
      checkupStyle: agreedOpts.checkupStyle,
      emptyDeckBehavior: agreedOpts.emptyDeckBehavior,
      wager: agreedOpts.wager,
      cardConfig: agreedOpts.cardConfig,
      timerBaseSec: agreedOpts.timerBaseSec,
      timerIncSec: agreedOpts.timerIncSec
    });
    navigate('game');
  }
};

// In-Game State & Loop
let currentGame = null;
let selectedCardId = null;

function renderGame() {
  const opts = Store.getGameOpts();
  const user = Store.getUser();
  
  // Create a new game
  currentGame = WhotEngine.createGame(opts.playerCount, opts);
  selectedCardId = null;

  // Initialize chess timers based on mode
  let baseSeconds = 600; // 10 mins
  if (opts.timerMode === 'bullet') baseSeconds = 60;
  if (opts.timerMode === 'blitz') baseSeconds = 180;
  if (opts.timerMode === 'classical') baseSeconds = 1800;
  if (opts.timerMode === 'unlimited') baseSeconds = 99999;

  gameTimerSeconds = {};
  for (let i = 0; i < opts.playerCount; i++) {
    gameTimerSeconds[i] = baseSeconds;
  }

  const div = document.createElement('div');
  div.className = 'page fade-in';
  div.style.paddingTop = '64px';
  
  // Main layout grid
  div.innerHTML = `
    <div class="game-board">
      <!-- Play area -->
      <div class="board-area">
        <!-- Top row: Opponents -->
        <div class="board-top" id="gameOpponents"></div>

        <!-- Center: Piles -->
        <div class="center-pile">
          <div style="text-align:center;">
            <div class="text-xs text-muted mb-1">DECK</div>
            <div class="whot-card back" onclick="handleDrawClick()"></div>
          </div>
          
          <div style="text-align:center;">
            <div class="text-xs text-muted mb-1" id="gameSuitAlert">TOP CARD</div>
            <div class="whot-card" id="topCardPile"></div>
          </div>
        </div>

        <!-- Bottom row: Player Hand & Seat -->
        <div class="board-bottom">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
            <div style="display:flex; align-items:center; gap:12px;">
              <div class="seat-avi" style="background:var(--accent);">${user.avi}</div>
              <div>
                <div class="text-sm fw-700">${user.name} (You)</div>
                <div class="text-xs text-accent">Active Player</div>
              </div>
            </div>
            <div class="timer" id="playerTimer-0">10:00</div>
          </div>

          <div class="hand-cards" id="playerHand"></div>
          
          <div style="display:flex; gap:1rem; justify-content:center; margin-top:1rem;">
            <button class="btn-primary" onclick="handlePlayClick()">Play Selected Card</button>
            <button class="btn-ghost" onclick="handleCheckupClick()">Check / Declare Win</button>
          </div>
        </div>
      </div>

      <!-- Right column: Logs, Rules, Chat -->
      <div class="board-sidebar">
        <!-- Game log -->
        <div class="panel" style="flex:1; display:flex; flex-direction:column; overflow:hidden;">
          <h4 style="border-bottom:1px solid var(--border); padding-bottom:6px; margin-bottom:6px;">Game Logs</h4>
          <div style="flex:1; overflow-y:auto; font-size:0.75rem; color:var(--text2);" id="gameLog"></div>
        </div>

        <!-- Quick rules -->
        <div class="panel">
          <h4 style="margin-bottom:6px;">Rules Selected</h4>
          <div class="text-xs text-muted">
            • Wildcard Whot 20: ${opts.includeWhot ? 'Enabled' : 'Disabled'}<br>
            • Hold On card: Card ${opts.holdOnCard}<br>
            • Timer increment: ${opts.timerMode === 'unlimited' ? 'None' : '2s'}<br>
            • Elimination: Highest card sum on time-over.
          </div>
        </div>

        <!-- Chat box -->
        <div class="chat-box">
          <div class="chat-msgs" id="chatMsgs">
            <div class="chat-msg"><span class="who">System:</span> Welcome to the room! Chat is online.</div>
          </div>
          <div class="chat-input">
            <input type="text" placeholder="Type a message..." id="chatInputText" onkeydown="if(event.key==='Enter') sendGameChatMessage()">
            <button onclick="sendGameChatMessage()">Send</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Suit Selection Modal (Whot 20 play) -->
    <div class="modal-overlay hidden" id="suitModal">
      <div class="modal-box" style="max-width:320px;">
        <h3>Select a Suit to Call</h3>
        <p class="text-muted text-xs mb-2">Since you played a Whot wildcard, choose the next matching suit:</p>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; margin-top:1rem;">
          <button class="btn-ghost" onclick="selectSuitCall('circle')">⭕ Circle</button>
          <button class="btn-ghost" onclick="selectSuitCall('triangle')">🔺 Triangle</button>
          <button class="btn-ghost" onclick="selectSuitCall('cross')">✚ Cross</button>
          <button class="btn-ghost" onclick="selectSuitCall('square')">🟦 Square</button>
          <button class="btn-ghost" onclick="selectSuitCall('star')">⭐ Star</button>
        </div>
      </div>
    </div>
  `;

  // Start turn timers
  startTimerSystem();

  // Render first update
  setTimeout(updateGameBoardUI, 50);

  return div;
}

function updateGameBoardUI() {
  if (!currentGame) return;

  // Render opponents
  const oppContainer = document.getElementById('gameOpponents');
  if (oppContainer) {
    oppContainer.innerHTML = '';
    currentGame.players.forEach((p, idx) => {
      if (p.isHuman) return;
      const isActive = currentGame.currentPlayer === idx;
      
      const oppDiv = document.createElement('div');
      oppDiv.className = `player-seat ${isActive ? 'active-seat' : ''}`;
      oppDiv.style.flex = 1;
      
      oppDiv.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px;">
          <div class="seat-avi" style="background:var(--bg3); color:var(--text); border:1px solid var(--border);">${p.name.slice(0,2)}</div>
          <div>
            <div class="seat-name">${p.name}</div>
            <div class="seat-cards">🎴 ${p.hand.length} cards</div>
            <div class="text-xs text-muted" id="playerTimer-${idx}">10:00</div>
          </div>
        </div>
      `;
      oppContainer.appendChild(oppDiv);
    });
  }

  // Render Top pile card
  const topCard = currentGame.pile[currentGame.pile.length - 1];
  const topCardPile = document.getElementById('topCardPile');
  if (topCardPile) {
    topCardPile.className = `whot-card suit-${topCard.suit}`;
    topCardPile.innerHTML = `
      <div>${topCard.num}</div>
      <div class="card-suit-icon">${SUIT_ICONS[topCard.suit] || ''}</div>
    `;
  }

  // Called suit alert
  const suitAlert = document.getElementById('gameSuitAlert');
  if (suitAlert) {
    if (currentGame.calledSuit) {
      suitAlert.innerText = `CALLED: ${currentGame.calledSuit.toUpperCase()} ${SUIT_ICONS[currentGame.calledSuit]}`;
      suitAlert.style.color = 'var(--accent)';
    } else {
      suitAlert.innerText = 'TOP CARD';
      suitAlert.style.color = 'var(--text2)';
    }
  }

  // Render player hand
  const playerHand = document.getElementById('playerHand');
  if (playerHand) {
    playerHand.innerHTML = '';
    const myHand = currentGame.players[0].hand;
    myHand.forEach(card => {
      const cardDiv = document.createElement('div');
      cardDiv.className = `whot-card suit-${card.suit} ${selectedCardId === card.id ? 'selected' : ''}`;
      cardDiv.innerHTML = `
        <div>${card.num}</div>
        <div class="card-suit-icon">${SUIT_ICONS[card.suit] || ''}</div>
      `;
      cardDiv.onclick = () => {
        selectedCardId = card.id;
        updateGameBoardUI();
      };
      playerHand.appendChild(cardDiv);
    });
  }

  // Render logs
  const logDiv = document.getElementById('gameLog');
  if (logDiv) {
    logDiv.innerHTML = currentGame.log.slice().reverse().map(l => `<div>• ${l}</div>`).join('');
  }

  // Trigger CPU moves if it's their turn
  if (currentGame.currentPlayer !== 0 && !currentGame.gameOver) {
    setTimeout(triggerCpuMove, 1500);
  }
}

// Timer system
function startTimerSystem() {
  if (currentTurnTimer) clearInterval(currentTurnTimer);

  currentTurnTimer = setInterval(() => {
    if (!currentGame || currentGame.gameOver) {
      clearInterval(currentTurnTimer);
      return;
    }

    const active = currentGame.currentPlayer;
    
    // Decrement active player clock
    if (Store.getGameOpts().timerMode !== 'unlimited') {
      gameTimerSeconds[active]--;
    }

    // Update displays
    for (let idx in gameTimerSeconds) {
      const el = document.getElementById(`playerTimer-${idx}`);
      if (el) {
        const min = Math.floor(gameTimerSeconds[idx] / 60);
        const sec = Math.floor(gameTimerSeconds[idx] % 60);
        el.innerText = `${min}:${sec < 10 ? '0' : ''}${sec}`;
        
        if (gameTimerSeconds[idx] <= 15) {
          el.className = 'timer danger';
        } else {
          el.className = 'timer';
        }
      }
    }

    // Handle Time-out
    if (gameTimerSeconds[active] <= 0) {
      clearInterval(currentTurnTimer);
      handleTimeOut(active);
    }
  }, 1000);
}

function handleTimeOut(playerIdx) {
  const loserName = currentGame.players[playerIdx].name;
  currentGame.log.push(`❌ ${loserName} ran out of time!`);
  
  // Calculate scores to find winner (lowest card sum wins)
  let scores = currentGame.players.map((p, idx) => ({
    idx,
    score: WhotEngine.getCardScore(p.hand),
    name: p.name
  }));
  
  scores.sort((a, b) => a.score - b.score);
  const winner = scores[0];

  currentGame.gameOver = true;
  currentGame.winner = winner.idx;
  currentGame.log.push(`🏆 ${winner.name} wins by checkup count (sum score: ${winner.score})!`);
  updateGameBoardUI();

  // Show end game modal
  setTimeout(() => showGameEndModal(winner.idx, scores), 100);
}

function triggerCpuMove() {
  if (currentGame.currentPlayer === 0 || currentGame.gameOver) return;

  const cpuIdx = currentGame.currentPlayer;
  const cpu = currentGame.players[cpuIdx];
  const topCard = currentGame.pile[currentGame.pile.length - 1];

  const chosenCard = WhotEngine.aiChooseCard(cpu.hand, topCard, currentGame.calledSuit, currentGame.opts);

  if (chosenCard) {
    // If it's a Whot card, CPU selects the suit they have the most of
    let wildCall = null;
    if (chosenCard.suit === 'whot') {
      const suitsCount = {};
      cpu.hand.forEach(c => {
        if (c.suit !== 'whot') {
          suitsCount[c.suit] = (suitsCount[c.suit] || 0) + 1;
        }
      });
      wildCall = Object.keys(suitsCount).sort((a,b) => suitsCount[b] - suitsCount[a])[0] || 'circle';
    }

    // Apply chess time increment (+2s for blitz/rapid/classical)
    if (Store.getGameOpts().timerMode !== 'unlimited') {
      gameTimerSeconds[cpuIdx] += 2;
    }

    currentGame = WhotEngine.playCard(currentGame, cpuIdx, chosenCard.id, wildCall);
  } else {
    // Draw card
    currentGame = WhotEngine.drawCard(currentGame, cpuIdx);
  }

  updateGameBoardUI();
  
  if (currentGame.gameOver) {
    const scores = currentGame.players.map((p, idx) => ({ idx, score: WhotEngine.getCardScore(p.hand), name: p.name }));
    scores.sort((a,b) => a.score - b.score);
    setTimeout(() => showGameEndModal(currentGame.winner, scores), 200);
  }
}

function handleDrawClick() {
  if (currentGame.currentPlayer !== 0 || currentGame.gameOver) return;
  currentGame = WhotEngine.drawCard(currentGame, 0);
  selectedCardId = null;
  updateGameBoardUI();
}

function handlePlayClick() {
  if (currentGame.currentPlayer !== 0 || currentGame.gameOver) {
    showToast('It is not your turn!');
    return;
  }
  if (!selectedCardId) {
    showToast('Select a card to play first!');
    return;
  }

  const card = currentGame.players[0].hand.find(c => c.id === selectedCardId);
  if (!card) return;

  const topCard = currentGame.pile[currentGame.pile.length - 1];
  if (!WhotEngine.canPlay(card, topCard, currentGame.calledSuit, currentGame.opts)) {
    showToast('Invalid move! Card does not match top card suit or number.');
    return;
  }

  // If Whot 20 wild card played, prompt user to select suit
  if (card.suit === 'whot') {
    document.getElementById('suitModal').classList.remove('hidden');
    return;
  }

  // Apply chess time increment (+2s)
  if (Store.getGameOpts().timerMode !== 'unlimited') {
    gameTimerSeconds[0] += 2;
  }

  currentGame = WhotEngine.playCard(currentGame, 0, selectedCardId);
  selectedCardId = null;
  updateGameBoardUI();

  if (currentGame.gameOver) {
    const scores = currentGame.players.map((p, idx) => ({ idx, score: WhotEngine.getCardScore(p.hand), name: p.name }));
    scores.sort((a,b) => a.score - b.score);
    setTimeout(() => showGameEndModal(currentGame.winner, scores), 200);
  }
}

function selectSuitCall(suit) {
  document.getElementById('suitModal').classList.add('hidden');
  if (selectedCardId) {
    // Apply chess time increment
    if (Store.getGameOpts().timerMode !== 'unlimited') {
      gameTimerSeconds[0] += 2;
    }
    currentGame = WhotEngine.playCard(currentGame, 0, selectedCardId, suit);
    selectedCardId = null;
    updateGameBoardUI();

    if (currentGame.gameOver) {
      const scores = currentGame.players.map((p, idx) => ({ idx, score: WhotEngine.getCardScore(p.hand), name: p.name }));
      scores.sort((a,b) => a.score - b.score);
      setTimeout(() => showGameEndModal(currentGame.winner, scores), 200);
    }
  }
}

function handleCheckupClick() {
  if (currentGame.gameOver) return;
  
  // Calculate scores
  let scores = currentGame.players.map((p, idx) => ({
    idx,
    score: WhotEngine.getCardScore(p.hand),
    name: p.name
  }));
  scores.sort((a, b) => a.score - b.score);
  
  currentGame.gameOver = true;
  currentGame.winner = scores[0].idx;
  currentGame.log.push(`📣 Checkup declared! Lowest score wins.`);
  updateGameBoardUI();

  setTimeout(() => showGameEndModal(currentGame.winner, scores), 100);
}

function showGameEndModal(winnerIdx, scores) {
  const isUserWinner = winnerIdx === 0;
  const user = Store.getUser();
  const wager = Store.getGameOpts().wager || 0;
  let winnings = 0;

  if (isUserWinner && wager > 0) {
    // Platform takes 10% fee on wager
    winnings = Math.floor(wager * 2 * 0.9);
    user.wallet += winnings;
    user.won++;
    user.points += 150; // base + victory points
  } else if (isUserWinner) {
    user.won++;
    user.points += 50;
  } else {
    user.lost++;
    user.points = Math.max(0, user.points - 20);
  }
  user.played++;

  // Create end game modal overlay
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box" style="text-align:center;">
      <h2 style="font-size:2rem; color:${isUserWinner ? 'var(--accent)' : 'var(--red)'}">
        ${isUserWinner ? '🏆 VICTORY!' : '💔 DEFEAT'}
      </h2>
      <p class="text-muted text-sm mt-1">
        ${isUserWinner ? `Congrats! You won the match.${wager > 0 ? ` Winnings: ₦${winnings} added to wallet (10% platform fee deducted).` : ''}` : 'Better luck next time!'}
      </p>

      <div class="panel-dark mt-2" style="text-align:left;">
        <h4 style="margin-bottom:0.5rem; border-bottom:1px solid var(--border); padding-bottom:4px;">Scoreboard (Lowest Wins)</h4>
        ${scores.map((s, idx) => `
          <div class="flex-between text-sm py-1">
            <span>${idx + 1}. ${s.name} ${s.idx === winnerIdx ? '⭐' : ''}</span>
            <span class="fw-700">${s.score} pts</span>
          </div>
        `).join('')}
      </div>

      <div class="flex gap-2 mt-3" style="justify-content:center;">
        <button class="btn-primary" onclick="closeEndModalAndGoHome(this)">Back to Dashboard</button>
        <button class="btn-ghost" onclick="closeEndModalAndReplay(this)">Play Again</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

function closeEndModalAndGoHome(btn) {
  btn.closest('.modal-overlay').remove();
  navigate('dashboard');
}

function closeEndModalAndReplay(btn) {
  btn.closest('.modal-overlay').remove();
  navigate('game');
}

function sendGameChatMessage() {
  const input = document.getElementById('chatInputText');
  if (!input || !input.value.trim()) return;

  const msgsDiv = document.getElementById('chatMsgs');
  const user = Store.getUser();

  // Add my message
  const msgEl = document.createElement('div');
  msgEl.className = 'chat-msg';
  msgEl.innerHTML = `<span class="who">${user.name}:</span> ${input.value}`;
  msgsDiv.appendChild(msgEl);
  msgsDiv.scrollTop = msgsDiv.scrollHeight;

  input.value = '';

  // Trigger funny CPU chats
  setTimeout(() => {
    const opps = ['Adunola', 'ChukwuEmeka', 'Garba', 'Effiong'];
    const cpuName = opps[Math.floor(Math.random() * opps.length)];
    const responses = [
      'Hold on, I am thinking!',
      'Who played that general market?! 😠',
      'I am checking up very soon, watch out.',
      'Nice move, but I have a counter!',
      'Do you want to play a cash tournament later?',
      'Igbo kwenu! Let\'s go!'
    ];
    const replyEl = document.createElement('div');
    replyEl.className = 'chat-msg';
    replyEl.innerHTML = `<span class="who" style="color:var(--text2);">${cpuName}:</span> ${responses[Math.floor(Math.random() * responses.length)]}`;
    msgsDiv.appendChild(replyEl);
    msgsDiv.scrollTop = msgsDiv.scrollHeight;
  }, 1200);
}

// Views: Tournaments
let _liveMatchesUnsub = null;
function renderTournaments() {
  const tournaments = Store.getTournaments();

  if (!_liveMatchesUnsub && typeof Db !== 'undefined') {
    _liveMatchesUnsub = Db.listenLiveMatches(liveMatches => {
      Store.state.liveMatches = liveMatches;
      if (Store.state.page === 'tournaments') navigate('tournaments');
    });
  }
  const liveMatches = Store.state.liveMatches || [];

  const html = `
    <h2>Tournaments</h2>
    <p class="text-muted text-sm mt-1">Elimination tournament system (4 → 3 → 2 → Winner). Drop out on defeat, advance on checkup victory.</p>

    <h3 class="mt-3" style="font-size:1.1rem;">🔴 Live Now — Watch Without Playing</h3>
    <div class="grid-3 mt-2">
      ${liveMatches.length === 0 ? `<p class="text-muted text-xs">No spectator-enabled matches live right now.</p>` : liveMatches.map(m => `
        <div class="panel">
          <span class="rank-badge rank-expert">LIVE</span>
          <h3 class="mt-1" style="font-size:1rem;">${m.players.map(p => p.name).join(' vs ')}</h3>
          <p class="text-xs text-muted mt-1" id="viewerCount-${m.id}">👁️ ...watching</p>
          <button class="btn-primary btn-sm mt-2" style="width:100%;" onclick="openSpectateModal('${m.id}')">Watch Live</button>
        </div>
      `).join('')}
    </div>

    <!-- Spectate Modal -->
    <div class="modal-overlay hidden" id="spectateModal">
      <div class="modal-box">
        <h3 id="spectateTitle">Watching Match</h3>
        <p class="text-xs text-muted" id="spectateViewerCount">👁️ 0 watching</p>
        <p class="text-xs text-muted mt-1" id="spectateStatus">Live match in progress.</p>
        <div class="chat-box mt-2">
          <div class="chat-msgs" id="spectateChatMsgs"></div>
          <div class="chat-input">
            <input type="text" placeholder="Cheer them on..." id="spectateChatInput" onkeydown="if(event.key==='Enter') sendSpectateChatMessage()">
            <button onclick="sendSpectateChatMessage()">Send</button>
          </div>
        </div>
        <div class="flex gap-2 mt-3" style="justify-content:flex-end;">
          <button class="btn-ghost btn-sm" onclick="closeSpectateModal()">Leave</button>
        </div>
      </div>
    </div>

    <div class="grid-2 mt-3">
      <!-- Active Tournaments List -->
      <div style="display:flex; flex-direction:column; gap:1.5rem;">
        ${tournaments.map(t => `
          <div class="panel">
            <div class="flex-between">
              <span class="rank-badge rank-${t.status === 'live' ? 'expert' : 'player'}">${t.status.toUpperCase()}</span>
              ${t.starts ? `<span class="text-xs text-muted">Starts: ${t.starts}</span>` : ''}
            </div>
            <h3 style="font-size:1.2rem; font-weight:800; margin-top:0.5rem;">${t.name}</h3>
            <p class="text-muted text-xs mt-1">Players registered: ${t.players.join(', ')}</p>
            <div class="flex gap-2 mt-2">
              ${t.status === 'live' ? `
                <button class="btn-primary btn-sm" onclick="showTournamentBracket('${t.id}')">View Bracket</button>
                <button class="btn-ghost btn-sm" onclick="showToast('Spectating is available from the Live Now panel above for matches that allow it.')">Spectate</button>
              ` : `
                <button class="btn-primary btn-sm" onclick="showToast('Registered for ${t.name}!')">Register (Free)</button>
              `}
            </div>
          </div>
        `).join('')}
      </div>

      <!-- Tournament Bracket Display Panel -->
      <div class="panel" id="tournamentBracketPanel">
        <h3 style="font-size:1.1rem; font-weight:700; border-bottom:1px solid var(--border); padding-bottom:0.75rem;">Interactive Bracket</h3>
        <p class="text-muted text-xs mt-1" id="bracketInstructions">Select "View Bracket" from a live tournament on the left.</p>
        <div id="bracketViewContainer" class="mt-2"></div>
      </div>
    </div>
  `;
  return renderDashLayout(html, 'tournaments');
}

function showTournamentBracket(tId) {
  const t = Store.getTournaments().find(x => x.id === tId);
  const container = document.getElementById('bracketViewContainer');
  const instructions = document.getElementById('bracketInstructions');
  if (!container) return;

  instructions.classList.add('hidden');
  
  container.innerHTML = `
    <div class="bracket">
      <!-- Round 1 -->
      <div class="bracket-round">
        <div class="bracket-match">
          <div class="bracket-player winner">ChukwuEmeka 👑</div>
          <div class="bracket-player">Garba</div>
        </div>
        <div class="bracket-match">
          <div class="bracket-player winner">Adunola 👑</div>
          <div class="bracket-player">Effiong</div>
        </div>
      </div>

      <div class="bracket-connector"></div>

      <!-- Round 2 (Finals) -->
      <div class="bracket-round">
        <div class="bracket-match">
          <div class="bracket-player">ChukwuEmeka</div>
          <div class="bracket-player">Adunola</div>
        </div>
      </div>
    </div>
    <div class="mt-2 text-xs text-muted" style="text-align:center;">
      Round 1 completed. Final match is starting now.
    </div>
  `;
}

let _spectateUnsubs = [];
function openSpectateModal(matchId) {
  const user = Store.getUser();
  document.getElementById('spectateModal').classList.remove('hidden');
  Db.joinAsSpectator(matchId, user.id, user.name).catch(() => {});

  _spectateUnsubs.forEach(u => u());
  _spectateUnsubs = [];

  _spectateUnsubs.push(Db.listenMatch(matchId, m => {
    if (!m) return;
    document.getElementById('spectateTitle').innerText = m.players.map(p => p.name).join(' vs ');
    document.getElementById('spectateStatus').innerText = m.status === 'completed'
      ? `Match ended. Winner: ${m.winner_id}` : 'Live match in progress.';
  }));

  _spectateUnsubs.push(Db.listenViewerCount(matchId, count => {
    const el = document.getElementById('spectateViewerCount');
    if (el) el.innerText = `👁️ ${count} watching`;
    const cardEl = document.getElementById(`viewerCount-${matchId}`);
    if (cardEl) cardEl.innerText = `👁️ ${count} watching`;
  }));

  _spectateUnsubs.push(Db.listenMatchChat(matchId, msgs => {
    const box = document.getElementById('spectateChatMsgs');
    if (!box) return;
    box.innerHTML = msgs.map(m => `<div class="chat-msg"><span class="who">${m.sender_name}:</span> ${m.text}</div>`).join('');
    box.scrollTop = box.scrollHeight;
  }));

  window._activeSpectateMatchId = matchId;
}
function closeSpectateModal() {
  const user = Store.getUser();
  const matchId = window._activeSpectateMatchId;
  if (matchId && user) Db.leaveAsSpectator(matchId, user.id).catch(() => {});
  document.getElementById('spectateModal').classList.add('hidden');
  _spectateUnsubs.forEach(u => u());
  _spectateUnsubs = [];
  window._activeSpectateMatchId = null;
}
function sendSpectateChatMessage() {
  const input = document.getElementById('spectateChatInput');
  const text = input.value.trim();
  const matchId = window._activeSpectateMatchId;
  if (!text || !matchId) return;
  const user = Store.getUser();
  Db.sendMatchChat(matchId, user.id, user.name, text);
  input.value = '';
}

// Views: Competitions
let _compsUnsub = null;
let _tribesUnsub = null;
function renderCompetitions() {
  const user = Store.getUser();

  if (!_compsUnsub && typeof Db !== 'undefined') {
    _compsUnsub = Db.listenCompetitions(liveComps => {
      Store.state.liveCompetitions = liveComps;
      if (Store.state.page === 'competitions') navigate('competitions');
    });
  }
  if (!_tribesUnsub && typeof Db !== 'undefined') {
    _tribesUnsub = Db.listenTribes(tribes => {
      Store.state.liveTribes = tribes;
      if (Store.state.page === 'competitions') navigate('competitions');
    });
  }
  const userTribes = Store.state.liveTribes || [];

  const liveComps = (Store.state.liveCompetitions || []).map(c => ({
    id: c.id,
    name: c.name,
    type: c.type,
    prize: c.prize_pool ? `₦${c.prize_pool}` : (c.entry_fee ? `₦${c.entry_fee * 2}` : '500 pts'),
    players: (c.players || []).length,
    maxPlayers: c.max_players,
    entry: c.entry_fee ? `₦${c.entry_fee}` : 'free',
    ends: c.start_time ? new Date(c.start_time).toLocaleString() : 'TBD',
    tribe: c.tribe_id ? c.tribe_id : null,
    private: !c.allow_spectators,
    creatorName: c.creator_name,
    creatorParticipates: c.creator_participates,
    allowSpectators: c.allow_spectators,
    entryFeeRaw: c.entry_fee,
    startTimeRaw: c.start_time,
    live: true
  }));

  const comps = [...liveComps, ...Store.getCompetitions()];

  const html = `
    <div class="flex-between">
      <div>
        <h2>Competitions</h2>
        <p class="text-muted text-sm mt-1">Participate in daily, weekly, and monthly events, or join a tribe room.</p>
      </div>
      <button class="btn-primary" onclick="openCreateCompModal()">Create Private Match</button>
    </div>

    <!-- Tribe selection rooms -->
    <div class="grid-4 mt-3">
      <div class="panel tribe-igbo" style="border-top: 4px solid var(--green); text-align:center;">
        <div style="font-size:2rem;">🟢</div>
        <h3 class="mt-1">Igbo Tribe Room</h3>
        <p class="text-xs text-muted mt-1">Igbo kwenu! Connect and stack tribe leader points.</p>
        <button class="btn-ghost btn-sm mt-2" style="width:100%;" onclick="joinTribeChat('Igbo')">Join Chat</button>
      </div>
      <div class="panel tribe-yoruba" style="border-top: 4px solid var(--accent2); text-align:center;">
        <div style="font-size:2rem;">🟠</div>
        <h3 class="mt-1">Yoruba Tribe Room</h3>
        <p class="text-xs text-muted mt-1">E kaabo! Connect and stack tribe leader points.</p>
        <button class="btn-ghost btn-sm mt-2" style="width:100%;" onclick="joinTribeChat('Yoruba')">Join Chat</button>
      </div>
      <div class="panel tribe-hausa" style="border-top: 4px solid var(--blue); text-align:center;">
        <div style="font-size:2rem;">🔵</div>
        <h3 class="mt-1">Hausa Tribe Room</h3>
        <p class="text-xs text-muted mt-1">Sannu ku da zuwa! Connect and stack points.</p>
        <button class="btn-ghost btn-sm mt-2" style="width:100%;" onclick="joinTribeChat('Hausa')">Join Chat</button>
      </div>
      <div class="panel tribe-efik" style="border-top: 4px solid var(--purple); text-align:center;">
        <div style="font-size:2rem;">🟣</div>
        <h3 class="mt-1">Efik Tribe Room</h3>
        <p class="text-xs text-muted mt-1">Mmedi he! Connect and stack points.</p>
        <button class="btn-ghost btn-sm mt-2" style="width:100%;" onclick="joinTribeChat('Efik')">Join Chat</button>
      </div>
    </div>

    <!-- User-created tribes -->
    <div class="flex-between mt-3">
      <h3 style="font-size:1.1rem;">Custom Tribes</h3>
      <button class="btn-ghost btn-sm" onclick="openCreateTribeModal()">+ Create Your Own Tribe</button>
    </div>
    <div class="grid-4 mt-2">
      ${userTribes.length === 0 ? `<p class="text-muted text-xs">No custom tribes yet — be the first to start one.</p>` : userTribes.map(t => `
        <div class="panel" style="text-align:center;">
          <div style="font-size:2rem;">🔶</div>
          <h3 class="mt-1">${t.name}</h3>
          <p class="text-xs text-muted mt-1">${(t.members || []).length} members · ${t.points || 0} pts</p>
          <button class="btn-ghost btn-sm mt-2" style="width:100%;" onclick="openTribeChatModal('${t.id}', '${t.name}')">Open Chat</button>
        </div>
      `).join('')}
    </div>

    <!-- Create Tribe Modal -->
    <div class="modal-overlay hidden" id="createTribeModal">
      <div class="modal-box">
        <h3>Create Your Own Tribe</h3>
        <p class="text-muted text-xs mb-2">Host weekly/monthly competitions exclusive to your tribe.</p>
        <div class="form-group mt-2">
          <label>Tribe Name</label>
          <input type="text" id="newTribeName" placeholder="e.g. Lagos Sharks">
        </div>
        <div class="form-group">
          <label>Description</label>
          <input type="text" id="newTribeDesc" placeholder="What's this tribe about?">
        </div>
        <div class="flex gap-2 mt-3" style="justify-content:flex-end;">
          <button class="btn-ghost btn-sm" onclick="closeCreateTribeModal()">Cancel</button>
          <button class="btn-primary btn-sm" onclick="submitCreateTribe()">Create Tribe</button>
        </div>
      </div>
    </div>

    <!-- Tribe Chat Modal -->
    <div class="modal-overlay hidden" id="tribeChatModal">
      <div class="modal-box">
        <h3 id="tribeChatTitle">Tribe Chat</h3>
        <div class="chat-box mt-2">
          <div class="chat-msgs" id="tribeChatMsgs"></div>
          <div class="chat-input">
            <input type="text" placeholder="Type a message..." id="tribeChatInput" onkeydown="if(event.key==='Enter') sendTribeChatMessage()">
            <button onclick="sendTribeChatMessage()">Send</button>
          </div>
        </div>
        <div class="flex gap-2 mt-3" style="justify-content:flex-end;">
          <button class="btn-ghost btn-sm" onclick="closeTribeChatModal()">Close</button>
        </div>
      </div>
    </div>

    <div class="grid-3 mt-3">
      ${comps.map(c => `
        <div class="comp-card" onclick="joinCompetitionMatch('${c.id}')">
          <div class="flex-between">
            <span class="comp-card-type text-accent">${c.type}</span>
            <span class="prize-badge">${c.prize}</span>
          </div>
          <h3 class="mt-1">${c.name}</h3>
          <p class="text-muted text-xs">Players joined: ${c.players}/${c.maxPlayers}</p>
          <div class="comp-meta">
            <span>Entry: ${c.entry}</span>
            <span>Ends: ${c.ends}</span>
            ${c.tribe ? `<span class="tribe-tag tribe-${c.tribe.toLowerCase()}">${c.tribe} Only</span>` : ''}
            ${c.private ? `<span class="private-badge">Private</span>` : ''}
          </div>
        </div>
      `).join('')}
    </div>

    <!-- Create Competition Modal Overlay -->
    <div class="modal-overlay hidden" id="createCompModal">
      <div class="modal-box">
        <h3>Create Customized Competition</h3>
        <p class="text-muted text-xs mb-2">Monetize your own games. Fund the prize pool or let everyone contribute entry fees!</p>
        <div class="form-group mt-2">
          <label>Competition Name</label>
          <input type="text" id="newCompName" placeholder="e.g. Saturday Night Showdown">
        </div>
        <div class="form-group">
          <label>Monetization Model</label>
          <select id="newCompMonetization">
            <option value="funded">I will fund the prize pool myself</option>
            <option value="buyin">Wager Match (All players fund the prize pool)</option>
            <option value="free">Free / Just points prize</option>
          </select>
        </div>
        <div class="form-group">
          <label>Entry Fee (or self funding amount)</label>
          <select id="newCompEntry">
            <option value="500">₦500</option>
            <option value="1000">₦1,000</option>
            <option value="2000">₦2,000</option>
            <option value="5000">₦5,000</option>
          </select>
        </div>
        <div class="form-group">
          <label>Join Restrictions</label>
          <select id="newCompPrivacy">
            <option value="public">Public (Anyone can search & join)</option>
            <option value="approval">By Approval (Host approves requests)</option>
          </select>
        </div>
        <div class="form-group">
          <label>Max Players</label>
          <select id="newCompMaxPlayers">
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4" selected>4</option>
            <option value="6">6</option>
            <option value="8">8</option>
          </select>
        </div>
        <div class="form-group">
          <label>Will you play in this competition?</label>
          <select id="newCompParticipates" onchange="document.getElementById('newCompFundNote').classList.toggle('hidden', this.value==='yes')">
            <option value="yes">Yes, I'm playing too</option>
            <option value="no">No, I'm only funding it (host & watch)</option>
          </select>
          <p class="text-xs text-muted mt-1 hidden" id="newCompFundNote">Sitting out is only allowed if you fund the prize pool — set "I will fund the prize pool myself" above.</p>
        </div>
        <div class="form-group">
          <label>Allow Spectators?</label>
          <select id="newCompSpectators">
            <option value="yes">Yes — anyone can watch live</option>
            <option value="no">No — players only</option>
          </select>
        </div>
        <div class="form-group">
          <label>Game Start Time</label>
          <input type="datetime-local" id="newCompStartTime">
        </div>
        <div class="form-group">
          <label>Join Cutoff Time (must be before start)</label>
          <input type="datetime-local" id="newCompCutoffTime">
        </div>
        <div class="flex gap-2 mt-3" style="justify-content:flex-end;">
          <button class="btn-ghost btn-sm" onclick="closeCreateCompModal()">Cancel</button>
          <button class="btn-primary btn-sm" onclick="submitCreateComp()">Create & Open Room</button>
        </div>
      </div>
    </div>
  `;
  return renderDashLayout(html, 'competitions');
}

function openCreateCompModal() {
  document.getElementById('createCompModal').classList.remove('hidden');
}

function closeCreateCompModal() {
  document.getElementById('createCompModal').classList.add('hidden');
}

function submitCreateComp() {
  const name = document.getElementById('newCompName').value || 'Custom Cup';
  const entry = parseInt(document.getElementById('newCompEntry').value);
  const monetization = document.getElementById('newCompMonetization').value;
  const maxPlayers = parseInt(document.getElementById('newCompMaxPlayers').value);
  const participates = document.getElementById('newCompParticipates').value === 'yes';
  const allowSpectators = document.getElementById('newCompSpectators').value === 'yes';
  const startTimeRaw = document.getElementById('newCompStartTime').value;
  const cutoffTimeRaw = document.getElementById('newCompCutoffTime').value;

  const user = Store.getUser();
  const fundedByCreator = monetization === 'funded';

  if (!participates && !fundedByCreator) {
    showToast('To sit out, you must fund the prize pool ("I will fund the prize pool myself").');
    return;
  }
  if (fundedByCreator && user.wallet < entry) {
    showToast('Insufficient wallet balance to fund this competition.');
    return;
  }
  if (!startTimeRaw) {
    showToast('Please set a game start time.');
    return;
  }

  Db.createCompetition({
    name,
    type: 'custom',
    creatorId: user.id,
    creatorName: user.name,
    creatorParticipates: participates,
    fundedByCreator,
    allowSpectators,
    maxPlayers,
    entryFee: monetization === 'free' ? 0 : entry,
    prizePool: fundedByCreator ? entry : (monetization === 'buyin' ? entry * maxPlayers : 0),
    startTime: startTimeRaw,
    joinCutoffTime: cutoffTimeRaw || null
  }).then(compId => {
    if (fundedByCreator) {
      user.wallet -= entry;
      showToast(`₦${entry} funded to competition prize pool!`);
    }
    closeCreateCompModal();
    navigate('competitions');
    showShareModal(`"${name}" is live!`, joinLinkFor(compId), 'Share this link with friends — opening it takes them straight to joining this competition.');
  }).catch(err => showToast(err.message));
}

function joinTribeChat(tribeName) {
  const user = Store.getUser();
  if (user && user.id && typeof Db !== 'undefined' && !String(user.id).startsWith('guest_')) {
    Db.setUserTribe(user.id, tribeName).catch(() => {});
    user.tribe = tribeName;
  }
  showToast(`Joined the ${tribeName} Tribe community chat! Represent your people.`);
}

function openCreateTribeModal() {
  document.getElementById('createTribeModal').classList.remove('hidden');
}
function closeCreateTribeModal() {
  document.getElementById('createTribeModal').classList.add('hidden');
}
function submitCreateTribe() {
  const name = document.getElementById('newTribeName').value.trim();
  const description = document.getElementById('newTribeDesc').value.trim();
  if (!name) { showToast('Please name your tribe.'); return; }
  const user = Store.getUser();
  Db.createTribe({ name, description, creatorId: user.id, creatorName: user.name })
    .then(() => {
      user.tribe = name;
      closeCreateTribeModal();
      showToast(`Tribe "${name}" created!`);
      navigate('competitions');
    })
    .catch(err => showToast(err.message));
}

let _tribeChatUnsub = null;
let _activeTribeChatId = null;
function openTribeChatModal(tribeId, tribeName) {
  _activeTribeChatId = tribeId;
  document.getElementById('tribeChatTitle').innerText = `${tribeName} Tribe Chat`;
  document.getElementById('tribeChatModal').classList.remove('hidden');
  if (_tribeChatUnsub) _tribeChatUnsub();
  _tribeChatUnsub = Db.listenTribeChat(tribeId, msgs => {
    const box = document.getElementById('tribeChatMsgs');
    if (!box) return;
    box.innerHTML = msgs.map(m => `<div class="chat-msg"><span class="who">${m.sender_name}:</span> ${m.text}</div>`).join('');
    box.scrollTop = box.scrollHeight;
  });
}
function closeTribeChatModal() {
  document.getElementById('tribeChatModal').classList.add('hidden');
  if (_tribeChatUnsub) { _tribeChatUnsub(); _tribeChatUnsub = null; }
  _activeTribeChatId = null;
}
function sendTribeChatMessage() {
  const input = document.getElementById('tribeChatInput');
  const text = input.value.trim();
  if (!text || !_activeTribeChatId) return;
  const user = Store.getUser();
  Db.sendTribeChat(_activeTribeChatId, user.id, user.name, text);
  input.value = '';
}

function joinCompetitionMatch(compId) {
  const liveComp = (Store.state.liveCompetitions || []).find(x => x.id === compId);
  if (liveComp) {
    const user = Store.getUser();
    if (liveComp.entry_fee && user.wallet < liveComp.entry_fee) {
      showToast('Insufficient wallet balance to join this monetized competition.');
      return;
    }
    Db.joinCompetition(compId, user.id)
      .then(() => showToast(`Joined "${liveComp.name}"! Game starts ${liveComp.start_time ? new Date(liveComp.start_time).toLocaleString() : 'soon'}.`))
      .catch(err => showToast(err.message));
    return;
  }

  const c = Store.getCompetitions().find(x => x.id === compId);
  if (!c) { showToast('Competition not found.'); return; }
  if (c.entry !== 'free') {
    const entryFee = parseInt(c.entry.replace('₦','').replace(',',''));
    const user = Store.getUser();
    if (user.wallet < entryFee) {
      showToast('Insufficient wallet balance to join this monetized competition.');
      return;
    }
  }
  showWagerAlertAndJoin(c.entry === 'free' ? 0 : parseInt(c.entry.replace('₦','').replace(',','')), c.maxPlayers);
}

// Views: Leaderboard
function renderLeaderboard() {
  const players = Store.getLB();
  const html = `
    <h2>Global Rankings</h2>
    <p class="text-muted text-sm mt-1">Climb the leaderboards and claim Daily, Weekly, and Monthly prizes.</p>
    
    <div class="tabs mt-2">
      <button class="tab active" onclick="switchLBPeriod(this, 'daily')">Daily Rush</button>
      <button class="tab" onclick="switchLBPeriod(this, 'weekly')">Weekly</button>
      <button class="tab" onclick="switchLBPeriod(this, 'monthly')">Monthly</button>
    </div>

    <div class="panel mt-3">
      <div style="display:flex; flex-direction:column; gap:0.25rem;">
        ${players.map((p, idx) => `
          <div class="lb-row" onclick="navigate('profile', '${p.id}')" style="cursor:pointer;">
            <div class="lb-rank ${idx===0 ? 'gold':''} ${idx===1 ? 'silver':''} ${idx===2 ? 'bronze':''}">
              ${idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
            </div>
            <div class="lb-player">
              <div class="avi">${p.avi}</div>
              <div>
                <div class="text-sm fw-700">${p.name}</div>
                <div class="text-xs text-muted">${p.tribe} Tribe • ${p.rank}</div>
              </div>
            </div>
            <div class="lb-points">${p.points.toLocaleString()} pts</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  return renderDashLayout(html, 'leaderboard');
}

function switchLBPeriod(btn, period) {
  const tabs = btn.parentNode.children;
  for(let t of tabs) t.classList.remove('active');
  btn.classList.add('active');
  showToast(`Filtered rankings by ${period}`);
}

// Views: Profile
function renderProfile(pId) {
  const p = Store.getPlayer(pId) || Store.getUser();
  const isMe = p.id === 'me' || p.id === Store.getUser().id;

  const html = `
    <div class="profile-header">
      <div class="profile-avi">${p.avi}</div>
      <div>
        <div style="display:flex; align-items:center; gap:10px;">
          <h2 style="font-size:2rem; font-weight:800;">${p.name}</h2>
          <span class="rank-badge rank-${p.rank}">${p.rank}</span>
          <span class="tribe-tag tribe-${p.tribe.toLowerCase()}">${p.tribe} Tribe</span>
        </div>
        <div class="text-muted text-sm mt-1" style="display:flex; gap:1.5rem;">
          <span>🏆 <strong>${p.points.toLocaleString()}</strong> pts</span>
          <span>👥 <strong>${p.followers}</strong> followers</span>
        </div>
      </div>
    </div>

    <div class="grid-2 mt-3">
      <!-- Player stats -->
      <div class="panel">
        <h3 style="font-size:1.1rem; font-weight:700; border-bottom:1px solid var(--border); padding-bottom:0.75rem; margin-bottom:1rem;">Performance Statistics</h3>
        <div class="grid-3">
          <div class="stat-card">
            <div class="stat-val">${p.played}</div>
            <div class="stat-label">Played</div>
          </div>
          <div class="stat-card">
            <div class="stat-val">${p.won}</div>
            <div class="stat-label">Won</div>
          </div>
          <div class="stat-card">
            <div class="stat-val">${p.lost}</div>
            <div class="stat-label">Lost</div>
          </div>
        </div>
        
        <div class="flex gap-2 mt-3">
          ${isMe ? `
            <button class="btn-primary" onclick="shareProfileLink()">🔗 Share Profile</button>
          ` : `
            <button class="btn-primary" id="profileFollowBtn" onclick="toggleFollowRequest('${p.id}')">➕ Request to Follow</button>
            <button class="btn-ghost" onclick="showToast('Challenged player to 1v1!')">⚔️ Challenge 1v1</button>
          `}
        </div>
      </div>

      <!-- Head-to-Head & Rivalries -->
      <div class="panel">
        <h3 style="font-size:1.1rem; font-weight:700; border-bottom:1px solid var(--border); padding-bottom:0.75rem; margin-bottom:1rem;">Head-to-Head History</h3>
        <div class="h2h-row">
          <span>vs Adunola</span>
          <span class="text-green fw-700">3 Wins - 2 Losses</span>
        </div>
        <div class="h2h-row">
          <span>vs Garba</span>
          <span class="text-green fw-700">1 Win - 0 Losses</span>
        </div>
        <div class="h2h-row">
          <span>vs ChukwuEmeka</span>
          <span class="text-red fw-700">0 Wins - 3 Losses</span>
        </div>
      </div>
    </div>
  `;
  return renderDashLayout(html, 'dash');
}

function shareProfileLink() {
  const user = Store.getUser();
  const fakeUrl = `${window.location.origin}/profile?user=${user.name.toLowerCase()}`;
  navigator.clipboard.writeText(fakeUrl).then(() => {
    showToast('Copied profile share link to clipboard!');
  }).catch(() => {
    showToast(`Share Link: ${fakeUrl}`);
  });
}

function toggleFollowRequest(pId) {
  const btn = document.getElementById('profileFollowBtn');
  if (!btn) return;
  if (btn.innerText.includes('Request')) {
    btn.innerText = '⏳ Request Sent';
    btn.className = 'btn-ghost';
    showToast('Follow request sent (user will need to accept)');
  } else {
    btn.innerText = '➕ Request to Follow';
    btn.className = 'btn-primary';
    showToast('Follow request cancelled');
  }
}

// Views: Wallet
function renderWallet() {
  const user = Store.getUser();
  const txs = Store.state.wallet.transactions;

  const html = `
    <h2>Wallet & Monetization</h2>
    <p class="text-muted text-sm mt-1">Fund your wallet, buy points for competitions, and cash out your winnings.</p>
    
    <div class="grid-2 mt-3">
      <!-- Wallet balance & actions -->
      <div class="wallet-card">
        <div class="text-muted text-xs uppercase" style="letter-spacing:1px;">Available Funds</div>
        <div class="wallet-amount mt-1">₦${user.wallet.toLocaleString()}</div>
        
        <div class="flex gap-2 mt-3">
          <button class="btn-primary" onclick="openFundModal()">Fund Wallet</button>
          <button class="btn-ghost" onclick="openWithdrawModal()">Withdraw Cash</button>
        </div>
      </div>

      <!-- Transaction history -->
      <div class="panel">
        <h3 style="font-size:1.1rem; font-weight:700; border-bottom:1px solid var(--border); padding-bottom:0.75rem; margin-bottom:1rem;">Transaction History</h3>
        <div style="display:flex; flex-direction:column;">
          ${txs.map(t => `
            <div class="tx-row">
              <div>
                <div class="text-sm fw-700">${t.desc}</div>
                <div class="text-xs text-muted">${t.date}</div>
              </div>
              <span class="${t.type === 'credit' ? 'text-green' : 'text-red'} fw-700">
                ${t.type === 'credit' ? '+' : '-'} ₦${t.amount.toLocaleString()}
              </span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>

    <!-- Fund Wallet Modal -->
    <div class="modal-overlay hidden" id="fundModal">
      <div class="modal-box" style="max-width:360px;">
        <h3>Fund Your Wallet</h3>
        <p class="text-muted text-xs mb-2">Fund instantly using card payment, bank transfer, or USSD.</p>
        <div class="form-group mt-2">
          <label>Amount (₦)</label>
          <input type="number" id="fundAmountInput" value="2000" min="500">
        </div>
        <div class="flex gap-2 mt-3" style="justify-content:flex-end;">
          <button class="btn-ghost btn-sm" onclick="closeFundModal()">Cancel</button>
          <button class="btn-primary btn-sm" onclick="submitFunding()">Pay Now</button>
        </div>
      </div>
    </div>

    <!-- Withdraw Modal -->
    <div class="modal-overlay hidden" id="withdrawModal">
      <div class="modal-box" style="max-width:360px;">
        <h3>Withdraw to Bank</h3>
        <p class="text-muted text-xs mb-2">Transfers are processed instantly. Note: A 1.5% transactional withdrawal fee is charged.</p>
        <div class="form-group mt-2">
          <label>Amount (₦)</label>
          <input type="number" id="withdrawAmountInput" value="1000" min="500">
        </div>
        <div class="form-group">
          <label>Select Destination Bank</label>
          <select>
            <option>GTBank</option>
            <option>Access Bank</option>
            <option>Zenith Bank</option>
            <option>OPay / PalmPay</option>
          </select>
        </div>
        <div class="form-group">
          <label>Account Number</label>
          <input type="text" placeholder="0123456789">
        </div>
        <div class="flex gap-2 mt-3" style="justify-content:flex-end;">
          <button class="btn-ghost btn-sm" onclick="closeWithdrawModal()">Cancel</button>
          <button class="btn-primary btn-sm" onclick="submitWithdrawal()">Confirm Withdrawal</button>
        </div>
      </div>
    </div>
  `;
  return renderDashLayout(html, 'wallet');
}

function openFundModal() { document.getElementById('fundModal').classList.remove('hidden'); }
function closeFundModal() { document.getElementById('fundModal').classList.add('hidden'); }
function openWithdrawModal() { document.getElementById('withdrawModal').classList.remove('hidden'); }
function closeWithdrawModal() { document.getElementById('withdrawModal').classList.add('hidden'); }

function submitFunding() {
  const amt = parseInt(document.getElementById('fundAmountInput').value) || 0;
  if (amt < 500) {
    showToast('Minimum funding amount is ₦500');
    return;
  }
  const user = Store.getUser();
  user.wallet += amt;
  Store.state.wallet.transactions.unshift({
    id: Math.random(),
    type: 'credit',
    desc: 'Card Funding',
    amount: amt,
    date: new Date().toISOString().split('T')[0]
  });
  closeFundModal();
  showToast(`₦${amt.toLocaleString()} added to your wallet!`);
  navigate('wallet');
}

function submitWithdrawal() {
  const amt = parseInt(document.getElementById('withdrawAmountInput').value) || 0;
  const user = Store.getUser();
  if (amt > user.wallet) {
    showToast('Insufficient balance to withdraw this amount.');
    return;
  }
  
  // Apply transactional fee (1.5%)
  const fee = Math.floor(amt * 0.015);
  const totalDeducted = amt + fee;

  if (totalDeducted > user.wallet) {
    showToast(`Insufficient balance to cover withdrawal + 1.5% fee (₦${fee})`);
    return;
  }

  user.wallet -= totalDeducted;
  Store.state.wallet.transactions.unshift({
    id: Math.random(),
    type: 'debit',
    desc: `Bank Withdrawal (Fee: ₦${fee})`,
    amount: amt,
    date: new Date().toISOString().split('T')[0]
  });

  closeWithdrawModal();
  showToast(`₦${amt.toLocaleString()} withdrawal request sent. Processing...`);
  navigate('wallet');
}

// Views: Offline
function renderOffline() {
  const html = `
    <h2>Offline Local Gaming</h2>
    <p class="text-muted text-sm mt-1">No mobile internet? Connect with nearby friends or family using local P2P options.</p>
    
    <div class="grid-2 mt-3">
      <!-- Bluetooth P2P Connection UI -->
      <div class="panel">
        <div style="font-size:2.5rem; margin-bottom:0.5rem;">📱</div>
        <h3>Bluetooth Connection</h3>
        <p class="text-muted text-xs mt-1">Host a local game server. Nearby users with Bluetooth enabled can scan and connect.</p>
        
        <div class="panel-dark mt-2" style="text-align:center;">
          <div class="text-xs text-muted">Bluetooth scanning is mock active...</div>
          <div class="online-dot mt-1" style="background:var(--blue);"></div>
        </div>

        <div class="flex gap-2 mt-2">
          <button class="btn-primary btn-sm" onclick="showToast('Scanning for nearby devices...')">Scan Devices</button>
          <button class="btn-ghost btn-sm" onclick="showToast('Hosting local Bluetooth lobby...')">Host Match</button>
        </div>
      </div>

      <!-- Local Wifi Hotspot Connection UI -->
      <div class="panel">
        <div style="font-size:2.5rem; margin-bottom:0.5rem;">📶</div>
        <h3>WiFi Hotspot (No Internet)</h3>
        <p class="text-muted text-xs mt-1">One player creates a portable hotspot. Other players connect to that network to join the game lobby.</p>
        
        <div class="panel-dark mt-2" style="text-align:center;">
          <div class="text-xs text-muted">Hotspot ready. Connect to "NGWhot-Local" WiFi</div>
        </div>

        <button class="btn-primary btn-sm mt-2" onclick="showToast('Local WiFi Lobby established!')">Establish Local Lobby</button>
      </div>
    </div>
  `;
  return renderDashLayout(html, 'offline');
}

// Window Loader & Init
window.onload = async () => {
  // Initialize Store from local storage if available
  Store.init();
  updateNavbar();

  // A shared "join this game" link looks like ?join=<competitionId>
  const joinId = new URLSearchParams(window.location.search).get('join');

  if (typeof Auth !== 'undefined' && Auth.initAuthListener) {
    // initAuthListener returns true if a Google redirect was just processed
    // (in that case it handles navigation itself — don't override with landing)
    const wasRedirected = await Auth.initAuthListener();
    if (!wasRedirected) {
      navigate('landing');
    }
  } else {
    navigate('landing');
  }

  if (joinId) {
    if (Store.isLoggedIn() && Store.getUser().id !== 'guest' && !String(Store.getUser().id).startsWith('guest_')) {
      navigate('competitions');
      joinViaSharedLink(joinId);
    } else {
      showToast('Log in or sign up to join this game — then come back to this link.');
      navigate('auth');
    }
  }
};




