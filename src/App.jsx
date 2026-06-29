import Ritual from './pages/Ritual.jsx';

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-navy text-white px-6 py-4 flex items-center gap-4 shadow-lg">
        <span className="text-2xl">📋</span>
        <div>
          <span className="text-lg font-semibold">Monday Ritual</span>
          <span className="ml-2 text-xs font-mono text-slate-400 uppercase tracking-widest">International CS · TaxDome</span>
        </div>
        <div className="flex-1" />
        <span className="text-xs text-slate-400 font-mono hidden md:block">monday-ritual-dashboard.netlify.app</span>
      </header>
      <main className="flex-1"><Ritual /></main>
    </div>
  );
}
