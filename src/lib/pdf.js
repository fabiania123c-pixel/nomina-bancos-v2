import jsPDF from 'jspdf';

const LABEL_BANCO = { produbanco: 'Produbanco', pichincha: 'Banco Pichincha', guayaquil: 'Banco de Guayaquil' };
const LABEL_TIPO = {
  finiquito: 'Finiquitos',
  nomina_regular: 'Nómina regular',
  prestamo: 'Préstamos',
  jubilacion: 'Jubilación',
  teletrabajo: 'Teletrabajo',
};

function formatoDolares(n) {
  return `$${(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function descargarPdfResumen({ tipo, periodo, fecha, generadoPor, detalleBancos, filename }) {
  const doc = new jsPDF();
  let y = 20;

  doc.setFontSize(16);
  doc.text('Resumen de generación — Nómina Bancos', 14, y);
  y += 8;
  doc.setDrawColor(200);
  doc.line(14, y, 196, y);
  y += 10;

  doc.setFontSize(11);
  doc.text(`Tipo: ${LABEL_TIPO[tipo] || tipo}`, 14, y);
  y += 7;
  doc.text(`Periodo: ${periodo}`, 14, y);
  y += 7;
  if (fecha) {
    doc.text(`Fecha: ${fecha}`, 14, y);
    y += 7;
  }
  doc.text(`Generado por: ${generadoPor}`, 14, y);
  y += 7;
  doc.text(`Fecha de generación: ${new Date().toLocaleString('es-EC')}`, 14, y);
  y += 14;

  doc.setFontSize(13);
  doc.text('Detalle por banco', 14, y);
  y += 10;

  // Tabla: Banco (izquierda) / Registros (derecha) / Monto (derecha, con comas de miles)
  const colBanco = 14;
  const colRegistros = 130;
  const colMonto = 196;

  doc.setFontSize(10.5);
  doc.setFont(undefined, 'bold');
  doc.text('Banco', colBanco, y);
  doc.text('Registros', colRegistros, y, { align: 'right' });
  doc.text('Monto', colMonto, y, { align: 'right' });
  y += 3;
  doc.setDrawColor(180);
  doc.line(14, y, 196, y);
  y += 7;

  doc.setFont(undefined, 'normal');
  doc.setFontSize(11);
  let totalGeneral = 0;
  let registrosGeneral = 0;
  Object.entries(detalleBancos).forEach(([banco, info]) => {
    doc.text(LABEL_BANCO[banco] || banco, colBanco, y);
    doc.text(String(info.registros), colRegistros, y, { align: 'right' });
    doc.text(formatoDolares(info.total), colMonto, y, { align: 'right' });
    y += 8;
    totalGeneral += info.total || 0;
    registrosGeneral += info.registros || 0;
  });

  y += 2;
  doc.setDrawColor(180);
  doc.line(14, y, 196, y);
  y += 9;

  doc.setFont(undefined, 'bold');
  doc.setFontSize(11.5);
  doc.text('Total general', colBanco, y);
  doc.text(String(registrosGeneral), colRegistros, y, { align: 'right' });
  doc.text(formatoDolares(totalGeneral), colMonto, y, { align: 'right' });

  doc.save(filename);
}