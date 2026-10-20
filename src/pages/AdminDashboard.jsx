import { useEffect, useState } from 'react';
import AppShell from '../components/AppShell.jsx';
import { getHistorialCorridas, getArchivosCorrida, marcarSubidoBanco } from '../lib/historial.js';
import { filtrarPorEmpresa, LABEL_BANCO } from '../lib/kpis.js';
import { PanelKPIs, CorridaCabecera, LineaBanco, ChipEstado, tarjetaCorridaStyle } from '../components/SeguimientoUI.jsx';
import { descargarPdfResumen } from '../lib/pdf.js';
import { descargarDetalleExcel } from '../lib/detalleExport.js';
import { buildFileContent } from '../lib/bankProfiles.js';
import { EMPRESAS, EMPRESAS_KEYS } from '../lib/empresas.js';
import { nombreArchivoBanco, nombrePdfResumen, nombreDetalleExcel } from '../lib/nombresArchivo.js';
import { useEstadoPersistente } from '../lib/useEstadoPersistente.js';
import { useDescargados, estiloDescarga, textoDescarga } from '../lib/descargados.js';


export default function AdminDashboard({ perfil, onLogout }) {
  const [corridas, setCorridas] = useState([]);
  const [cargando, setCargando] = useState(true);
  // La pantalla en la que está y el filtro de empresa se recuerdan: si la página se recarga o se vuelve a montar,
  // la persona sigue donde estaba (no regresa al inicio).
  const idUsuario = perfil?.id || perfil?.nombre || 'admin';
  const [vista, setVista] = useEstadoPersistente(`nomina:${idUsuario}:admin:vista`, 'home');
  // 'consolidado' = las 3 empresas juntas; si no, 'superdeporte' | 'equinox' | 'medeport'
  const [filtroEmpresa, setFiltroEmpresa] = useEstadoPersistente(`nomina:${idUsuario}:admin:empresa`, 'consolidado');

  useEffect(() => {
    getHistorialCorridas(500).then((data) => {
      setCorridas(data);
      setCargando(false);
    });
  }, []);

  // "Por revisar" = corridas finalizadas, no anuladas, con al menos un banco todavía sin confirmar como subido.
  // Se va apagando solo a medida que se confirma la subida de cada banco.
  const recientes = corridas.filter(
    (c) => c.finalizado && !c.anulada && Object.keys(c.detalle_bancos || {}).some((banco) => !c.subidoBanco?.[banco])
  );
  const corridasVista = filtrarPorEmpresa(corridas, filtroEmpresa);

  // Cuando se confirma la subida de un banco, se actualiza la lista en memoria para que el contador baje al instante.
  function alConfirmarSubido(corridaId, banco, confirmado) {
    setCorridas((prev) =>
      prev.map((x) => (x.id === corridaId ? { ...x, subidoBanco: { ...(x.subidoBanco || {}), [banco]: confirmado } } : x))
    );
  }

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

      {!cargando && vista === 'procesos' && <VistaProcesos corridas={corridasVista} perfil={perfil} idUsuario={idUsuario} alConfirmarSubido={alConfirmarSubido} />}
      {!cargando && vista === 'kpis' && <VistaKPIs corridas={corridasVista} mostrarPorEmpresa={filtroEmpresa === 'consolidado'} />}
    </AppShell>
  );
}

function BoxHome({ titulo, descripcion, badge, onClick }) {
  return (
    <div onClick={onClick} style={boxHome}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <h2 style={{ margin: 0, fontSize: 15.5, fontWeight: 600 }}>{titulo}</h2>
        {badge && <span style={badgeStyle}>{badge} por revisar</span>}
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 10, lineHeight: 1.5 }}>{descripcion}</p>
    </div>
  );
}

function VistaProcesos({ corridas, perfil, idUsuario, alConfirmarSubido }) {
  const [busqueda, setBusqueda] = useEstadoPersistente(`nomina:${idUsuario}:admin:busqueda`, '');
  const [filtroTipo, setFiltroTipo] = useEstadoPersistente(`nomina:${idUsuario}:admin:tipo`, 'todos');
  const [filtroBanco, setFiltroBanco] = useEstadoPersistente(`nomina:${idUsuario}:admin:banco`, 'todos');

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
          <option value="nomina_regular">Rebotes</option>
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
            <CorridaRow key={c.id} corrida={c} perfil={perfil} soloBanco={filtroBanco === 'todos' ? null : filtroBanco} alConfirmarSubido={alConfirmarSubido} />
          ))}
        </div>
      )}
    </div>
  );
}

function CorridaRow({ corrida: c, perfil, soloBanco, alConfirmarSubido }) {
  const { hecho, marcar } = useDescargados(c.id);
  const [descargando, setDescargando] = useState(null);
  const [descargandoDetalle, setDescargandoDetalle] = useState(false);
  const [error, setError] = useState('');

  const [marcando, setMarcando] = useState(null);
  const [subidoBancoLocal, setSubidoBancoLocal] = useState({});

  const anulada = c.anulada;
  const notaAnulacion = c.notaAnulacion;
  const subidoBancoEfectivo = { ...(c.subidoBanco || {}), ...subidoBancoLocal };

  // Bancos que se muestran: todos, o solo el que se eligió en el filtro.
  const bancosVisibles = Object.keys(c.detalle_bancos || {}).filter((b) => !soloBanco || b === soloBanco);

  const empresa = c.empresa || 'superdeporte';
  const fechaCorrida = new Date(c.fecha);
  const ddF = String(fechaCorrida.getDate()).padStart(2, '0');
  const mmF = String(fechaCorrida.getMonth() + 1).padStart(2, '0');
  const yyyyF = String(fechaCorrida.getFullYear());
  // La fecha del NOMBRE de cada archivo es la del día en que se descarga (se toma al hacer clic).
  const fechaDescarga = () => {
    const h = new Date();
    return { dd: String(h.getDate()).padStart(2, '0'), mm: String(h.getMonth() + 1).padStart(2, '0'), yyyy: String(h.getFullYear()) };
  };

  function descargarPdf() {
    const hoy = fechaDescarga();
    descargarPdfResumen({
      tipo: c.tipo,
      empresa: EMPRESAS[empresa]?.label,
      periodo: `MES-${mmF}-${yyyyF}`,
      fecha: `${ddF}/${mmF}/${yyyyF}`,
      generadoPor: c.generadoPorNombre,
      detalleBancos: c.detalle_bancos,
      filename: nombrePdfResumen({ empresa, tipo: c.tipo, ...hoy }),
    });
    marcar('resumen');
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
      const ctx = { ...archivos.ctx, empresa, tipo: c.tipo, secuencia: c.secuencia_guayaquil ?? archivos.ctx?.secuencia ?? null };
      const content = buildFileContent(banco, archivos.filas_por_banco[banco], ctx);
      const filename = nombreArchivoBanco(banco, { ...ctx, ...fechaDescarga() });
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      marcar(`txt:${banco}`);
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
        filename: nombreDetalleExcel({ empresa, tipo: c.tipo, ...fechaDescarga() }),
      });
      marcar('detalle');
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
    // Se pinta de verde al instante; si el servidor no lo puede guardar, se revierte y sale el error en rojo.
    setSubidoBancoLocal((prev) => ({ ...prev, [banco]: { at: new Date().toISOString(), por: perfil?.nombre || 'Admin' } }));
    try {
      // Devuelve lo que quedó GUARDADO en la base (fecha y nombre reales).
      const confirmado = await marcarSubidoBanco(c.id, banco);
      setSubidoBancoLocal((prev) => ({ ...prev, [banco]: confirmado }));
      if (alConfirmarSubido) alConfirmarSubido(c.id, banco, confirmado);
    } catch (err) {
      console.error(err);
      setSubidoBancoLocal((prev) => {
        const sig = { ...prev };
        delete sig[banco];
        return sig;
      });
      setError(`No se pudo confirmar la subida a ${LABEL_BANCO[banco]}: ` + err.message);
    } finally {
      setMarcando(null);
    }
  }

  return (
    <div style={{ ...tarjetaCorridaStyle, opacity: anulada ? 0.7 : 1 }}>
      <CorridaCabecera corrida={c} />

      {anulada && (
        <div style={{ fontSize: 13.5, color: 'var(--err)', marginTop: 8 }}>
          {notaAnulacion}
        </div>
      )}

      <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {Object.entries(c.detalle_bancos || {})
            .filter(([banco]) => bancosVisibles.includes(banco))
            .map(([banco, info]) => (
              <LineaBanco key={banco} banco={banco} info={info} subido={subidoBancoEfectivo[banco]} />
            ))}
          {c.registros_con_error > 0 && (
            <ChipEstado tipo="error">{c.registros_con_error} error(es)</ChipEstado>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {bancosVisibles.map((banco) => (
            <button key={banco} onClick={() => descargarTxt(banco)} disabled={descargando === banco} style={estiloDescarga(btnGhost, hecho(`txt:${banco}`))}>
              {descargando === banco ? '…' : textoDescarga(`${LABEL_BANCO[banco]} · .txt`, hecho(`txt:${banco}`))}
            </button>
          ))}
          <button onClick={descargarPdf} style={estiloDescarga(btnGhost, hecho('resumen'))}>{textoDescarga('Descargar resumen', hecho('resumen'))}</button>
          <button onClick={descargarDetalle} disabled={descargandoDetalle} style={estiloDescarga(btnGhost, hecho('detalle'))}>
            {descargandoDetalle ? '…' : textoDescarga('Descargar detalle', hecho('detalle'))}
          </button>
        </div>
      </div>

      {!anulada && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', marginTop: 10 }}>
          {bancosVisibles
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
  return <PanelKPIs corridas={corridas} mostrarPorEmpresa={mostrarPorEmpresa} />;
}

const pageTitle = { margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em' };
const btnGhost = { background: '#fff', border: '1.5px solid var(--line)', borderRadius: 8, padding: '8px 14px', fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' };
const boxHome = {
  background: '#fff', border: '1.5px solid var(--line)', borderRadius: 14, padding: 24,
  flex: '1 1 320px', minWidth: 280, cursor: 'pointer',
};
const badgeStyle = { background: 'var(--err)', color: '#fff', fontSize: 11, fontWeight: 700, borderRadius: 20, padding: '3px 9px' };
const filtroInput = { border: '1.5px solid var(--line)', borderRadius: 8, padding: '8px 11px', fontSize: 12.5, fontFamily: 'inherit', background: '#fff' };
const emptyState = { textAlign: 'center', padding: '48px 20px', color: 'var(--muted)' };
const btnConfirmarSubido = { background: '#fff', border: '1.5px solid var(--ok)', color: 'var(--ok)', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const pillActivo = { background: 'var(--accent)', color: '#fff', border: '1.5px solid var(--accent)', borderRadius: 20, padding: '9px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const pillInactivo = { background: '#fff', color: 'var(--ink)', border: '1.5px solid var(--line)', borderRadius: 20, padding: '9px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };