import { useAuth } from './lib/useAuth.js';
import Login from './pages/Login.jsx';
import NuevaPassword from './pages/NuevaPassword.jsx';
import OperadorDashboard from './pages/OperadorDashboard.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';

export default function App() {
  const { perfil, loading, recuperando, avisoEnlace, login, logout, solicitarCambioPassword, cambiarPassword, cancelarRecuperacion } = useAuth();

  // Llegó desde el correo de "cambiar contraseña": primero pone la nueva, antes de entrar a la app.
  if (recuperando) {
    return <NuevaPassword onGuardar={cambiarPassword} onCancelar={cancelarRecuperacion} />;
  }

  if (loading) {
    return <div style={{ padding: 40, fontFamily: 'sans-serif' }}>Cargando...</div>;
  }

  if (!perfil) {
    return <Login onLogin={login} onSolicitarCambio={solicitarCambioPassword} aviso={avisoEnlace} />;
  }

  if (perfil.rol === 'admin') {
    return <AdminDashboard perfil={perfil} onLogout={logout} />;
  }

  return <OperadorDashboard perfil={perfil} onLogout={logout} />;
}