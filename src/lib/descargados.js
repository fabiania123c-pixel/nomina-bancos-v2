import { useState } from 'react';

// Marca (en este navegador) qué archivos de cada corrida ya se descargaron, para pintarlos en verde.
// item: 'txt:produbanco' | 'txt:pichincha' | 'txt:guayaquil' | 'resumen' | 'detalle'
const clave = (corridaId, item) => `descargado:${corridaId}:${item}`;

function leer(corridaId, item) {
  try {
    return localStorage.getItem(clave(corridaId, item)) === '1';
  } catch (e) {
    return false;
  }
}

export function useDescargados(corridaId) {
  const [version, setVersion] = useState(0);
  const [enMemoria, setEnMemoria] = useState({});

  function hecho(item) {
    return !!enMemoria[item] || leer(corridaId, item);
  }
  function marcar(item) {
    setEnMemoria((prev) => ({ ...prev, [item]: true }));
    try {
      localStorage.setItem(clave(corridaId, item), '1');
    } catch (e) {
      /* sin almacenamiento: queda solo mientras la pantalla esté abierta */
    }
    setVersion((v) => v + 1);
  }
  return { hecho, marcar };
}

/** Estilo de un botón de descarga: verde con ✓ si ya se descargó. */
export function estiloDescarga(base, yaDescargado) {
  if (!yaDescargado) return base;
  return { ...base, background: 'var(--ok-bg, #E7F6EC)', borderColor: 'var(--ok)', color: 'var(--ok)', fontWeight: 600 };
}

export function textoDescarga(texto, yaDescargado) {
  return yaDescargado ? `✓ ${texto}` : texto;
}