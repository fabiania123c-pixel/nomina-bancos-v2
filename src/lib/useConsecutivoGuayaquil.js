import { useState } from 'react';
import { asignarConsecutivoGuayaquil } from './historial.js';

const p2 = (n) => String(n).padStart(2, '0');

/**
 * Consecutivo de Banco de Guayaquil de UNA corrida.
 * Se asigna la primera vez que se descarga el .txt de Guayaquil (uno por día, en el orden de descarga) y queda fijo:
 * volver a descargar el mismo archivo repite el mismo número.
 *  - consecutivo: { secuencia, dd, mm, yyyy } si ya tiene número; si no, null.
 *  - obtener(): devuelve el consecutivo; si todavía no tiene, lo pide al servidor (y lo recuerda).
 */
export function useConsecutivoGuayaquil(corrida) {
  const [asignado, setAsignado] = useState(null);
  let guardado = null;
  if (corrida.secuencia_guayaquil != null && corrida.consecutivo_dia) {
    const [yyyy, mm, dd] = String(corrida.consecutivo_dia).slice(0, 10).split('-');
    guardado = { secuencia: corrida.secuencia_guayaquil, dd, mm, yyyy };
  }
  const consecutivo = asignado || guardado;

  async function obtener() {
    if (consecutivo) return consecutivo;
    const nuevo = await asignarConsecutivoGuayaquil(corrida.id);
    setAsignado(nuevo);
    return nuevo;
  }
  return { consecutivo, obtener };
}

/** Texto corto para el botón: " · N° 02" cuando ya tiene número. */
export function sufijoConsecutivo(consecutivo) {
  return consecutivo ? ` · N° ${p2(consecutivo.secuencia)}` : '';
}