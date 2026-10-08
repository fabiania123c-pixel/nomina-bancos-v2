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

/**
 * Empresas que el usuario puede ver/procesar. Si es Admin, todas.
 * (Se lee aparte de getPerfilActual para no tocar useAuth.)
 */
export async function getMisEmpresas() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('profiles')
    .select('rol, empresas')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('Error leyendo las empresas del usuario:', error.message);
    return [];
  }
  if (data.rol === 'admin') return ['superdeporte', 'equinox', 'medeport'];
  return Array.isArray(data.empresas) ? data.empresas : [];
}

export async function getHistorialCorridas(limite = 50) {
  const { data, error } = await supabase
    .from('corridas')
    .select(
      'id, tipo, empresa, secuencia_guayaquil, generado_por, fecha, detalle_bancos, registros_con_error, finalizado, finalizado_en, ' +
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
      empresa: c.empresa || 'superdeporte',
      generadoPorNombre: c.profiles?.nombre || 'Desconocido',
      anulada: !!anulacion,
      notaAnulacion: anulacion?.nota || null,
      subidoBanco,
    };
  });
}

/**
 * Registra y finaliza una corrida en UN solo paso (función del servidor
 * `registrar_corrida`). Asigna el consecutivo de Guayaquil de forma atómica:
 * uno por empresa y por día, sin huecos ni repetidos.
 *
 * Parámetros: tipo, empresa, detalleBancos, registrosConError, dia ('YYYY-MM-DD'),
 * filasPorBanco y ctx.
 * @returns la corrida creada (incluye secuencia_guayaquil si hubo Guayaquil)
 */
export async function registrarCorridaFinal({
  tipo,
  empresa,
  detalleBancos,
  registrosConError = 0,
  dia,
  filasPorBanco,
  ctx,
}) {
  const { data, error } = await supabase.rpc('registrar_corrida', {
    p_tipo: tipo,
    p_empresa: empresa,
    p_detalle: detalleBancos,
    p_errores: registrosConError,
    p_dia: dia,
    p_filas: filasPorBanco,
    p_ctx: ctx,
  });

  if (error) throw error;
  const corrida = Array.isArray(data) ? data[0] : data;
  if (!corrida || !corrida.id) throw new Error('El servidor no devolvió la corrida registrada.');
  return corrida;
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
 * Marca que los archivos de un banco de esta corrida ya se subieron al portal
 * de cash management. Solo Admin (lo hace cumplir la política de la tabla).
 * Verifica que de verdad se actualizó una fila: si la política bloquea el
 * UPDATE, Supabase NO da error, solo devuelve 0 filas.
 */
export async function marcarSubidoBanco(corridaId, banco, nombreQuienConfirma) {
  const cols = COLUMNAS_SUBIDO[banco];
  if (!cols) throw new Error(`Banco "${banco}" no reconocido.`);

  const { data, error } = await supabase
    .from('corridas')
    .update({
      [cols.at]: new Date().toISOString(),
      [cols.por]: nombreQuienConfirma,
    })
    .eq('id', corridaId)
    .select('id');

  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error('No se pudo guardar la confirmación (sin permiso o la corrida ya no existe).');
  }
}