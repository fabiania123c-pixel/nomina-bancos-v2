import { useEffect, useState } from 'react';
import AppShell from '../components/AppShell.jsx';
import { getHistorialCorridas, getArchivosCorrida, marcarSubidoBanco } from '../lib/historial.js';
import { calcularKPIs, corridasRecientes, calcularPorPersona, filtrarPorEmpresa, LABEL_BANCO } from '../lib/kpis.js';
import { descargarPdfResumen } from '../lib/pdf.js';
import { descargarDetalleExcel } from '../lib/detalleExport.js';
import { buildFileContent } from '../lib/bankProfiles.js';
import { EMPRESAS, EMPRESAS_KEYS } from '../lib/empresas.js';
import { nombreArchivoBanco, nombrePdfResumen } from '../lib/nombresArchivo.js';
import { useConteo } from '../lib/useConteo.js';

const LABEL_TIPO = {
  finiquito: 'Finiquitos',
  prestamo: 'Préstamos',
  jubilacion: 'Jubilación',
  teletrabajo: 'Teletrabajo',
  nomina_regular: 'Nómina regular',
};
const COLOR_BANCO = { produbanco: 'var(--bank-produbanco)', pichincha: 'var(--bank-pichincha)', guayaquil: 'var(--bank-guayaquil)' };

export default function AdminDashboard({ perfil, onLogout }) {
  const [corridas, setCorridas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [vista, setVista] = useState('home');
  // 'consolidado' = las 3 empresas juntas; si no, 'superdeporte' | 'equinox' | 'medeport'
  const [filtroEmpresa, setFiltroEmpresa] = useState('consolidado');

  useEffect(() => {
    getHistorialCorridas(500).then((data) => {
      setCorridas(data);
      setCargando(false);
    });
  }, []);

  const recientes = corridasRecientes(corridas, 48);
  const corridasVista = filtrarPorEmpresa(corridas, filtroEmpresa);

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

      {!cargando && vista !== 'home' && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 18 }}>
          <button type="button" onClick={() => setFiltroEmpresa('consolidado')} style={filtroEmpresa === 'consolidado' ? pillActivo : pillInactivo}>
            Consolidado
          </button>
          {EMPRESAS_KEYS.map((key) => (
            <button key={key} type="button" onClick={() => setFiltroEmpresa(key)} style={filtroEmpresa === key ? pillActivo : pillInactivo}>
              {EMPRESAS[key].label}
            </button>
          ))}
        </div>
      )}

      {!cargando && vista === 'home' && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 28 }}>
          <BoxHome
            titulo="Procesos finalizados"
            descripcion="Historial de corridas generadas — revisa, confirma la subida a cada banco, y descarga el resumen en PDF de cualquiera."
            badge={recientes.length > 0 ? recientes.length : null}
            onClick={() => setVista('procesos')}
          />
          <BoxHome
            titulo="Dashboard de seguimiento"
            descripcion="Cuánto se ha movido por banco, tendencia mensual, por tipo de transacción, por responsable."
            onClick={() => setVista('kpis')}
          />
        </div>
      )}

      {!cargando && vista === 'procesos' && <VistaProcesos corridas={corridasVista} perfil={perfil} />}
      {!cargando && vista === 'kpis' && <VistaKPIs corridas={corridasVista} mostrarPorEmpresa={filtroEmpresa === 'consolidado'} />}
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

function VistaProcesos({ corridas, perfil }) {
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
          En cuanto se finalice una corrida de esta selección, va a aparecer en esta lista.
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
          <option value="prestamo">Préstamos</option>
          <option value="jubilacion">Jubilación</option>
          <option value="teletrabajo">Teletrabajo</option>
          <option value="nomina_regular">Nómina regular (histórico)</option>
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
            <CorridaRow key={c.id} corrida={c} perfil={perfil} />
          ))}
        </div>
      )}
    </div>
  );
}

function CorridaRow({ corrida: c, perfil }) {
  const [descargando, setDescargando] = useState(null);
  const [descargandoDetalle, setDescargandoDetalle] = useState(false);
  const [error, setError] = useState('');

  const [marcando, setMarcando] = useState(null);
  const [subidoBancoLocal, setSubidoBancoLocal] = useState({});

  const anulada = c.anulada;
  const notaAnulacion = c.notaAnulacion;
  const subidoBancoEfectivo = { ...(c.subidoBanco || {}), ...subidoBancoLocal };

  const empresa = c.empresa || 'superdeporte';
  const fechaCorrida = new Date(c.fecha);
  const ddF = String(fechaCorrida.getDate()).padStart(2, '0');
  const mmF = String(fechaCorrida.getMonth() + 1).padStart(2, '0');
  const yyyyF = String(fechaCorrida.getFullYear());

  function descargarPdf() {
    descargarPdfResumen({
      tipo: c.tipo,
      empresa: EMPRESAS[empresa]?.label,
      periodo: `MES-${mmF}-${yyyyF}`,
      fecha: `${ddF}/${mmF}/${yyyyF}`,
      generadoPor: c.generadoPorNombre,
      detalleBancos: c.detalle_bancos,
      filename: nombrePdfResumen({ empresa, dd: ddF, mm: mmF, yyyy: yyyyF }),
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
      const ctx = { ...archivos.ctx, empresa, secuencia: c.secuencia_guayaquil ?? archivos.ctx?.secuencia ?? null };
      const content = buildFileContent(banco, archivos.filas_por_banco[banco], ctx);
      const filename = nombreArchivoBanco(banco, ctx);
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

  async function descargarDetalle() {
    setError('');
    setDescargandoDetalle(true);
    try {
      const archivos = await getArchivosCorrida(c.id);
      if (!archivos) {
        setError('No se encontró el archivo guardado para esta corrida.');
        return;
      }
      await descargarDetalleExcel({
        resultado: archivos.filas_por_banco,
        tipo: c.tipo,
        filename: `detalle-nomina-${EMPRESAS[empresa]?.abrev || 'Super'}-${ddF}${mmF}${yyyyF}.xlsx`,
      });
    } catch (err) {
      console.error(err);
      setError('No se pudo descargar el detalle: ' + err.message);
    } finally {
      setDescargandoDetalle(false);
    }
  }

  async function marcarSubido(banco) {
    setError('');
    setMarcando(banco);
    try {
      const nombreQuienConfirma = perfil?.nombre || 'Admin';
      await marcarSubidoBanco(c.id, banco, nombreQuienConfirma);
      setSubidoBancoLocal((prev) => ({
        ...prev,
        [banco]: { at: new Date().toISOString(), por: nombreQuienConfirma },
      }));
    } catch (err) {
      console.error(err);
      setError(`No se pudo confirmar la subida a ${LABEL_BANCO[banco]}: ` + err.message);
    } finally {
      setMarcando(null);
    }
  }

  return (
    <div style={{ ...rowCard, opacity: anulada ? 0.7 : 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>
            {LABEL_TIPO[c.tipo] || c.tipo}
            <span style={badgeEmpresa}>{EMPRESAS[empresa]?.label || empresa}</span>
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
          {Object.entries(c.detalle_bancos || {}).map(([banco, info]) => {
            const subido = subidoBancoEfectivo[banco];
            return (
              <div key={banco} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', borderLeft: `2px solid ${COLOR_BANCO[banco]}`, paddingLeft: 8 }}>
                <span className="mono" style={{ fontSize: 12 }}>
                  {LABEL_BANCO[banco]} · {info.registros} reg. · ${info.total?.toFixed(2)}
                </span>
                {subido ? (
                  <span style={badgeSubido}>✓ Subido {new Date(subido.at).toLocaleDateString('es-EC')} · {subido.por}</span>
                ) : (
                  <span style={badgePendienteSubida}>Pendiente de subir al banco</span>
                )}
              </div>
            );
          })}
          {c.registros_con_error > 0 && (
            <span style={{ fontSize: 12, color: 'var(--err)' }}>{c.registros_con_error} error(es)</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {Object.keys(c.detalle_bancos || {}).map((banco) => (
            <button key={banco} onClick={() => descargarTxt(banco)} disabled={descargando === banco} style={btnGhost}>
              {descargando === banco ? '…' : `${LABEL_BANCO[banco]} · .txt`}
            </button>
          ))}
          <button onClick={descargarPdf} style={btnGhost}>Descargar PDF</button>
          <button onClick={descargarDetalle} disabled={descargandoDetalle} style={btnGhost}>
            {descargandoDetalle ? '…' : 'Descargar detalle'}
          </button>
        </div>
      </div>

      {!anulada && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', marginTop: 10 }}>
          {Object.keys(c.detalle_bancos || {})
            .filter((banco) => !subidoBancoEfectivo[banco])
            .map((banco) => (
              <button key={`subir-${banco}`} onClick={() => marcarSubido(banco)} disabled={marcando === banco} style={btnConfirmarSubido}>
                {marcando === banco ? 'Confirmando…' : `Confirmar subido a ${LABEL_BANCO[banco]}`}
              </button>
            ))}
        </div>
      )}

      {error && <div style={{ fontSize: 12, color: 'var(--err)', marginTop: 8 }}>{error}</div>}
    </div>
  );
}

function VistaKPIs({ corridas, mostrarPorEmpresa }) {
  const k = calcularKPIs(corridas);
  const porPersona = calcularPorPersona(corridas);
  const maxBanco = Math.max(1, ...Object.values(k.porBanco).map((b) => b.total));
  const maxTipo = Math.max(1, ...Object.values(k.porTipo).map((t) => t.total));
  const maxMes = Math.max(1, ...k.tendenciaMensual.map(([, total]) => total));
  const maxEmpresa = Math.max(1, ...Object.values(k.porEmpresa).map((e) => e.total));
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

      {mostrarPorEmpresa && Object.keys(k.porEmpresa).length > 0 && (
        <ChartSection title="Por empresa">
          {Object.entries(k.porEmpresa).map(([emp, info]) => (
            <BarRow
              key={emp}
              label={`${EMPRESAS[emp]?.label || emp} · ${info.corridas} corrida${info.corridas !== 1 ? 's' : ''}`}
              value={`${info.registros} reg. · $${info.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
              pct={(info.total / maxEmpresa) * 100}
              color="var(--accent)"
            />
          ))}
        </ChartSection>
      )}

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

      {Object.keys(k.porTipo).length > 0 && (
        <ChartSection title="Por tipo de transacción">
          {Object.entries(k.porTipo).map(([tipoKey, info]) => (
            <BarRow
              key={tipoKey}
              label={`${LABEL_TIPO[tipoKey] || tipoKey} · ${info.corridas} corrida${info.corridas !== 1 ? 's' : ''}`}
              value={`$${info.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
              pct={(info.total / maxTipo) * 100}
              color="var(--accent-2)"
            />
          ))}
        </ChartSection>
      )}

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
const badgeSubido = { fontSize: 10.5, fontWeight: 700, color: 'var(--ok)', background: 'rgba(22,163,74,0.12)', borderRadius: 5, padding: '2px 7px', whiteSpace: 'nowrap' };
const badgePendienteSubida = { fontSize: 10.5, fontWeight: 700, color: 'var(--warn)', background: 'var(--warn-bg)', borderRadius: 5, padding: '2px 7px', whiteSpace: 'nowrap' };
const btnConfirmarSubido = { background: '#fff', border: '1.5px solid var(--ok)', color: 'var(--ok)', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const pillActivo = { background: 'var(--accent)', color: '#fff', border: '1.5px solid var(--accent)', borderRadius: 20, padding: '8px 16px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const pillInactivo = { background: '#fff', color: 'var(--ink)', border: '1.5px solid var(--line)', borderRadius: 20, padding: '8px 16px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const badgeEmpresa = { fontSize: 10.5, fontWeight: 700, color: 'var(--accent)', background: 'var(--line-soft)', borderRadius: 5, padding: '2px 7px', marginLeft: 8, whiteSpace: 'nowrap' };