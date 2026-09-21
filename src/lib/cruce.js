import { validateRow, onlyDigits } from './bankProfiles.js';

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

export function cruzarConDataMadre(filasPago, mapaDataMadre) {
  const resultado = { produbanco: [], pichincha: [], guayaquil: [] };
  const errores = [];
  const advertencias = [];
  const vistos = new Set();
  const resueltas = [];

  filasPago.forEach((fp, i) => {
    const fila = i + 1;

    if (vistos.has(fp.cedula)) {
      errores.push({ fila, cedula: fp.cedula, nombre: fp.nombre, motivo: 'Cédula duplicada en el archivo subido' });
      return;
    }
    vistos.add(fp.cedula);

    const m = mapaDataMadre.get(fp.cedula);
    if (!m) {
      errores.push({ fila, cedula: fp.cedula, nombre: fp.nombre, motivo: 'Cédula no encontrada en Data_madre' });
      return;
    }
    if (!m.banco || !m.cuenta) {
      errores.push({
        fila,
        cedula: fp.cedula,
        nombre: m.nombre || fp.nombre,
        motivo: 'Empleado en Data_madre sin banco/cuenta cargado',
      });
      return;
    }

    const bancoClave = BANCO_A_CLAVE[m.banco];
    if (!bancoClave) {
      errores.push({
        fila,
        cedula: fp.cedula,
        nombre: m.nombre,
        motivo: `Banco "${m.banco}" no reconocido (todavía no construido en el sistema)`,
      });
      return;
    }

    const tipoCuenta = TIPO_CUENTA_POR_BANCO[bancoClave][m.tipoCuentaCodigo];
    if (!tipoCuenta) {
      errores.push({
        fila,
        cedula: fp.cedula,
        nombre: m.nombre,
        motivo: `Tipo de cuenta "${m.tipoCuentaCodigo}" no reconocido en Data_madre (se esperaba 01 o 02)`,
      });
      return;
    }

    const rowResuelta = {
      cedula: m.cedula,
      nombre: m.nombre,
      codigoEmpleado: m.codigoSap,
      celular: m.celular,
      cuenta: m.cuenta,
      tipoCuenta,
      monto: String(fp.monto),
    };

    const erroresValidacion = validateRow(bancoClave, rowResuelta);
    if (erroresValidacion.length > 0) {
      errores.push({ fila, cedula: fp.cedula, nombre: m.nombre, motivo: erroresValidacion.join('; ') });
      return;
    }

    const monto = parseFloat(fp.monto) || 0;
    if (monto > 10000) {
      advertencias.push({ fila, cedula: fp.cedula, nombre: m.nombre, motivo: `Monto inusualmente alto ($${monto.toFixed(2)}) — confirma que esté bien` });
    }
    if (monto > 0 && monto < 1) {
      advertencias.push({ fila, cedula: fp.cedula, nombre: m.nombre, motivo: `Monto muy bajo ($${monto.toFixed(2)}) — confirma que esté completo` });
    }
    if (!m.celular) {
      advertencias.push({ fila, cedula: fp.cedula, nombre: m.nombre, motivo: 'Sin celular cargado en Data_madre (no bloquea este banco, pero revisa para el futuro)' });
    }
    if (bancoClave === 'guayaquil') {
      const cuentaCruda = onlyDigits(m.cuenta);
      const cuentaLimpia = cuentaCruda.replace(/^0+/, '') || '0';
      if (cuentaCruda.length > 8 && cuentaLimpia.length <= 8) {
        advertencias.push({
          fila,
          cedula: fp.cedula,
          nombre: m.nombre,
          motivo: `Cuenta en Data_madre tenía ceros de más (${cuentaCruda}) — se limpió automáticamente a ${cuentaLimpia.padStart(8, '0')}`,
        });
      }
    }

    resultado[bancoClave].push(rowResuelta);
    resueltas.push({ fila, cedula: fp.cedula, nombre: m.nombre, cuenta: m.cuenta });
  });

  const porCuenta = new Map();
  resueltas.forEach((r) => {
    if (!porCuenta.has(r.cuenta)) porCuenta.set(r.cuenta, new Set());
    porCuenta.get(r.cuenta).add(r.cedula);
  });
  resueltas.forEach((r) => {
    if (porCuenta.get(r.cuenta).size > 1) {
      advertencias.push({ fila: r.fila, cedula: r.cedula, nombre: r.nombre, motivo: 'Esta cuenta se repite en otra cédula del archivo' });
    }
  });

  return { resultado, errores, advertencias };
}