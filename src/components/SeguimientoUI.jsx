import { calcularKPIs, calcularPorPersona, LABEL_BANCO } from '../lib/kpis.js';
import { EMPRESAS } from '../lib/empresas.js';
import { useConteo } from '../lib/useConteo.js';

// ─────────────────────────────────────────────────────────────────────────────
// Piezas visuales compartidas del "Dashboard de seguimiento" (Operador y Admin).
// Solo presentación: no calculan nada que no calcule ya kpis.js.
// Colores fijos (no dependen de variables CSS) para que cada empresa y cada banco
// se distingan siempre, y con buen contraste sobre blanco.
// ─────────────────────────────────────────────────────────────────────────────

export const LABEL_TIPO = {
  finiquito: 'Finiquitos',
  prestamo: 'Préstamos',
  jubilacion: 'Jubilación',
  teletrabajo: 'Teletrabajo',
  nomina_regular: 'Nómina regular',
};

export const COLOR_EMPRESA = {
  superdeporte: '#2F4FD8', // azul
  equinox: '#E8590C',      // naranja
  medeport: '#0C8599',     // verde azulado
};
export const COLOR_BANCO_UI = {
  produbanco: '#2F9E44',   // verde
  pichincha: '#B08900',    // dorado
  guayaquil: '#7048E8',    // violeta
};
const COLOR_NEUTRO = '#4C5A7A';
const TINTA = '#101828';        // texto principal
const TEXTO_2 = '#475467';      // texto secundario (contraste alto sobre blanco)
const LINEA = '#E4E7EC';

const NUM = { fontVariantNumeric: 'tabular-nums' };

export const fmtUsd = (n, dec = 2) =>
  `$${(n || 0).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })}`;
const fmtInt = (n) => Math.round(n || 0).toLocaleString('en-US');
const fmtPct = (p) => `${p.toLocaleString('es-EC', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
function nombreMes(clave) {
  const [y, m] = String(clave).split('-');
  return `${MESES[Number(m) - 1] || clave} ${y}`;
}

// ── Etiquetas (chips) ────────────────────────────────────────────────────────
const CHIP = { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, borderRadius: 999, padding: '3px 10px', whiteSpace: 'nowrap' };

export function ChipEmpresa({ empresa }) {
  const key = empresa || 'superdeporte';
  const color = COLOR_EMPRESA[key] || COLOR_NEUTRO;
  return (
    <span style={{ ...CHIP, color, background: `${color}1A`, border: `1px solid ${color}55` }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
      {EMPRESAS[key]?.label || key}
    </span>
  );
}

export function ChipEstado({ tipo, children }) {
  const mapa = {
    ok: { color: '#087443', bg: '#DDF5E7' },
    pendiente: { color: '#8A5300', bg: '#FFF1D6' },
    error: { color: '#B42318', bg: '#FEE4E2' },
  };
  const t = mapa[tipo] || mapa.pendiente;
  return <span style={{ ...CHIP, color: t.color, background: t.bg }}>{children}</span>;
}

// ── Tarjeta de corrida (historial) ───────────────────────────────────────────
export const tarjetaCorridaStyle = {
  background: '#fff', border: `1px solid ${LINEA}`, borderRadius: 12, padding: '16px 18px', marginBottom: 12,
};

export function CorridaCabecera({ corrida: c }) {
  const anulada = c.anulada;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: 16, color: TINTA }}>{LABEL_TIPO[c.tipo] || c.tipo}</span>
          <ChipEmpresa empresa={c.empresa} />
        </div>
        <div style={{ fontSize: 13.5, color: TEXTO_2, marginTop: 5 }}>
          {new Date(c.fecha).toLocaleString('es-EC')} · {c.generadoPorNombre}
        </div>
      </div>
      {anulada ? (
        <ChipEstado tipo="error">Anulada</ChipEstado>
      ) : (
        <ChipEstado tipo={c.finalizado ? 'ok' : 'pendiente'}>{c.finalizado ? '✓ Finalizado' : 'Pendiente'}</ChipEstado>
      )}
    </div>
  );
}

export function LineaBanco({ banco, info, subido }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', borderLeft: `4px solid ${COLOR_BANCO_UI[banco] || COLOR_NEUTRO}`, paddingLeft: 10 }}>
      <span style={{ fontSize: 14.5, color: TINTA, ...NUM }}>
        <strong>{LABEL_BANCO[banco] || banco}</strong>
        <span style={{ color: TEXTO_2 }}> · {info.registros} reg. · </span>
        <strong>{fmtUsd(info.total)}</strong>
      </span>
      {subido ? (
        <ChipEstado tipo="ok">✓ Subido {new Date(subido.at).toLocaleDateString('es-EC')} · {subido.por}</ChipEstado>
      ) : (
        <ChipEstado tipo="pendiente">Pendiente de subir al banco</ChipEstado>
      )}
    </div>
  );
}

// ── Bloques del panel ────────────────────────────────────────────────────────
function Tarjeta({ titulo, subtitulo, children }) {
  return (
    <section style={{ background: '#fff', border: `1px solid ${LINEA}`, borderRadius: 14, padding: '20px 22px' }}>
      <h2 style={{ margin: 0, fontSize: 16.5, fontWeight: 700, color: TINTA }}>{titulo}</h2>
      {subtitulo && <p style={{ margin: '4px 0 0', fontSize: 13.5, color: TEXTO_2 }}>{subtitulo}</p>}
      <div style={{ marginTop: 18 }}>{children}</div>
    </section>
  );
}

// Una fila: nombre + monto grande; barra gruesa; detalle y % del total debajo.
function Fila({ color, nombre, extra, monto, detalle, pct, pctTotal }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
          <span style={{ width: 11, height: 11, borderRadius: 3, background: color, flexShrink: 0 }} />
          <span style={{ fontSize: 15.5, fontWeight: 700, color: TINTA }}>{nombre}</span>
          {extra && <span style={{ fontSize: 13.5, color: TEXTO_2 }}>{extra}</span>}
        </div>
        <span style={{ fontSize: 16, fontWeight: 700, color: TINTA, ...NUM }}>{monto}</span>
      </div>
      <div style={{ background: '#EEF1F6', borderRadius: 7, height: 12, marginTop: 8, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, minWidth: pct > 0 ? 6 : 0, height: '100%', borderRadius: 7, background: color }} />
      </div>
      <div style={{ fontSize: 13.5, color: TEXTO_2, marginTop: 6, ...NUM }}>
        {detalle}
        {pctTotal != null && <>{detalle ? ' · ' : ''}<strong style={{ color: TINTA }}>{fmtPct(pctTotal)}</strong> del total</>}
      </div>
    </div>
  );
}

function StatCard({ label, numero, formatear = fmtInt, sufijo = '', nota, tonoNota }) {
  const animado = useConteo(numero);
  const colorNota = tonoNota === 'ok' ? '#087443' : tonoNota === 'err' ? '#B42318' : TEXTO_2;
  return (
    <div style={{ background: '#fff', border: `1px solid ${LINEA}`, borderRadius: 14, padding: '18px 20px', flex: '1 1 210px', minWidth: 200, boxSizing: 'border-box' }}>
      <div style={{ fontSize: 14, color: TEXTO_2, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 800, color: tonoNota === 'err' ? '#B42318' : TINTA, marginTop: 6, letterSpacing: '-0.02em', ...NUM }}>
        {formatear(animado)}{sufijo}
      </div>
      {nota && <div style={{ fontSize: 13.5, color: colorNota, fontWeight: tonoNota ? 700 : 500, marginTop: 4 }}>{nota}</div>}
    </div>
  );
}

function Tendencia({ meses }) {
  const max = Math.max(1, ...meses.map(([, t]) => t));
  const ALTO = 150;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, minHeight: ALTO + 56, paddingTop: 4 }}>
      {meses.map(([mes, total], i) => {
        const ultimo = i === meses.length - 1;
        return (
          <div key={mes} style={{ flex: 1, maxWidth: 120, textAlign: 'center' }}>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: TINTA, marginBottom: 6, ...NUM }}>{fmtUsd(total, 0)}</div>
            <div
              title={fmtUsd(total)}
              style={{ height: Math.max(4, (total / max) * ALTO), background: ultimo ? '#2F4FD8' : '#9DB0F5', borderRadius: '6px 6px 0 0' }}
            />
            <div style={{ fontSize: 14, color: TEXTO_2, fontWeight: 600, marginTop: 8 }}>{nombreMes(mes)}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Panel completo ───────────────────────────────────────────────────────────
export function PanelKPIs({ corridas, mostrarPorEmpresa }) {
  const k = calcularKPIs(corridas);
  const porPersona = calcularPorPersona(corridas);

  const suma = (objs) => objs.reduce((a, o) => a + (o.total || 0), 0) || 1;
  const sumaEmpresa = suma(Object.values(k.porEmpresa));
  const sumaBanco = suma(Object.values(k.porBanco));
  const sumaTipo = suma(Object.values(k.porTipo));
  const sumaPersona = suma(porPersona);
  const maxDe = (objs) => Math.max(1, ...objs.map((o) => o.total || 0));

  const pendientes = k.totalCorridas - k.corridasFinalizadas;
  const promedio = k.totalCorridas > 0 ? k.totalGeneral / k.totalCorridas : 0;
  const empresasLista = Object.entries(k.porEmpresa).sort((a, b) => b[1].total - a[1].total);
  const bancosLista = Object.entries(k.porBanco).sort((a, b) => b[1].total - a[1].total);
  const tiposLista = Object.entries(k.porTipo).sort((a, b) => b[1].total - a[1].total);
  const maxE = maxDe(empresasLista.map(([, v]) => v));
  const maxB = maxDe(bancosLista.map(([, v]) => v));
  const maxT = maxDe(tiposLista.map(([, v]) => v));
  const maxP = maxDe(porPersona);

  return (
    <div style={{ marginTop: 22 }}>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
        <StatCard label="Total movido" numero={k.totalGeneral} formatear={(n) => fmtUsd(n)} nota={`Promedio ${fmtUsd(promedio, 0)} por corrida`} />
        <StatCard label="Registros procesados" numero={k.registrosGeneral} nota="Pagos individuales generados" />
        <StatCard
          label="Corridas finalizadas"
          numero={k.corridasFinalizadas}
          sufijo={` de ${k.totalCorridas}`}
          nota={pendientes > 0 ? `${pendientes} sin finalizar` : 'Todas finalizadas'}
          tonoNota={pendientes > 0 ? undefined : 'ok'}
        />
        <StatCard
          label="Errores acumulados"
          numero={k.erroresGeneral}
          nota={k.erroresGeneral > 0 ? 'Revisar las corridas con error' : 'Sin errores'}
          tonoNota={k.erroresGeneral > 0 ? 'err' : 'ok'}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
        {mostrarPorEmpresa && empresasLista.length > 0 && (
          <Tarjeta titulo="Por empresa" subtitulo="Cuánto se ha pagado en cada empresa">
            {empresasLista.map(([emp, info]) => (
              <Fila
                key={emp}
                color={COLOR_EMPRESA[emp] || COLOR_NEUTRO}
                nombre={EMPRESAS[emp]?.label || emp}
                extra={`${info.corridas} corrida${info.corridas !== 1 ? 's' : ''}`}
                monto={fmtUsd(info.total)}
                detalle={`${fmtInt(info.registros)} registros`}
                pct={(info.total / maxE) * 100}
                pctTotal={(info.total / sumaEmpresa) * 100}
              />
            ))}
          </Tarjeta>
        )}

        <Tarjeta titulo="Por banco" subtitulo="A qué banco fue el dinero">
          {bancosLista.map(([banco, info]) => (
            <Fila
              key={banco}
              color={COLOR_BANCO_UI[banco] || COLOR_NEUTRO}
              nombre={LABEL_BANCO[banco] || banco}
              monto={fmtUsd(info.total)}
              detalle={`${fmtInt(info.registros)} registros`}
              pct={(info.total / maxB) * 100}
              pctTotal={(info.total / sumaBanco) * 100}
            />
          ))}
        </Tarjeta>

        {tiposLista.length > 0 && (
          <Tarjeta titulo="Por tipo de transacción" subtitulo="Finiquitos, préstamos, jubilación, teletrabajo">
            {tiposLista.map(([tipoKey, info]) => (
              <Fila
                key={tipoKey}
                color={COLOR_NEUTRO}
                nombre={LABEL_TIPO[tipoKey] || tipoKey}
                extra={`${info.corridas} corrida${info.corridas !== 1 ? 's' : ''}`}
                monto={fmtUsd(info.total)}
                detalle=""
                pct={(info.total / maxT) * 100}
                pctTotal={(info.total / sumaTipo) * 100}
              />
            ))}
          </Tarjeta>
        )}

        {porPersona.length > 0 && (
          <Tarjeta titulo="Por responsable" subtitulo="Quién generó las corridas">
            {porPersona.map((p) => (
              <Fila
                key={p.nombre}
                color={COLOR_NEUTRO}
                nombre={p.nombre}
                extra={`${p.corridas} corrida${p.corridas !== 1 ? 's' : ''}`}
                monto={fmtUsd(p.total)}
                detalle={`${fmtInt(p.registros)} registros${p.errores > 0 ? ` · ${p.errores} error(es)` : ''}`}
                pct={(p.total / maxP) * 100}
                pctTotal={(p.total / sumaPersona) * 100}
              />
            ))}
          </Tarjeta>
        )}
      </div>

      {k.tendenciaMensual.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <Tarjeta titulo="Tendencia mensual" subtitulo="Total movido por mes (últimos 6 meses)">
            <Tendencia meses={k.tendenciaMensual} />
          </Tarjeta>
        </div>
      )}
    </div>
  );
}