// Direct Supabase client — called from browser, no backend needed.
// Uses anon key + RLS disabled (internal tool).

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

let _session = null;

function getKey() {
  return _session?.access_token || SUPABASE_ANON_KEY;
}

async function supa(path, { method = 'GET', params = {}, body, prefer } = {}) {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  const url = `${SUPABASE_URL}/rest/v1/${path}${qs ? '?' + qs : ''}`;
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${getKey()}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (prefer) headers['Prefer'] = prefer;
  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`[${res.status}] ${text}`);
  return text ? JSON.parse(text) : [];
}

// ── Auth ───────────────────────────────────────────────────────────
export async function signIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.message || 'Login failed');
  _session = data;
  localStorage.setItem('ritual_session', JSON.stringify(data));
  return data;
}

export async function signOut() {
  try {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${getKey()}` },
    });
  } catch (_) {}
  _session = null;
  localStorage.removeItem('ritual_session');
}

export function loadSession() {
  try {
    const raw = localStorage.getItem('ritual_session');
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (s.expires_at && Date.now() / 1000 > s.expires_at) {
      localStorage.removeItem('ritual_session');
      return null;
    }
    _session = s;
    return s;
  } catch (_) {
    return null;
  }
}

export function getCurrentUser() {
  return _session?.user || null;
}

export function getUserName(user) {
  if (!user) return '';
  const email = user.email || '';
  const map = {
    'pbellelli@taxdome.com': 'Piera Bellelli',
    'jseitz@taxdome.com': 'Julia Seitz',
    'mmazur@taxdome.com': 'Maria Mazur',
    'vmanta@taxdome.com': 'Valentina Manta',
    'pzafra@taxdome.com': 'Paolo Zafra',
    'rkurosawa@taxdome.com': 'Reina Kurosawa',
  };
  return map[email] || email.split('@')[0];
}

// ── Ritual data ────────────────────────────────────────────────────
export async function getWeeks() {
  const data = await supa('ritual_accounts', {
    params: { select: 'week_of', order: 'week_of.desc' },
  });
  return [...new Set(data.map((r) => r.week_of))];
}

export async function getRitual(weekOf) {
  let wk = weekOf;
  if (!wk) {
    const weeks = await getWeeks();
    if (!weeks.length) return { week_of: null, accounts: [] };
    wk = weeks[0];
  }

  const accounts = await supa('ritual_accounts', {
    params: { select: '*', week_of: `eq.${wk}`, order: 'score.desc' },
  });
  if (!accounts.length) return { week_of: wk, accounts: [] };

  const ids = accounts.map((a) => a.account_id);

  const [notes, contacted] = await Promise.all([
    supa('ritual_notes', {
      params: {
        select: '*',
        account_id: `in.(${ids.join(',')})`,
        order: 'created_at.asc',
      },
    }),
    // v2: filter ritual_contacted by week_of so history is preserved across weeks
    supa('ritual_contacted', {
      params: {
        select: '*',
        week_of: `eq.${wk}`,
        account_id: `in.(${ids.join(',')})`,
      },
    }),
  ]);

  const notesByAccount = {};
  for (const n of notes) (notesByAccount[n.account_id] ||= []).push(n);

  const contactedMap = {};
  for (const c of contacted) contactedMap[c.account_id] = c;

  return {
    week_of: wk,
    accounts: accounts.map((a) => ({
      ...a,
      notes: notesByAccount[a.account_id] || [],
      contacted: contactedMap[a.account_id]?.contacted || false,
      contacted_by: contactedMap[a.account_id]?.contacted_by || null,
      contacted_at: contactedMap[a.account_id]?.contacted_at || null,
    })),
  };
}

export async function addNote(account_id, author, body) {
  const data = await supa('ritual_notes', {
    method: 'POST',
    body: [{ account_id, author, body }],
    prefer: 'return=representation',
  });
  return data[0];
}

export async function deleteNote(id) {
  await supa('ritual_notes', { method: 'DELETE', params: { id: `eq.${id}` } });
  return { ok: true };
}

// v2: now requires week_of to scope contacted flag per week
export async function setContacted(account_id, week_of, contacted, contacted_by) {
  const data = await supa('ritual_contacted', {
    method: 'POST',
    params: { on_conflict: 'account_id,week_of' },
    body: [{
      account_id,
      week_of,
      contacted,
      contacted_by: contacted ? contacted_by : null,
      contacted_at: contacted ? new Date().toISOString() : null,
    }],
    prefer: 'resolution=merge-duplicates,return=representation',
  });
  return data[0];
}
