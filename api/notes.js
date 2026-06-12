import { supabase, cors } from './_supabase.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'POST') {
      const { account_id, author, body } = req.body;
      if (!account_id || !author || !body) {
        return res.status(400).json({ error: 'account_id, author, body required' });
      }
      const data = await supabase('ritual_notes', {
        method: 'POST',
        body: [{ account_id, author, body }],
        prefer: 'return=representation',
      });
      return res.json(data[0]);
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'id required' });
      await supabase('ritual_notes', {
        method: 'DELETE',
        params: { id: `eq.${id}` },
      });
      return res.json({ ok: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[/api/notes]', err.message);
    res.status(500).json({ error: err.message });
  }
}
