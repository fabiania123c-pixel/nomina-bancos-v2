import { useState, useEffect } from 'react';
import AppShell from '../components/AppShell.jsx';
import { parseDataMadre, parseArchivoPago } from '../lib/excelParser.js';
import { cruzarConDataMadre } from '../lib/cruce.js';
import { buildFileContent, BANK_PROFILES } from '../lib/bankProfiles.js';
import { registrarCorrida, finalizarCorrida, registrarArchivosCorrida, getHistorialCorridas } from '../lib/historial.js';
import { descargarPdfResumen } from '../lib/pdf.js';
import { compararConHistorico } from '../lib/kpis.js';

const MESES = [
  ['01', 'Enero'], ['02', 'Febrero'], ['03', 'Marzo'], ['04', 'Abril'],
  ['05', 'Mayo'], ['06', 'Junio'], ['07', 'Julio'], ['08', 'Agosto'],
  ['09', 'Septiembre'], ['10', 'Octubre'], ['11', 'Noviembre'], ['12', 'Diciembre'],
];
const LABEL_BANCO = { produbanco: 'Produbanco', pichincha: 'Banco Pichincha', guayaquil: 'Banco de Guayaquil' };
const COLOR_BANCO = { produbanco: 'var(--bank-produbanco)', pichincha: 'var(--bank-pichincha)', guayaquil: 'var(--bank-guayaquil)' };

export default function OperadorDashboard({ perfil, onLogout }) {
  const hoy = new Date();
  const [tipo, setTipo] = useState('finiquito');
  const [mm, setMm] = useState(String(hoy.getMonth() + 1).padStart(2, '0'));
  const [dd, setDd] = useState(String(hoy.getDate()));
  const [yyyy, setYyyy] = useState(String(hoy.getFullYear()));
  const [cuentaOrigen, setCuentaOrigen] = useState('01005024240');
  const [ruc, setRuc] = useState('1791413237001');

  const [dataMadreFile, setDataMadreFile] = useState(null);
  const [pagoFile, setPagoFile] = useState(null);

  const [procesando, setProcesando] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState('');
  const [resultado, setResultado] = useState(null);

  const [finalizando, setFinalizando] = useState(false);
  const [finalizado, setFinalizado] = useState(false);

  const [historial, setHistorial] = useState([]);
  const [previaAbierta, setPreviaAbierta] = useState({});

  useEffect(() => {
    getHistorialCorridas(200).then(setHistorial);
  }, []);

  async function procesar() {
    setErrorGeneral('');
    setResultado(null);
    setFinalizado(false);
    if (!dataMadreFile || !pagoFile) {
      setErrorGeneral('Sube los dos archivos antes de procesar.');
      return;
    }
    setProcesando(true);
    try {
      const [dataMadreBuf, pagoBuf] = await Promise.all([
        dataMadreFile.arrayBuffer(),
        pagoFile.arrayBuffer(),
      ]);
      const mapaDataMadre = parseDataMadre(dataMadreBuf);
      const filasPago = parseArchivoPago(pagoBuf);
      const cruce = cruzarConDataMadre(filasPago, mapaDataMadre);
      setResultado(cruce);
    } catch (err) {
      console.error(err);
      setErrorGeneral(err.message || 'Ocurrió un error procesando los archivos.');
    } finally {
      setProcesando(false);
    }
  }

  function ctxBase() {
    return { cuentaOrigen, ruc, mm, dd, yyyy };
  }

  function descargarBanco(bancoKey) {
    const filas = resultado.resultado[bancoKey];
    const content = buildFileContent(bancoKey, filas, ctxBase());
    const filename = BANK_PROFILES[bancoKey].filename({ mm, dd, yyyy });
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function detalleBancos() {
    const detalle = {};
    for (const banco of ['produbanco', 'pichincha', 'guayaquil']) {
      const filas = resultado.resultado[banco];
      if (filas.length === 0) continue;
      const total = filas.reduce((acc, r) => acc + (parseFloat(r.monto) || 0), 0);
      detalle[banco] = { registros: filas.length, total };
    }
    return detalle;
  }

  function descargarPdf() {
    descargarPdfResumen({
      tipo,
      periodo: `${dd}/${mm}/${yyyy}`,
      generadoPor: perfil.nombre,
      detalleBancos: detalleBancos(),
      filename: `resumen-nomina-${dd}${mm}${yyyy}.pdf`,
    });
  }

  async function handleFinalizar() {
    setFinalizando(true);
    try {
      const corrida = await registrarCorrida({
        tipo,
        detalleBancos: detalleBancos(),
        registrosConError: resultado.errores.length,
      });
      await registrarArchivosCorrida(corrida.id, resultado.resultado, ctxBase());
      await finalizarCorrida(corrida.id);
      setFinalizado(true);
    } catch (err) {
      console.error(err);
      setErrorGeneral('No se pudo registrar la corrida: ' + err.message);
    } finally {
      setFinalizando(false);
    }
  }

  const hayErrores = resultado && resultado.errores.length > 0;
  const hayResultados =
    resultado && !hayErrores && Object.values(resultado.resultado).some((f) => f.length > 0);
  const avisosHistorico = hayResultados ? compararConHistorico(detalleBancos(), historial, tipo) : [];
  const hayAdvertencias =
    (resultado && resultado.advertencias && resultado.advertencias.length > 0) || avisosHistorico.length > 0;

  return (
    <AppShell perfil={perfil} onLogout={onLogout}>
      <h1 style={pageTitle}>Generar archivos de pago</h1>
      <p style={pageSubtitle}>Sube Data_madre y el archivo de pago — el cruce y el formato de cada banco se arman solos.</p>

      <Section num="1" title="Datos de la corrida">
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <Field label="Tipo">
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={input}>
              <option value="finiquito">Finiquitos</option>
              <option value="nomina_regular">Nómina regular</option>
            </select>
          </Field>
          <Field label="Mes">
            <select value={mm} onChange={(e) => setMm(e.target.value)} style={input}>
              {MESES.map(([v, l]) => <option key={v} value={v}>{v} · {l}</option>)}
            </select>
          </Field>
          <Field label="Día">
            <input value={dd} onChange={(e) => setDd(e.target.value)} className="mono" style={{ ...input, width: 60 }} />
          </Field>
          <Field label="Año">
            <input value={yyyy} onChange={(e) => setYyyy(e.target.value)} className="mono" style={{ ...input, width: 80 }} />
          </Field>
          <Field label="Cuenta origen (Produbanco)">
            <input value={cuentaOrigen} onChange={(e) => setCuentaOrigen(e.target.value)} className="mono" style={input} />
          </Field>
          <Field label="RUC (Pichincha)">
            <input value={ruc} onChange={(e) => setRuc(e.target.value)} className="mono" style={input} />
          </Field>
        </div>
      </Section>

      <Section num="2" title="Subir archivos">
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <Dropzone
            label="Data_madre"
            hint=".xlsx / .xlsm"
            fileName={dataMadreFile?.name}
            onChange={(f) => setDataMadreFile(f)}
            accept=".xlsx,.xlsm"
          />
          <Dropzone
            label={tipo === 'finiquito' ? 'Archivo de finiquitos' : 'Archivo de nómina'}
            hint=".xlsx"
            fileName={pagoFile?.name}
            onChange={(f) => setPagoFile(f)}
            accept=".xlsx"
          />
        </div>
        <button onClick={procesar} disabled={procesando} style={{ ...btnPrimary, marginTop: 20 }}>
          {procesando ? 'Procesando…' : 'Procesar'}
        </button>
        {errorGeneral && <div style={errBox}>{errorGeneral}</div>}
      </Section>

      {hayErrores && (
        <Panel tono="err" titulo={`${resultado.errores.length} fila(s) con error — corrige el archivo y vuelve a procesar`}>
          {resultado.errores.slice(0, 20).map((e, i) => (
            <div key={i} style={panelLine}>
              <span className="mono" style={{ color: 'var(--muted)' }}>Fila {e.fila}</span> — {e.nombre || 'sin nombre'}, cédula <span className="mono">{e.cedula}</span>: {e.motivo}
            </div>
          ))}
          {resultado.errores.length > 20 && <div style={panelLine}>… y {resultado.errores.length - 20} más.</div>}
        </Panel>
      )}

      {hayAdvertencias && (
        <Panel tono="warn" titulo="Vale la pena revisar esto antes de finalizar">
          {avisosHistorico.map((texto, i) => (
            <div key={`h${i}`} style={panelLine}>{texto}</div>
          ))}
          {resultado?.advertencias?.slice(0, 20).map((a, i) => (
            <div key={i} style={panelLine}>
              <span className="mono" style={{ color: 'var(--muted)' }}>Fila {a.fila}</span> — {a.nombre || 'sin nombre'}, cédula <span className="mono">{a.cedula}</span>: {a.motivo}
            </div>
          ))}
          {resultado?.advertencias?.length > 20 && <div style={panelLine}>… y {resultado.advertencias.length - 20} más.</div>}
        </Panel>
      )}

      {hayResultados && (
        <Section num="3" title="Resumen y descarga">
          {Object.entries(detalleBancos()).map(([banco, info]) => (
            <div key={banco}>
              <div style={filaBanco}>
                <div style={{ borderLeft: `2px solid ${COLOR_BANCO[banco]}`, paddingLeft: 10 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{LABEL_BANCO[banco]}</div>
                  <div className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {info.registros} reg. · ${info.total.toFixed(2)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => setPreviaAbierta((p) => ({ ...p, [banco]: !p[banco] }))}
                    style={btnGhost}
                  >
                    {previaAbierta[banco] ? 'Ocultar vista previa' : 'Vista previa'}
                  </button>
                  <button onClick={() => descargarBanco(banco)} style={btnGhost}>Descargar .txt</button>
                </div>
              </div>
              {previaAbierta[banco] && (
                <div style={previewBox}>
                  {buildFileContent(banco, resultado.resultado[banco], ctxBase())
                    .split('\r\n')
                    .slice(0, 3)
                    .map((linea, i) => (
                      <div key={i} className="mono" style={previewLine}>{linea || '\u00A0'}</div>
                    ))}
                  {resultado.resultado[banco].length > 3 && (
                    <div style={{ fontSize: 11, color: 'var(--muted-2)', marginTop: 6 }}>
                      … y {resultado.resultado[banco].length - 3} línea(s) más en el archivo completo.
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button onClick={descargarPdf} style={btnGhost}>Descargar resumen PDF</button>
            <button onClick={handleFinalizar} disabled={finalizando || finalizado} style={btnPrimary}>
              {finalizado ? 'Proceso finalizado ✓' : finalizando ? 'Finalizando…' : 'Finalizar proceso'}
            </button>
          </div>
          {finalizado && <p style={{ fontSize: 12.5, color: 'var(--ok)', marginTop: 10 }}>Registrado en el historial — el Admin ya lo puede ver.</p>}
        </Section>
      )}
    </AppShell>
  );
}

function Section({ num, title, children }) {
  return (
    <section style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginBottom: 14 }}>
        <span className="mono" style={sectionNum}>{num}</span>
        <h2 style={sectionTitle}>{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--muted)' }}>{label}</label>
      {children}
    </div>
  );
}

function Dropzone({ label, hint, fileName, onChange, accept }) {
  const [arrastrando, setArrastrando] = useState(false);

  function handleDrop(e) {
    e.preventDefault();
    setArrastrando(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onChange(file);
  }

  return (
    <label
      style={{ ...dropzone, ...(arrastrando ? dropzoneActivo : {}) }}
      onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
      onDragLeave={() => setArrastrando(false)}
      onDrop={handleDrop}
    >
      <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
      <div className="mono" style={{ fontSize: 11, color: 'var(--muted-2)', marginTop: 2 }}>{hint}</div>
      <div style={{ fontSize: 12, color: fileName ? 'var(--accent)' : 'var(--muted)', marginTop: 10 }}>
        {fileName || (arrastrando ? 'Suelta aquí…' : 'Elegir archivo o arrastrar aquí…')}
      </div>
      <input type="file" accept={accept} onChange={(e) => onChange(e.target.files[0])} style={{ display: 'none' }} />
    </label>
  );
}

function Panel({ tono, titulo, children }) {
  const map = {
    err: { bg: 'var(--err-bg)', color: 'var(--err)' },
    warn: { bg: 'var(--warn-bg)', color: 'var(--warn)' },
  };
  const t = map[tono];
  return (
    <div style={{ background: t.bg, borderRadius: 10, padding: '16px 18px', marginBottom: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: t.color, marginBottom: 8 }}>{titulo}</div>
      {children}
    </div>
  );
}

const pageTitle = { margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em' };
const pageSubtitle = { margin: '6px 0 36px', fontSize: 13.5, color: 'var(--muted)' };
const sectionNum = { fontSize: 12, color: 'var(--accent)', fontWeight: 600 };
const sectionTitle = { margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--ink)' };
const input = { border: '1.5px solid var(--line)', borderRadius: 8, padding: '9px 11px', fontSize: 13.5, fontFamily: 'inherit' };
const btnPrimary = { background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '11px 20px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' };
const btnGhost = { background: '#fff', border: '1.5px solid var(--line)', borderRadius: 8, padding: '9px 16px', fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' };
const errBox = { color: 'var(--err)', fontSize: 12.5, marginTop: 12 };
const filaBanco = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 0', borderBottom: '1px solid var(--line-soft)' };
const bankDot = { width: 9, height: 9, borderRadius: '50%', display: 'inline-block', flexShrink: 0 };
const dropzone = {
  flex: '1 1 220px', background: '#fff', border: '1.5px dashed var(--line)', borderRadius: 12,
  padding: '18px 20px', cursor: 'pointer', display: 'block', transition: 'border-color .15s, background .15s',
};
const dropzoneActivo = { borderColor: 'var(--accent)', background: '#F2F5FE' };
const previewBox = {
  background: 'var(--navy)', borderRadius: 8, padding: '12px 14px', marginTop: 8, marginBottom: 4,
  overflowX: 'auto',
};
const previewLine = { fontSize: 11, color: '#B7C0E8', whiteSpace: 'pre', lineHeight: 1.6 };
const panelLine = { fontSize: 12.5, marginBottom: 4, color: 'var(--ink)' };