import { useState } from 'react';

// Pantalla a la que se llega desde el enlace del correo de "cambiar contraseña".
export default function NuevaPassword({ onGuardar, onCancelar }) {
  const [password, setPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (password !== confirmar) {
      setError('Las dos contraseñas no son iguales.');
      return;
    }
    setGuardando(true);
    try {
      await onGuardar(password);
      // Al guardar, la app entra sola: no hace falta hacer nada más aquí.
    } catch (err) {
      console.error(err);
      const msg = err?.message || '';
      if (/different from the old/i.test(msg)) setError('La nueva contraseña debe ser distinta a la anterior.');
      else if (/session missing|expired|invalid/i.test(msg)) setError('El enlace venció o ya se usó. Vuelve al inicio y pide uno nuevo con «¿Olvidaste tu contraseña?».');
      else if (/weak|at least|characters|pwned|easy to guess/i.test(msg)) setError('Esa contraseña es muy fácil de adivinar. Usa otra más larga o con números y símbolos.');
      else setError('No se pudo cambiar la contraseña. Inténtalo otra vez o pide un enlace nuevo.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div style={styles.wrap}>
      <form onSubmit={handleSubmit} style={styles.card}>
        <h1 style={styles.title}>Crea tu nueva contraseña</h1>
        <p style={styles.subtitle}>Mínimo 8 caracteres.</p>

        <label style={styles.label}>Nueva contraseña</label>
        <input
          style={styles.input}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
        />

        <label style={styles.label}>Repite la contraseña</label>
        <input
          style={styles.input}
          type="password"
          value={confirmar}
          onChange={(e) => setConfirmar(e.target.value)}
          autoComplete="new-password"
          required
        />

        {error && <div style={styles.error}>{error}</div>}

        <button style={styles.button} type="submit" disabled={guardando}>
          {guardando ? 'Guardando...' : 'Guardar contraseña'}
        </button>
        <button type="button" style={styles.linkBtn} onClick={onCancelar} disabled={guardando}>Cancelar</button>
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
  error: { color: '#c23b3b', fontSize: 12.5, marginTop: 10, lineHeight: 1.45 },
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
  linkBtn: {
    marginTop: 10,
    background: 'none',
    border: 'none',
    color: '#145DA0',
    fontSize: 12.5,
    cursor: 'pointer',
    padding: 4,
  },
};