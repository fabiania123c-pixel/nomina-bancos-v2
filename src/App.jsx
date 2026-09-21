import { useAuth } from './lib/useAuth.js';
import Login from './pages/Login.jsx';
import OperadorDashboard from './pages/OperadorDashboard.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';

export default function App() {
  const { perfil, loading, login, logout } = useAuth();

  if (loading) {
    return <div style={{ padding: 40, fontFamily: 'sans-serif' }}>Cargando...</div>;
  }

  if (!perfil) {
    return <Login onLogin={login} />;
  }

  if (perfil.rol === 'admin') {
    return <AdminDashboard perfil={perfil} onLogout={logout} />;
  }

  return <OperadorDashboard perfil={perfil} onLogout={logout} />;
}