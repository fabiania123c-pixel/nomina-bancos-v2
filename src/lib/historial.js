import { supabase } from './supabaseClient.js';

const COLUMNAS_SUBIDO = {
  produbanco: { at: 'subido_produbanco_at', por: 'subido_produbanco_por' },
  pichincha: { at: 'subido_pichincha_at', por: 'subido_pichincha_por' },
  guayaquil: { at: 'subido_guayaquil_at', por: 'subido_guayaquil_por' },
};

export async function getPerfilActual() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, nombre, rol')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('Error leyendo el perfil:', error.message);
    return null;
  }
  return data;
}

export async function getHistorialCorridas(limite = 50) {
  const { data, error } = await supabase
    .from('corridas')
    .select(
      'id, tipo, generado_por, fecha, detalle_bancos, registros_con_error, finalizado, finalizado_en, ' +
        'subido_produbanco_at, subido_produbanco_por, subido_pichincha_at, subido_pichincha_por, subido_guayaquil_at, subido_guayaquil_por, ' +
        'profiles(nombre), corrida_anulaciones(nota, creado_en)'
    )
    .order('fecha', { ascending: false })
    .limit(limite);

  if (error) {
    console.error('Error leyendo el historial:', error.message);
    return [];
  }
  return data.map((c) => {
    const anulacion = Array.isArray(c.corrida_anulaciones) ? c.corrida_anulaciones[0] : c.corrida_anulaciones;
    const subidoBanco = {};
    for (const [banco, cols] of Object.entries(COLUMNAS_SUBIDO)) {
      subidoBanco[banco] = c[cols.at] ? { at: c[cols.at], por: c[cols.por] } : null;
    }
    return {
      ...c,
      generadoPorNombre: c.profiles?.nombre || 'Desconocido',
      anulada: !!anulacion,
      notaAnulacion: anulacion?.nota || null,
      subidoBanco,
    };
  });
}

export async function registrarCorrida({ tipo, detalleBancos, registrosConError = 0 }) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('No hay sesión activa');

  const { data, error } = await supabase
    .from('corridas')
    .insert({
      tipo,
      generado_por: user.id,
      detalle_bancos: detalleBancos,
      registros_con_error: registrosConError,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function finalizarCorrida(corridaId) {
  const { error } = await supabase
    .from('corridas')
    .update({ finalizado: true, finalizado_en: new Date().toISOString() })
    .eq('id', corridaId);

  if (error) throw error;
}

export async function registrarArchivosCorrida(corridaId, filasPorBanco, ctx) {
  const { error } = await supabase
    .from('corrida_archivos')
    .insert({ corrida_id: corridaId, filas_por_banco: filasPorBanco, ctx });

  if (error) throw error;
}

export async function getArchivosCorrida(corridaId) {
  const { data, error } = await supabase
    .from('corrida_archivos')
    .select('filas_por_banco, ctx')
    .eq('corrida_id', corridaId)
    .single();

  if (error) {
    console.error('Error leyendo los archivos de la corrida:', error.message);
    return null;
  }
  return data;
}

/**
 * Anula una corrida — solo funciona si quien llama es Admin (lo hace
 * cumplir la política de la tabla, no este código). Requiere una nota
 * explicando por qué, para que quede registro.
 */
export async function anularCorrida(corridaId, nota) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('No hay sesión activa');
  if (!nota || !nota.trim()) throw new Error('Escribe una nota explicando por qué se anula.');

  const { error } = await supabase
    .from('corrida_anulaciones')
    .insert({ corrida_id: corridaId, anulado_por: user.id, nota: nota.trim() });

  if (error) throw error;
}

/**
 * Marca que los archivos de un banco específico de esta corrida ya se
 * subieron al portal de cash management de ese banco. Solo debería poder
 * llamarlo un Admin (lo hace cumplir la política de la tabla sobre
 * `corridas`, igual que las demás operaciones de este archivo).
 *
 * @param {string} corridaId
 * @param {'produbanco'|'pichincha'|'guayaquil'} banco
 * @param {string} nombreQuienConfirma - nombre a mostrar (ej. perfil.nombre del Admin que confirma)
 */
export async function marcarSubidoBanco(corridaId, banco, nombreQuienConfirma) {
  const cols = COLUMNAS_SUBIDO[banco];
  if (!cols) throw new Error(`Banco "${banco}" no reconocido.`);

  const { error } = await supabase
    .from('corridas')
    .update({
      [cols.at]: new Date().toISOString(),
      [cols.por]: nombreQuienConfirma,
    })
    .eq('id', corridaId);

  if (error) throw error;
}