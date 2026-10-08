import { BANK_PROFILES } from './bankProfiles.js';
import { EMPRESAS } from './empresas.js';

const p2 = (n) => String(n).padStart(2, '0');

function partes(ctx) {
  const dd = p2(ctx.dd);
  const mm = p2(ctx.mm);
  const yyyy = String(ctx.yyyy);
  return { dd, mm, yyyy };
}

function ensureTxt(nombre) {
  return /\.txt$/i.test(nombre) ? nombre : `${nombre}.txt`;
}

/**
 * Nombre del .txt de cada banco.
 *   Pichincha  -> MMDDAAAA-BP_Super      (BP_Equi, BP_Mede)
 *   Produbanco -> MMDDAAAA-BPRO_Super
 *   Guayaquil  -> NCRAAAAMMDDHGS-01      (consecutivo por empresa y por día)
 * ctx = { dd, mm, yyyy, empresa, secuencia }
 */
export function nombreArchivoBanco(banco, ctx) {
  const { dd, mm, yyyy } = partes(ctx);
  const abrev = EMPRESAS[ctx.empresa || 'superdeporte']?.abrev || 'Super';

  if (banco === 'pichincha') return ensureTxt(`${mm}${dd}${yyyy}-BP_${abrev}`);
  if (banco === 'produbanco') return ensureTxt(`${mm}${dd}${yyyy}-BPRO_${abrev}`);
  if (banco === 'guayaquil') {
    if (ctx.secuencia != null) return ensureTxt(`NCR${yyyy}${mm}${dd}HGS-${p2(ctx.secuencia)}`);
    // corridas viejas (antes del consecutivo): se conserva el nombre de siempre
    return ensureTxt(BANK_PROFILES.guayaquil.filename(ctx));
  }
  throw new Error(`Banco "${banco}" no reconocido.`);
}

/**
 * Nombre del PDF resumen.
 *   Superdeporte        -> MMDDAAAA- Retail bancos.pdf
 *   Equinox / Medeport  -> MMDDAAAA- Mayoristas Equi bancos.pdf
 */
export function nombrePdfResumen({ empresa, dd, mm, yyyy }) {
  const e = EMPRESAS[empresa || 'superdeporte'] || EMPRESAS.superdeporte;
  const fecha = `${p2(mm)}${p2(dd)}${yyyy}`;
  const resto = e.grupo === 'Retail' ? 'Retail bancos' : `Mayoristas ${e.abrev} bancos`;
  return `${fecha}- ${resto}.pdf`;
}