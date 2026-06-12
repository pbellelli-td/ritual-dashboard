export default function Header() {
  return (
    <header className="bg-navy text-white px-6 py-4 flex items-center gap-4 shadow-lg">
      <div className="flex items-center gap-3">
        <span className="text-2xl">📋</span>
        <div>
          <span className="text-lg font-semibold tracking-tight">Monday Ritual</span>
          <span className="ml-2 text-xs font-mono text-slate-400 uppercase tracking-widest">International CS</span>
        </div>
      </div>
      <div className="flex-1" />
      <span className="text-xs text-slate-400 font-mono hidden md:block">TaxDome · CSAM Portfolio Intelligence</span>
    </header>
  );
}
