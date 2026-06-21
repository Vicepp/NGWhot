// NG Whot — App State Store
const Store = {
  state: {
    user: null,
    gameState: null,
    gameOpts: { 
      includeWhot: true, 
      holdOnCard: 1, 
      timerMode: 'rapid', 
      playerCount: 2,
      cardConfig: {
        pickTwo:      { num: 2,  win: true,  defend: true },
        pickThree:    { num: 5,  win: true,  defend: true },
        genMarket:    { num: 14, win: true,  defend: true },
        holdOn:       { num: 1,  win: true,  defend: false },
        suspension:   { num: 8,  win: true,  defend: false },
        crown:        { num: 20, win: true,  defend: false }
      }
    },
    page: 'landing',
    pageArg: null,
    notifications: [
      { id:1, text:'🏆 Weekend Tournament starts in 2 hours!', time:'1h ago' },
      { id:2, text:'👤 ChukwuEmeka wants to follow you', time:'3h ago' },
      { id:3, text:'🎮 Your game invite expired', time:'5h ago' }
    ],
    wallet: { balance: 2500, transactions: [
      { id:1, type:'credit', desc:'Welcome bonus', amount:500, date:'2026-06-10' },
      { id:2, type:'credit', desc:'Tournament win', amount:2000, date:'2026-06-11' }
    ]},
    leaderboard: {
      daily: [], weekly: [], monthly: []
    },
    players: [
      { id:'p1', name:'ChukwuEmeka', avi:'CE', rank:'legend', points:28400, won:312, lost:88, played:400, followers:1240, tribe:'Igbo', online:true },
      { id:'p2', name:'Adunola', avi:'AD', rank:'master', points:18200, won:245, lost:120, played:365, followers:890, tribe:'Yoruba', online:true },
      { id:'p3', name:'Garba', avi:'GB', rank:'expert', points:9800, won:180, lost:100, played:280, followers:420, tribe:'Hausa', online:false },
      { id:'p4', name:'Effiong', avi:'EF', rank:'expert', points:7600, won:140, lost:95, played:235, followers:310, tribe:'Efik', online:true },
      { id:'p5', name:'Bola', avi:'BL', rank:'skilled', points:3200, won:80, lost:70, played:150, followers:120, tribe:'Yoruba', online:false },
      { id:'p6', name:'Amaka', avi:'AK', rank:'player', points:900, won:30, lost:45, played:75, followers:55, tribe:'Igbo', online:true }
    ],
    competitions: [
      { id:'c1', name:'Daily Rush', type:'daily', prize:'200 pts', players:48, maxPlayers:64, public:true, entry:'free', ends:'in 6h', tribe:null },
      { id:'c2', name:'Weekend Warrior', type:'weekend', prize:'₦5,000', players:32, maxPlayers:64, public:true, entry:'free', ends:'Sun 11PM', tribe:null },
      { id:'c3', name:'Igbo Masters', type:'tribe', prize:'1000 pts', players:24, maxPlayers:32, public:true, entry:'free', ends:'in 3 days', tribe:'Igbo' },
      { id:'c4', name:'Yoruba Champions', type:'tribe', prize:'1000 pts', players:18, maxPlayers:32, public:true, entry:'free', ends:'in 3 days', tribe:'Yoruba' },
      { id:'c5', name:'Hausa Warriors', type:'tribe', prize:'1000 pts', players:22, maxPlayers:32, public:true, entry:'free', ends:'in 3 days', tribe:'Hausa' },
      { id:'c6', name:'Efik League', type:'tribe', prize:'1000 pts', players:14, maxPlayers:32, public:true, entry:'free', ends:'in 3 days', tribe:'Efik' },
      { id:'c7', name:'Monthly King', type:'monthly', prize:'₦50,000', players:128, maxPlayers:256, public:true, entry:'free', ends:'Jun 30', tribe:null },
      { id:'c8', name:'Pro Cash Cup', type:'paid', prize:'₦20,000', players:16, maxPlayers:16, public:false, entry:'₦500', ends:'Today 8PM', tribe:null, private:true },
      { id:'c9', name:'Chukwu\'s 1v1 Challenge', type:'user', prize:'₦2,000', players:2, maxPlayers:2, public:false, entry:'₦1,000', ends:'Now', tribe:null, private:true, creator:'ChukwuEmeka' }
    ],
    tournaments: [
      { id:'t1', name:'NG Whot Open', status:'live', players:['ChukwuEmeka','Adunola','Garba','Effiong'], rounds:[{matches:[{p1:'ChukwuEmeka',p2:'Garba',winner:'ChukwuEmeka'},{p1:'Adunola',p2:'Effiong',winner:'Adunola'}]},{matches:[{p1:'ChukwuEmeka',p2:'Adunola',winner:null}]}] },
      { id:'t2', name:'Weekend Blitz', status:'upcoming', players:['You','...3 others'], starts:'Tomorrow 3PM' },
      { id:'t3', name:'Tribe Wars Q2', status:'upcoming', players:['64 players'], starts:'Jun 15' }
    ]
  },

  getUser() { return this.state.user; },
  isLoggedIn() { return !!this.state.user; },

  login(userObj) {
    this.state.user = userObj;
    // Persist to local storage for quick initial load next time
    localStorage.setItem('ngwhot_user', JSON.stringify(userObj));
    return this.state.user;
  },

  logout() {
    this.state.user = null;
    localStorage.removeItem('ngwhot_user');
  },

  // Persist in-memory edits to the user object (e.g. won/lost/points bumped after a match)
  // to localStorage immediately, and to Supabase in the background if this is a real account.
  saveUser(userObj) {
    this.state.user = userObj;
    localStorage.setItem('ngwhot_user', JSON.stringify(userObj));
    if (typeof supabaseClient !== 'undefined' && userObj.id && !String(userObj.id).startsWith('guest_')) {
      supabaseClient.from('profiles').update({
        won: userObj.won, lost: userObj.lost, played: userObj.played, points: userObj.points
      }).eq('id', userObj.id).then(({ error }) => {
        if (error) console.warn('Could not sync user stats to Supabase:', error);
      });
    }
  },

  init() {
    // Attempt to load from local storage immediately so UI doesn't flicker
    // Auth state listener will confirm and update this
    const stored = localStorage.getItem('ngwhot_user');
    if (stored) {
      try {
        this.state.user = JSON.parse(stored);
      } catch(e) {}
    }
  },

  getNotifications() { return this.state.notifications; },
  clearNotifications() { this.state.notifications = []; },

  getLB(period) {
    return this.state.players.slice().sort((a,b) => b.points - a.points);
  },

  getCompetitions() { return this.state.competitions; },
  getTournaments() { return this.state.tournaments; },
  getPlayers() { return this.state.players; },
  getPlayer(id) { return this.state.players.find(p => p.id === id); },

  setGameOpts(opts) { this.state.gameOpts = { ...this.state.gameOpts, ...opts }; },
  getGameOpts() { return this.state.gameOpts; }
};

window.Store = Store;
