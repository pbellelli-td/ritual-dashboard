import { supabase, cors } from './_supabase.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    const data = await supabase('ritual_accounts', {
      params: { select: 'week_of', order: 'week_of.desc' },
    });
    const weeks = [...new Set(data.map((r) => r.week_of))];
    res.json(weeks);
  } catch (err) {
    console.error('[/api/weeks]', err.message);
    res.status(500).json({ error: err.message });
  }
}
