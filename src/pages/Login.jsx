import { useState } from 'react';

export default function Login({ onLogin, onSolicitarCambio, aviso = '' }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  // 'login' = entrar normal; 'recuperar' = pedir que el Admin le dé una contraseña nueva
  const [modo, setModo] = useState('login');
  const [enviado, setEnviado] = useState(false);

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

  async function handleSolicitar(e) {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      await onSolicitarCambio(email);
      setEnviado(true);
    } catch (err) {
      console.error(err);
      if (/seconds|rate limit|too many/i.test(err?.message || '') || err?.status === 429) {
        setError('Ya pediste un correo hace poco. Espera un minuto, y usa el último correo que te llegó.');
      } else {
        setError('No se pudo enviar el correo. Revisa tu conexión e inténtalo otra vez.');
      }
    } finally {
      setCargando(false);
    }
  }

  function abrirRecuperar() {
    setModo('recuperar');
    setError('');
    setEnviado(false);
  }

  function volverAlLogin() {
    setModo('login');
    setError('');
    setEnviado(false);
  }

  if (modo === 'recuperar') {
    return (
      <div style={styles.wrap}>
        <form onSubmit={handleSolicitar} style={styles.card}>
          <h1 style={styles.title}>Cambiar contraseña</h1>
          <p style={styles.subtitle}>Escribe tu correo y te enviamos un link para crear una contraseña nueva.</p>

          {enviado ? (
            <>
              <div style={styles.ok}>
                Listo. Si el correo está registrado, te llegó un mensaje con el link para cambiar tu contraseña. Revisa también spam y usa solo el último correo que te llegue.
              </div>
              <button type="button" style={styles.button} onClick={volverAlLogin}>Volver a entrar</button>
            </>
          ) : (
            <>
              <label style={styles.label}>Tu correo</label>
              <input
                style={styles.input}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                required
              />

              {error && <div style={styles.error}>{error}</div>}

              <button style={styles.button} type="submit" disabled={cargando}>
                {cargando ? 'Enviando...' : 'Enviarme el link'}
              </button>
              <button type="button" style={styles.linkBtn} onClick={volverAlLogin}>Volver</button>
            </>
          )}
        </form>
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      <form onSubmit={handleSubmit} style={styles.card}>
        <h1 style={styles.title}>Nómina Bancos</h1>
        <p style={styles.subtitle}>Marathon / Superdeporte</p>

        {aviso && <div style={styles.aviso}>{aviso}</div>}

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
        <button type="button" style={styles.linkBtn} onClick={abrirRecuperar}>¿Olvidaste tu contraseña?</button>
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
  subtitle: { margin: '2px 0 18px', fontSize: 12.5, color: '#6b7794', lineHeight: 1.45 },
  label: { fontSize: 11.5, fontWeight: 600, color: '#6b7794', marginTop: 10 },
  input: {
    border: '1.5px solid #dbe2f0',
    borderRadius: 7,
    padding: '9px 10px',
    fontSize: 13.5,
    marginTop: 4,
  },
  error: { color: '#c23b3b', fontSize: 12.5, marginTop: 10, lineHeight: 1.45 },
  ok: { color: '#1f7a4d', fontSize: 13, lineHeight: 1.5, marginBottom: 6 },
  aviso: { color: '#8a5a00', background: '#fff6e0', borderRadius: 7, padding: '9px 10px', fontSize: 12.5, lineHeight: 1.45 },
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