import { useState, useEffect } from 'react';
import AppShell from '../components/AppShell.jsx';
import { parseDataMadre, parseArchivoPago } from '../lib/excelParser.js';
import { cruzarConDataMadre } from '../lib/cruce.js';
import { buildFileContent, BANK_PROFILES } from '../lib/bankProfiles.js';
import { registrarCorrida, finalizarCorrida, registrarArchivosCorrida, getHistorialCorridas } from '../lib/historial.js';
import { descargarPdfResumen } from '../lib/pdf.js';
import { descargarDetalleExcel } from '../lib/detalleExport.js';
import { compararConHistorico, calcularKPIs, calcularPorPersona, LABEL_BANCO } from '../lib/kpis.js';

const COLOR_BANCO = { produbanco: 'var(--bank-produbanco)', pichincha: 'var(--bank-pichincha)', guayaquil: 'var(--bank-guayaquil)' };

const LABEL_TIPO = {
  finiquito: 'Finiquitos',
  prestamo: 'Préstamos',
  jubilacion: 'Jubilación',
  teletrabajo: 'Teletrabajo',
  nomina_regular: 'Nómina regular',
};

const TIPOS = [
  { value: 'finiquito', label: 'Finiquitos' },
  { value: 'prestamo', label: 'Préstamos' },
  { value: 'jubilacion', label: 'Jubilación' },
  { value: 'teletrabajo', label: 'Teletrabajo' },
];

const LABEL_ARCHIVO_PAGO = {
  finiquito: 'Archivo de finiquitos',
  prestamo: 'Archivo de préstamos',
  jubilacion: 'Archivo de jubilación',
  teletrabajo: 'Archivo de teletrabajo',
};

// cuentaOrigen/ruc de Equinox y Medeport quedan vacíos hasta que se confirmen
// los reales — mientras tanto el campo sigue editable a mano para esos dos.
const EMPRESAS = {
  superdeporte: { label: 'Superdeporte', cuentaOrigen: '01005024240', ruc: '1791413237001' },
  equinox: { label: 'Equinox', cuentaOrigen: '', ruc: '' },
  medeport: { label: 'Medeport', cuentaOrigen: '', ruc: '' },
};

export default function OperadorDashboard({ perfil, onLogout }) {
  const hoy = new Date();
  const mm = String(hoy.getMonth() + 1).padStart(2, '0');
  const dd = String(hoy.getDate()).padStart(2, '0');
  const yyyy = String(hoy.getFullYear());

  const [vista, setVista] = useState('generar');

  const [tipo, setTipo] = useState('finiquito');
  const [empresa, setEmpresa] = useState('superdeporte');
  const [cuentaOrigen, setCuentaOrigen] = useState(EMPRESAS.superdeporte.cuentaOrigen);
  const [ruc, setRuc] = useState(EMPRESAS.superdeporte.ruc);

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
    getHistorialCorridas(500).then(setHistorial);
  }, []);

  const nav = [
    { label: 'Generar archivos', active: vista === 'generar', onClick: () => setVista('generar') },
    { label: 'Dashboard de seguimiento', active: vista === 'seguimiento', onClick: () => setVista('seguimiento') },
  ];

  function handleEmpresaChange(key) {
    setEmpresa(key);
    setCuentaOrigen(EMPRESAS[key].cuentaOrigen);
    setRuc(EMPRESAS[key].ruc);
  }

  async function procesar() {
    setErrorGeneral('');
    setResultado(null);
    setFinalizado(false);
    if (!cuentaOrigen || !ruc) {
      setErrorGeneral(`${EMPRESAS[empresa].label} todavía no tiene cuenta origen / RUC configurados en el sistema — avísale a Fabián antes de continuar.`);
      return;
    }
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
      periodo: `MES-${mm}-${yyyy}`,
      fecha: `${dd}/${mm}/${yyyy}`,
      generadoPor: perfil.nombre,
      detalleBancos: detalleBancos(),
      filename: `resumen-nomina-${dd}${mm}${yyyy}.pdf`,
    });
  }

  async function descargarDetalle() {
    try {
      await descargarDetalleExcel({
        resultado: resultado.resultado,
        tipo,
        filename: `detalle-nomina-${dd}${mm}${yyyy}.xlsx`,
      });
    } catch (err) {
      console.error(err);
      setErrorGeneral('No se pudo generar el Excel de detalle: ' + err.message);
    }
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
      getHistorialCorridas(500).then(setHistorial);
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
    <AppShell perfil={perfil} onLogout={onLogout} nav={nav}>
      {vista === 'generar' && (
        <>
          <h1 style={pageTitle}>Generar archivos de pago</h1>
          <p style={pageSubtitle}>Sube Data_madre y el archivo de pago — el cruce y el formato de cada banco se arman solos.</p>

          <Section num="1" title="Datos de la corrida">
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <Field label="Tipo de transacción">
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {TIPOS.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setTipo(t.value)}
                      style={tipo === t.value ? pillActivo : pillInactivo}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Empresa">
                <select value={empresa} onChange={(e) => handleEmpresaChange(e.target.value)} style={input}>
                  {Object.entries(EMPRESAS).map(([key, e]) => (
                    <option key={key} value={key}>{e.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Fecha de la corrida">
                <div className="mono" style={fechaAuto}>{dd}/{mm}/{yyyy}</div>
              </Field>
            </div>
            {/* Cuenta origen y RUC ya no se muestran en pantalla — los fija
                automáticamente la empresa seleccionada arriba (ver EMPRESAS). */}
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
                label={LABEL_ARCHIVO_PAGO[tipo] || 'Archivo de pago'}
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
                          <div key={i} className="mono" style={previewLine}>{linea || ' '}</div>
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

              <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
                <button onClick={descargarPdf} style={btnGhost}>Descargar resumen PDF</button>
                <button onClick={descargarDetalle} style={btnGhost}>Descargar detalle (Excel)</button>
                <button onClick={handleFinalizar} disabled={finalizando || finalizado} style={btnPrimary}>
                  {finalizado ? 'Proceso finalizado ✓' : finalizando ? 'Finalizando…' : 'Finalizar proceso'}
                </button>
              </div>
              {finalizado && <p style={{ fontSize: 12.5, color: 'var(--ok)', marginTop: 10 }}>Registrado en el historial — el Admin ya lo puede ver.</p>}
            </Section>
          )}
        </>
      )}

      {vista === 'seguimiento' && (
        <>
          <h1 style={pageTitle}>Dashboard de seguimiento</h1>
          <p style={pageSubtitle}>Solo lectura — acá no se puede editar ni anular nada, es para que tengas visibilidad de todo lo que se ha corrido.</p>
          <VistaSeguimiento corridas={historial} />
        </>
      )}
    </AppShell>
  );
}

function VistaSeguimiento({ corridas }) {
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [filtroBanco, setFiltroBanco] = useState('todos');

  if (corridas.length === 0) {
    return <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 24 }}>Todavía no hay corridas registradas.</p>;
  }

  const k = calcularKPIs(corridas);
  const porPersona = calcularPorPersona(corridas);
  const maxBanco = Math.max(1, ...Object.values(k.porBanco).map((b) => b.total));
  const maxTipo = Math.max(1, ...Object.values(k.porTipo).map((t) => t.total));
  const maxMes = Math.max(1, ...k.tendenciaMensual.map(([, total]) => total));
  const maxPersona = Math.max(1, ...porPersona.map((p) => p.total));

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
    <div style={{ marginTop: 20 }}>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 28 }}>
        <StatCardSeg label="Total histórico movido" valor={`$${k.totalGeneral.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
        <StatCardSeg label="Registros procesados" valor={k.registrosGeneral.toLocaleString('en-US')} />
        <StatCardSeg label="Corridas finalizadas" valor={`${k.corridasFinalizadas} / ${k.totalCorridas}`} />
        <StatCardSeg label="Errores acumulados" valor={String(k.erroresGeneral)} alerta={k.erroresGeneral > 0} />
      </div>

      <ChartSectionSeg title="Por banco">
        {Object.entries(k.porBanco).map(([banco, info]) => (
          <BarRowSeg
            key={banco}
            label={LABEL_BANCO[banco]}
            value={`${info.registros} reg. · $${info.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
            pct={(info.total / maxBanco) * 100}
            color={COLOR_BANCO[banco]}
          />
        ))}
      </ChartSectionSeg>

      {Object.keys(k.porTipo).length > 0 && (
        <ChartSectionSeg title="Por tipo de transacción">
          {Object.entries(k.porTipo).map(([tipoKey, info]) => (
            <BarRowSeg
              key={tipoKey}
              label={`${LABEL_TIPO[tipoKey] || tipoKey} · ${info.corridas} corrida${info.corridas !== 1 ? 's' : ''}`}
              value={`$${info.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
              pct={(info.total / maxTipo) * 100}
              color="var(--accent-2)"
            />
          ))}
        </ChartSectionSeg>
      )}

      {k.tendenciaMensual.length > 0 && (
        <ChartSectionSeg title="Tendencia (últimos meses)">
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 130 }}>
            {k.tendenciaMensual.map(([mes, total]) => (
              <div key={mes} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ background: 'var(--accent)', borderRadius: '4px 4px 0 0', height: `${(total / maxMes) * 92 + 6}px` }} title={`$${total.toFixed(2)}`} />
                <div className="mono" style={{ fontSize: 10, color: 'var(--muted)', marginTop: 6 }}>{mes}</div>
              </div>
            ))}
          </div>
        </ChartSectionSeg>
      )}

      {porPersona.length > 0 && (
        <ChartSectionSeg title="Por responsable">
          {porPersona.map((p) => (
            <BarRowSeg
              key={p.nombre}
              label={p.nombre}
              value={`${p.corridas} corrida(s) · ${p.registros} reg. · $${p.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}${p.errores > 0 ? `  ·  ${p.errores} error(es)` : ''}`}
              pct={(p.total / maxPersona) * 100}
              color="var(--accent-2)"
            />
          ))}
        </ChartSectionSeg>
      )}

      <h2 style={{ fontSize: 15, fontWeight: 600, margin: '36px 0 14px' }}>Historial de corridas</h2>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <input
          placeholder="Buscar por responsable…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          style={{ ...filtroInputSeg, flex: '1 1 200px' }}
        />
        <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} style={filtroInputSeg}>
          <option value="todos">Todos los tipos</option>
          <option value="finiquito">Finiquitos</option>
          <option value="prestamo">Préstamos</option>
          <option value="jubilacion">Jubilación</option>
          <option value="teletrabajo">Teletrabajo</option>
          <option value="nomina_regular">Nómina regular (histórico)</option>
        </select>
        <select value={filtroBanco} onChange={(e) => setFiltroBanco(e.target.value)} style={filtroInputSeg}>
          <option value="todos">Todos los bancos</option>
          <option value="produbanco">Produbanco</option>
          <option value="pichincha">Banco Pichincha</option>
          <option value="guayaquil">Banco de Guayaquil</option>
        </select>
      </div>

      {filtradas.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>Nada coincide con ese filtro.</p>
      ) : (
        filtradas.map((c) => <FilaSeguimiento key={c.id} corrida={c} />)
      )}
    </div>
  );
}

function FilaSeguimiento({ corrida: c }) {
  const anulada = c.anulada;
  return (
    <div style={{ ...rowCardSeg, opacity: anulada ? 0.7 : 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>
            {LABEL_TIPO[c.tipo] || c.tipo}
            {anulada && <span style={{ ...badgeAnuladaSeg, marginLeft: 8 }}>Anulada</span>}
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

      {anulada && <div style={{ fontSize: 12.5, color: 'var(--err)', marginTop: 6 }}>{c.notaAnulacion}</div>}

      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {Object.entries(c.detalle_bancos || {}).map(([banco, info]) => {
          const subido = c.subidoBanco?.[banco];
          return (
            <div key={banco} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', borderLeft: `2px solid ${COLOR_BANCO[banco]}`, paddingLeft: 8 }}>
              <span className="mono" style={{ fontSize: 12 }}>
                {LABEL_BANCO[banco]} · {info.registros} reg. · ${info.total?.toFixed(2)}
              </span>
              {subido ? (
                <span style={badgeSubidoSeg}>✓ Subido {new Date(subido.at).toLocaleDateString('es-EC')} · {subido.por}</span>
              ) : (
                <span style={badgePendienteSeg}>Pendiente de subir al banco</span>
              )}
            </div>
          );
        })}
        {c.registros_con_error > 0 && (
          <span style={{ fontSize: 12, color: 'var(--err)' }}>{c.registros_con_error} error(es)</span>
        )}
      </div>
    </div>
  );
}

function ChartSectionSeg({ title, children }) {
  return (
    <section style={{ marginBottom: 30 }}>
      <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', margin: '0 0 16px' }}>{title}</h2>
      {children}
    </section>
  );
}

function BarRowSeg({ label, value, pct, color }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 5 }}>
        <strong style={{ fontWeight: 600 }}>{label}</strong>
        <span className="mono" style={{ color: 'var(--muted)' }}>{value}</span>
      </div>
      <div style={barTrackSeg}>
        <div style={{ ...barFillSeg, width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function StatCardSeg({ label, valor, alerta }) {
  return (
    <div style={statCardSeg}>
      <div style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 600 }}>{label}</div>
      <div className="mono" style={{ fontSize: 21, fontWeight: 600, color: alerta ? 'var(--err)' : 'var(--ink)', marginTop: 6 }}>
        {valor}
      </div>
    </div>
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
const fechaAuto = { border: '1.5px solid var(--line)', borderRadius: 8, padding: '9px 11px', fontSize: 13.5, background: 'var(--line-soft)', color: 'var(--muted)', display: 'flex', alignItems: 'center' };
const btnPrimary = { background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '11px 20px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' };
const btnGhost = { background: '#fff', border: '1.5px solid var(--line)', borderRadius: 8, padding: '9px 16px', fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' };
const pillActivo = { background: 'var(--accent)', color: '#fff', border: '1.5px solid var(--accent)', borderRadius: 20, padding: '8px 16px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const pillInactivo = { background: '#fff', color: 'var(--ink)', border: '1.5px solid var(--line)', borderRadius: 20, padding: '8px 16px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
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
const statCardSeg = { background: '#fff', border: '1px solid var(--line)', borderRadius: 12, padding: '16px 18px', flex: '1 1 180px', minWidth: 170 };
const barTrackSeg = { background: 'var(--line-soft)', borderRadius: 6, height: 9, overflow: 'hidden' };
const barFillSeg = { height: '100%', borderRadius: 6 };
const filtroInputSeg = { border: '1.5px solid var(--line)', borderRadius: 8, padding: '8px 11px', fontSize: 12.5, fontFamily: 'inherit', background: '#fff' };
const rowCardSeg = { padding: '16px 0', borderBottom: '1px solid var(--line-soft)' };
const badgeAnuladaSeg = { fontSize: 10.5, fontWeight: 700, color: 'var(--err)', background: 'var(--err-bg)', borderRadius: 5, padding: '2px 7px' };
const badgeSubidoSeg = { fontSize: 10.5, fontWeight: 700, color: 'var(--ok)', background: 'rgba(22,163,74,0.12)', borderRadius: 5, padding: '2px 7px', whiteSpace: 'nowrap' };
const badgePendienteSeg = { fontSize: 10.5, fontWeight: 700, color: 'var(--warn)', background: 'var(--warn-bg)', borderRadius: 5, padding: '2px 7px', whiteSpace: 'nowrap' };