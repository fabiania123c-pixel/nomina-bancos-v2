import * as XLSX from 'xlsx';

// ─────────────────────────────────────────────────────────────────────────────
// Formato estándar (igual para Retail y Mayoristas):
//   · Matriz de bancos (antes "Data_madre"): una fila por empleado/registro SAP.
//   · Archivo de netos: SOLO 2 columnas → Nº pers. | valor.
// ─────────────────────────────────────────────────────────────────────────────

export const SOCIEDADES = ['E100', 'E101', 'E200'];

function norm(h) {
  return String(h ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function texto(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(v);
  return String(v).trim();
}

// Cédulas ecuatorianas empiezan a veces con 0; si Excel la guardó como número
// pierde ese 0 y queda de 9 dígitos.
function normalizarCedula(v) {
  const s = texto(v).replace(/\s+/g, '');
  return /^\d{9}$/.test(s) ? s.padStart(10, '0') : s;
}

// ── Matriz de bancos ─────────────────────────────────────────────────────────
// Devuelve Map con clave "SOC|NPERS" → array de filas (normalmente 1; si SAP
// exporta más de un registro bancario por persona hay varias y el cruce decide).
export function parseDataMadre(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });

  const headerIdx = rows.findIndex((r) => r.some((c) => norm(c) === 'NPERS'));
  if (headerIdx === -1) {
    throw new Error(
      'No se encontró la columna "Nº pers." en la matriz de bancos. ¿Es el archivo correcto? ¿Cambió la estructura?'
    );
  }
  const header = rows[headerIdx].map(norm);
  const col = (...nombres) => header.findIndex((h) => nombres.includes(h));

  const idx = {
    soc: col('SOC'),
    nPers: col('NPERS'),
    cedula: col('NUMEROID'),
    nombre: col('NUMERODEPERSONAL'),
    cese: col('ZFFECHACESE'),
    banco: col('CLAVEDEBANCO'),
    cuenta: col('CUENTABANCARIA'),
    tipoCuenta: col('CC'),
    celular: col('CELULARUNO'),
  };
  const etiquetas = {
    soc: 'Soc.',
    nPers: 'Nº pers.',
    cedula: 'Número ID',
    nombre: 'Número de personal',
    banco: 'Clave de banco',
    cuenta: 'Cuenta bancaria',
    tipoCuenta: 'CC',
    celular: 'CELULAR_UNO',
  };
  for (const [campo, i] of Object.entries(idx)) {
    if (i === -1 && campo !== 'cese') {
      throw new Error(`No se encontró la columna "${etiquetas[campo]}" en la matriz de bancos.`);
    }
  }

  const mapa = new Map();
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    const soc = texto(r[idx.soc]).toUpperCase();
    const nPers = texto(r[idx.nPers]);
    if (!soc || !nPers) continue;
    const cese = idx.cese !== -1 ? r[idx.cese] : '';
    const fila = {
      soc,
      nPers,
      cedula: normalizarCedula(r[idx.cedula]),
      nombre: texto(r[idx.nombre]),
      banco: texto(r[idx.banco]).toUpperCase(),
      cuenta: texto(r[idx.cuenta]).replace(/\s+/g, ''),
      tipoCuentaCodigo: texto(r[idx.tipoCuenta]),
      celular: texto(r[idx.celular]).replace(/\s+/g, ''),
      cese: cese instanceof Date ? cese : null,
    };
    const key = `${soc}|${nPers}`;
    if (!mapa.has(key)) mapa.set(key, []);
    mapa.get(key).push(fila);
  }
  return mapa;
}

// ── Monto estricto ───────────────────────────────────────────────────────────
// Acepta 600, 600.23, "600,23", "1.234,56", "1,234.56", "$ 600,23".
// Si es ambiguo ("1,500" / "1.500") o no es número → null (la fila se marca error;
// NUNCA se convierte en 0 en silencio).
export function parseMontoEstricto(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
  let s = String(v ?? '').trim().replace(/[$\s]/g, '');
  if (!s || !/^[0-9.,]+$/.test(s)) return null;
  const nComa = (s.match(/,/g) || []).length;
  const nPunto = (s.match(/\./g) || []).length;
  let dec = null;
  if (nComa && nPunto) {
    const ult = Math.max(s.lastIndexOf(','), s.lastIndexOf('.'));
    dec = s[ult];
  } else if (nComa === 1 || nPunto === 1) {
    const sep = nComa ? ',' : '.';
    const despues = s.length - s.lastIndexOf(sep) - 1;
    if (despues === 3) return null; // "1,500": ¿1.5 o 1500? no se adivina
    dec = sep;
  } else if (nComa > 1 || nPunto > 1) {
    const sep = nComa ? ',' : '.';
    if (nComa && nPunto) return null;
    // varios separadores iguales = miles ("1.234.567")
    s = s.split(sep).join('');
    return Number.isFinite(Number(s)) ? Math.round(Number(s) * 100) / 100 : null;
  }
  if (dec) {
    const miles = dec === ',' ? '.' : ',';
    s = s.split(miles).join('').replace(dec, '.');
  }
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

// ── Netos ────────────────────────────────────────────────────────────────────
// Lee SOLO las dos primeras columnas por posición (sin importar cómo se llamen):
//   col 1 = identificador (Nº pers., o cédula de 10 dígitos)
//   col 2 = monto
// Devuelve [{ fila, id, monto, error? }]. Las filas inválidas llevan `error` y el
// cruce las reporta; nada se salta ni se paga en 0.
export function parseArchivoPago(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });

  const filas = [];
  let primeraLeida = false;
  rows.forEach((r, i) => {
    const rawId = r[0];
    const rawMonto = r[1];
    const vacia = texto(rawId) === '' && texto(rawMonto) === '';
    if (vacia) return;

    // Primera fila con contenido: si el monto no es un número, es el encabezado.
    if (!primeraLeida) {
      primeraLeida = true;
      if (parseMontoEstricto(rawMonto) === null && !/^\d+$/.test(texto(rawId))) return;
    }

    const fila = i + 1; // número de fila real en Excel
    const id = texto(rawId).replace(/\.0+$/, '').replace(/\s+/g, '');
    if (!/^\d+$/.test(id)) {
      filas.push({ fila, id: texto(rawId), monto: 0, error: `La primera columna debe ser el Nº pers. (solo números), vino "${texto(rawId)}"` });
      return;
    }
    const monto = parseMontoEstricto(rawMonto);
    if (monto === null) {
      filas.push({ fila, id, monto: 0, error: `Monto no válido o ambiguo ("${texto(rawMonto)}") — revisa la segunda columna` });
      return;
    }
    if (monto <= 0) {
      filas.push({ fila, id, monto, error: `Monto debe ser mayor a 0 (vino ${monto})` });
      return;
    }
    filas.push({ fila, id, monto });
  });

  if (filas.length === 0) {
    throw new Error('El archivo de netos no tiene filas con datos. Debe tener 2 columnas: Nº pers. y valor.');
  }
  return filas;
}