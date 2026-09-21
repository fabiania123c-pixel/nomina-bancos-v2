import { useEffect, useState } from 'react';
import AppShell from '../components/AppShell.jsx';
import { getHistorialCorridas, getArchivosCorrida, anularCorrida } from '../lib/historial.js';
import { calcularKPIs, corridasRecientes, calcularPorPersona, LABEL_BANCO } from '../lib/kpis.js';
import { descargarPdfResumen } from '../lib/pdf.js';
import { buildFileContent, BANK_PROFILES } from '../lib/bankProfiles.js';
import { useConteo } from '../lib/useConteo.js';

const LABEL_TIPO = { nomina_regular: 'Nómina regular', finiquito: 'Finiquitos' };
const COLOR_BANCO = { produbanco: 'var(--bank-produbanco)', pichincha: 'var(--bank-pichincha)', guayaquil: 'var(--bank-guayaquil)' };

export default function AdminDashboard({ perfil, onLogout }) {
  const [corridas, setCorridas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [vista, setVista] = useState('home');

  useEffect(() => {
    getHistorialCorridas(500).then((data) => {
      setCorridas(data);
      setCargando(false);
    });
  }, []);

  const recientes = corridasRecientes(corridas, 48);

  const nav = [
    { label: 'Inicio', active: vista === 'home', onClick: () => setVista('home') },
    { label: `Procesos finalizados${recientes.length ? `  ·  ${recientes.length}` : ''}`, active: vista === 'procesos', onClick: () => setVista('procesos') },
    { label: 'Dashboard de seguimiento', active: vista === 'kpis', onClick: () => setVista('kpis') },
  ];

  return (
    <AppShell perfil={perfil} onLogout={onLogout} nav={nav}>
      <h1 style={pageTitle}>
        {vista === 'home' && 'Panel de Admin'}
        {vista === 'procesos' && 'Procesos finalizados'}
        {vista === 'kpis' && 'Dashboard de seguimiento'}
      </h1>

      {cargando && <p style={{ color: 'var(--muted)' }}>Cargando…</p>}

      {!cargando && vista === 'home' && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 28 }}>
          <BoxHome
            titulo="Procesos finalizados"
            descripcion="Historial de corridas generadas — revisa, y descarga el resumen en PDF de cualquiera."
            badge={recientes.length > 0 ? recientes.length : null}
            onClick={() => setVista('procesos')}
          />
          <BoxHome
            titulo="Dashboard de seguimiento"
            descripcion="Cuánto se ha movido por banco, tendencia mensual, finiquitos vs. nómina regular, por responsable."
            onClick={() => setVista('kpis')}
          />
        </div>
      )}

      {!cargando && vista === 'procesos' && <VistaProcesos corridas={corridas} />}
      {!cargando && vista === 'kpis' && <VistaKPIs corridas={corridas} />}
    </AppShell>
  );
}

function BoxHome({ titulo, descripcion, badge, onClick }) {
  return (
    <div onClick={onClick} style={boxHome}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <h2 style={{ margin: 0, fontSize: 15.5, fontWeight: 600 }}>{titulo}</h2>
        {badge && <span style={badgeStyle}>{badge} nuevo{badge > 1 ? 's' : ''}</span>}
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 10, lineHeight: 1.5 }}>{descripcion}</p>
    </div>
  );
}

function VistaProcesos({ corridas }) {
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [filtroBanco, setFiltroBanco] = useState('todos');

  if (corridas.length === 0) {
    return (
      <div style={emptyState}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--muted-2)" strokeWidth="1.5" style={{ margin: '0 auto' }}>
          <path d="M3 8l3-5h12l3 5M3 8v10a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V8M3 8h6a1 1 0 0 1 1 1v1a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1V9a1 1 0 0 1 1-1h6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p style={{ fontWeight: 600, fontSize: 14, margin: '10px 0 2px' }}>Todavía no hay nada aquí</p>
        <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: 0 }}>
          En cuanto Santiago finalice una corrida, va a aparecer en esta lista.
        </p>
      </div>
    );
  }

  const filtradas = corridas.filter((c) => {
    if (filtroTipo !== 'todos' && c.tipo !== filtroTipo) return false;
    if (filtroBanco !== 'todos' && !c.detalle_bancos?.[filtroBanco]) return false;
    if (busqueda.trim()) {
      const q = busqueda.trim().toLowerCase();
      if (!c.generadoPorNombre?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '20px 0 4px' }}>
        <input
          placeholder="Buscar por responsable…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          style={{ ...filtroInput, flex: '1 1 200px' }}
        />
        <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} style={filtroInput}>
          <option value="todos">Todos los tipos</option>
          <option value="finiquito">Finiquitos</option>
          <option value="nomina_regular">Nómina regular</option>
        </select>
        <select value={filtroBanco} onChange={(e) => setFiltroBanco(e.target.value)} style={filtroInput}>
          <option value="todos">Todos los bancos</option>
          <option value="produbanco">Produbanco</option>
          <option value="pichincha">Banco Pichincha</option>
          <option value="guayaquil">Banco de Guayaquil</option>
        </select>
      </div>

      {filtradas.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 16 }}>Nada coincide con ese filtro.</p>
      ) : (
        <div style={{ marginTop: 8 }}>
          {filtradas.map((c) => (
            <CorridaRow key={c.id} corrida={c} />
          ))}
        </div>
      )}
    </div>
  );
}

function CorridaRow({ corrida: c }) {
  const [descargando, setDescargando] = useState(null);
  const [error, setError] = useState('');

  const [mostrandoForm, setMostrandoForm] = useState(false);
  const [nota, setNota] = useState('');
  const [anulando, setAnulando] = useState(false);
  const [anuladaLocal, setAnuladaLocal] = useState(false);
  const [notaLocal, setNotaLocal] = useState('');

  const anulada = c.anulada || anuladaLocal;
  const notaAnulacion = c.notaAnulacion || notaLocal;

  function descargarPdf() {
    descargarPdfResumen({
      tipo: c.tipo,
      periodo: new Date(c.fecha).toLocaleDateString('es-EC'),
      generadoPor: c.generadoPorNombre,
      detalleBancos: c.detalle_bancos,
      filename: `resumen-${new Date(c.fecha).toISOString().slice(0, 10)}.pdf`,
    });
  }

  async function descargarTxt(banco) {
    setError('');
    setDescargando(banco);
    try {
      const archivos = await getArchivosCorrida(c.id);
      if (!archivos || !archivos.filas_por_banco[banco]?.length) {
        setError('No se encontró el archivo guardado para esta corrida.');
        return;
      }
      const content = buildFileContent(banco, archivos.filas_por_banco[banco], archivos.ctx);
      const filename = BANK_PROFILES[banco].filename(archivos.ctx);
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setError('No se pudo descargar: ' + err.message);
    } finally {
      setDescargando(null);
    }
  }

  async function confirmarAnulacion() {
    if (!nota.trim()) {
      setError('Escribe una nota explicando por qué se anula.');
      return;
    }
    setError('');
    setAnulando(true);
    try {
      await anularCorrida(c.id, nota);
      setAnuladaLocal(true);
      setNotaLocal(nota.trim());
      setMostrandoForm(false);
    } catch (err) {
      console.error(err);
      setError('No se pudo anular: ' + err.message);
    } finally {
      setAnulando(false);
    }
  }

  return (
    <div style={{ ...rowCard, opacity: anulada ? 0.7 : 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>
            {LABEL_TIPO[c.tipo] || c.tipo}
            {anulada && <span style={{ ...badgeAnulada, marginLeft: 8 }}>Anulada</span>}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
            {new Date(c.fecha).toLocaleString('es-EC')} · {c.generadoPorNombre}
          </div>
        </div>
        {!anulada && (
          <span style={{ fontSize: 11.5, fontWeight: 600, color: c.finalizado ? 'var(--ok)' : 'var(--warn)' }}>
            {c.finalizado ? 'Finalizado' : 'Pendiente'}
          </span>
        )}
      </div>

      {anulada && (
        <div style={{ fontSize: 12.5, color: 'var(--err)', marginTop: 6 }}>
          {notaAnulacion}
        </div>
      )}

      <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {Object.entries(c.detalle_bancos || {}).map(([banco, info]) => (
            <div key={banco} style={{ display: 'flex', alignItems: 'center', gap: 8, borderLeft: `2px solid ${COLOR_BANCO[banco]}`, paddingLeft: 8 }}>
              <span className="mono" style={{ fontSize: 12 }}>
                {LABEL_BANCO[banco]} · {info.registros} reg. · ${info.total?.toFixed(2)}
              </span>
            </div>
          ))}
          {c.registros_con_error > 0 && (
            <span style={{ fontSize: 12, color: 'var(--err)' }}>{c.registros_con_error} error(es)</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Object.keys(c.detalle_bancos || {}).map((banco) => (
            <button key={banco} onClick={() => descargarTxt(banco)} disabled={descargando === banco} style={btnGhost}>
              {descargando === banco ? '…' : `${LABEL_BANCO[banco]} · .txt`}
            </button>
          ))}
          <button onClick={descargarPdf} style={btnGhost}>Descargar PDF</button>
          {!anulada && !mostrandoForm && (
            <button onClick={() => setMostrandoForm(true)} style={btnAnular}>Anular</button>
          )}
        </div>
      </div>

      {mostrandoForm && (
        <div style={{ marginTop: 12, padding: 12, background: 'var(--err-bg)', borderRadius: 8 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--err)', display: 'block', marginBottom: 6 }}>
            ¿Por qué se anula esta corrida?
          </label>
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            rows={2}
            placeholder="Ej: monto duplicado, se generó con el archivo equivocado…"
            style={notaInput}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={confirmarAnulacion} disabled={anulando} style={btnConfirmarAnular}>
              {anulando ? 'Anulando…' : 'Confirmar anulación'}
            </button>
            <button onClick={() => { setMostrandoForm(false); setNota(''); setError(''); }} style={btnGhost}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {error && <div style={{ fontSize: 12, color: 'var(--err)', marginTop: 8 }}>{error}</div>}
    </div>
  );
}

function VistaKPIs({ corridas }) {
  const k = calcularKPIs(corridas);
  const porPersona = calcularPorPersona(corridas);
  const maxBanco = Math.max(1, ...Object.values(k.porBanco).map((b) => b.total));
  const maxMes = Math.max(1, ...k.tendenciaMensual.map(([, total]) => total));
  const maxPersona = Math.max(1, ...porPersona.map((p) => p.total));

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 28 }}>
        <StatCard
          label="Total histórico movido"
          numero={k.totalGeneral}
          formatear={(n) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        />
        <StatCard label="Registros procesados" numero={k.registrosGeneral} />
        <StatCard label="Corridas finalizadas" numero={k.corridasFinalizadas} sufijo={` / ${k.totalCorridas}`} />
        <StatCard label="Errores acumulados" numero={k.erroresGeneral} alerta={k.erroresGeneral > 0} />
      </div>

      <ChartSection title="Por banco">
        {Object.entries(k.porBanco).map(([banco, info]) => (
          <BarRow
            key={banco}
            label={LABEL_BANCO[banco]}
            value={`${info.registros} reg. · $${info.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
            pct={(info.total / maxBanco) * 100}
            color={COLOR_BANCO[banco]}
          />
        ))}
      </ChartSection>

      <ChartSection title="Finiquitos vs. nómina regular">
        <div style={{ display: 'flex', gap: 36 }}>
          <TipoStat label="Finiquitos" corridas={k.porTipo.finiquito.corridas} total={k.porTipo.finiquito.total} />
          <TipoStat label="Nómina regular" corridas={k.porTipo.nomina_regular.corridas} total={k.porTipo.nomina_regular.total} />
        </div>
      </ChartSection>

      {k.tendenciaMensual.length > 0 && (
        <ChartSection title="Tendencia (últimos meses)">
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 130 }}>
            {k.tendenciaMensual.map(([mes, total]) => (
              <div key={mes} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ background: 'var(--accent)', borderRadius: '4px 4px 0 0', height: `${(total / maxMes) * 92 + 6}px` }} title={`$${total.toFixed(2)}`} />
                <div className="mono" style={{ fontSize: 10, color: 'var(--muted)', marginTop: 6 }}>{mes}</div>
              </div>
            ))}
          </div>
        </ChartSection>
      )}

      {porPersona.length > 0 && (
        <ChartSection title="Por responsable">
          {porPersona.map((p) => (
            <BarRow
              key={p.nombre}
              label={p.nombre}
              value={`${p.corridas} corrida(s) · ${p.registros} reg. · $${p.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}${p.errores > 0 ? `  ·  ${p.errores} error(es)` : ''}`}
              pct={(p.total / maxPersona) * 100}
              color="var(--accent-2)"
            />
          ))}
        </ChartSection>
      )}
    </div>
  );
}

function ChartSection({ title, children }) {
  return (
    <section style={{ marginBottom: 30 }}>
      <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', margin: '0 0 16px' }}>{title}</h2>
      {children}
    </section>
  );
}

function BarRow({ label, value, pct, color }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 5 }}>
        <strong style={{ fontWeight: 600 }}>{label}</strong>
        <span className="mono" style={{ color: 'var(--muted)' }}>{value}</span>
      </div>
      <div style={barTrack}>
        <div style={{ ...barFill, width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function TipoStat({ label, corridas, total }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{label}</div>
      <div style={{ fontSize: 19, fontWeight: 600, marginTop: 3 }}>{corridas} corrida{corridas !== 1 ? 's' : ''}</div>
      <div className="mono" style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>
        ${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
      </div>
    </div>
  );
}

function StatCard({ label, numero, formatear = (n) => Math.round(n).toLocaleString('en-US'), sufijo = '', alerta }) {
  const animado = useConteo(numero);
  return (
    <div style={statCard}>
      <div style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 600 }}>{label}</div>
      <div className="mono" style={{ fontSize: 21, fontWeight: 600, color: alerta ? 'var(--err)' : 'var(--ink)', marginTop: 6 }}>
        {formatear(animado)}{sufijo}
      </div>
    </div>
  );
}

const pageTitle = { margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em' };
const btnGhost = { background: '#fff', border: '1.5px solid var(--line)', borderRadius: 8, padding: '8px 14px', fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' };
const boxHome = {
  background: '#fff', border: '1.5px solid var(--line)', borderRadius: 14, padding: 24,
  flex: '1 1 320px', minWidth: 280, cursor: 'pointer',
};
const badgeStyle = { background: 'var(--err)', color: '#fff', fontSize: 11, fontWeight: 700, borderRadius: 20, padding: '3px 9px' };
const rowCard = { padding: '16px 0', borderBottom: '1px solid var(--line-soft)' };
const filtroInput = { border: '1.5px solid var(--line)', borderRadius: 8, padding: '8px 11px', fontSize: 12.5, fontFamily: 'inherit', background: '#fff' };
const emptyState = { textAlign: 'center', padding: '48px 20px', color: 'var(--muted)' };
const statCard = { background: '#fff', border: '1px solid var(--line)', borderRadius: 12, padding: '16px 18px', flex: '1 1 180px', minWidth: 170 };
const barTrack = { background: 'var(--line-soft)', borderRadius: 6, height: 9, overflow: 'hidden' };
const barFill = { height: '100%', borderRadius: 6 };
const badgeAnulada = { fontSize: 10.5, fontWeight: 700, color: 'var(--err)', background: 'var(--err-bg)', borderRadius: 5, padding: '2px 7px' };
const btnAnular = { background: '#fff', border: '1.5px solid var(--err)', color: 'var(--err)', borderRadius: 8, padding: '8px 14px', fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' };
const btnConfirmarAnular = { background: 'var(--err)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const notaInput = { width: '100%', border: '1.5px solid var(--line)', borderRadius: 8, padding: '8px 10px', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' };