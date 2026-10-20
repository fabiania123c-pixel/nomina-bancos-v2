import { useState, useEffect } from 'react';

/**
 * Como useState, pero el valor se guarda en la pestaña (sessionStorage).
 * Si la pantalla se vuelve a montar (por ejemplo al volver a la pestaña), la persona
 * sigue donde estaba en vez de regresar al inicio. Si el navegador no deja guardar, funciona normal.
 */
export function useEstadoPersistente(clave, inicial) {
  const [valor, setValor] = useState(() => {
    try {
      const guardado = sessionStorage.getItem(clave);
      if (guardado !== null) return JSON.parse(guardado);
    } catch (e) {
      /* sin almacenamiento: se usa el valor inicial */
    }
    return typeof inicial === 'function' ? inicial() : inicial;
  });

  useEffect(() => {
    try {
      if (valor === undefined || valor === null) sessionStorage.removeItem(clave);
      else sessionStorage.setItem(clave, JSON.stringify(valor));
    } catch (e) {
      /* lleno o bloqueado: se ignora */
    }
  }, [clave, valor]);

  return [valor, setValor];
}