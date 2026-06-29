import { useEffect, useState, useMemo } from 'react';
import { getRitual, getWeeks, addNote, deleteNote, setContacted, getUserName } from '../lib/supabase.js';

const CSAMS = ['Julia Seitz', 'Maria Mazur', 'Valentina Manta', 'Paolo Zafra', 'Reina Kurosawa', 'Piera Bellelli'];

const RAG = {
  critical: { label: 'Critical', emoji: '🔴', badge: 'bg-red-50 text-red-700 ring-1 ring-red-200', bar: 'bg-red-400', order: 0 },
  at_risk:  { label: 'At Risk',  emoji: '🟡', badge: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200', bar: 'bg-amber-400', order: 1 },
  watch:    { label: 'Watch',    emoji: '⚪', badge: 'bg-slate-50 text-slate-600 ring-1 ring-slate-200', bar: 'bg-slate-300', order: 2 },
  churned:  { label: 'Churned',  emoji: '⛔', badge: 'bg-gray-50 text-gray-500 ring-1 ring-gray-200', bar: 'bg-gray-300', order: 3 },
  none:     { label: 'None',     emoji: '✅', badge: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200', bar: 'bg-emerald-300', order: 4 },
};

const SIGNAL = {
  expansion:  { label: 'Expansion',  emoji: '🚀', color: 'text-blue-600 bg-blue-50 ring-blue-200' },
  churn_risk: { label: 'Churn Risk', emoji: '⚠️', color: 'text-red-600 bg-red-50 ring-red-200' },
  both:       { label: 'Both',       emoji: '🔥', color: 'text-orange-600 bg-orange-50 ring-orange-200' },
  standard:   { label: '',           emoji: '',   color: '' },
};

function fmtDate(w) {
  if (!w) return '—';
  return new Date(w).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtWhen(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function trunc(s, n = 90) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n) + '…' : s;
}

// Score bar — max score is ~125 points
function ScoreBar({ score }) {
  if (!score) return null;
  const pct = Math.min(100, Math.round((score / 125) * 100));
  const color = score >= 60 ? 'bg-red-400' : score >= 30 ? 'bg-amber-400' : 'bg-slate-300';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-gray-400">{score}</span>
    </div>
  );
}

// Renewal pill
function RenewalPill({ days }) {
  if (!days) return null;
  const urgent = days <= 30;
  const soon = days <= 90;
  if (!soon) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono ring-1 ${
      urgent ? 'bg-red-50 text-red-600 ring-red-200' : 'bg-amber-50 text-amber-600 ring-amber-200'
    }`}>
      🗓 {days}d
    </span>
  );
}

function StatCard({ emoji, label, value, active, onClick, color }) {
  return (
    <button onClick={onClick}
      className={`flex flex-col items-start px-4 py-3 rounded-xl border transition-all text-left ${
        active
          ? `${color} border-transparent shadow-sm`
          : 'bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm'
      }`}>
      <span className="text-lg leading-none mb-1">{emoji}</span>
      <span className={`text-2xl font-bold font-mono leading-none ${active ? '' : 'text-gray-900'}`}>{value}</span>
      <span className={`text-xs mt-0.5 ${active ? 'opacity-80' : 'text-gray-400'}`}>{label}</span>
    </button>
  );
}

function NoteThread({ account, authorName, onRefresh }) {
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  async function add() {
    if (!body.trim()) return;
    setSaving(true);
    try {
      await addNote(account.account_id, authorName, body.trim());
      setBody('');
      onRefresh();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  }

  async function remove(id) {
    if (!confirm('Delete this note?')) return;
    try { await deleteNote(id); onRefresh(); }
    catch (e) { alert(e.message); }
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Notes</p>
      <div className="space-y-2 mb-3">
        {account.notes.length === 0 && <p className="text-xs text-gray-400 italic">No notes yet.</p>}
        {account.notes.map((n) => (
          <div key={n.id} className="flex items-start gap-2 bg-gray-50 rounded-lg px-3 py-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-semibold text-gray-700">{n.author}</span>
                <span className="text-xs text-gray-400 font-mono">{fmtWhen(n.created_at)}</span>
              </div>
              <p className="text-sm text-gray-700">{n.body}</p>
            </div>
            <button onClick={() => remove(n.id)} className="text-gray-300 hover:text-red-400 text-xs shrink-0 mt-0.5">✕</button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <span className="text-xs text-gray-400 self-center shrink-0">{authorName}</span>
        <input value={body} onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && add()}
          placeholder="Add note… (Enter to save)"
          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 min-w-0" />
        <button onClick={add} disabled={saving || !body.trim()}
          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg disabled:opacity-40 shrink-0 transition-colors">
          {saving ? '…' : 'Save'}
        </button>
      </div>
    </div>
  );
}

function AccountRow({ account, authorName, onToggleContacted, onRefresh }) {
  const [open, setOpen] = useState(false);
  const rag = RAG[account.rag] || RAG.none;
  const sig = SIGNAL[account.signal_type] || SIGNAL.standard;
  const isChurned = account.rag === 'churned';

  return (
    <div className={`bg-white rounded-xl border transition-all ${
      account.contacted ? 'border-gray-100 opacity-60' : 
      account.rag === 'critical' ? 'border-red-100 shadow-sm' : 'border-gray-100'
    }`}>
      {/* Left accent bar */}
      <div className="flex">
        <div className={`w-1 rounded-l-xl shrink-0 ${rag.bar}`} />
        <div className="flex-1 px-4 py-3">
          <div className="flex items-start gap-3">
            {/* Checkbox */}
            {!isChurned && (
              <div className="pt-0.5 shrink-0">
                <input type="checkbox" checked={account.contacted} onChange={() => onToggleContacted(account)}
                  className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-200 cursor-pointer" />
              </div>
            )}

            {/* Main content */}
            <div className="flex-1 min-w-0">
              {/* Row 1: Name + badges */}
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span className="font-semibold text-gray-900 text-sm">{account.account_name}</span>

                {/* RAG badge */}
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${rag.badge}`}>
                  {rag.emoji} {rag.label}
                </span>

                {/* Signal type badge */}
                {sig.emoji && (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ring-1 ${sig.color}`}>
                    {sig.emoji} {sig.label}
                  </span>
                )}

                {/* Renewal pill */}
                <RenewalPill days={account.renewal_days} />

                {/* ARR */}
                {account.arr && account.arr !== '—' && (
                  <span className="text-xs font-mono text-gray-400 bg-gray-50 px-2 py-0.5 rounded-md">{account.arr}</span>
                )}

                {/* Notes count */}
                {account.notes?.length > 0 && (
                  <span className="text-xs text-indigo-500 font-medium">💬 {account.notes.length}</span>
                )}

                {/* Contacted by */}
                {account.contacted && account.contacted_by && (
                  <span className="text-xs text-emerald-600 font-medium">✓ {account.contacted_by}</span>
                )}
              </div>

              {/* Row 2: Meta */}
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-400 mb-2">
                <span><span className="text-gray-300">CSAM</span> {account.csam}</span>
                <span><span className="text-gray-300">Market</span> {account.market || '—'}</span>
                <span><span className="text-gray-300">Login</span> {account.last_login || '—'}</span>
                <span><span className="text-gray-300">Contact</span> {account.last_contact || '—'}</span>
                {account.score && <ScoreBar score={account.score} />}
              </div>

              {/* Row 3: Signals */}
              {account.expansion && (
                <div className="flex items-start gap-1.5 mb-1">
                  <span className="text-xs mt-px">🚀</span>
                  <p className="text-xs text-blue-700">{trunc(account.expansion)}</p>
                </div>
              )}
              {account.churn && (
                <div className="flex items-start gap-1.5 mb-1">
                  <span className="text-xs mt-px">⚠️</span>
                  <p className="text-xs text-red-700">{trunc(account.churn)}</p>
                </div>
              )}
              {account.check_firms_summary && (
                <div className="flex items-start gap-1.5 mb-1">
                  <span className="text-xs mt-px">📋</span>
                  <p className="text-xs text-gray-500 italic">{trunc(account.check_firms_summary, 120)}</p>
                </div>
              )}

              {/* Row 4: Action */}
              <p className="text-xs text-gray-500 bg-gray-50 rounded-md px-2.5 py-1.5 mt-1">{account.action}</p>

              {/* Notes thread */}
              {open && <NoteThread account={account} authorName={authorName} onRefresh={onRefresh} />}
            </div>

            {/* Right actions */}
            <div className="flex flex-col items-end gap-2 shrink-0">
              {account.hubspot_url && (
                <a href={account.hubspot_url} target="_blank" rel="noreferrer"
                  className="text-xs text-gray-300 hover:text-indigo-400 transition-colors" title="Open in HubSpot">
                  HubSpot ↗
                </a>
              )}
              <button onClick={() => setOpen((o) => !o)}
                className="text-xs text-indigo-500 hover:text-indigo-700 font-medium transition-colors">
                {open ? 'Close' : `Notes${account.notes?.length ? ` (${account.notes.length})` : ''}`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Ritual({ currentUser }) {
  const authorName = getUserName(currentUser);
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
    setLoading(true); setError(null);
    getRitual(week)
      .then((d) => { setWeekOf(d.week_of); setAccounts(d.accounts || []); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    getWeeks().then(setWeeks).catch(() => {});
    load();
  }, []);

  async function toggleContacted(account) {
    const next = !account.contacted;
    setAccounts((prev) => prev.map((a) =>
      a.account_id === account.account_id ? { ...a, contacted: next, contacted_by: next ? authorName : null } : a
    ));
    try { await setContacted(account.account_id, weekOf, next, authorName); }
    catch (e) {
      setAccounts((prev) => prev.map((a) => a.account_id === account.account_id ? { ...a, contacted: !next } : a));
      alert(e.message);
    }
  }

  const counts = useMemo(() => {
    const c = { critical: 0, at_risk: 0, watch: 0, churned: 0, expansion: 0, churn_risk: 0, both: 0, contacted: 0, total: 0 };
    for (const a of accounts) {
      c.total++;
      if (c[a.rag] !== undefined) c[a.rag]++;
      if (a.signal_type === 'expansion') c.expansion++;
      if (a.signal_type === 'churn_risk') c.churn_risk++;
      if (a.signal_type === 'both') { c.expansion++; c.churn_risk++; c.both++; }
      if (a.contacted) c.contacted++;
    }
    return c;
  }, [accounts]);

  const contactedPct = counts.total > 0 ? Math.round((counts.contacted / (counts.total - counts.churned)) * 100) : 0;

  const topSignals = useMemo(() => {
    const sig = [];
    for (const a of accounts) {
      if (a.rag === 'critical' && a.churn) sig.push({ type: 'churn', account: a.account_name, csam: a.csam, text: a.churn, rag: a.rag });
      if (a.signal_type === 'expansion' || a.signal_type === 'both') sig.push({ type: 'expansion', account: a.account_name, csam: a.csam, text: a.expansion, rag: a.rag });
    }
    return sig.sort((x) => x.type === 'churn' ? -1 : 1).slice(0, 3);
  }, [accounts]);

  const filtered = useMemo(() => {
    let list = [...accounts];
    if (filterCsam) list = list.filter((a) => a.csam === filterCsam);
    if (filterRag) list = list.filter((a) => a.rag === filterRag);
    if (filterSignal === 'expansion') list = list.filter((a) => a.signal_type === 'expansion' || a.signal_type === 'both');
    if (filterSignal === 'churn_risk') list = list.filter((a) => a.signal_type === 'churn_risk' || a.signal_type === 'both');
    if (filterSignal === 'contacted') list = list.filter((a) => a.contacted);
    if (filterSignal === 'uncontacted') list = list.filter((a) => !a.contacted && a.rag !== 'churned');
    if (search) list = list.filter((a) => a.account_name?.toLowerCase().includes(search.toLowerCase()));
    return list.sort((a, b) => {
      const ro = (RAG[a.rag]?.order ?? 9) - (RAG[b.rag]?.order ?? 9);
      return ro !== 0 ? ro : (b.score ?? 0) - (a.score ?? 0);
    });
  }, [accounts, filterCsam, filterRag, filterSignal, search]);

  const hasFilters = filterCsam || filterRag || filterSignal || search;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="text-2xl mb-2 animate-pulse">📋</div>
        <div className="text-gray-400 text-sm">Loading ritual data…</div>
      </div>
    </div>
  );

  if (error) return (
    <div className="max-w-xl mx-auto mt-16 p-6 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
      <strong>Error loading data</strong>
      <p className="font-mono text-xs mt-1 break-all text-red-500">{error}</p>
    </div>
  );

  return (
    <div className="max-w-screen-lg mx-auto px-4 py-8">

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Week of {fmtDate(weekOf)}</h1>
          <p className="text-sm text-gray-400 mt-1">
            {counts.total} accounts scanned · {counts.contacted} contacted
            {contactedPct > 0 && <span className="ml-1 text-emerald-500 font-medium">({contactedPct}%)</span>}
          </p>
        </div>
        {weeks.length > 1 && (
          <select value={weekOf || ''} onChange={(e) => load(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200">
            {weeks.map((w) => <option key={w} value={w}>Week of {fmtDate(w)}</option>)}
          </select>
        )}
      </div>

      {/* Top signals */}
      {topSignals.length > 0 && (
        <div className="mb-8">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Top signals this week</p>
          <div className="grid gap-3 md:grid-cols-3">
            {topSignals.map((s, i) => (
              <div key={i} className={`rounded-xl p-4 border ${
                s.type === 'churn'
                  ? 'bg-red-50 border-red-100'
                  : 'bg-blue-50 border-blue-100'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base">{s.type === 'churn' ? '⚠️' : '🚀'}</span>
                  <span className="font-semibold text-gray-900 text-sm truncate">{s.account}</span>
                </div>
                <p className="text-xs text-gray-500 mb-1.5">{s.csam}</p>
                <p className="text-xs text-gray-700 leading-relaxed">{trunc(s.text, 100)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-6">
        <StatCard emoji="🔴" label="Critical" value={counts.critical}
          active={filterRag==='critical'} color="bg-red-50 text-red-700 border-red-200"
          onClick={() => setFilterRag(filterRag==='critical'?'':'critical')} />
        <StatCard emoji="🟡" label="At Risk" value={counts.at_risk}
          active={filterRag==='at_risk'} color="bg-amber-50 text-amber-700 border-amber-200"
          onClick={() => setFilterRag(filterRag==='at_risk'?'':'at_risk')} />
        <StatCard emoji="🚀" label="Expansion" value={counts.expansion}
          active={filterSignal==='expansion'} color="bg-blue-50 text-blue-700 border-blue-200"
          onClick={() => setFilterSignal(filterSignal==='expansion'?'':'expansion')} />
        <StatCard emoji="⚠️" label="Churn Risk" value={counts.churn_risk}
          active={filterSignal==='churn_risk'} color="bg-orange-50 text-orange-700 border-orange-200"
          onClick={() => setFilterSignal(filterSignal==='churn_risk'?'':'churn_risk')} />
        <StatCard emoji="⛔" label="Churned" value={counts.churned}
          active={filterRag==='churned'} color="bg-gray-100 text-gray-600 border-gray-200"
          onClick={() => setFilterRag(filterRag==='churned'?'':'churned')} />
        <StatCard emoji="✓" label="Contacted" value={counts.contacted}
          active={filterSignal==='contacted'} color="bg-emerald-50 text-emerald-700 border-emerald-200"
          onClick={() => setFilterSignal(filterSignal==='contacted'?'':'contacted')} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-5 items-center">
        <select value={filterCsam} onChange={(e) => setFilterCsam(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200">
          <option value="">All CSAMs</option>
          {CSAMS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search account…"
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 w-44" />
        <button
          onClick={() => setFilterSignal(filterSignal==='uncontacted'?'':'uncontacted')}
          className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
            filterSignal === 'uncontacted'
              ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
              : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
          }`}>
          Not contacted
        </button>
        {hasFilters && (
          <button onClick={() => { setFilterCsam(''); setFilterRag(''); setFilterSignal(''); setSearch(''); }}
            className="text-xs text-gray-400 hover:text-gray-600 px-2 transition-colors">
            Clear all ×
          </button>
        )}
        <span className="ml-auto text-xs text-gray-400">{filtered.length} shown</span>
      </div>

      {/* Account list */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-16 text-gray-400 text-sm">
            {hasFilters
              ? <><p className="text-base mb-1">No accounts match your filters.</p><button onClick={() => { setFilterCsam(''); setFilterRag(''); setFilterSignal(''); setSearch(''); }} className="text-xs text-indigo-400 hover:text-indigo-600">Clear filters</button></>
              : <><p className="text-base mb-1">No data for this week yet.</p><p className="text-xs text-gray-300">Run /monday to populate the dashboard.</p></>
            }
          </div>
        )}
        {filtered.map((a) => (
          <AccountRow key={a.account_id} account={a} authorName={authorName}
            onToggleContacted={toggleContacted} onRefresh={() => load(weekOf)} />
        ))}
      </div>

      {/* Footer */}
      {filtered.length > 0 && (
        <p className="text-center text-xs text-gray-300 mt-8">
          {counts.contacted} of {counts.total - counts.churned} actionable accounts contacted this week
        </p>
      )}
    </div>
  );
}
