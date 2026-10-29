import { useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';

export default function AppShell({ perfil, onLogout, nav, children }) {
  const [cambiandoClave, setCambiandoClave] = useState(false);
  return (
    <div className="app-shell">
      <aside className="app-rail" style={{ background: 'var(--navy)', color: '#fff' }}>
        <div>
          <div style={wordmark}>
            <span style={wordmarkDot} />
            Nómina
          </div>
          <div style={wordmarkSub}>Marathon · Superdeporte</div>
        </div>

        {nav && nav.length > 0 && (
          <nav style={{ marginTop: 36, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {nav.map((item) => (
              <button
                key={item.label}
                onClick={item.onClick}
                style={{ ...navItem, ...(item.active ? navItemActive : {}) }}
              >
                {item.label}
              </button>
            ))}
          </nav>
        )}

        <div style={{ flex: 1, minHeight: 24 }} />

        <div style={userBlock}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{perfil.nombre}</div>
          <div style={{ fontSize: 11, color: '#8592C4', marginTop: 2 }}>
            {perfil.rol === 'admin' ? 'Administrador' : 'Operador'}
          </div>
          <button onClick={() => setCambiandoClave(true)} style={logoutBtn}>Cambiar contraseña</button>
          <button onClick={onLogout} style={{ ...logoutBtn, marginTop: 8 }}>Cerrar sesión</button>
        </div>
      </aside>

      <main className="app-content">{children}</main>

      {cambiandoClave && <CambiarPassword onCerrar={() => setCambiandoClave(false)} />}
    </div>
  );
}

// Cada persona cambia su propia contraseña, ya dentro de la app (no usa correo).
function CambiarPassword({ onCerrar }) {
  const [nueva, setNueva] = useState('');
  const [repite, setRepite] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [listo, setListo] = useState(false);

  async function guardar(e) {
    e.preventDefault();
    setError('');
    if (nueva.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (nueva !== repite) {
      setError('Las dos contraseñas no son iguales.');
      return;
    }
    setGuardando(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password: nueva });
      if (err) throw err;
      setListo(true);
    } catch (err) {
      console.error(err);
      const msg = err?.message || '';
      if (/different from the old/i.test(msg)) setError('La nueva contraseña debe ser distinta a la actual.');
      else if (/weak|pwned|easy to guess/i.test(msg)) setError('Esa contraseña es muy fácil de adivinar. Usa otra más larga o con números y símbolos.');
      else setError('No se pudo cambiar la contraseña. Cierra sesión, vuelve a entrar e inténtalo otra vez.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div style={overlay} role="dialog" aria-modal="true">
      <form onSubmit={guardar} style={modal}>
        <h2 style={{ margin: 0, fontSize: 17, color: '#0a1329' }}>Cambiar mi contraseña</h2>
        {listo ? (
          <>
            <p style={{ color: '#1f7a4d', fontSize: 13.5, lineHeight: 1.5 }}>Listo, tu contraseña quedó actualizada. Úsala la próxima vez que entres.</p>
            <button type="button" style={modalBtn} onClick={onCerrar}>Cerrar</button>
          </>
        ) : (
          <>
            <label style={modalLabel}>Nueva contraseña (mínimo 8 caracteres)</label>
            <input style={modalInput} type="password" value={nueva} onChange={(e) => setNueva(e.target.value)} autoComplete="new-password" required />
            <label style={modalLabel}>Repite la contraseña</label>
            <input style={modalInput} type="password" value={repite} onChange={(e) => setRepite(e.target.value)} autoComplete="new-password" required />
            {error && <div style={{ color: '#c23b3b', fontSize: 12.5, lineHeight: 1.45 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button type="submit" style={modalBtn} disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar contraseña'}</button>
              <button type="button" style={modalBtnGhost} onClick={onCerrar} disabled={guardando}>Cancelar</button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}

const wordmark = {
  display: 'flex', alignItems: 'center', gap: 9,
  fontSize: 16.5, fontWeight: 600, letterSpacing: '-0.01em',
};
const wordmarkDot = {
  width: 8, height: 8, borderRadius: 2, background: 'var(--accent)',
  display: 'inline-block', flexShrink: 0,
};
const wordmarkSub = { fontSize: 11, color: '#7C88BD', marginTop: 5, marginLeft: 17 };
const navItem = {
  textAlign: 'left', background: 'none', border: 'none', color: '#B7C0E8',
  fontSize: 13.5, padding: '9px 11px', borderRadius: 8, cursor: 'pointer',
  fontFamily: 'inherit',
};
const navItemActive = { background: 'var(--navy-2)', color: '#fff' };
const userBlock = { borderTop: '1px solid rgba(255,255,255,0.12)', paddingTop: 16, marginTop: 16 };
const logoutBtn = {
  marginTop: 10, background: 'none', border: '1px solid rgba(255,255,255,0.18)',
  color: '#B7C0E8', fontSize: 11.5, padding: '6px 10px', borderRadius: 6,
  cursor: 'pointer', width: '100%', fontFamily: 'inherit',
};
const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(10,19,41,0.55)', display: 'flex',
  alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16,
};
const modal = {
  background: '#fff', borderRadius: 12, padding: '26px 26px 22px', width: 340, maxWidth: '100%',
  display: 'flex', flexDirection: 'column', gap: 6, color: '#0a1329', fontFamily: 'inherit',
};
const modalLabel = { fontSize: 11.5, fontWeight: 600, color: '#6b7794', marginTop: 8 };
const modalInput = { border: '1.5px solid #dbe2f0', borderRadius: 7, padding: '9px 10px', fontSize: 13.5, marginTop: 4 };
const modalBtn = {
  background: '#145DA0', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 14px',
  fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
};
const modalBtnGhost = {
  background: '#fff', color: '#145DA0', border: '1.5px solid #dbe2f0', borderRadius: 8, padding: '10px 14px',
  fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
};