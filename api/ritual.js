import { supabase, cors } from './_supabase.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const week = req.query?.week;

    // Get latest week if none specified
    let weekOf = week;
    if (!weekOf) {
      const weeks = await supabase('ritual_accounts', {
        params: { select: 'week_of', order: 'week_of.desc', limit: 1 },
      });
      if (!weeks.length) return res.json({ week_of: null, accounts: [] });
      weekOf = weeks[0].week_of;
    }

    // Get accounts for that week
    const accounts = await supabase('ritual_accounts', {
      params: { select: '*', week_of: `eq.${weekOf}`, order: 'score.desc' },
    });

    if (!accounts.length) return res.json({ week_of: weekOf, accounts: [] });

    const ids = accounts.map((a) => a.account_id);

    // Get notes + contacted in parallel
    const [notes, contacted] = await Promise.all([
      supabase('ritual_notes', {
        params: { select: '*', account_id: `in.(${ids.join(',')})`, order: 'created_at.asc' },
      }),
      supabase('ritual_contacted', { params: { select: '*' } }),
    ]);

    // Merge
    const notesByAccount = {};
    for (const n of notes) (notesByAccount[n.account_id] ||= []).push(n);

    const contactedMap = {};
    for (const c of contacted) contactedMap[c.account_id] = c;

    const merged = accounts.map((a) => ({
      ...a,
      notes: notesByAccount[a.account_id] || [],
      contacted: contactedMap[a.account_id]?.contacted || false,
      contacted_by: contactedMap[a.account_id]?.contacted_by || null,
      contacted_at: contactedMap[a.account_id]?.contacted_at || null,
    }));

    res.json({ week_of: weekOf, accounts: merged });
  } catch (err) {
    console.error('[/api/ritual]', err.message);
    res.status(500).json({ error: err.message });
  }
}
