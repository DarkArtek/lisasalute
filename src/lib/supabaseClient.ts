import { createClient } from '@supabase/supabase-js'

// Carico le variabili di ambiente
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("VALORI NON IMPOSTATI")
}

// Esporta il client Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
