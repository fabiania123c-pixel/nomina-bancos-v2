import { supabase } from './supabaseClient.js';

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
      'id, tipo, generado_por, fecha, detalle_bancos, registros_con_error, finalizado, finalizado_en, profiles(nombre)'
    )
    .order('fecha', { ascending: false })
    .limit(limite);

  if (error) {
    console.error('Error leyendo el historial:', error.message);
    return [];
  }
  return data.map((c) => ({ ...c, generadoPorNombre: c.profiles?.nombre || 'Desconocido' }));
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

/**
 * Guarda las filas resueltas (datos de empleados) de una corrida, para que
 * el Admin pueda volver a descargar el .txt real más tarde. Vive en una
 * tabla aparte con acceso restringido — solo el Admin o quien generó la
 * corrida puede leerlas después.
 */
export async function registrarArchivosCorrida(corridaId, filasPorBanco, ctx) {
  const { error } = await supabase
    .from('corrida_archivos')
    .insert({ corrida_id: corridaId, filas_por_banco: filasPorBanco, ctx });

  if (error) throw error;
}

/**
 * Trae las filas guardadas de una corrida (para que el Admin regenere y
 * descargue el .txt real).
 */
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