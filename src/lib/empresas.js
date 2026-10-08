// Empresas del grupo. "grupo" decide el nombre del PDF:
//   Retail     -> Superdeporte
//   Mayoristas -> Equinox y Medeport
// IMPORTANTE: cuentaOrigen y ruc de Equinox y Medeport están vacíos a propósito
// (no se inventan). Mientras estén vacíos, el sistema NO deja procesar esa empresa.
export const EMPRESAS = {
  superdeporte: {
    label: 'Superdeporte',
    abrev: 'Super',
    grupo: 'Retail',
    cuentaOrigen: '01005024240',
    ruc: '1791413237001',
  },
  equinox: { label: 'Equinox', abrev: 'Equi', grupo: 'Mayoristas', cuentaOrigen: '', ruc: '' },
  medeport: { label: 'Medeport', abrev: 'Mede', grupo: 'Mayoristas', cuentaOrigen: '', ruc: '' },
};

export const EMPRESAS_KEYS = Object.keys(EMPRESAS);

export function labelEmpresa(key) {
  return EMPRESAS[key]?.label || key || '—';
}