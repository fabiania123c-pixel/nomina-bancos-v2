export const LABEL_BANCO = {
  produbanco: 'Produbanco',
  pichincha: 'Banco Pichincha',
  guayaquil: 'Banco de Guayaquil',
};

/**
 * A partir del historial completo de corridas, calcula los agregados para
 * el dashboard de seguimiento del Admin. Solo usa detalle_bancos (montos y
 * conteos ya agregados) — nunca datos de empleados individuales.
 */
export function calcularKPIs(corridas) {
  const porBanco = {
    produbanco: { registros: 0, total: 0 },
    pichincha: { registros: 0, total: 0 },
    guayaquil: { registros: 0, total: 0 },
  };
  const porTipo = {
    finiquito: { registros: 0, total: 0, corridas: 0 },
    nomina_regular: { registros: 0, total: 0, corridas: 0 },
  };
  const porMes = new Map();

  let totalGeneral = 0;
  let registrosGeneral = 0;
  let erroresGeneral = 0;
  let corridasFinalizadas = 0;

  corridas.forEach((c) => {
    if (c.finalizado) corridasFinalizadas++;
    erroresGeneral += c.registros_con_error || 0;

    const mesKey = c.fecha ? new Date(c.fecha).toISOString().slice(0, 7) : 'sin-fecha';
    let totalCorrida = 0;

    Object.entries(c.detalle_bancos || {}).forEach(([banco, info]) => {
      if (!porBanco[banco]) porBanco[banco] = { registros: 0, total: 0 };
      porBanco[banco].registros += info.registros || 0;
      porBanco[banco].total += info.total || 0;
      totalGeneral += info.total || 0;
      registrosGeneral += info.registros || 0;
      totalCorrida += info.total || 0;
    });

    if (!porTipo[c.tipo]) porTipo[c.tipo] = { registros: 0, total: 0, corridas: 0 };
    porTipo[c.tipo].corridas += 1;
    porTipo[c.tipo].total += totalCorrida;

    porMes.set(mesKey, (porMes.get(mesKey) || 0) + totalCorrida);
  });

  const tendenciaMensual = [...porMes.entries()]
    .filter(([mes]) => mes !== 'sin-fecha')
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6);

  return {
    totalGeneral,
    registrosGeneral,
    erroresGeneral,
    corridasFinalizadas,
    totalCorridas: corridas.length,
    porBanco,
    porTipo,
    tendenciaMensual,
  };
}

/** Corridas finalizadas en las últimas `horas` horas — para el badge de "nuevo". */
export function corridasRecientes(corridas, horas = 48) {
  const limite = Date.now() - horas * 3600 * 1000;
  return corridas.filter((c) => c.finalizado && c.finalizado_en && new Date(c.finalizado_en).getTime() > limite);
}

/**
 * Agrupa las corridas por quién las generó — para el seguimiento por persona
 * en el dashboard del Admin. Solo usa nombre + totales ya agregados, nunca
 * datos de empleados.
 */
export function calcularPorPersona(corridas) {
  const porPersona = new Map();
  corridas.forEach((c) => {
    const nombre = c.generadoPorNombre || 'Desconocido';
    if (!porPersona.has(nombre)) porPersona.set(nombre, { corridas: 0, registros: 0, total: 0, errores: 0 });
    const p = porPersona.get(nombre);
    p.corridas += 1;
    p.errores += c.registros_con_error || 0;
    Object.values(c.detalle_bancos || {}).forEach((info) => {
      p.registros += info.registros || 0;
      p.total += info.total || 0;
    });
  });
  return [...porPersona.entries()]
    .map(([nombre, datos]) => ({ nombre, ...datos }))
    .sort((a, b) => b.total - a.total);
}