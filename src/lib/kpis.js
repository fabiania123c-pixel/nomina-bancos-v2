// Filtra por empresa. 'consolidado' (o vacío) deja todo; si no, solo esa empresa.
// Las corridas viejas sin empresa cuentan como Superdeporte.
export function filtrarPorEmpresa(corridas, empresa) {
  if (!empresa || empresa === 'consolidado') return corridas;
  return corridas.filter((c) => (c.empresa || 'superdeporte') === empresa);
}

export const LABEL_BANCO = {
  produbanco: 'Produbanco',
  pichincha: 'Banco Pichincha',
  guayaquil: 'Banco de Guayaquil',
};

export function calcularKPIs(corridasConAnuladas) {
  const corridas = corridasConAnuladas.filter((c) => !c.anulada);
  const porBanco = {
    produbanco: { registros: 0, total: 0 },
    pichincha: { registros: 0, total: 0 },
    guayaquil: { registros: 0, total: 0 },
  };
  // Dinámico (antes venía fijo a finiquito/nomina_regular): ahora hay 4 tipos
  // nuevos (finiquito, prestamo, jubilacion, teletrabajo) más el legado
  // nomina_regular en corridas viejas, así que cada tipo que aparezca se crea solo.
  const porTipo = {};
  const porMes = new Map();
  const porEmpresa = {};

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

    const emp = c.empresa || 'superdeporte';
    if (!porEmpresa[emp]) porEmpresa[emp] = { registros: 0, total: 0, corridas: 0 };
    porEmpresa[emp].corridas += 1;
    porEmpresa[emp].total += totalCorrida;
    Object.values(c.detalle_bancos || {}).forEach((info) => {
      porEmpresa[emp].registros += info.registros || 0;
    });

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
    porEmpresa,
    tendenciaMensual,
  };
}

export function corridasRecientes(corridas, horas = 48) {
  const limite = Date.now() - horas * 3600 * 1000;
  return corridas.filter((c) => c.finalizado && c.finalizado_en && new Date(c.finalizado_en).getTime() > limite);
}

export function calcularPorPersona(corridasConAnuladas) {
  const corridas = corridasConAnuladas.filter((c) => !c.anulada);
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

// `empresa` (opcional): compara solo contra corridas de esa misma empresa, para que
// el promedio de Superdeporte no distorsione los avisos de Equinox o Medeport.
export function compararConHistorico(detalleActual, corridasHistoricasConAnuladas, tipo, empresa) {
  const avisos = [];
  const mismasTipo = filtrarPorEmpresa(corridasHistoricasConAnuladas, empresa).filter((c) => !c.anulada && c.tipo === tipo);
  if (mismasTipo.length < 2) return avisos;

  Object.entries(detalleActual).forEach(([banco, info]) => {
    const totalesHistoricos = mismasTipo
      .map((c) => c.detalle_bancos?.[banco]?.total)
      .filter((t) => typeof t === 'number' && t > 0);
    if (totalesHistoricos.length < 2) return;

    const promedio = totalesHistoricos.reduce((a, b) => a + b, 0) / totalesHistoricos.length;
    const variacion = (info.total - promedio) / promedio;

    if (Math.abs(variacion) > 0.5) {
      const direccion = variacion > 0 ? 'más alto' : 'más bajo';
      const pct = Math.round(Math.abs(variacion) * 100);
      avisos.push(
        `${LABEL_BANCO[banco] || banco}: el total es ${pct}% ${direccion} que el promedio histórico de este tipo de corrida ($${promedio.toFixed(2)})`
      );
    }
  });

  return avisos;
}