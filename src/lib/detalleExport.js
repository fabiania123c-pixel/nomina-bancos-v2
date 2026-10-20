import ExcelJS from 'exceljs';

const LABEL_BANCO = { produbanco: 'PRODUBANCO', pichincha: 'BANCO PICHINCHA', guayaquil: 'BANCO DE GUAYAQUIL' };

// Columnas en el mismo orden que el archivo de referencia (NETOS_FINIQUITOS).
function columnasDetalle(conEmpresa) {
  const cols = [
    ...(conEmpresa ? [{ header: 'EMPRESA', key: 'empresa', width: 14 }] : []),
    { header: 'COD. SAP', key: 'codigoSap', width: 11 },
    { header: 'NOMBRE', key: 'nombre', width: 34 },
    { header: 'CEDULA', key: 'cedula', width: 14 },
    { header: 'VALOR', key: 'valor', width: 13 },
    { header: 'NUMERO DE CUENTA', key: 'cuenta', width: 18 },
    { header: 'BANCO', key: 'banco', width: 20 },
    { header: 'TIPO DE CUENTA', key: 'tipoCuenta', width: 14 },
    { header: 'NUMERO CELULAR', key: 'celular', width: 16 },
  ];
  return cols;
}

const BORDE_SUAVE = {
  top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
  left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
  bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
  right: { style: 'thin', color: { argb: 'FFD9D9D9' } },
};

/**
 * Arma el libro de detalle por empleado (sin descargarlo; así se puede probar).
 *
 * Un solo archivo con los 3 bancos juntos (la columna BANCO los distingue), armado a partir de
 * los datos ya cruzados y validados contra la matriz — no del archivo crudo que se sube.
 *
 * Dos formas de llamarlo:
 *  - { resultado }                       una empresa: { produbanco, pichincha, guayaquil }
 *  - { bloques: [{ empresa, resultado }] } varias empresas en un solo Excel: agrega la columna
 *    EMPRESA y lista primero todo lo de la primera empresa, luego la siguiente.
 *
 * Al final del libro se agrega el resumen: subtotal por banco y total acumulado.
 * @param {string} tipo - (se conserva por compatibilidad; ya no cambia las columnas)
 */
export async function armarDetalleExcel({ resultado, bloques, tipo }) {
  const conEmpresa = Array.isArray(bloques) && bloques.length > 0;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Detalle');
  ws.columns = columnasDetalle(conEmpresa);

  // Columnas que deben quedar como texto (nunca número) para no perder
  // ceros a la izquierda: cédula, cuenta, celular y código SAP.
  ['codigoSap', 'cedula', 'cuenta', 'celular'].forEach((key) => {
    ws.getColumn(key).numFmt = '@';
  });
  ws.getColumn('valor').numFmt = '"$"#,##0.00';

  const grupos = conEmpresa ? bloques : [{ empresa: null, resultado }];
  const subtotales = { produbanco: { n: 0, total: 0 }, pichincha: { n: 0, total: 0 }, guayaquil: { n: 0, total: 0 } };
  const porEmpresa = [];
  for (const g of grupos) {
    const acumEmpresa = { n: 0, total: 0 };
    for (const banco of ['produbanco', 'pichincha', 'guayaquil']) {
      for (const r of g.resultado?.[banco] || []) {
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
        if (conEmpresa) fila.empresa = g.empresa;
        ws.addRow(fila);
        subtotales[banco].n += 1;
        subtotales[banco].total += fila.valor;
        acumEmpresa.n += 1;
        acumEmpresa.total += fila.valor;
      }
    }
    if (conEmpresa) porEmpresa.push({ empresa: g.empresa, ...acumEmpresa });
  }
  const ultimaFilaDatos = ws.rowCount;

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

  // ── Resumen al final: subtotal por banco y total acumulado (separado de los datos) ──
  const r2 = (n) => Math.round(n * 100) / 100;
  const colNombre = conEmpresa ? 3 : 2; // NOMBRE
  const colCedula = colNombre + 1; // se usa para el Nº de registros
  const colValor = colNombre + 2; // VALOR
  const estiloFila = (row, { negrita = false, fondo = null } = {}) => {
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      if (col > ws.columns.length) return;
      cell.font = { bold: negrita };
      if (fondo) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fondo } };
      cell.border = BORDE_SUAVE;
    });
  };
  const agregarLineaResumen = (etiqueta, n, total, opciones) => {
    const fila = ws.addRow({});
    fila.getCell(colNombre).value = etiqueta;
    fila.getCell(colCedula).value = n === null ? '' : `${n} reg.`;
    fila.getCell(colValor).value = r2(total);
    fila.getCell(colValor).numFmt = '"$"#,##0.00';
    estiloFila(fila, opciones);
    return fila;
  };

  ws.addRow({}); // línea en blanco para separar
  const titulo = ws.addRow({});
  titulo.getCell(colNombre).value = 'SUBTOTAL POR BANCO';
  titulo.eachCell({ includeEmpty: true }, (cell, col) => {
    if (col > ws.columns.length) return;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10193A' } };
  });

  let totalN = 0;
  let totalValor = 0;
  for (const banco of ['produbanco', 'pichincha', 'guayaquil']) {
    const sub = subtotales[banco];
    if (sub.n === 0) continue;
    agregarLineaResumen(LABEL_BANCO[banco], sub.n, sub.total);
    totalN += sub.n;
    totalValor += sub.total;
  }
  agregarLineaResumen('TOTAL ACUMULADO', totalN, totalValor, { negrita: true, fondo: 'FFEEF1FB' });

  if (conEmpresa && porEmpresa.length > 1) {
    ws.addRow({});
    const tituloEmp = ws.addRow({});
    tituloEmp.getCell(colNombre).value = 'SUBTOTAL POR EMPRESA';
    tituloEmp.eachCell({ includeEmpty: true }, (cell, col) => {
      if (col > ws.columns.length) return;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10193A' } };
    });
    for (const e of porEmpresa) agregarLineaResumen(String(e.empresa).toUpperCase(), e.n, e.total);
  }

  ws.views = [{ state: 'frozen', ySplit: 1 }];
  // El filtro cubre solo las filas de datos (no el resumen del final).
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, ultimaFilaDatos), column: ws.columns.length } };

  return wb;
}

/** Genera y descarga el Excel de detalle (ver armarDetalleExcel). */
export async function descargarDetalleExcel({ resultado, bloques, tipo, filename }) {
  const wb = await armarDetalleExcel({ resultado, bloques, tipo });
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