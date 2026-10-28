import { useState } from 'react';
import { getArchivosCorrida } from '../lib/historial.js';
import { descargarPdfResumen } from '../lib/pdf.js';
import { descargarDetalleExcel } from '../lib/detalleExport.js';
import { EMPRESAS } from '../lib/empresas.js';
import { nombrePdfResumen, nombreDetalleExcel } from '../lib/nombresArchivo.js';
import { useDescargados, estiloDescarga, textoDescarga } from '../lib/descargados.js';

// Botones para volver a descargar el resumen (PDF) y el detalle (Excel) de una corrida YA registrada.
// Lee lo guardado en el servidor, así que sirve aunque la persona haya salido de la pantalla donde generó todo.
// Los .txt de los bancos NO se bajan desde aquí: son solo del Admin.
export default function DescargasCorrida({ corrida: c }) {
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