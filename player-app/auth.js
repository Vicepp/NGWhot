// NG Whot — Authentication Services (Supabase)

const Auth = {
  // Sign up with Email and Password
  async signUpEmail(email, password, username, tribe) {
    try {
      const { data, error } = await supabaseClient.auth.signUp({ email, password });
      if (error) throw error;
      const user = data.user;
      if (!user) throw new Error('Sign up failed — no user returned.');

      const userProfile = {
        id: user.id,
        username,
        email,
        avi: username.slice(0, 2).toUpperCase(),
        tribe: tribe || 'None',
        rank: 'player',
        points: 0,
        won: 0,
        lost: 0,
        played: 0,
        followers: 0,
        following: 0,
        wallet: 2500,
        last_login: new Date().toISOString()
      };

      if (!data.session) {
        // Email confirmation is required — there's no authenticated session yet, so RLS
        // would reject this insert. The profile row gets created later by
        // initAuthListener()'s hydrateFromSession() once the user confirms and logs in.
        showToast('Account created! Check your email to confirm before logging in.');
        return false;
      }

      const { error: profileErr } = await supabaseClient.from('profiles').upsert(userProfile);
      if (profileErr) throw profileErr;

      Store.login({ id: user.id, ...userProfile, name: username });
      return true;
    } catch (error) {
      console.error('Signup error:', error);
      showToast(error.message);
      return false;
    }
  },

  // Login with Email and Password
  async loginEmail(email, password) {
    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const user = data.user;

      const { data: profile, error: profileErr } = await supabaseClient.from('profiles').select('*').eq('id', user.id).single();
      if (profileErr || !profile) throw new Error('User profile not found.');

      await supabaseClient.from('profiles').update({ last_login: new Date().toISOString() }).eq('id', user.id);

      Store.login({ id: user.id, ...profile, name: profile.username });
      return true;
    } catch (error) {
      console.error('Login error:', error);
      showToast(error.message);
      return false;
    }
  },

  // Login with Google
  async loginGoogle() {
    try {
      const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.href }
      });
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Google Login error:', error);
      showToast(error.message);
      return false;
    }
  },

  // Logout
  async logout() {
    try {
      await supabaseClient.auth.signOut();
      Store.logout();
      navigate('landing');
      return true;
    } catch (error) {
      console.error('Logout error:', error);
      showToast('Error logging out.');
      return false;
    }
  },

  // Initialize auth session listener — returns a Promise resolving to true if a session was found/restored
  initAuthListener() {
    return new Promise((resolveInit) => {
      let resolved = false;
      const resolveOnce = (v) => { if (!resolved) { resolved = true; resolveInit(v); } };

      const hydrateFromSession = async (user) => {
        try {
          let { data: profile } = await supabaseClient.from('profiles').select('*').eq('id', user.id).single();

          if (!profile) {
            // OAuth (Google) first-time sign-in — no profile row yet, create one
            const username = user.user_metadata?.full_name || (user.email ? user.email.split('@')[0] : 'Player');
            profile = {
              id: user.id,
              username,
              email: user.email || '',
              avi: username.slice(0, 2).toUpperCase(),
              tribe: 'None',
              rank: 'player',
              points: 0, won: 0, lost: 0, played: 0, followers: 0, following: 0, wallet: 2500,
              last_login: new Date().toISOString()
            };
            const { error: upsertErr } = await supabaseClient.from('profiles').upsert(profile);
            if (upsertErr) console.warn('Could not write new profile:', upsertErr);
          } else {
            const { error: updateErr } = await supabaseClient.from('profiles').update({ last_login: new Date().toISOString() }).eq('id', user.id);
            if (updateErr) console.warn('Could not update last_login:', updateErr);
          }

          Store.login({ id: user.id, ...profile, name: profile.username });
          updateNavbar();

          if (['auth', 'landing'].includes(Store.state.page)) {
            if (typeof goToPendingJoinOrDashboard === 'function') {
              goToPendingJoinOrDashboard();
            } else {
              navigate('dashboard');
            }
          }
        } catch (e) {
          console.error('Error hydrating user profile from session:', e);
        }
        resolveOnce(true);
      };

      supabaseClient.auth.getSession().then(({ data }) => {
        if (data.session && data.session.user) {
          hydrateFromSession(data.session.user);
        } else {
          resolveOnce(false);
        }
      });

      supabaseClient.auth.onAuthStateChange((event, session) => {
        if (session && session.user) {
          if (!Store.isLoggedIn()) hydrateFromSession(session.user);
        } else {
          if (Store.isLoggedIn() && Store.getUser().id !== 'guest' && !String(Store.getUser().id).startsWith('guest_')) {
            Store.logout();
            updateNavbar();
            if (['dashboard', 'tournaments', 'wallet', 'competitions', 'leaderboard'].includes(Store.state.page)) {
              navigate('landing');
            }
          }
        }
      });
    });
  },

  loginGuest() {
    const guestId = 'guest_' + Math.floor(Math.random() * 10000);
    Store.login({
      id: guestId,
      name: 'Guest Player',
      avi: 'GP',
      rank: 'guest',
      points: 0, won: 0, lost: 0, played: 0,
      followers: 0, following: 0, tribe: 'None', wallet: 0
    });
    navigate('lobby');
    showToast('Logged in as Guest for offline/CPU play');
  }
};

window.Auth = Auth;
