import { useEffect, useState, useMemo } from 'react';
import { getRitual, getWeeks, addNote, deleteNote, setContacted, setStatus, generateEmail } from '../lib/supabase.js';

const CSAMS = ['Julia Seitz', 'Maria Mazur', 'Valentina Manta', 'Paolo Zafra', 'Reina Kurosawa', 'Piera Bellelli'];

const RAG = {
  critical: { label: '🔴 Critical', badge: 'bg-red-50 text-red-700 ring-1 ring-red-200', order: 0 },
  at_risk:  { label: '🟡 At Risk',  badge: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200', order: 1 },
  watch:    { label: '⚪ Watch',    badge: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200', order: 2 },
  none:     { label: '✅ None',     badge: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200', order: 3 },
};

const STATUSES = [
  { value: 'not_started',    label: '— Not started',     color: 'text-gray-400' },
  { value: 'in_progress',   label: '🔵 In progress',     color: 'text-blue-600' },
  { value: 'call_booked',   label: '📅 Call booked',     color: 'text-indigo-600' },
  { value: 'not_responsive',label: '🔇 Not responsive',  color: 'text-orange-600' },
  { value: 'save_attempt',  label: '🛟 Save attempt',    color: 'text-red-600' },
  { value: 'churned',       label: '❌ Churned',          color: 'text-gray-500' },
  { value: 'expanded',      label: '🚀 Expanded',         color: 'text-green-600' },
  { value: 'resolved',      label: '✅ Resolved',         color: 'text-emerald-600' },
];

const EMAIL_TYPE = {
  critical: { type: 'Re-engagement', tone: 'warm but direct — there is urgency. Reference the gap in activity and offer concrete help to get them back on track.' },
  at_risk:  { type: 'Check-in',      tone: 'friendly and curious — no pressure. Ask how things are going and offer a quick call.' },
  watch:    { type: 'Expansion nudge', tone: 'positive and forward-looking. They are doing well — open a conversation about what more TaxDome could do for them.' },
  none:     { type: 'Check-in',      tone: 'light and friendly.' },
};

function fmtDate(w) { if (!w) return '—'; return new Date(w).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
function fmtWhen(ts) { if (!ts) return ''; return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
function trunc(s, n = 80) { if (!s) return ''; return s.length > n ? s.slice(0, n) + '…' : s; }
function getStatusMeta(val) { return STATUSES.find(s => s.value === val) || STATUSES[0]; }

// ── Email Modal ────────────────────────────────────────────────────
function EmailModal({ account, authorName, onClose, onSent }) {
  const [emailBody, setEmailBody] = useState('');
  const [subject, setSubject] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const emailType = EMAIL_TYPE[account.rag] || EMAIL_TYPE.none;

  useEffect(() => { gen(); }, []);

  async function gen() {
    setLoading(true); setError('');
    try {
      const notes = account.notes.map(n => `- ${n.author} (${fmtWhen(n.created_at)}): ${n.body}`).join('\n');
      const prompt = `You are ${authorName}, a Customer Success Manager at TaxDome (accounting practice management software).
Write a ${emailType.type} email to a client at ${account.account_name}.
Context:
- Account health: ${account.rag?.replace('_', ' ')} (score: ${account.score})
- Market: ${account.market}
- Last login: ${account.last_login || 'unknown'}
- Last contact: ${account.last_contact || 'unknown'}
- ARR: ${account.arr || 'not disclosed'}
- Current status: ${getStatusMeta(account.status).label}
${account.expansion ? `- Expansion signal: ${account.expansion}` : ''}
${account.churn ? `- Risk signal: ${account.churn}` : ''}
${account.action ? `- Suggested action: ${account.action}` : ''}
${notes ? `- Recent notes:\n${notes}` : ''}
Tone: ${emailType.tone}
Rules: max 120 words body. No "I hope this email finds you well". Sign off as ${authorName}, Customer Success Manager, TaxDome.
Subject line: start with "TaxDome - ".
Output format: first line = subject (no "Subject:" prefix), blank line, then body.`;
      const text = await generateEmail(prompt);
      const lines = text.trim().split('\n');
      setSubject(lines[0].replace(/^Subject:\s*/i, '').trim());
      setEmailBody(lines.slice(2).join('\n').trim());
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  function copy() {
    navigator.clipboard.writeText(`Subject: ${subject}\n\n${emailBody}`);
    setCopied(true); setTimeout(() => setCopied(false), 2000); onSent();
  }
  function openGmail() {
    window.open(`https://mail.google.com/mail/u/0/#compose?su=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`, '_blank');
    onSent();
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-900">{emailType.type} — {account.account_name}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{RAG[account.rag]?.label} · {account.csam}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? <div className="flex items-center justify-center h-40"><div className="text-gray-400 text-sm animate-pulse">Generating email…</div></div>
          : error ? <div className="text-red-600 text-sm bg-red-50 rounded-lg p-4">{error}</div>
          : <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Subject</label>
                <input value={subject} onChange={e => setSubject(e.target.value)} className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Body</label>
                <textarea value={emailBody} onChange={e => setEmailBody(e.target.value)} rows={10} className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none font-mono" />
              </div>
            </div>}
        </div>
        {!loading && !error && (
          <div className="flex items-center gap-2 px-6 py-4 border-t border-gray-100">
            <button onClick={gen} className="text-xs text-gray-400 hover:text-gray-600 mr-auto">↺ Regenerate</button>
            <button onClick={copy} className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">{copied ? '✓ Copied!' : 'Copy'}</button>
            <button onClick={openGmail} className="px-4 py-2 bg-accent hover:bg-accent-dark text-white rounded-lg text-sm font-medium">Open in Gmail ↗</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Note Thread ────────────────────────────────────────────────────
function NoteThread({ account, authorName, onRefresh }) {
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  async function add() {
    if (!body.trim()) return;
    setSaving(true);
    try { await addNote(account.account_id, authorName, body.trim()); setBody(''); onRefresh(); }
    catch (e) { alert(e.message); } finally { setSaving(false); }
  }
  async function remove(id) {
    if (!confirm('Delete note?')) return;
    try { await deleteNote(id); onRefresh(); } catch (e) { alert(e.message); }
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Notes</p>
      <div className="space-y-2 mb-3">
        {account.notes.length === 0 && <p className="text-xs text-gray-400">No notes yet.</p>}
        {account.notes.map(n => (
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
        <span className="text-xs text-gray-500 self-center shrink-0 font-medium">{authorName}</span>
        <input value={body} onChange={e => setBody(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && add()} placeholder="Add note… (Enter to save)" className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 min-w-0" />
        <button onClick={add} disabled={saving || !body.trim()} className="px-3 py-1.5 bg-accent hover:bg-accent-dark text-white text-sm font-medium rounded-lg disabled:opacity-50 shrink-0">{saving ? '…' : 'Add'}</button>
      </div>
    </div>
  );
}

// ── Account Row ────────────────────────────────────────────────────
function AccountRow({ account, authorName, selected, onToggleSelect, onToggleContacted, onStatusChange, onRefresh }) {
  const [open, setOpen] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const rag = RAG[account.rag] || RAG.none;
  const statusMeta = getStatusMeta(account.status);

  async function handleStatusChange(e) {
    const newStatus = e.target.value;
    onStatusChange(account.account_id, newStatus);
    try { await setStatus(account.account_id, newStatus, authorName); }
    catch (e) { alert(e.message); }
  }

  function handleEmailSent() {
    setShowEmail(false);
    if (!account.contacted) onToggleContacted(account);
  }

  return (
    <>
      {showEmail && <EmailModal account={account} authorName={authorName} onClose={() => setShowEmail(false)} onSent={handleEmailSent} />}
      <div className={`bg-white rounded-xl ring-1 ${selected ? 'ring-2 ring-accent' : 'ring-gray-100'} shadow-sm overflow-hidden ${account.status === 'churned' ? 'opacity-40' : account.contacted ? 'opacity-60' : ''}`}>
        <div className="px-4 py-3 flex items-start gap-3">
          {/* Batch selection checkbox */}
          <div className="pt-1 shrink-0">
            <input type="checkbox" checked={selected} onChange={() => onToggleSelect(account.account_id)} className="w-4 h-4 rounded border-gray-300 text-accent cursor-pointer" title="Select for batch outreach" />
          </div>

          {/* Contacted checkbox */}
          <div className="pt-1 shrink-0">
            <input type="checkbox" checked={account.contacted} onChange={() => onToggleContacted(account)} className="w-4 h-4 rounded border-gray-300 text-accent cursor-pointer" title="Mark as contacted" />
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="font-semibold text-gray-900 text-sm">{account.account_name}</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-medium ${rag.badge}`}>{rag.label}</span>
              {account.arr && account.arr !== '—' && <span className="text-xs font-mono text-gray-400">{account.arr}</span>}
              {account.notes.length > 0 && <span className="text-xs text-accent font-medium">💬 {account.notes.length}</span>}
              {account.contacted && account.contacted_by && <span className="text-xs text-emerald-600">✓ {account.contacted_by}</span>}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500 mb-1.5">
              <span><span className="text-gray-400">CSAM:</span> {account.csam}</span>
              <span><span className="text-gray-400">Market:</span> {account.market || '—'}</span>
              <span><span className="text-gray-400">Login:</span> {account.last_login || '—'}</span>
              <span><span className="text-gray-400">Contact:</span> {account.last_contact || '—'}</span>
            </div>
            {account.expansion && <p className="text-xs text-blue-700 mb-0.5">🚀 {trunc(account.expansion)}</p>}
            {account.churn && <p className="text-xs text-red-700 mb-0.5">⚠️ {trunc(account.churn)}</p>}
            <p className="text-xs text-gray-500 italic">{account.action}</p>
            {open && <NoteThread account={account} authorName={authorName} onRefresh={onRefresh} />}
          </div>

          {/* Right side actions */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            {/* Status dropdown */}
            <select
              value={account.status || 'not_started'}
              onChange={handleStatusChange}
              className={`text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 cursor-pointer ${statusMeta.color}`}
            >
              {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              <a href={account.hubspot_url} target="_blank" rel="noreferrer" className="text-xs text-gray-400 hover:text-accent" title="HubSpot">↗</a>
              <button onClick={() => setShowEmail(true)} className="text-xs bg-accent/10 hover:bg-accent/20 text-accent font-medium px-2 py-0.5 rounded-md">✉ Email</button>
              <button onClick={() => setOpen(o => !o)} className="text-xs text-accent hover:text-accent-dark font-medium">
                {open ? 'Close' : `Notes${account.notes.length ? ` (${account.notes.length})` : ''}`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Executive Panel ────────────────────────────────────────────────
function ExecutivePanel({ accounts, prevAccounts }) {
  const stats = useMemo(() => {
    let arrAtRisk = 0, arrExpansion = 0, expansionCount = 0;
    let churnConfirmed = 0, saveAttempt = 0;
    let criticalCount = 0, criticalContacted = 0, atRiskCount = 0, atRiskContacted = 0;
    for (const a of accounts) {
      const arr = parseFloat(String(a.arr || '').replace(/[^0-9.]/g, '')) || 0;
      if (a.rag === 'critical' || a.rag === 'at_risk') arrAtRisk += arr;
      if (a.expansion) { expansionCount++; arrExpansion += arr; }
      if (a.status === 'churned') churnConfirmed++;
      if (a.status === 'save_attempt') saveAttempt++;
      if (a.rag === 'critical') { criticalCount++; if (a.contacted) criticalContacted++; }
      if (a.rag === 'at_risk') { atRiskCount++; if (a.contacted) atRiskContacted++; }
    }
    const totalPriority = criticalCount + atRiskCount;
    const totalContacted = criticalContacted + atRiskContacted;
    const contactedPct = totalPriority > 0 ? Math.round((totalContacted / totalPriority) * 100) : 0;
    return { arrAtRisk, arrExpansion, expansionCount, churnConfirmed, saveAttempt, criticalCount, atRiskCount, totalPriority, totalContacted, contactedPct };
  }, [accounts]);

  const prev = useMemo(() => {
    if (!prevAccounts?.length) return null;
    let c = 0, r = 0;
    for (const a of prevAccounts) {
      if (a.rag === 'critical') c++;
      if (a.rag === 'at_risk') r++;
    }
    return { criticalCount: c, atRiskCount: r, total: c + r };
  }, [prevAccounts]);

  function delta(now, before) {
    if (before === null || before === undefined) return null;
    const d = now - before;
    if (d === 0) return <span className="text-slate-500 text-xs ml-1">→ same</span>;
    if (d > 0) return <span className="text-red-400 text-xs ml-1">↑ +{d} vs prev week</span>;
    return <span className="text-emerald-400 text-xs ml-1">↓ {d} vs prev week</span>;
  }

  function fmtArr(n) {
    if (!n) return '—';
    if (n >= 1000) return `€${(n / 1000).toFixed(1)}K`;
    return `€${n}`;
  }

  return (
    <div className="bg-navy rounded-xl p-4 mb-6 text-white">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Executive View</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* ARR at risk */}
        <div className="bg-white/5 rounded-lg px-4 py-3">
          <p className="text-xs text-slate-400 mb-1">ARR at risk</p>
          <p className="text-2xl font-semibold text-red-400">{fmtArr(stats.arrAtRisk)}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {stats.criticalCount} critical · {stats.atRiskCount} at risk
            {prev && delta(stats.criticalCount, prev.criticalCount)}
          </p>
        </div>
        {/* Expansion pipeline */}
        <div className="bg-white/5 rounded-lg px-4 py-3">
          <p className="text-xs text-slate-400 mb-1">Expansion pipeline</p>
          <p className="text-2xl font-semibold text-blue-400">{stats.expansionCount} signals</p>
          <p className="text-xs text-slate-500 mt-0.5">{fmtArr(stats.arrExpansion)} ARR base</p>
        </div>
        {/* Churn status */}
        <div className="bg-white/5 rounded-lg px-4 py-3">
          <p className="text-xs text-slate-400 mb-1">Churn status</p>
          <p className="text-2xl font-semibold text-orange-400">{stats.churnConfirmed} confirmed</p>
          <p className="text-xs text-slate-500 mt-0.5">{stats.saveAttempt} save attempt{stats.saveAttempt !== 1 ? 's' : ''} in progress</p>
        </div>
        {/* Contacted % */}
        <div className="bg-white/5 rounded-lg px-4 py-3">
          <p className="text-xs text-slate-400 mb-1">Outreach coverage</p>
          <p className={`text-2xl font-semibold ${stats.contactedPct >= 80 ? 'text-emerald-400' : stats.contactedPct >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
            {stats.contactedPct}%
          </p>
          <p className="text-xs text-slate-500 mt-0.5">{stats.totalContacted}/{stats.totalPriority} priority accounts contacted</p>
        </div>
      </div>
    </div>
  );
}


function Metric({ label, value, active, onClick }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-colors ${active ? 'bg-accent text-white border-accent' : 'bg-white text-gray-600 border-gray-200 hover:border-accent hover:text-accent'}`}>
      <span>{label}</span>
      <span className={`font-mono font-semibold ${active ? 'text-white' : 'text-gray-900'}`}>{value}</span>
    </button>
  );
}

// ── Main Ritual page ───────────────────────────────────────────────
export default function Ritual() {
  const [authorName, setAuthorName] = useState(() => localStorage.getItem('ritual_author') || '');
  const [weekOf, setWeekOf] = useState(null);
  const [weeks, setWeeks] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [prevAccounts, setPrevAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterCsam, setFilterCsam] = useState('');
  const [filterRag, setFilterRag] = useState('');
  const [filterSignal, setFilterSignal] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [copiedBatch, setCopiedBatch] = useState(false);

  function toggleSelect(account_id) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(account_id)) next.delete(account_id); else next.add(account_id);
      return next;
    });
  }

  function selectAllFiltered() {
    setSelectedIds(new Set(filtered.map(a => a.account_id)));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  // Builds the JSON payload for /batchoutreach-data and copies it to clipboard.
  // Only Supabase-known fields are included — no HubSpot/Gmail call happens here.
  function copyBatchPayload() {
    const selectedAccounts = filtered.filter(a => selectedIds.has(a.account_id));
    const payload = selectedAccounts.map(a => ({
      account_name: a.account_name,
      csam: a.csam,
      market: a.market || null,
      health: a.health || null,
      rag: a.rag,
      score: a.score ?? null,
      last_login: a.last_login || null,
      last_contact: a.last_contact || null,
      arr: a.arr || null,
      status: a.status || 'not_started',
      churn: a.churn || null,
      expansion: a.expansion || null,
      action: a.action || null,
      contacted: !!a.contacted,
      notes: (a.notes || []).map(n => ({ author: n.author, body: n.body, created_at: n.created_at })),
      hubspot_url: a.hubspot_url || null,
    }));
    const command = `/batchoutreach-data\n${JSON.stringify(payload, null, 2)}`;
    navigator.clipboard.writeText(command);
    setCopiedBatch(true);
    setTimeout(() => setCopiedBatch(false), 2500);
  }

  function load(week) {
    setLoading(true); setError(null);
    getRitual(week)
      .then(d => {
        setWeekOf(d.week_of);
        setAccounts(d.accounts || []);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    getWeeks().then(ws => {
      setWeeks(ws);
      // Load prev week for WoW delta
      if (ws.length > 1) {
        getRitual(ws[1]).then(d => setPrevAccounts(d.accounts || [])).catch(() => {});
      }
    }).catch(() => {});
    load();
  }, []);

  function exportCsv() {
    const rows = filtered.map(a => ({
      Account: a.account_name,
      CSAM: a.csam,
      Market: a.market || '',
      RAG: a.rag,
      Score: a.score,
      Health: a.health || '',
      ARR: a.arr || '',
      Status: a.status || 'not_started',
      'Last Login': a.last_login || '',
      'Last Contact': a.last_contact || '',
      Contacted: a.contacted ? 'Yes' : 'No',
      'Contacted By': a.contacted_by || '',
      Expansion: a.expansion || '',
      Churn: a.churn || '',
      Action: a.action || '',
      Notes: a.notes.map(n => `${n.author}: ${n.body}`).join(' | '),
      HubSpot: a.hubspot_url || '',
    }));
    const headers = Object.keys(rows[0] || {});
    const csv = [
      headers.join(','),
      ...rows.map(r => headers.map(h => `"${String(r[h] || '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ritual-${weekOf || 'export'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function toggleContacted(account) {
    const next = !account.contacted;
    setAccounts(prev => prev.map(a => a.account_id === account.account_id ? { ...a, contacted: next, contacted_by: next ? authorName : null } : a));
    try { await setContacted(account.account_id, weekOf, next, authorName); }
    catch (e) {
      setAccounts(prev => prev.map(a => a.account_id === account.account_id ? { ...a, contacted: !next } : a));
      alert(e.message);
    }
  }

  function handleStatusChange(account_id, newStatus) {
    setAccounts(prev => prev.map(a => a.account_id === account_id ? { ...a, status: newStatus, status_updated_by: authorName } : a));
  }

  // Counts respect CSAM/status/search filters (so picking a CSAM updates the numbers),
  // but stay independent of filterRag/filterSignal themselves — those are the filters
  // these very buttons control, so they must show the count within the OTHER active
  // filters, not collapse to match whichever RAG/signal is currently selected.
  const countsBase = useMemo(() => {
    let list = [...accounts];
    if (filterCsam) list = list.filter(a => a.csam === filterCsam);
    if (filterStatus) list = list.filter(a => a.status === filterStatus);
    if (search) list = list.filter(a => a.account_name.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [accounts, filterCsam, filterStatus, search]);

  const counts = useMemo(() => {
    const c = { critical: 0, at_risk: 0, watch: 0, expansion: 0, churn: 0, contacted: 0 };
    for (const a of countsBase) {
      if (c[a.rag] !== undefined) c[a.rag]++;
      if (a.expansion) c.expansion++;
      if (a.churn) c.churn++;
      if (a.contacted) c.contacted++;
    }
    return c;
  }, [countsBase]);

  const topSignals = useMemo(() => {
    const sig = [];
    for (const a of accounts) {
      if (a.churn) sig.push({ type: 'churn', account: a.account_name, csam: a.csam, text: a.churn });
      if (a.expansion) sig.push({ type: 'expansion', account: a.account_name, csam: a.csam, text: a.expansion });
    }
    return sig.sort(x => x.type === 'churn' ? -1 : 1).slice(0, 3);
  }, [accounts]);

  const filtered = useMemo(() => {
    let list = [...accounts];
    if (filterCsam) list = list.filter(a => a.csam === filterCsam);
    if (filterRag) list = list.filter(a => a.rag === filterRag);
    if (filterSignal === 'expansion') list = list.filter(a => a.expansion);
    if (filterSignal === 'churn') list = list.filter(a => a.churn);
    if (filterSignal === 'contacted') list = list.filter(a => a.contacted);
    if (filterSignal === 'uncontacted') list = list.filter(a => !a.contacted);
    if (filterStatus) list = list.filter(a => a.status === filterStatus);
    if (search) list = list.filter(a => a.account_name.toLowerCase().includes(search.toLowerCase()));
    return list.sort((a, b) => { const ro = (RAG[a.rag]?.order ?? 9) - (RAG[b.rag]?.order ?? 9); return ro !== 0 ? ro : (b.score ?? 0) - (a.score ?? 0); });
  }, [accounts, filterCsam, filterRag, filterSignal, filterStatus, search]);

  const hasFilters = filterCsam || filterRag || filterSignal || filterStatus || search;

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-gray-400 text-sm animate-pulse">Loading…</div></div>;
  if (error) return <div className="max-w-xl mx-auto mt-16 p-6 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm"><strong>Error:</strong><p className="font-mono text-xs mt-1 break-all">{error}</p></div>;

  return (
    <div className="max-w-screen-lg mx-auto px-4 py-8 pb-24">
      {/* Author selector */}
      {!authorName && (
        <div className="mb-6 bg-accent/10 border border-accent/20 rounded-xl p-4 flex items-center gap-3">
          <span className="text-sm font-medium text-accent">Who are you?</span>
          <div className="flex flex-wrap gap-2">
            {CSAMS.map(c => (
              <button key={c} onClick={() => { setAuthorName(c); localStorage.setItem('ritual_author', c); }}
                className="px-3 py-1.5 bg-white border border-accent/30 rounded-lg text-sm font-medium text-gray-700 hover:bg-accent hover:text-white hover:border-accent transition-colors">
                {c}
              </button>
            ))}
          </div>
        </div>
      )}
      {authorName && (
        <div className="mb-4 flex items-center gap-2 text-xs text-gray-400">
          <span>Viewing as <span className="font-semibold text-gray-600">{authorName}</span></span>
          <button onClick={() => { setAuthorName(''); localStorage.removeItem('ritual_author'); }}
            className="underline hover:text-gray-600">change</button>
        </div>
      )}
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Week of {fmtDate(weekOf)}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{accounts.length} flagged accounts · {counts.contacted} contacted</p>
        </div>
        {weeks.length > 1 && (
          <select value={weekOf || ''} onChange={e => load(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent/30">
            {weeks.map(w => <option key={w} value={w}>Week of {fmtDate(w)}</option>)}
          </select>
        )}
      </div>

      {/* Executive panel */}
      <ExecutivePanel accounts={accounts} prevAccounts={prevAccounts} />

      {/* Top signals */}
      {topSignals.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Top signals this week</p>
          <div className="grid gap-3 md:grid-cols-3">
            {topSignals.map((s, i) => (
              <div key={i} className={`rounded-xl p-4 ring-1 ${s.type === 'churn' ? 'bg-red-50/60 ring-red-200' : 'bg-blue-50/60 ring-blue-200'}`}>
                <div className="flex items-center gap-2 mb-1"><span>{s.type === 'churn' ? '⚠️' : '🚀'}</span><span className="font-semibold text-gray-900 text-sm">{s.account}</span></div>
                <p className="text-xs text-gray-500 mb-1">{s.csam}</p>
                <p className="text-xs text-gray-700 leading-relaxed">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metric strip */}
      <div className="flex flex-wrap gap-2 mb-5">
        <Metric label="🔴 Critical" value={counts.critical} active={filterRag==='critical'} onClick={() => setFilterRag(filterRag==='critical'?'':'critical')} />
        <Metric label="🟡 At Risk" value={counts.at_risk} active={filterRag==='at_risk'} onClick={() => setFilterRag(filterRag==='at_risk'?'':'at_risk')} />
        <Metric label="⚪ Watch" value={counts.watch} active={filterRag==='watch'} onClick={() => setFilterRag(filterRag==='watch'?'':'watch')} />
        <Metric label="🚀 Expansion" value={counts.expansion} active={filterSignal==='expansion'} onClick={() => setFilterSignal(filterSignal==='expansion'?'':'expansion')} />
        <Metric label="⚠️ Churn/Risk" value={counts.churn} active={filterSignal==='churn'} onClick={() => setFilterSignal(filterSignal==='churn'?'':'churn')} />
        <Metric label="✓ Contacted" value={counts.contacted} active={filterSignal==='contacted'} onClick={() => setFilterSignal(filterSignal==='contacted'?'':'contacted')} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <select value={filterCsam} onChange={e => setFilterCsam(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent/30">
          <option value="">All CSAMs</option>
          {CSAMS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent/30">
          <option value="">All statuses</option>
          {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search account…" className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-accent/30 w-44" />
        {hasFilters && <button onClick={() => { setFilterCsam(''); setFilterRag(''); setFilterSignal(''); setFilterStatus(''); setSearch(''); }} className="text-xs text-gray-400 hover:text-gray-600 px-2">Clear all</button>}
        <span className="ml-auto text-xs text-gray-400 self-center">{filtered.length} shown</span>
        <button onClick={exportCsv} className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 font-medium px-3 py-1.5 rounded-lg transition-colors">⬇ Export CSV</button>
      </div>

      {/* Account cards */}
      <div className="space-y-2">
        {filtered.length === 0 && <div className="text-center py-12 text-gray-400 text-sm">{hasFilters ? 'No accounts match your filters.' : 'No data for this week yet.'}</div>}
        {filtered.map(a => (
          <AccountRow key={a.account_id} account={a} authorName={authorName}
            selected={selectedIds.has(a.account_id)}
            onToggleSelect={toggleSelect}
            onToggleContacted={toggleContacted}
            onStatusChange={handleStatusChange}
            onRefresh={() => load(weekOf)} />
        ))}
      </div>

      {/* Batch selection bar — sticky, shown when 1+ accounts selected */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-navy text-white shadow-2xl z-40">
          <div className="max-w-screen-lg mx-auto px-4 py-3 flex items-center gap-3">
            <span className="text-sm font-medium">{selectedIds.size} account{selectedIds.size !== 1 ? 's' : ''} selected</span>
            <button onClick={selectAllFiltered} className="text-xs text-slate-300 hover:text-white underline">select all {filtered.length} shown</button>
            <button onClick={clearSelection} className="text-xs text-slate-300 hover:text-white underline">clear</button>
            <div className="flex-1" />
            <button
              onClick={copyBatchPayload}
              className="px-4 py-2 bg-accent hover:bg-accent-dark text-white rounded-lg text-sm font-medium transition-colors"
            >
              {copiedBatch ? '✓ Copied — paste into Claude' : '📋 Copy for Claude (/batchoutreach-data)'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
