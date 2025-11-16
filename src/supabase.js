import { createClient } from '@supabase/supabase-js'

// ATTENZIONE: Sostituisci questi valori con le tue chiavi Supabase
// Le trovi nel pannello di controllo del tuo progetto Supabase > Settings > API
const supabaseUrl = 'https://hiazsgeaofossojnbcbs.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpYXpzZ2Vhb2Zvc3Nvam5iY2JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2OTIyMDksImV4cCI6MjA3ODI2ODIwOX0.utXB1DYXKJ1nDnS1IymziGy_xMtA4M4NXqL2hLirpkc'

if (!supabaseUrl || supabaseUrl === '') {
  console.warn('Supabase URL non impostato. Inseriscilo in /src/supabase.js');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
