import { supabase, cors } from './_supabase.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { account_id, contacted, contacted_by } = req.body;
    if (!account_id) return res.status(400).json({ error: 'account_id required' });

    const data = await supabase('ritual_contacted', {
      method: 'POST',
      params: { on_conflict: 'account_id' },
      body: [{
        account_id,
        contacted: !!contacted,
        contacted_by: contacted ? contacted_by : null,
        contacted_at: contacted ? new Date().toISOString() : null,
      }],
      prefer: 'resolution=merge-duplicates,return=representation',
    });
    res.json(data[0]);
  } catch (err) {
    console.error('[/api/contacted]', err.message);
    res.status(500).json({ error: err.message });
  }
}
