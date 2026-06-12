import { Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header.jsx';
import Ritual from './pages/Ritual.jsx';

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Ritual />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
