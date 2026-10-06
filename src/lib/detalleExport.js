import ExcelJS from 'exceljs';

const LABEL_BANCO = { produbanco: 'PRODUBANCO', pichincha: 'BANCO PICHINCHA', guayaquil: 'BANCO DE GUAYAQUIL' };

// Columnas en el mismo orden que el archivo de referencia (NETOS_FINIQUITOS).
function columnasDetalle(incluirBaja) {
  const cols = [
    { header: 'COD. SAP', key: 'codigoSap', width: 11 },
    { header: 'NOMBRE', key: 'nombre', width: 34 },
    { header: 'CEDULA', key: 'cedula', width: 14 },
    { header: 'VALOR', key: 'valor', width: 13 },
    { header: 'NUMERO DE CUENTA', key: 'cuenta', width: 18 },
    { header: 'BANCO', key: 'banco', width: 20 },
    { header: 'TIPO DE CUENTA', key: 'tipoCuenta', width: 14 },
    { header: 'NUMERO CELULAR', key: 'celular', width: 16 },
  ];
  if (incluirBaja) cols.push({ header: 'BAJA', key: 'baja', width: 13 });
  return cols;
}

function normalizarFecha(valor) {
  if (!valor) return null;
  const d = valor instanceof Date ? valor : new Date(valor);
  if (isNaN(d.getTime())) return null;
  // Normalizada a medianoche UTC para que Excel no la corra un día al
  // mostrarla en una zona con offset negativo (Ecuador).
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

const BORDE_SUAVE = {
  top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
  left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
  bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
  right: { style: 'thin', color: { argb: 'FFD9D9D9' } },
};

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
export async function descargarDetalleExcel({ resultado, tipo, filename }) {
  const incluirBaja = tipo === 'finiquito';
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Detalle');
  ws.columns = columnasDetalle(incluirBaja);

  // Columnas que deben quedar como texto (nunca número) para no perder
  // ceros a la izquierda: cédula, cuenta, celular y código SAP.
  ['codigoSap', 'cedula', 'cuenta', 'celular'].forEach((key) => {
    ws.getColumn(key).numFmt = '@';
  });
  ws.getColumn('valor').numFmt = '"$"#,##0.00';
  if (incluirBaja) ws.getColumn('baja').numFmt = 'dd/mm/yyyy';

  for (const banco of ['produbanco', 'pichincha', 'guayaquil']) {
    for (const r of resultado?.[banco] || []) {
      const fila = {
        codigoSap: r.codigoEmpleado || '',
        nombre: r.nombre || '',
        cedula: r.cedula || '',
        valor: Number(r.monto) || 0,
        cuenta: r.cuenta || '',
        banco: LABEL_BANCO[banco] || banco,
        tipoCuenta: r.tipoCuenta || '',
        celular: r.celular || '',
      };
      if (incluirBaja) fila.baja = normalizarFecha(r.baja);
      ws.addRow(fila);
    }
  }

  // Encabezado: negrita, blanco sobre navy, bordeado y centrado.
  const header = ws.getRow(1);
  header.height = 20;
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10193A' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = BORDE_SUAVE;
  });

  // Bordes suaves en todas las filas de datos.
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = BORDE_SUAVE;
    });
  });

  ws.views = [{ state: 'frozen', ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columns.length } };

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}