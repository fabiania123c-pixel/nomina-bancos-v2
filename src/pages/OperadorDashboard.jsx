import { useState, useEffect } from 'react';
import AppShell from '../components/AppShell.jsx';
import { parseDataMadre, parseArchivoPago } from '../lib/excelParser.js';
import { cruzarVariasEmpresas } from '../lib/cruce.js';
import { buildFileContent } from '../lib/bankProfiles.js';
import { registrarCorridaFinal, getHistorialCorridas, getMisEmpresas, getMiId } from '../lib/historial.js';
import { EMPRESAS, EMPRESAS_KEYS } from '../lib/empresas.js';
import { nombreArchivoBanco, nombrePdfResumen, nombreDetalleExcel } from '../lib/nombresArchivo.js';
import { descargarPdfResumen } from '../lib/pdf.js';
import { descargarDetalleExcel } from '../lib/detalleExport.js';
import { compararConHistorico, filtrarPorEmpresa, LABEL_BANCO } from '../lib/kpis.js';
import { PanelKPIs, CorridaCabecera, LineaBanco, ChipEstado, tarjetaCorridaStyle } from '../components/SeguimientoUI.jsx';
import DescargasCorrida from '../components/DescargasCorrida.jsx';
import { useEstadoPersistente } from '../lib/useEstadoPersistente.js';

const COLOR_BANCO = { produbanco: 'var(--bank-produbanco)', pichincha: 'var(--bank-pichincha)', guayaquil: 'var(--bank-guayaquil)' };

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

const AMBAS = 'ambas'; // opción del selector: Equinox + Medeport en una sola corrida
const EMPRESAS_AMBAS = ['equinox', 'medeport'];

export default function OperadorDashboard({ perfil, onLogout }) {
  const hoy = new Date();
  const mm = String(hoy.getMonth() + 1).padStart(2, '0');
  const dd = String(hoy.getDate()).padStart(2, '0');
  const yyyy = String(hoy.getFullYear());

  // Todo lo que la persona va haciendo se recuerda en la pestaña: si la pantalla se recarga o se vuelve a montar
  // (por ejemplo al cambiar de pestaña y regresar), el proceso sigue donde estaba.
  const idUsuario = perfil?.id || perfil?.nombre || 'operador';
  const k = (nombre) => `nomina:${idUsuario}:op:${nombre}`;

  const [vista, setVista] = useEstadoPersistente(k('vista'), 'generar');

  const [tipo, setTipo] = useEstadoPersistente(k('tipo'), 'finiquito');
  // Empresas que este usuario puede procesar (null = cargando). Las asigna el Admin en la base.
  const [misEmpresas, setMisEmpresas] = useState(null);
  // Valor del selector: una clave de EMPRESAS, o 'ambas' (Equinox + Medeport juntas).
  const [empresa, setEmpresa] = useEstadoPersistente(k('empresa'), '');
  const puedeAmbas = !!misEmpresas && EMPRESAS_AMBAS.every((k) => misEmpresas.includes(k));
  const objetivo = empresa === AMBAS ? EMPRESAS_AMBAS : empresa ? [empresa] : [];

  const [dataMadreFile, setDataMadreFile] = useState(null);
  const [pagoFile, setPagoFile] = useState(null);

  const [procesando, setProcesando] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState('');
  // { bloques: [{empresa, resultado, ...}], errores, advertencias, otrasEmpresas }
  const [resultado, setResultado] = useEstadoPersistente(k('resultado'), null);

  const [finalizando, setFinalizando] = useState(false);
  // Contexto definitivo por empresa (fecha del proceso, id de la corrida) — existe SOLO después de finalizar.
  const [finales, setFinales] = useEstadoPersistente(k('finales'), {});

  const [historial, setHistorial] = useState([]);
  const [miId, setMiId] = useState(null);
  const [previaAbierta, setPreviaAbierta] = useEstadoPersistente(k('previa'), {});

  useEffect(() => {
    getHistorialCorridas(500).then(setHistorial);
    getMiId().then(setMiId);
    getMisEmpresas().then((lista) => {
      const validas = lista.filter((k) => EMPRESAS_KEYS.includes(k));
      setMisEmpresas(validas);
      const ambas = EMPRESAS_AMBAS.every((k) => validas.includes(k)) && !validas.includes('superdeporte');
      setEmpresa((actual) => actual || (ambas ? AMBAS : validas[0] || ''));
    });
  }, []);

  const nav = [
    { label: 'Generar archivos', active: vista === 'generar', onClick: () => setVista('generar') },
    { label: 'Dashboard de seguimiento', active: vista === 'seguimiento', onClick: () => setVista('seguimiento') },
  ];

  // Cambiar empresa o tipo invalida lo ya procesado: hay que volver a procesar.
  function limpiarResultado() {
    setResultado(null);
    setFinales({});
    setPreviaAbierta({});
    setErrorGeneral('');
  }

  // Empezar de cero: borra el proceso que quedó en pantalla (ya registrado en el historial) y los archivos elegidos.
  function nuevoProceso() {
    limpiarResultado();
    setDataMadreFile(null);
    setPagoFile(null);
  }

  function handleEmpresaChange(key) {
    setEmpresa(key);
    limpiarResultado();
  }

  function handleTipoChange(value) {
    setTipo(value);
    limpiarResultado();
  }

  async function procesar() {
    setErrorGeneral('');
    setResultado(null);
    setFinales({});
    setPreviaAbierta({});
    if (objetivo.length === 0 || !objetivo.every((k) => misEmpresas?.includes(k))) {
      setErrorGeneral('No tienes ninguna empresa asignada para procesar — avísale a Fabián.');
      return;
    }
    const sinRuc = objetivo.find((k) => !EMPRESAS[k].ruc);
    if (sinRuc) {
      setErrorGeneral(`${EMPRESAS[sinRuc].label} todavía no tiene RUC configurado en el sistema — avísale a Fabián antes de continuar.`);
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
      const cruce = cruzarVariasEmpresas(filasPago, mapaDataMadre, { empresas: objetivo, tipo });
      const enObjetivo = cruce.bloques.reduce(
        (a, b) => a + Object.values(b.resultado).reduce((x, f) => x + f.length, 0), 0
      );
      if (enObjetivo === 0 && cruce.errores.length === 0 && cruce.otrasEmpresas.length > 0) {
        const otras = [...new Set(cruce.otrasEmpresas.map((o) => o.empresa))].join(' y ');
        const propias = objetivo.map((k) => EMPRESAS[k].label).join(' / ');
        setErrorGeneral(`Ninguna persona de este archivo es de ${propias}: todas son de ${otras}. Cambia la empresa y vuelve a procesar.`);
        return;
      }
      const sinCuenta = cruce.bloques.find((b) => !EMPRESAS[b.empresa].cuentaOrigen && b.resultado.produbanco.length > 0);
      if (sinCuenta) {
        setErrorGeneral(`${EMPRESAS[sinCuenta.empresa].label} todavía no tiene cuenta de origen configurada y hay pagos por Produbanco (la lleva cada línea del archivo) — avísale a Fabián antes de continuar.`);
        return;
      }
      setResultado(cruce);
    } catch (err) {
      console.error(err);
      setErrorGeneral(err.message || 'Ocurrió un error procesando los archivos.');
    } finally {
      setProcesando(false);
    }
  }

  function ctxBase(emp) {
    return { cuentaOrigen: EMPRESAS[emp]?.cuentaOrigen || '', ruc: EMPRESAS[emp]?.ruc || '', mm, dd, yyyy };
  }

  function detalleBancos(bloque) {
    const detalle = {};
    for (const banco of ['produbanco', 'pichincha', 'guayaquil']) {
      const filas = bloque.resultado[banco];
      if (filas.length === 0) continue;
      const total = filas.reduce((acc, r) => acc + (parseFloat(r.monto) || 0), 0);
      detalle[banco] = { registros: filas.length, total };
    }
    return detalle;
  }

  const bloquesConDatos = resultado
    ? resultado.bloques.filter((b) => Object.values(b.resultado).some((f) => f.length > 0))
    : [];
  const variasEmpresas = objetivo.length > 1;
  const detalleJunto = bloquesConDatos.length > 1; // dos empresas con datos -> un solo Excel de detalle

  // Las descargas solo existen después de finalizar: usan finales[empresa].
  function descargarBanco(bloque, bancoKey) {
    const fctx = finales[bloque.empresa];
    if (!fctx) return;
    setErrorGeneral('');
    try {
      // Guayaquil: la operadora baja una COPIA sin consecutivo (nunca toca el contador del banco). El archivo con el
      // número oficial, el que se sube al banco, lo baja el Admin.
      const content = buildFileContent(bancoKey, bloque.resultado[bancoKey], fctx);
      const filename = nombreArchivoBanco(bancoKey, { ...fctx, tipo, secuencia: null });
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
      setErrorGeneral('No se pudo descargar el archivo: ' + err.message);
    }
  }

  function descargarPdf(bloque) {
    const fctx = finales[bloque.empresa];
    if (!fctx) return;
    const { dd: d, mm: m, yyyy: y } = fctx;
    descargarPdfResumen({
      tipo,
      empresa: EMPRESAS[bloque.empresa]?.label,
      periodo: `MES-${m}-${y}`,
      fecha: `${d}/${m}/${y}`,
      generadoPor: perfil.nombre,
      detalleBancos: detalleBancos(bloque),
      filename: nombrePdfResumen({ empresa: bloque.empresa, tipo, dd: d, mm: m, yyyy: y }),
    });
  }

  async function descargarDetalle(bloque) {
    const fctx = finales[bloque.empresa];
    if (!fctx) return;
    try {
      await descargarDetalleExcel({
        resultado: bloque.resultado,
        tipo,
        filename: nombreDetalleExcel({ empresa: bloque.empresa, tipo, dd: fctx.dd, mm: fctx.mm, yyyy: fctx.yyyy }),
      });
    } catch (err) {
      console.error(err);
      setErrorGeneral('No se pudo generar el Excel de detalle: ' + err.message);
    }
  }

  // Con varias empresas en la corrida: UN solo Excel de detalle con columna EMPRESA.
  async function descargarDetalleJunto() {
    const fctx = finales[bloquesConDatos[0]?.empresa];
    if (!fctx) return;
    try {
      await descargarDetalleExcel({
        bloques: bloquesConDatos.map((b) => ({ empresa: EMPRESAS[b.empresa].label, resultado: b.resultado })),
        tipo,
        filename: nombreDetalleExcel({ empresas: bloquesConDatos.map((b) => b.empresa), tipo, dd: fctx.dd, mm: fctx.mm, yyyy: fctx.yyyy }),
      });
    } catch (err) {
      console.error(err);
      setErrorGeneral('No se pudo generar el Excel de detalle: ' + err.message);
    }
  }

  // Finalizar = guardar en el servidor (de forma atómica por empresa) y recién ahí habilitar las descargas.
  // Si hay dos empresas se registran una tras otra; si la segunda falla, la primera queda registrada y
  // el botón vuelve a ofrecer solo lo pendiente (no se duplica nada).
  async function handleFinalizar() {
    setFinalizando(true);
    setErrorGeneral('');
    let ultimo = null;
    try {
      for (const bloque of bloquesConDatos) {
        if (finales[bloque.empresa]) continue;
        ultimo = bloque;
        // La fecha se toma AHORA (no al abrir la pantalla).
        const ahora = new Date();
        const y = String(ahora.getFullYear());
        const m = String(ahora.getMonth() + 1).padStart(2, '0');
        const d = String(ahora.getDate()).padStart(2, '0');
        const ctx = { cuentaOrigen: EMPRESAS[bloque.empresa].cuentaOrigen, ruc: EMPRESAS[bloque.empresa].ruc, mm: m, dd: d, yyyy: y };

        const corrida = await registrarCorridaFinal({
          tipo,
          empresa: bloque.empresa,
          detalleBancos: detalleBancos(bloque),
          registrosConError: resultado.errores.length,
          dia: `${y}-${m}-${d}`,
          filasPorBanco: bloque.resultado,
          ctx,
        });
        setFinales((prev) => ({ ...prev, [bloque.empresa]: { ...ctx, empresa: bloque.empresa, corridaId: corrida.id, secuencia: corrida.secuencia_guayaquil ?? null } }));
      }
      getHistorialCorridas(500).then(setHistorial);
    } catch (err) {
      console.error(err);
      getHistorialCorridas(500).then(setHistorial);
      const quien = ultimo ? ` (${EMPRESAS[ultimo.empresa].label})` : '';
      setErrorGeneral(`No se pudo finalizar el proceso${quien}: ` + err.message + (bloquesConDatos.some((b) => finales[b.empresa]) ? ' Lo que ya se registró no se repite: vuelve a presionar "Finalizar" para completar lo pendiente.' : ''));
    } finally {
      setFinalizando(false);
    }
  }

  const finalizado = bloquesConDatos.length > 0 && bloquesConDatos.every((b) => finales[b.empresa]);
  const algunoFinalizado = bloquesConDatos.some((b) => finales[b.empresa]);
  const hayErrores = resultado && resultado.errores.length > 0;
  const hayResultados = resultado && !hayErrores && bloquesConDatos.length > 0;
  const avisosHistorico = hayResultados
    ? bloquesConDatos.flatMap((b) =>
        compararConHistorico(detalleBancos(b), historial, tipo, b.empresa).map((t) => (variasEmpresas ? `${EMPRESAS[b.empresa].label}: ${t}` : t))
      )
    : [];
  const hayAdvertencias =
    (resultado && resultado.advertencias && resultado.advertencias.length > 0) || avisosHistorico.length > 0;
  const etiquetaEmpresa = variasEmpresas ? 'Equinox + Medeport' : EMPRESAS[objetivo[0]]?.label;

  return (
    <AppShell perfil={perfil} onLogout={onLogout} nav={nav}>
      {vista === 'generar' && (
        <>
          <h1 style={pageTitle}>Generar archivos de pago</h1>
          <p style={pageSubtitle}>Sube la matriz de bancos y el archivo de netos — el cruce y el formato de cada banco se arman solos.</p>

          <Section num="1" title="Datos de la corrida">
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <Field label="Tipo de transacción">
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {TIPOS.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => handleTipoChange(t.value)}
                      style={tipo === t.value ? pillActivo : pillInactivo}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Empresa">
                {misEmpresas === null ? (
                  <div style={fechaAuto}>Cargando…</div>
                ) : misEmpresas.length > 1 ? (
                  <select value={empresa} onChange={(e) => handleEmpresaChange(e.target.value)} style={input}>
                    {puedeAmbas && <option value={AMBAS}>Equinox + Medeport (ambas)</option>}
                    {misEmpresas.map((key) => (
                      <option key={key} value={key}>{EMPRESAS[key].label}</option>
                    ))}
                  </select>
                ) : misEmpresas.length === 1 ? (
                  <div style={fechaAuto}>{EMPRESAS[misEmpresas[0]].label}</div>
                ) : (
                  <div style={{ ...fechaAuto, color: 'var(--err)' }}>Sin empresa asignada</div>
                )}
              </Field>
              <Field label="Fecha de la corrida">
                <div className="mono" style={fechaAuto}>{dd}/{mm}/{yyyy}</div>
              </Field>
            </div>
            {empresa === AMBAS && (
              <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 10 }}>
                Un solo archivo de netos con Equinox y/o Medeport: el sistema separa a cada persona en su empresa y genera los archivos de cada una.
              </p>
            )}
          </Section>

          <Section num="2" title="Subir archivos">
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <Dropzone
                label="Matriz de bancos"
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
            <button onClick={procesar} disabled={procesando || !misEmpresas || misEmpresas.length === 0} style={{ ...btnPrimary, marginTop: 20 }}>
              {procesando ? 'Procesando…' : 'Procesar'}
            </button>
            {misEmpresas && misEmpresas.length === 0 && (
              <div style={errBox}>Tu usuario no tiene ninguna empresa asignada. Avísale a Fabián para que te la asigne.</div>
            )}
            {errorGeneral && <div style={errBox}>{errorGeneral}</div>}
          </Section>

          {hayErrores && (
            <Panel tono="err" titulo={`${resultado.errores.length} fila(s) con error — corrige el archivo y vuelve a procesar`}>
              {resultado.errores.slice(0, 20).map((e, i) => (
                <div key={i} style={panelLine}>
                  <span className="mono" style={{ color: 'var(--muted)' }}>Fila {e.fila}</span> — {e.nombre || 'sin nombre'}, Nº pers. <span className="mono">{e.nPers}</span>: {e.motivo}
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
                  <span className="mono" style={{ color: 'var(--muted)' }}>Fila {a.fila}</span> — {variasEmpresas && a.empresa ? `[${a.empresa}] ` : ''}{a.nombre || 'sin nombre'}, Nº pers. <span className="mono">{a.nPers}</span>: {a.motivo}
                </div>
              ))}
              {resultado?.advertencias?.length > 20 && <div style={panelLine}>… y {resultado.advertencias.length - 20} más.</div>}
            </Panel>
          )}

          {resultado?.otrasEmpresas?.length > 0 && (
            <Panel tono="warn" titulo={`Este archivo también trae personas de otra empresa — NO entran en esta corrida de ${etiquetaEmpresa}`}>
              {Object.entries(
                resultado.otrasEmpresas.reduce((acc, o) => {
                  acc[o.empresa] = acc[o.empresa] || { n: 0, total: 0 };
                  acc[o.empresa].n += 1;
                  acc[o.empresa].total += Number(o.monto) || 0;
                  return acc;
                }, {})
              ).map(([emp, info]) => (
                <div key={emp} style={panelLine}>
                  <strong>{emp}</strong>: {info.n} persona(s) · ${info.total.toLocaleString('en-US', { minimumFractionDigits: 2 })} — para pagarlas, cambia la empresa a {emp} y procesa este mismo archivo otra vez.
                </div>
              ))}
            </Panel>
          )}

          {hayResultados && (
            <Section num="3" title="Resumen y descarga">
              {bloquesConDatos.map((bloque) => {
                const fctx = finales[bloque.empresa];
                return (
                  <div key={bloque.empresa} style={variasEmpresas ? { marginBottom: 22 } : undefined}>
                    {variasEmpresas && (
                      <div style={{ fontSize: 13, fontWeight: 700, margin: '4px 0 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
                        {EMPRESAS[bloque.empresa].label}
                        {fctx && <span style={{ color: 'var(--ok)', fontWeight: 600, fontSize: 12 }}>✓ registrada</span>}
                      </div>
                    )}
                    {Object.entries(detalleBancos(bloque)).map(([banco, info]) => {
                      const kPrevia = `${bloque.empresa}:${banco}`;
                      return (
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
                                onClick={() => setPreviaAbierta((p) => ({ ...p, [kPrevia]: !p[kPrevia] }))}
                                style={btnGhost}
                              >
                                {previaAbierta[kPrevia] ? 'Ocultar vista previa' : 'Vista previa'}
                              </button>
                              {fctx && (
                                <button onClick={() => descargarBanco(bloque, banco)} style={btnGhost} title={nombreArchivoBanco(banco, { ...fctx, tipo, secuencia: null })}>
                                  Descargar .txt{banco === 'guayaquil' ? ' (sin consecutivo)' : ''}
                                </button>
                              )}
                            </div>
                          </div>
                          {previaAbierta[kPrevia] && (
                            <div style={previewBox}>
                              {buildFileContent(banco, bloque.resultado[banco], ctxBase(bloque.empresa))
                                .split('\r\n')
                                .slice(0, 3)
                                .map((linea, i) => (
                                  <div key={i} className="mono" style={previewLine}>{linea || ' '}</div>
                                ))}
                              {bloque.resultado[banco].length > 3 && (
                                <div style={{ fontSize: 11, color: 'var(--muted-2)', marginTop: 6 }}>
                                  … y {bloque.resultado[banco].length - 3} línea(s) más en el archivo completo.
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {fctx && (
                      <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                        <button onClick={() => descargarPdf(bloque)} style={btnGhost}>
                          Descargar resumen{variasEmpresas ? ` · ${EMPRESAS[bloque.empresa].label}` : ''}
                        </button>
                        {!detalleJunto && (
                          <button onClick={() => descargarDetalle(bloque)} style={btnGhost}>
                            Descargar detalle (Excel){variasEmpresas ? ` · ${EMPRESAS[bloque.empresa].label}` : ''}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
                {finalizado && detalleJunto && (
                  <button onClick={descargarDetalleJunto} style={btnGhost}>Descargar detalle (Excel) · Equinox + Medeport</button>
                )}
                {finalizado ? (
                  <>
                    <button disabled style={{ ...btnPrimary, opacity: 0.7, cursor: 'default' }}>Proceso finalizado ✓</button>
                    <button onClick={nuevoProceso} style={btnGhost}>Nuevo proceso</button>
                  </>
                ) : (
                  <button onClick={handleFinalizar} disabled={finalizando} style={btnPrimary}>
                    {finalizando ? 'Finalizando…' : algunoFinalizado ? 'Finalizar lo pendiente' : 'Finalizar proceso'}
                  </button>
                )}
              </div>
              {!finalizado && (
                <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 10 }}>
                  Revisa la vista previa. Al finalizar se registra el proceso{variasEmpresas ? ' de cada empresa' : ''} y se habilitan las descargas (.txt, PDF y Excel).
                </p>
              )}
              {algunoFinalizado && (
                <p style={{ fontSize: 12.5, color: 'var(--ok)', marginTop: 10 }}>
                  Registrado en el historial — el Admin ya lo puede ver. Si sales de esta pantalla, puedes volver a descargar todo desde «Dashboard de seguimiento» → «Historial de corridas».
                </p>
              )}
            </Section>
          )}
        </>
      )}

      {vista === 'seguimiento' && (
        <>
          <h1 style={pageTitle}>Dashboard de seguimiento</h1>
          <p style={pageSubtitle}>Solo lectura — acá no se puede editar ni anular nada, es para que tengas visibilidad de todo lo que se ha corrido.</p>
          <VistaSeguimiento corridas={historial} empresasPermitidas={misEmpresas || []} miId={miId} />
        </>
      )}
    </AppShell>
  );
}

function VistaSeguimiento({ corridas: todas, empresasPermitidas, miId }) {
  const [filtroEmpresa, setFiltroEmpresa] = useState('consolidado');
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [filtroBanco, setFiltroBanco] = useState('todos');

  if (todas.length === 0) {
    return <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 24 }}>Todavía no hay corridas registradas.</p>;
  }

  // Selector de empresa solo si el usuario tiene más de una (Mayra y su equipo: Equinox / Medeport / Consolidado).
  const hayVariasEmpresas = empresasPermitidas.length > 1;
  const corridas = hayVariasEmpresas ? filtrarPorEmpresa(todas, filtroEmpresa) : todas;

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
      {hayVariasEmpresas && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
          <button type="button" onClick={() => setFiltroEmpresa('consolidado')} style={filtroEmpresa === 'consolidado' ? pillActivo : pillInactivo}>
            Consolidado
          </button>
          {empresasPermitidas.map((key) => (
            <button key={key} type="button" onClick={() => setFiltroEmpresa(key)} style={filtroEmpresa === key ? pillActivo : pillInactivo}>
              {EMPRESAS[key].label}
            </button>
          ))}
        </div>
      )}

      <PanelKPIs corridas={corridas} mostrarPorEmpresa={hayVariasEmpresas && filtroEmpresa === 'consolidado'} />

      <h2 style={{ fontSize: 18, fontWeight: 700, margin: '40px 0 14px', color: '#101828' }}>Historial de corridas</h2>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
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
          <option value="nomina_regular">Rebotes</option>
        </select>
        <select value={filtroBanco} onChange={(e) => setFiltroBanco(e.target.value)} style={filtroInputSeg}>
          <option value="todos">Todos los bancos</option>
          <option value="produbanco">Produbanco</option>
          <option value="pichincha">Banco Pichincha</option>
          <option value="guayaquil">Banco de Guayaquil</option>
        </select>
      </div>

      {filtradas.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>Nada coincide con ese filtro.</p>
      ) : (
        filtradas.map((c) => <FilaSeguimiento key={c.id} corrida={c} miId={miId} soloBanco={filtroBanco === 'todos' ? null : filtroBanco} />)
      )}
    </div>
  );
}

function FilaSeguimiento({ corrida: c, miId, soloBanco }) {
  const anulada = c.anulada;
  return (
    <div style={{ ...tarjetaCorridaStyle, opacity: anulada ? 0.7 : 1 }}>
      <CorridaCabecera corrida={c} />

      {anulada && <div style={{ fontSize: 13.5, color: 'var(--err)', marginTop: 8 }}>{c.notaAnulacion}</div>}

      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {Object.entries(c.detalle_bancos || {})
          .filter(([banco]) => !soloBanco || banco === soloBanco)
          .map(([banco, info]) => (
            <LineaBanco key={banco} banco={banco} info={info} subido={c.subidoBanco?.[banco]} />
          ))}
        {c.registros_con_error > 0 && (
          <ChipEstado tipo="error">{c.registros_con_error} error(es)</ChipEstado>
        )}
      </div>

      {/* Solo quien generó la corrida puede volver a bajar sus archivos (así lo exige la base). */}
      {!anulada && miId && c.generado_por === miId && <DescargasCorrida corrida={c} soloBanco={soloBanco} />}
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
const pillActivo = { background: 'var(--accent)', color: '#fff', border: '1.5px solid var(--accent)', borderRadius: 20, padding: '9px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const pillInactivo = { background: '#fff', color: 'var(--ink)', border: '1.5px solid var(--line)', borderRadius: 20, padding: '9px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
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
const filtroInputSeg = { border: '1.5px solid var(--line)', borderRadius: 8, padding: '9px 12px', fontSize: 14, fontFamily: 'inherit', background: '#fff' };