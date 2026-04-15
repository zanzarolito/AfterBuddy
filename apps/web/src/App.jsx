import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Session from './pages/Session.jsx';
import Results from './pages/Results.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/session/:id" element={<Session />} />
      <Route path="/session/:id/results" element={<Results />} />
    </Routes>
  );
}
