import jsPDF from 'jspdf';

const LABEL_BANCO = { produbanco: 'Produbanco', pichincha: 'Banco Pichincha', guayaquil: 'Banco de Guayaquil' };
const LABEL_TIPO = { nomina_regular: 'Nómina regular', finiquito: 'Finiquitos' };

export function descargarPdfResumen({ tipo, periodo, generadoPor, detalleBancos, filename }) {
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
  doc.text(`Generado por: ${generadoPor}`, 14, y);
  y += 7;
  doc.text(`Fecha de generación: ${new Date().toLocaleString('es-EC')}`, 14, y);
  y += 14;

  doc.setFontSize(13);
  doc.text('Detalle por banco', 14, y);
  y += 9;

  doc.setFontSize(11);
  let totalGeneral = 0;
  let registrosGeneral = 0;
  Object.entries(detalleBancos).forEach(([banco, info]) => {
    doc.text(`${LABEL_BANCO[banco] || banco}`, 14, y);
    doc.text(`${info.registros} registro(s)`, 100, y);
    doc.text(`$${info.total.toFixed(2)}`, 160, y);
    y += 7;
    totalGeneral += info.total;
    registrosGeneral += info.registros;
  });

  y += 5;
  doc.setDrawColor(200);
  doc.line(14, y, 196, y);
  y += 9;

  doc.setFontSize(12);
  doc.text('Total general', 14, y);
  doc.text(`${registrosGeneral} registro(s)`, 100, y);
  doc.text(`$${totalGeneral.toFixed(2)}`, 160, y);

  doc.save(filename);
}