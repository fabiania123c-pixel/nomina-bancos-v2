import { useState } from 'react';
import { getArchivosCorrida } from '../lib/historial.js';
import { buildFileContent } from '../lib/bankProfiles.js';
import { descargarPdfResumen } from '../lib/pdf.js';
import { descargarDetalleExcel } from '../lib/detalleExport.js';
import { EMPRESAS } from '../lib/empresas.js';
import { LABEL_BANCO } from '../lib/kpis.js';
import { nombreArchivoBanco, nombrePdfResumen, nombreDetalleExcel } from '../lib/nombresArchivo.js';
import { useDescargados, estiloDescarga, textoDescarga } from '../lib/descargados.js';

// Botones para volver a descargar los archivos de una corrida YA registrada
// (.txt de cada banco, resumen PDF y detalle Excel). Lee lo guardado en el servidor,
// así que sirve aunque la persona haya salido de la pantalla donde generó todo.
// soloBanco: si el filtro de bancos está puesto, solo se muestra el .txt de ese banco.
export default function DescargasCorrida({ corrida: c, soloBanco = null }) {
  const [descargando, setDescargando] = useState(null);
  const [error, setError] = useState('');
  const { hecho, marcar } = useDescargados(c.id);

  const empresa = c.empresa || 'superdeporte';
  const f = new Date(c.fecha);
  const dd = String(f.getDate()).padStart(2, '0');
  const mm = String(f.getMonth() + 1).padStart(2, '0');
  const yyyy = String(f.getFullYear());
  // La fecha del NOMBRE de cada archivo es la del día en que se descarga.
  const fechaDescarga = () => {
    const h = new Date();
    return { dd: String(h.getDate()).padStart(2, '0'), mm: String(h.getMonth() + 1).padStart(2, '0'), yyyy: String(h.getFullYear()) };
  };

  const bancos = Object.keys(c.detalle_bancos || {}).filter((b) => !soloBanco || b === soloBanco);

  function descargarPdf() {
    descargarPdfResumen({
      tipo: c.tipo,
      empresa: EMPRESAS[empresa]?.label,
      periodo: `MES-${mm}-${yyyy}`,
      fecha: `${dd}/${mm}/${yyyy}`,
      generadoPor: c.generadoPorNombre,
      detalleBancos: c.detalle_bancos,
      filename: nombrePdfResumen({ empresa, tipo: c.tipo, ...fechaDescarga() }),
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
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // Guayaquil: el nombre lleva la fecha y el consecutivo del día en que se finalizó la corrida (van juntos, así
      // nunca se repite un nombre). Los demás bancos llevan la fecha del día de descarga.
      a.download = nombreArchivoBanco(
        banco,
        banco === 'guayaquil' ? { ...ctx, dd: ctx.dd || dd, mm: ctx.mm || mm, yyyy: ctx.yyyy || yyyy } : { ...ctx, ...fechaDescarga() }
      );
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
    setDescargando('detalle');
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
      setDescargando(null);
    }
  }

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {bancos.map((banco) => (
          <button key={banco} onClick={() => descargarTxt(banco)} disabled={descargando === banco} style={estiloDescarga(btn, hecho(`txt:${banco}`))}>
            {descargando === banco ? '…' : textoDescarga(`${LABEL_BANCO[banco]} · .txt`, hecho(`txt:${banco}`))}
          </button>
        ))}
        <button onClick={descargarPdf} style={estiloDescarga(btn, hecho('resumen'))}>{textoDescarga('Descargar resumen', hecho('resumen'))}</button>
        <button onClick={descargarDetalle} disabled={descargando === 'detalle'} style={estiloDescarga(btn, hecho('detalle'))}>
          {descargando === 'detalle' ? '…' : textoDescarga('Descargar detalle', hecho('detalle'))}
        </button>
      </div>
      {error && <div style={{ fontSize: 12, color: 'var(--err)', marginTop: 8 }}>{error}</div>}
    </div>
  );
}

const btn = { background: '#fff', border: '1.5px solid var(--line)', borderRadius: 8, padding: '8px 14px', fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' };