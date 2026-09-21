import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Falla rápido y claro en vez de un error críptico más adelante —
  // normalmente significa que falta copiar .env.example como .env y
  // llenar los valores reales.
  console.error(
    'Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. Copia .env.example como .env y llénalo.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
