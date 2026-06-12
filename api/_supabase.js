// Shared Supabase helper — native fetch, no dependencies.
// Used by all /api/* serverless functions.

export function getEnv() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_ANON_KEY not set');
  return { url, key };
}

export async function supabase(path, { method = 'GET', params = {}, body, prefer } = {}) {
  const { url, key } = getEnv();
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  const fullUrl = `${url}/rest/v1/${path}${qs ? '?' + qs : ''}`;
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (prefer) headers['Prefer'] = prefer;

  const res = await fetch(fullUrl, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${method} /${path} [${res.status}]: ${text}`);
  return text ? JSON.parse(text) : [];
}

export function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}
