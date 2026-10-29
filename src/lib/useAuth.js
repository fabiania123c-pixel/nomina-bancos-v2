import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient.js';

// Cuando alguien abre el enlace del correo de "cambiar contraseña", Supabase lo manda a esta página con datos en la
// URL (#...type=recovery) o con un error si el enlace ya venció (#error_code=otp_expired). Se lee UNA vez al cargar el
// módulo, antes de que Supabase limpie la URL.
const URL_AL_ABRIR = typeof window !== 'undefined' ? `${window.location.hash}${window.location.search}` : '';
const ABRIO_DESDE_CORREO = /[#&?]type=recovery\b/.test(URL_AL_ABRIR);
const ENLACE_VENCIDO = /error_code=otp_expired|error=access_denied/.test(URL_AL_ABRIR);

export function useAuth() {
  const [perfil, setPerfil] = useState(null);
  const [loading, setLoading] = useState(true);
  // true mientras la persona está poniendo su contraseña nueva (llegó desde el correo).
  const [recuperando, setRecuperando] = useState(ABRIO_DESDE_CORREO);
  const [avisoEnlace, setAvisoEnlace] = useState(
    ENLACE_VENCIDO ? 'El enlace del correo venció o ya se usó. Pide uno nuevo con «¿Olvidaste tu contraseña?».' : ''
  );

  async function cargarPerfil(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, nombre, rol')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error cargando el perfil:', error.message);
      setPerfil(null);
    } else {
      setPerfil(data);
    }
    setLoading(false);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        cargarPerfil(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      // Supabase avisa con este evento cuando la persona entra desde el enlace del correo.
      if (event === 'PASSWORD_RECOVERY') setRecuperando(true);
      if (session?.user) {
        setLoading(true);
        cargarPerfil(session.user.id);
      } else {
        setPerfil(null);
        setLoading(false);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function login(email, password) {
    setAvisoEnlace('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function logout() {
    await supabase.auth.signOut();
  }

  // "Olvidé mi contraseña": Supabase le manda el correo con el link a la persona.
  async function solicitarCambioPassword(email) {
    setAvisoEnlace('');
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
    if (error) throw error;
  }

  // La persona ya entró con un enlace de recuperación (el Admin puede mandarlo desde Supabase): aquí guarda la nueva contraseña.
  async function cambiarPassword(nueva) {
    const { error } = await supabase.auth.updateUser({ password: nueva });
    if (error) throw error;
    window.history.replaceState(null, '', window.location.pathname);
    setRecuperando(false);
  }

  // Si abrió el enlace pero no quiere cambiarla: se cierra esa sesión temporal y vuelve al login.
  async function cancelarRecuperacion() {
    window.history.replaceState(null, '', window.location.pathname);
    setRecuperando(false);
    await supabase.auth.signOut();
  }

  return { perfil, loading, recuperando, avisoEnlace, login, logout, solicitarCambioPassword, cambiarPassword, cancelarRecuperacion };
}