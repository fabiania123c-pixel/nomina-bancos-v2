import { useState } from 'react';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      await onLogin(email, password);
    } catch (err) {
      setError('Correo o contraseña incorrectos.');
      console.error(err);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div style={styles.wrap}>
      <form onSubmit={handleSubmit} style={styles.card}>
        <h1 style={styles.title}>Nómina Bancos</h1>
        <p style={styles.subtitle}>Marathon / Superdeporte</p>

        <label style={styles.label}>Correo</label>
        <input
          style={styles.input}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          required
        />

        <label style={styles.label}>Contraseña</label>
        <input
          style={styles.input}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />

        {error && <div style={styles.error}>{error}</div>}

        <button style={styles.button} type="submit" disabled={cargando}>
          {cargando ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}

const styles = {
  wrap: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0a1329',
    fontFamily: 'Segoe UI, Arial, sans-serif',
  },
  card: {
    background: '#fff',
    padding: '36px 32px',
    borderRadius: 12,
    width: 320,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  title: { margin: 0, fontSize: 19, color: '#0a1329' },
  subtitle: { margin: '2px 0 18px', fontSize: 12.5, color: '#6b7794' },
  label: { fontSize: 11.5, fontWeight: 600, color: '#6b7794', marginTop: 10 },
  input: {
    border: '1.5px solid #dbe2f0',
    borderRadius: 7,
    padding: '9px 10px',
    fontSize: 13.5,
    marginTop: 4,
  },
  error: { color: '#c23b3b', fontSize: 12.5, marginTop: 10 },
  button: {
    marginTop: 20,
    background: '#145DA0',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '11px',
    fontSize: 13.5,
    fontWeight: 600,
    cursor: 'pointer',
  },
};