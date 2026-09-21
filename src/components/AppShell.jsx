export default function AppShell({ perfil, onLogout, nav, children }) {
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
          <button onClick={onLogout} style={logoutBtn}>Cerrar sesión</button>
        </div>
      </aside>

      <main className="app-content">{children}</main>
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