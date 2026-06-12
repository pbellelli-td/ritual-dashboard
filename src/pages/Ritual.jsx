import { useEffect, useState, useMemo } from 'react';
import { api } from '../lib/api.js';

const CSAMS = ['Julia Seitz', 'Maria Mazur', 'Valentina Manta', 'Paolo Zafra', 'Reina Kurosawa', 'Piera Bellelli'];

const RAG = {
  critical: { label: '🔴 Critical', badge: 'bg-red-50 text-red-700 ring-1 ring-red-200', order: 0 },
  at_risk:  { label: '🟡 At Risk',  badge: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200', order: 1 },
  watch:    { label: '⚪ Watch',    badge: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200', order: 2 },
  none:     { label: '✅ None',     badge: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200', order: 3 },
};

function fmtDate(w) {
  if (!w) return '—';
  return new Date(w).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtWhen(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function trunc(s, n = 80) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n) + '…' : s;
}

function Metric({ label, value, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-colors ${
        active
          ? 'bg-accent text-white border-accent'
          : 'bg-white text-gray-600 border-gray-200 hover:border-accent hover:text-accent'
      }`}
    >
      <span>{label}</span>
      <span className={`font-mono font-semibold ${active ? 'text-white' : 'text-gray-900'}`}>{value}</span>
    </button>
  );
}

function NoteThread({ account, onRefresh }) {
  const [author, setAuthor] = useState(account.csam || CSAMS[0]);
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  async function add() {
    if (!body.trim() || !author.trim()) return;
    setSaving(true);
    try {
      await api.addNote(account.account_id, author, body.trim());
      setBody('');
      onRefresh();
    } catch (e) {
      alert(`Could not save: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id) {
    if (!confirm('Delete this note?')) return;
    try {
      await api.deleteNote(id);
      onRefresh();
    } catch (e) {
      alert(`Could not delete: ${e.message}`);
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Notes</p>
      <div className="space-y-2 mb-3">
        {account.notes.length === 0 && <p className="text-xs text-gray-400">No notes yet.</p>}
        {account.notes.map((n) => (
          <div key={n.id} className="flex items-start gap-2 bg-white rounded-lg px-3 py-2 ring-1 ring-gray-100">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-800">{n.author}</span>
                <span className="text-xs text-gray-400 font-mono">{fmtWhen(n.created_at)}</span>
              </div>
              <p className="text-sm text-gray-700 mt-0.5">{n.body}</p>
            </div>
            <button onClick={() => remove(n.id)} className="text-gray-300 hover:text-red-400 text-xs shrink-0">✕</button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <select
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-accent/30"
        >
          {CSAMS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && add()}
          placeholder="Add note… (e.g. called, rescheduled for Mon)"
          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-accent/30 min-w-0"
        />
        <button
          onClick={add}
          disabled={saving || !body.trim()}
          className="px-3 py-1.5 bg-accent hover:bg-accent-dark text-white text-sm font-medium rounded-lg disabled:opacity-50 shrink-0"
        >
          {saving ? '…' : 'Add'}
        </button>
      </div>
    </div>
  );
}

function AccountRow({ account, onToggleContacted, onRefresh }) {
  const [open, setOpen] = useState(false);
  const rag = RAG[account.rag] || RAG.none;

  return (
    <div className={`bg-white rounded-xl ring-1 ring-gray-100 shadow-sm overflow-hidden transition-opacity ${account.contacted ? 'opacity-60' : ''}`}>
      <div className="px-4 py-3 flex items-start gap-3">
        {/* Contacted checkbox */}
        <div className="pt-0.5">
          <input
            type="checkbox"
            checked={account.contacted}
            onChange={() => onToggleContacted(account)}
            className="w-4 h-4 rounded border-gray-300 text-accent focus:ring-accent/30 cursor-pointer"
            title="Mark as contacted"
          />
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="font-semibold text-gray-900 text-sm">{account.account_name}</span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-medium ${rag.badge}`}>
              {rag.label}
            </span>
            {account.arr && account.arr !== '—' && (
              <span className="text-xs font-mono text-gray-400">{account.arr}</span>
            )}
            {account.notes.length > 0 && (
              <span className="text-xs text-accent font-medium">💬 {account.notes.length}</span>
            )}
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500 mb-1.5">
            <span><span className="text-gray-400">CSAM:</span> {account.csam}</span>
            <span><span className="text-gray-400">Market:</span> {account.market || '—'}</span>
            <span><span className="text-gray-400">Login:</span> {account.last_login || '—'}</span>
            <span><span className="text-gray-400">Contact:</span> {account.last_contact || '—'}</span>
          </div>

          {account.expansion && (
            <p className="text-xs text-blue-700 mb-0.5">🚀 {trunc(account.expansion)}</p>
          )}
          {account.churn && (
            <p className="text-xs text-red-700 mb-0.5">⚠️ {trunc(account.churn)}</p>
          )}

          <p className="text-xs text-gray-500 italic">{account.action}</p>

          {open && <NoteThread account={account} onRefresh={onRefresh} />}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <a
            href={account.hubspot_url}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-gray-400 hover:text-accent font-medium"
            title="Open in HubSpot"
          >
            ↗ HubSpot
          </a>
          <button
            onClick={() => setOpen((o) => !o)}
            className="text-xs text-accent hover:text-accent-dark font-medium"
          >
            {open ? 'Close' : 'Notes'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Ritual() {
  const [weekOf, setWeekOf] = useState(null);
  const [weeks, setWeeks] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [filterCsam, setFilterCsam] = useState('');
  const [filterRag, setFilterRag] = useState('');
  const [filterSignal, setFilterSignal] = useState('');
  const [search, setSearch] = useState('');

  function load(week) {
    setLoading(true);
    setError(null);
    api.getRitual(week)
      .then((d) => { setWeekOf(d.week_of); setAccounts(d.accounts || []); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    api.getWeeks().then(setWeeks).catch(() => {});
    load();
  }, []);

  async function toggleContacted(account) {
    const next = !account.contacted;
    setAccounts((prev) => prev.map((a) =>
      a.account_id === account.account_id ? { ...a, contacted: next } : a
    ));
    try {
      await api.setContacted(account.account_id, next, account.csam);
    } catch (e) {
      setAccounts((prev) => prev.map((a) =>
        a.account_id === account.account_id ? { ...a, contacted: !next } : a
      ));
      alert(`Error: ${e.message}`);
    }
  }

  const counts = useMemo(() => {
    const c = { critical: 0, at_risk: 0, watch: 0, expansion: 0, churn: 0, contacted: 0 };
    for (const a of accounts) {
      if (c[a.rag] !== undefined) c[a.rag]++;
      if (a.expansion) c.expansion++;
      if (a.churn) c.churn++;
      if (a.contacted) c.contacted++;
    }
    return c;
  }, [accounts]);

  const topSignals = useMemo(() => {
    const sig = [];
    for (const a of accounts) {
      if (a.churn) sig.push({ type: 'churn', account: a.account_name, csam: a.csam, text: a.churn });
      if (a.expansion) sig.push({ type: 'expansion', account: a.account_name, csam: a.csam, text: a.expansion });
    }
    return sig.sort((x) => x.type === 'churn' ? -1 : 1).slice(0, 3);
  }, [accounts]);

  const filtered = useMemo(() => {
    let list = [...accounts];
    if (filterCsam) list = list.filter((a) => a.csam === filterCsam);
    if (filterRag) list = list.filter((a) => a.rag === filterRag);
    if (filterSignal === 'expansion') list = list.filter((a) => a.expansion);
    if (filterSignal === 'churn') list = list.filter((a) => a.churn);
    if (filterSignal === 'contacted') list = list.filter((a) => a.contacted);
    if (filterSignal === 'uncontacted') list = list.filter((a) => !a.contacted);
    if (search) list = list.filter((a) => a.account_name.toLowerCase().includes(search.toLowerCase()));
    return list.sort((a, b) => {
      const ro = (RAG[a.rag]?.order ?? 9) - (RAG[b.rag]?.order ?? 9);
      return ro !== 0 ? ro : (b.score ?? 0) - (a.score ?? 0);
    });
  }, [accounts, filterCsam, filterRag, filterSignal, search]);

  const hasFilters = filterCsam || filterRag || filterSignal || search;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-gray-400 text-sm animate-pulse">Loading ritual data…</div>
    </div>
  );

  if (error) return (
    <div className="max-w-xl mx-auto mt-16 p-6 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
      <strong>Could not load ritual data.</strong>
      <p className="mt-1 font-mono text-xs break-all">{error}</p>
    </div>
  );

  return (
    <div className="max-w-screen-lg mx-auto px-4 py-8">
      {/* Header row */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Week of {fmtDate(weekOf)}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{accounts.length} flagged accounts · {counts.contacted} contacted</p>
        </div>
        {weeks.length > 1 && (
          <select
            value={weekOf || ''}
            onChange={(e) => load(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent/30"
          >
            {weeks.map((w) => <option key={w} value={w}>Week of {fmtDate(w)}</option>)}
          </select>
        )}
      </div>

      {/* Top 3 signals */}
      {topSignals.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Top signals this week</p>
          <div className="grid gap-3 md:grid-cols-3">
            {topSignals.map((s, i) => (
              <div key={i} className={`rounded-xl p-4 ring-1 ${s.type === 'churn' ? 'bg-red-50/60 ring-red-200' : 'bg-blue-50/60 ring-blue-200'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span>{s.type === 'churn' ? '⚠️' : '🚀'}</span>
                  <span className="font-semibold text-gray-900 text-sm">{s.account}</span>
                </div>
                <p className="text-xs text-gray-500 mb-1">{s.csam}</p>
                <p className="text-xs text-gray-700 leading-relaxed">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metric strip */}
      <div className="flex flex-wrap gap-2 mb-5">
        <Metric label="🔴 Critical" value={counts.critical} active={filterRag === 'critical'} onClick={() => setFilterRag(filterRag === 'critical' ? '' : 'critical')} />
        <Metric label="🟡 At Risk" value={counts.at_risk} active={filterRag === 'at_risk'} onClick={() => setFilterRag(filterRag === 'at_risk' ? '' : 'at_risk')} />
        <Metric label="⚪ Watch" value={counts.watch} active={filterRag === 'watch'} onClick={() => setFilterRag(filterRag === 'watch' ? '' : 'watch')} />
        <Metric label="🚀 Expansion" value={counts.expansion} active={filterSignal === 'expansion'} onClick={() => setFilterSignal(filterSignal === 'expansion' ? '' : 'expansion')} />
        <Metric label="⚠️ Churn/Risk" value={counts.churn} active={filterSignal === 'churn'} onClick={() => setFilterSignal(filterSignal === 'churn' ? '' : 'churn')} />
        <Metric label="✓ Contacted" value={counts.contacted} active={filterSignal === 'contacted'} onClick={() => setFilterSignal(filterSignal === 'contacted' ? '' : 'contacted')} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <select
          value={filterCsam}
          onChange={(e) => setFilterCsam(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent/30"
        >
          <option value="">All CSAMs</option>
          {CSAMS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search account…"
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 w-48"
        />
        {hasFilters && (
          <button
            onClick={() => { setFilterCsam(''); setFilterRag(''); setFilterSignal(''); setSearch(''); }}
            className="text-xs text-gray-400 hover:text-gray-600 px-2"
          >
            Clear all
          </button>
        )}
        <span className="ml-auto text-xs text-gray-400 self-center">{filtered.length} shown</span>
      </div>

      {/* Account cards */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">
            {hasFilters ? 'No accounts match your filters.' : 'No data for this week yet.'}
          </div>
        )}
        {filtered.map((a) => (
          <AccountRow
            key={a.account_id}
            account={a}
            onToggleContacted={toggleContacted}
            onRefresh={() => load(weekOf)}
          />
        ))}
      </div>
    </div>
  );
}
