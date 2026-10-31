import { Link, Route, Routes } from 'react-router-dom';
import Admin from './pages/Admin.jsx';
import Landing from './pages/Landing.jsx';

function NotFound() {
  return (
    <main className="empty-state">
      <h1>Page not found</h1>
      <p>The page you are looking for does not exist.</p>
      <Link className="btn btn-primary" to="/">Back to Tour</Link>
    </main>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
