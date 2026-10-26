const p2 = (n) => String(n).padStart(2, '0');

// Estándar acordado con Víctor (Tesorería): fecha, banco, empresa y proceso se leen en el nombre.
const LETRA_EMPRESA = { superdeporte: 'S', equinox: 'E', medeport: 'M' };
const CODIGO_BANCO = { produbanco: 'PR', pichincha: 'BP' };
const CODIGO_TIPO = {
  finiquito: 'LQ',
  prestamo: 'PTS',
  jubilacion: 'JUB',
  teletrabajo: 'TTB',
  rebotes: 'RBT',
  nomina_regular: 'RBT', // el tipo viejo "Nómina regular" ahora se muestra como Rebotes
};

function partes(ctx) {
  return { dd: p2(ctx.dd), mm: p2(ctx.mm), yyyy: String(ctx.yyyy) };
}

function ensureTxt(nombre) {
  return /\.txt$/i.test(nombre) ? nombre : `${nombre}.txt`;
}

const letra = (empresa) => LETRA_EMPRESA[empresa || 'superdeporte'] || 'S';
const codTipo = (tipo) => CODIGO_TIPO[tipo] || '';

/**
 * Nombre del .txt de cada banco.
 *   Produbanco -> MMDDAAAA PR _ <S|E|M> _ <LQ|PTS|JUB|TTB|RBT>   ej. 10162026PR_S_LQ.txt
 *   Pichincha  -> MMDDAAAA BP _ <S|E|M> _ <proceso>               ej. 10162026BP_E_PTS.txt
 *   Guayaquil  -> NCR AAAAMMDD HGS _ <consecutivo>                ej. NCR20261016HGS_01.txt   (el que baja el Admin)
 *   Guayaquil, copia de la operadora (sin consecutivo) -> BGY_MMDDAAAA_<S|E|M>_<proceso>_SIN_CONSECUTIVO.txt
 * ctx = { dd, mm, yyyy, empresa, tipo, secuencia }
 */
export function nombreArchivoBanco(banco, ctx) {
  const { dd, mm, yyyy } = partes(ctx);

  if (banco === 'pichincha' || banco === 'produbanco') {
    const t = codTipo(ctx.tipo);
    return ensureTxt(`${mm}${dd}${yyyy}${CODIGO_BANCO[banco]}_${letra(ctx.empresa)}${t ? `_${t}` : ''}`);
  }
  if (banco === 'guayaquil') {
    if (ctx.secuencia != null) return ensureTxt(`NCR${yyyy}${mm}${dd}HGS_${p2(ctx.secuencia)}`);
    // Sin consecutivo = copia de la operadora (no es el archivo que se sube al banco): el nombre lo dice claro.
    const t = codTipo(ctx.tipo);
    return ensureTxt(`BGY_${mm}${dd}${yyyy}_${letra(ctx.empresa)}${t ? `_${t}` : ''}_SIN_CONSECUTIVO`);
  }
  throw new Error(`Banco "${banco}" no reconocido.`);
}

// Letras de empresa para un nombre: una sola ("E") o varias juntas ("EM").
function letras(empresas) {
  const lista = Array.isArray(empresas) ? empresas : [empresas];
  return lista.map(letra).join('');
}

function nombreConProceso(prefijo, { empresa, empresas, tipo, dd, mm, yyyy }, ext) {
  const t = codTipo(tipo);
  return `${p2(mm)}${p2(dd)}${yyyy} ${prefijo} ${letras(empresas || empresa)}${t ? `_${t}` : ''}.${ext}`;
}

/** PDF resumen:  10162026 Resumen S_LQ.pdf */
export function nombrePdfResumen(args) {
  return nombreConProceso('Resumen', args, 'pdf');
}

/** Excel de detalle:  10162026 Detalle E_LQ.xlsx  (varias empresas juntas: "EM_LQ") */
export function nombreDetalleExcel(args) {
  return nombreConProceso('Detalle', args, 'xlsx');
}