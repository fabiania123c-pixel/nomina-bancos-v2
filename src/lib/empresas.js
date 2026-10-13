// Empresas del grupo. "grupo" decide el nombre del PDF:
//   Retail     -> Superdeporte
//   Mayoristas -> Equinox y Medeport
// ruc: lo usa el encabezado de Pichincha. cuentaOrigen: la usa Produbanco (2º campo de cada
// línea). Equinox y Medeport todavía NO tienen cuentaOrigen (no se inventa): mientras esté
// vacía, el sistema bloquea la corrida solo si hay pagos por Produbanco.
export const EMPRESAS = {
  superdeporte: {
    label: 'Superdeporte',
    abrev: 'Super',
    sociedad: 'E200',
    grupo: 'Retail',
    cuentaOrigen: '01005024240',
    ruc: '1791413237001',
  },
  equinox: { label: 'Equinox', abrev: 'Equi', sociedad: 'E100', grupo: 'Mayoristas', cuentaOrigen: '', ruc: '1790665437001' },
  medeport: { label: 'Medeport', abrev: 'Mede', sociedad: 'E101', grupo: 'Mayoristas', cuentaOrigen: '', ruc: '1792056055001' },
};

export const EMPRESAS_KEYS = Object.keys(EMPRESAS);

export function labelEmpresa(key) {
  return EMPRESAS[key]?.label || key || '—';
}