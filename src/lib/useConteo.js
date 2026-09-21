import { useEffect, useState } from 'react';

export function useConteo(valor, duracion = 700) {
  const [actual, setActual] = useState(0);

  useEffect(() => {
    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducido || !isFinite(valor)) {
      setActual(valor);
      return;
    }

    let frame;
    const inicio = performance.now();
    const desde = 0;

    function tick(ahora) {
      const t = Math.min(1, (ahora - inicio) / duracion);
      const eased = 1 - Math.pow(1 - t, 3);
      setActual(desde + (valor - desde) * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [valor, duracion]);

  return actual;
}