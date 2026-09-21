// Motor de generación de archivos para bancos (bloc de notas).
//
// Portado y verificado byte a byte contra archivos reales de cada banco.
// No depende del DOM ni de ningún framework — funciones puras, así que corren
// igual en el navegador (para la vista previa) o en un servidor/edge function.
//
// Ver ESPECIFICACION_sistema_nomina_bancos.md para el detalle de cómo se
// dedujo cada formato y qué se verificó contra qué archivo real.

export function normalizeName(s) {
  if (!s) return '';
  const map = { Á: 'A', É: 'E', Í: 'I', Ó: 'O', Ú: 'U', Ü: 'U' };
  let out = s
    .toUpperCase()
    .split('')
    .map((ch) => map[ch] || ch)
    .join('');
  out = out.replace(/[^A-ZÑ0-9 ]/g, ''); // solo letras, Ñ, números y espacios
  out = out.replace(/\s+/g, ' ').trim();
  return out;
}

export function onlyDigits(s) {
  return (s || '').toString().replace(/[^0-9]/g, '');
}

export function parseMonto(s) {
  if (s === undefined || s === null) return NaN;
  let str = String(s).trim();
  if (str === '') return NaN;
  if (str.includes(',') && str.includes('.')) {
    str = str.replace(/,/g, '');
  } else if (str.includes(',') && !str.includes('.')) {
    str = str.replace(',', '.');
  }
  str = str.replace(/[^0-9.-]/g, '');
  return parseFloat(str);
}

export const BANK_PROFILES = {
  produbanco: {
    label: 'Produbanco',
    fields: {
      cedula: 'required',
      nombre: 'required',
      codigoEmpleado: 'hidden',
      celular: 'hidden',
      tipoCuenta: ['AHO', 'CTE'],
      tipoId: ['C', 'R'],
    },
    lineEnding: 'trailing', // el archivo real termina con \r\n después de la última línea
    filename: (ctx) => `PRODUBANCO_FINMES_SPD_${ctx.dd || ''}${ctx.mm}${ctx.yyyy}`,
    buildHeader: null,
    buildRecord: (r, ctx) => {
      const seq = String(ctx.seq).padStart(7, '0');
      const centavos = Math.round(ctx.monto * 100);
      const montoStr = String(centavos).padStart(13, '0');
      const nombre = normalizeName(r.nombre);
      const pad = ' '.repeat(Math.max(0, 151 - nombre.length));
      const fields = [
        'PA',
        ctx.cuentaOrigen,
        seq,
        '',
        onlyDigits(r.cedula),
        'USD',
        montoStr,
        'CTA',
        '0036',
        r.tipoCuenta || 'AHO',
        onlyDigits(r.cuenta),
        r.tipoId || 'C',
        onlyDigits(r.cedula),
        nombre,
        '',
        '',
        '',
        '',
        ctx.periodo,
        pad,
      ];
      return fields.join('\t');
    },
  },

  pichincha: {
    label: 'Pichincha',
    // Pichincha no lleva el nombre en el archivo, pero sí un código de empleado (SAP) que
    // Produbanco no pide. tipoCuenta usa sus propios códigos literales (AH/CC, no AHO/CTE).
    fields: {
      cedula: 'required',
      nombre: 'optional',
      codigoEmpleado: 'required',
      celular: 'hidden',
      tipoCuenta: ['AH', 'CC'],
      tipoId: 'none',
    },
    lineEnding: 'none', // el archivo real NO tiene \r\n después de la última línea
    filename: (ctx) => `PICHINCHA_${ctx.dd || ''}${ctx.mm}${ctx.yyyy}`,
    // Verificado contra un archivo real: encabezado con texto fijo (incluye el RUC de la
    // empresa) + cantidad de registros (6 dígitos) + monto total en centavos (17 dígitos).
    buildHeader: (rows, ctx) => {
      const fixed = `BPR${ctx.ruc} 0103`;
      const count = String(rows.length).padStart(6, '0');
      const totalCents = rows.reduce(
        (acc, r) => acc + Math.round(parseMonto(r.monto) * 100),
        0
      );
      const amount = String(totalCents).padStart(17, '0');
      return fixed + count + amount;
    },
    buildRecord: (r, ctx) => {
      const empc = onlyDigits(r.codigoEmpleado).padStart(16, '0');
      const bloque1 = empc + ' '.repeat(32) + 'C' + '0000';
      const cents =
        String(Math.round(ctx.monto * 100)).padStart(13, '0') + '0'.repeat(14);
      const bloque2 =
        onlyDigits(r.cedula) +
        cents +
        (r.tipoCuenta || 'AH') +
        'USDUSD' +
        onlyDigits(r.cuenta).padEnd(10, ' ');
      const bloque3 = 'C' + ctx.fecha + ctx.fecha + 'U';
      return bloque1 + bloque2 + bloque3;
    },
  },

  guayaquil: {
    label: 'Guayaquil',
    // Guayaquil no lleva cédula ni nombre en el archivo — usa el CELULAR como identificador
    // del beneficiario. Sin encabezado ni pie de archivo. Verificado 47/47 líneas exactas
    // contra un archivo real.
    fields: {
      cedula: 'hidden',
      nombre: 'optional',
      codigoEmpleado: 'hidden',
      celular: 'required',
      tipoCuenta: ['A00', 'C00'],
      tipoId: 'none',
    },
    lineEnding: 'none',
    filename: (ctx) => `BGY_${ctx.dd || ''}${ctx.mm}${ctx.yyyy}`,
    buildHeader: null,
    buildRecord: (r, ctx) => {
      const tipo = r.tipoCuenta || 'A00';
      const cuenta = onlyDigits(r.cuenta).padStart(8, '0');
      const centavos = String(Math.round(ctx.monto * 100)).padStart(15, '0');
      const celular = onlyDigits(r.celular).padStart(10, '0');
      return (
        tipo +
        cuenta +
        centavos +
        'XXY06' +
        ' '.repeat(38) +
        'HGS' +
        ' '.repeat(30) +
        celular
      );
    },
  },
};

/**
 * Arma las líneas de detalle (sin encabezado) para un banco dado.
 * @param {string} bankKey - 'produbanco' | 'pichincha' | 'guayaquil'
 * @param {Array} rows - filas ya resueltas contra Data_madre: {cedula, nombre, cuenta, monto, codigoEmpleado, celular, tipoCuenta, tipoId}
 * @param {object} ctx - { cuentaOrigen, ruc, mm, dd, yyyy }
 */
export function buildLines(bankKey, rows, ctx) {
  const profile = BANK_PROFILES[bankKey];
  if (!profile) throw new Error(`Banco desconocido: ${bankKey}`);

  const periodo = `MES-${ctx.mm}-${ctx.yyyy}`;
  const fecha = `${ctx.yyyy}-${ctx.mm}-${ctx.dd}`;

  return rows.map((r, idx) => {
    const rowCtx = {
      ...ctx,
      seq: idx + 1,
      periodo,
      fecha,
      cedula: onlyDigits(r.cedula),
      cuenta: onlyDigits(r.cuenta),
      nombre: normalizeName(r.nombre),
      monto: parseMonto(r.monto),
    };
    return profile.buildRecord(r, rowCtx);
  });
}

/**
 * Arma el contenido final del archivo (encabezado si aplica + líneas + el
 * salto de línea final correcto según el banco).
 */
export function buildFileContent(bankKey, rows, ctx) {
  const profile = BANK_PROFILES[bankKey];
  if (!profile) throw new Error(`Banco desconocido: ${bankKey}`);

  const periodo = `MES-${ctx.mm}-${ctx.yyyy}`;
  const fecha = `${ctx.yyyy}-${ctx.mm}-${ctx.dd}`;
  const baseCtx = { ...ctx, periodo, fecha };

  const lines = buildLines(bankKey, rows, ctx);
  const header = profile.buildHeader ? profile.buildHeader(rows, baseCtx) : null;
  const allLines = header ? [header, ...lines] : lines;
  const body = allLines.join('\r\n');
  return profile.lineEnding === 'trailing' ? body + '\r\n' : body;
}

/**
 * Valida una fila contra las reglas de campos requeridos del banco activo.
 * Devuelve un array de strings con los errores encontrados (vacío = sin errores).
 */
export function validateRow(bankKey, r) {
  const f = BANK_PROFILES[bankKey].fields;
  const errs = [];
  if (f.cedula === 'required' && onlyDigits(r.cedula).length !== 10) {
    errs.push('Cédula debe tener 10 dígitos');
  }
  if (f.nombre === 'required') {
    if (!r.nombre || normalizeName(r.nombre).length === 0) errs.push('Nombre vacío');
    if (normalizeName(r.nombre).length > 151) {
      errs.push('Nombre demasiado largo (máx. 151 caracteres tras normalizar)');
    }
  }
  if (f.codigoEmpleado === 'required' && onlyDigits(r.codigoEmpleado).length === 0) {
    errs.push('Código de empleado vacío');
  }
  if (f.celular === 'required' && onlyDigits(r.celular).length !== 10) {
    errs.push('Celular debe tener 10 dígitos');
  }
  if (onlyDigits(r.cuenta).length === 0) errs.push('Cuenta vacía o inválida');
  const monto = parseMonto(r.monto);
  if (isNaN(monto) || monto <= 0) errs.push('Monto inválido');
  return errs;
}
