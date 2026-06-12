const base = '/api';

async function req(path, opts = {}) {
  const res = await fetch(`${base}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text || res.statusText);
  return text ? JSON.parse(text) : null;
}

export const api = {
  getRitual: (week) => req(`/ritual${week ? `?week=${week}` : ''}`),
  getWeeks: () => req('/weeks'),
  addNote: (account_id, author, body) => req('/notes', { method: 'POST', body: { account_id, author, body } }),
  deleteNote: (id) => req(`/notes?id=${id}`, { method: 'DELETE' }),
  setContacted: (account_id, contacted, contacted_by) =>
    req('/contacted', { method: 'POST', body: { account_id, contacted, contacted_by } }),
};
