import { useState, useEffect } from 'react';
import { loadSession, signOut, getCurrentUser, getUserName } from './lib/supabase.js';
import Login from './pages/Login.jsx';
import Ritual from './pages/Ritual.jsx';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = loadSession();
    if (session) setUser(session.user);
    setLoading(false);
  }, []);

  function handleLogin(session) {
    setUser(session.user);
  }

  async function handleSignOut() {
    await signOut();
    setUser(null);
  }

  if (loading) return (
    <div className="min-h-screen bg-navy flex items-center justify-center">
      <div className="text-slate-400 text-sm animate-pulse">Loading…</div>
    </div>
  );

  if (!user) return <Login onLogin={handleLogin} />;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-navy text-white px-6 py-4 flex items-center gap-4 shadow-lg">
        <span className="text-2xl">📋</span>
        <div>
          <span className="text-lg font-semibold tracking-tight">Monday Ritual</span>
          <span className="ml-2 text-xs font-mono text-slate-400 uppercase tracking-widest">International CS</span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-300 hidden md:block">{getUserName(user)}</span>
          <button
            onClick={handleSignOut}
            className="text-xs text-slate-400 hover:text-white transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="flex-1">
        <Ritual currentUser={user} />
      </main>
    </div>
  );
}

