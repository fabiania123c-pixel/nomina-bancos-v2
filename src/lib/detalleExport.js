import * as XLSX from 'xlsx';

const LABEL_BANCO = { produbanco: 'PRODUBANCO', pichincha: 'BANCO PICHINCHA', guayaquil: 'BANCO DE GUAYAQUIL' };

function formatearFecha(valor) {
  if (!valor) return '';
  const d = valor instanceof Date ? valor : new Date(valor);
  if (isNaN(d.getTime())) return String(valor);
  // Las fechas de Excel no llevan huso horario — se leen en UTC para no
  // correrse un día al mostrarlas en una zona con offset negativo (Ecuador).
  const dia = String(d.getUTCDate()).padStart(2, '0');
  const mes = String(d.getUTCMonth() + 1).padStart(2, '0');
  const anio = d.getUTCFullYear();
  return `${dia}/${mes}/${anio}`;
}

/**
 * Genera y descarga el Excel de detalle por empleado: un solo archivo con
 * los 3 bancos juntos (la columna BANCO los distingue), armado a partir de
 * los datos ya cruzados y validados contra Data_madre — no del archivo
 * crudo que se sube. Por eso una cuenta corregida o un banco confirmado
 * salen reflejados aquí tal como quedaron en el .txt real.
 *
 * @param {object} resultado - { produbanco: [...], pichincha: [...], guayaquil: [...] },
 *   tal como lo entrega cruzarConDataMadre (o lo guardado en corrida_archivos).
 * @param {string} tipo - tipo de la corrida; la columna BAJA solo se incluye para 'finiquito'.
 * @param {string} filename
 */
export function descargarDetalleExcel({ resultado, tipo, filename }) {
  const incluirBaja = tipo === 'finiquito';
  const filas = [];

  for (const banco of ['produbanco', 'pichincha', 'guayaquil']) {
    for (const r of resultado?.[banco] || []) {
      const fila = {
        'COD. SAP': r.codigoEmpleado || '',
        NOMBRE: r.nombre || '',
        CEDULA: r.cedula || '',
        BANCO: LABEL_BANCO[banco] || banco,
        VALOR: Number(r.monto) || 0,
        'NUMERO DE CUENTA': r.cuenta || '',
        'TIPO DE CUENTA': r.tipoCuenta || '',
        'NUMERO CELULAR': r.celular || '',
      };
      if (incluirBaja) fila.BAJA = formatearFecha(r.baja);
      filas.push(fila);
    }
  }

  const ws = XLSX.utils.json_to_sheet(filas);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Detalle');
  XLSX.writeFile(wb, filename);
}