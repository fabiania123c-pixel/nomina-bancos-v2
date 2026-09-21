import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient.js';

export function useAuth() {
  const [perfil, setPerfil] = useState(null);
  const [loading, setLoading] = useState(true);

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

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
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
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function logout() {
    await supabase.auth.signOut();
  }

  return { perfil, loading, login, logout };
}