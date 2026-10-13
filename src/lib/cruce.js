import { validateRow, onlyDigits } from './bankProfiles.js';
import { EMPRESAS } from './empresas.js';
import { SOCIEDADES } from './excelParser.js';

const BANCO_A_CLAVE = {
  PRODUBANCO: 'produbanco',
  'BANCO PICHINCHA': 'pichincha',
  'BANCO DE GUAYAQUIL': 'guayaquil',
};

const TIPO_CUENTA_POR_BANCO = {
  produbanco: { '01': 'CTE', '02': 'AHO' },
  pichincha: { '01': 'CC', '02': 'AH' },
  guayaquil: { '01': 'C00', '02': 'A00' },
};

const LABEL_SOCIEDAD = Object.fromEntries(
  Object.values(EMPRESAS).map((e) => [e.sociedad, e.label])
);

/**
 * Cruza el archivo de netos (Nº pers. + valor) con la matriz de bancos.
 *
 * @param filasPago  salida de parseArchivoPago
 * @param mapa       salida de parseDataMadre (clave "SOC|NPERS" → filas)
 * @param opts       { sociedad: 'E100'|'E101'|'E200', tipo }  — la sociedad sale de la
 *                   empresa elegida para la corrida; solo se usan filas de esa sociedad.
 */
export function cruzarConDataMadre(filasPago, mapa, opts = {}) {
  const { sociedad, tipo } = opts;
  if (!sociedad) throw new Error('Falta la sociedad de la empresa elegida para cruzar con la matriz.');
  const labelEmpresa = LABEL_SOCIEDAD[sociedad] || sociedad;

  const resultado = { produbanco: [], pichincha: [], guayaquil: [] };
  const errores = [];
  const advertencias = [];
  const vistos = new Set();
  const resueltas = [];
  const otrasEmpresas = [];

  // Índice por cédula (solo la sociedad elegida) para ids de 10 dígitos.
  const porCedula = new Map();
  for (const [key, filas] of mapa) {
    if (!key.startsWith(`${sociedad}|`)) continue;
    for (const f of filas) {
      if (!f.cedula) continue;
      if (!porCedula.has(f.cedula)) porCedula.set(f.cedula, new Map());
      porCedula.get(f.cedula).set(f.nPers, filas);
    }
  }

  function candidatos(id) {
    if (id.length === 10) {
      const porPers = porCedula.get(id);
      if (!porPers) return { filas: null };
      if (porPers.size === 1) return { filas: [...porPers.values()][0] };
      // Misma cédula con varios Nº pers. (recontratación): se prefiere el que no tiene cese.
      const vigentes = [...porPers.values()].filter((fs) => !fs.every((f) => f.cese));
      if (vigentes.length === 1) return { filas: vigentes[0] };
      return { ambiguo: [...porPers.keys()].join(', ') };
    }
    const filas = mapa.get(`${sociedad}|${id}`) || mapa.get(`${sociedad}|${id.replace(/^0+/, '')}`);
    return { filas: filas || null };
  }

  // Si el Nº pers. no está en la empresa elegida pero sí en otra del grupo, no es un error:
  // un mismo archivo de netos puede traer varias empresas (Mayoristas). Esas personas NO
  // entran en esta corrida, pero se devuelven aparte para que se procesen con su empresa.
  function enOtraSociedad(id) {
    if (id.length === 10) return null;
    for (const s of SOCIEDADES) {
      if (s !== sociedad && mapa.has(`${s}|${id}`)) {
        const f = mapa.get(`${s}|${id}`)[0];
        return { empresa: LABEL_SOCIEDAD[s] || s, nombre: f.nombre };
      }
    }
    return null;
  }

  filasPago.forEach((fp) => {
    const fila = fp.fila;
    const base = { fila, nPers: fp.id, cedula: '', nombre: '' };

    if (fp.error) {
      errores.push({ ...base, motivo: fp.error });
      return;
    }

    const { filas: cands, ambiguo } = candidatos(fp.id);
    if (ambiguo) {
      errores.push({ ...base, motivo: `La cédula ${fp.id} tiene varios Nº pers. en ${labelEmpresa} (${ambiguo}) — usa el Nº pers. en el archivo` });
      return;
    }
    if (!cands) {
      const otra = enOtraSociedad(fp.id);
      if (otra) {
        otrasEmpresas.push({ fila, nPers: fp.id, nombre: otra.nombre, empresa: otra.empresa, monto: fp.monto });
        return;
      }
      errores.push({ ...base, motivo: `Nº pers. ${fp.id} no encontrado en la matriz` });
      return;
    }

    const ref = cands[0];
    const conBanco = cands.filter((f) => f.banco && f.cuenta);
    if (conBanco.length === 0) {
      errores.push({
        ...base,
        cedula: ref.cedula,
        nombre: ref.nombre,
        motivo: 'Empleado en la matriz sin banco/cuenta cargado',
      });
      return;
    }
    const distintas = new Map(conBanco.map((f) => [`${f.banco}|${onlyDigits(f.cuenta)}`, f]));
    if (distintas.size > 1) {
      errores.push({
        ...base,
        cedula: ref.cedula,
        nombre: ref.nombre,
        motivo: `Tiene ${distintas.size} cuentas distintas en la matriz (${[...distintas.keys()].map((k) => k.replace('|', ' ')).join(' / ')}) — define cuál es la vigente`,
      });
      return;
    }
    const m = conBanco[0];
    const b = { ...base, cedula: m.cedula, nombre: m.nombre };

    if (vistos.has(m.nPers)) {
      errores.push({ ...b, motivo: 'Nº pers. duplicado en el archivo de netos' });
      return;
    }
    vistos.add(m.nPers);

    const bancoClave = BANCO_A_CLAVE[m.banco];
    if (!bancoClave) {
      errores.push({ ...b, motivo: `Banco "${m.banco}" no reconocido (todavía no construido en el sistema)` });
      return;
    }

    const tipoCuenta = TIPO_CUENTA_POR_BANCO[bancoClave][m.tipoCuentaCodigo];
    if (!tipoCuenta) {
      errores.push({ ...b, motivo: `Tipo de cuenta "${m.tipoCuentaCodigo}" no reconocido en la matriz (se esperaba 01 o 02)` });
      return;
    }

    const rowResuelta = {
      cedula: m.cedula,
      nombre: m.nombre,
      codigoEmpleado: m.nPers,
      celular: m.celular,
      cuenta: m.cuenta,
      tipoCuenta,
      monto: String(fp.monto),
      // Solo se usa en el detalle de finiquitos (fecha de cese de la matriz);
      // no afecta el formato de ningún archivo de banco.
      baja: m.cese || null,
    };

    const erroresValidacion = validateRow(bancoClave, rowResuelta);
    if (erroresValidacion.length > 0) {
      errores.push({ ...b, motivo: erroresValidacion.join('; ') });
      return;
    }

    const monto = parseFloat(fp.monto) || 0;
    if (monto > 10000) {
      advertencias.push({ ...b, motivo: `Monto inusualmente alto ($${monto.toFixed(2)}) — confirma que esté bien` });
    }
    if (monto > 0 && monto < 1) {
      advertencias.push({ ...b, motivo: `Monto muy bajo ($${monto.toFixed(2)}) — confirma que esté completo` });
    }
    if (m.cese && tipo !== 'finiquito') {
      const f = m.cese;
      const txt = `${String(f.getDate()).padStart(2, '0')}/${String(f.getMonth() + 1).padStart(2, '0')}/${f.getFullYear()}`;
      advertencias.push({ ...b, motivo: `Tiene fecha de cese en la matriz (${txt}) — confirma que deba recibir este pago` });
    }
    if (!m.celular) {
      advertencias.push({ ...b, motivo: 'Sin celular cargado en la matriz (no bloquea este banco, pero revisa para el futuro)' });
    }
    if (bancoClave === 'guayaquil') {
      // Guayaquil exige la cuenta en 8 dígitos exactos. Si viene con ceros de más se limpia
      // DE VERDAD; si aun sin ceros no cabe en 8, es error (no se puede generar).
      const cuentaCruda = onlyDigits(m.cuenta);
      const cuentaLimpia = cuentaCruda.replace(/^0+/, '') || '0';
      if (cuentaLimpia.length > 8) {
        errores.push({ ...b, motivo: `Cuenta de Guayaquil con más de 8 dígitos (${cuentaCruda}) — el banco exige 8, revisa la matriz` });
        return;
      }
      if (cuentaCruda.length > 8) {
        rowResuelta.cuenta = cuentaLimpia.padStart(8, '0');
        advertencias.push({
          ...b,
          motivo: `Cuenta tenía ceros de más (${cuentaCruda}) — se limpió automáticamente a ${cuentaLimpia.padStart(8, '0')}`,
        });
      }
    }
    if (bancoClave === 'pichincha' && onlyDigits(m.cuenta).length > 10) {
      advertencias.push({
        ...b,
        motivo: `Cuenta de Pichincha con más de 10 dígitos (${onlyDigits(m.cuenta)}) — la línea saldría más larga que las demás, confirma que sea correcta`,
      });
    }
    if (bancoClave === 'produbanco' && onlyDigits(m.cuenta).length !== 11) {
      advertencias.push({
        ...b,
        motivo: `Cuenta de Produbanco con ${onlyDigits(m.cuenta).length} dígitos (${onlyDigits(m.cuenta)}); las demás tienen 11 — confirma que sea correcta`,
      });
    }

    resultado[bancoClave].push(rowResuelta);
    resueltas.push({ ...b, cuenta: rowResuelta.cuenta, cedulaKey: m.cedula });
  });

  const porCuenta = new Map();
  resueltas.forEach((r) => {
    if (!porCuenta.has(r.cuenta)) porCuenta.set(r.cuenta, new Set());
    porCuenta.get(r.cuenta).add(r.cedulaKey);
  });
  resueltas.forEach((r) => {
    if (porCuenta.get(r.cuenta).size > 1) {
      advertencias.push({ fila: r.fila, nPers: r.nPers, cedula: r.cedula, nombre: r.nombre, motivo: 'Esta cuenta se repite en otra persona del archivo' });
    }
  });

  return { resultado, errores, advertencias, otrasEmpresas };
}