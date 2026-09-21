import * as XLSX from 'xlsx';

export function parseDataMadre(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  const headerIdx = rows.findIndex((r) => r.includes('Número ID'));
  if (headerIdx === -1) {
    throw new Error(
      'No se encontró la columna "Número ID" en el archivo. ¿Es el Data_madre correcto? ¿Cambió la estructura?'
    );
  }
  const header = rows[headerIdx];

  const idx = {
    cedula: header.indexOf('Número ID'),
    codigoSap: header.indexOf('Nº pers.'),
    nombre: header.indexOf('Número de personal'),
    banco: header.indexOf('Clave de banco'),
    cuenta: header.indexOf('Cuenta bancaria'),
    tipoCuenta: header.indexOf('CC'),
    celular: header.indexOf('CELULAR_UNO'),
  };
  for (const [campo, i] of Object.entries(idx)) {
    if (i === -1) {
      throw new Error(`No se encontró la columna esperada para "${campo}" en Data_madre.`);
    }
  }

  const mapa = new Map();
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    const cedula = String(r[idx.cedula] || '').trim();
    if (!cedula) continue;
    mapa.set(cedula, {
      cedula,
      codigoSap: String(r[idx.codigoSap] || '').trim(),
      nombre: String(r[idx.nombre] || '').trim(),
      banco: String(r[idx.banco] || '').trim().toUpperCase(),
      cuenta: String(r[idx.cuenta] || '').trim(),
      tipoCuentaCodigo: String(r[idx.tipoCuenta] || '').trim(),
      celular: String(r[idx.celular] || '').trim(),
    });
  }
  return mapa;
}

export function parseArchivoPago(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  const headerIdx = rows.findIndex((r) =>
    r.some((c) => String(c).toUpperCase() === 'CEDULA' || String(c).toUpperCase() === 'CÉDULA')
  );
  if (headerIdx === -1) {
    throw new Error('No se encontró una columna "CEDULA" en el archivo subido.');
  }
  const header = rows[headerIdx].map((h) => String(h).toUpperCase());

  const idx = {
    codigoSap: header.indexOf('COD. SAP'),
    nombre: header.indexOf('NOMBRE'),
    cedula: header.findIndex((h) => h === 'CEDULA' || h === 'CÉDULA'),
    monto: header.findIndex((h) => h.startsWith('VALOR')),
  };
  if (idx.cedula === -1) throw new Error('Falta la columna CEDULA.');
  if (idx.monto === -1) {
    throw new Error('No se encontró la columna de monto (debe empezar con "VALOR", ej. "VALOR FINIQUITO").');
  }

  const filas = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    const cedulaRaw = String(r[idx.cedula] || '').trim();
    if (!cedulaRaw) continue;
    if (!/^\d+$/.test(cedulaRaw)) continue;
    filas.push({
      codigoSap: idx.codigoSap !== -1 ? String(r[idx.codigoSap] || '').trim() : '',
      nombre: idx.nombre !== -1 ? String(r[idx.nombre] || '').trim() : '',
      cedula: cedulaRaw,
      monto: Number(r[idx.monto]) || 0,
    });
  }
  return filas;
}