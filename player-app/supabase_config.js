// NG Whot — Supabase Configuration
//
// Real keys live in .env (same folder as this file) — drop them in there, not here.
// Get them from Supabase Dashboard > Project Settings > API.

function _loadEnvFile() {
  try {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', '.env', false); // synchronous — runs before any later <script> tag executes
    xhr.send(null);
    if (xhr.status !== 200) throw new Error('.env not found (HTTP ' + xhr.status + ')');
    const env = {};
    xhr.responseText.split('\n').forEach(line => {
      line = line.trim();
      if (!line || line.startsWith('#')) return;
      const idx = line.indexOf('=');
      if (idx === -1) return;
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      env[key] = val;
    });
    return env;
  } catch (e) {
    console.warn('Could not load .env (are you serving over http:// rather than file://?):', e);
    return {};
  }
}

const _env = _loadEnvFile();

// Defaults below are the real project values, baked in directly so a static host that
// doesn't deploy dotfiles (Netlify Drop excludes .env by default, for example) still works.
// .env, when present, overrides these — handy for swapping projects locally without
// editing this file. The anon key is meant to be public; RLS policies are what actually
// protect the data, not hiding this value.
const SUPABASE_URL = _env.SUPABASE_URL || 'https://eqihusajvfeijgeoettc.supabase.co';
const SUPABASE_ANON_KEY = _env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxaWh1c2FqdmZlaWpnZW9ldHRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NDA0OTcsImV4cCI6MjA5NzUxNjQ5N30.GlMDgMjvPKFnX2PTeccnmodS6FTGYfXGMIeY3ZmIH5E';

// service_role key — DO NOT use this in any client-side call. It bypasses every RLS
// policy in supabase_schema.sql, so anyone who views this page's source could read,
// write, or delete every row in every table. It's only read here as a placeholder
// slot; nothing in this codebase wires it into any Supabase call.
const SUPABASE_SERVICE_ROLE_KEY = _env.SUPABASE_SERVICE_ROLE_KEY || 'YOUR_SUPABASE_SERVICE_ROLE_KEY';

// Client used by the whole app — built with the anon key only.
// Named distinctly from the `supabase` global the CDN SDK itself defines (which only
// exposes `createClient`) to avoid a redeclaration SyntaxError across script tags.
let supabaseClient;
try {
  if (!window.supabase) throw new Error('Supabase SDK script did not load (check network/ad-blocker, or a CDN block).');
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (e) {
  console.error('Failed to initialize Supabase client:', e);
  document.addEventListener('DOMContentLoaded', () => {
    const banner = document.createElement('div');
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#b00020;color:#fff;padding:10px;text-align:center;z-index:9999;font-family:sans-serif;';
    banner.textContent = '⚠️ Could not connect to the database: ' + e.message;
    document.body.appendChild(banner);
  });
}

window.supabaseClient = supabaseClient;
