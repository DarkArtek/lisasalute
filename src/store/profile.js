import { ref, watchEffect } from 'vue'
import { supabase } from '../supabase'
import { userSession } from './auth.js'

/**
 * Gestisce lo stato del profilo medico dell'utente.
 */

export const profile = ref(null)
export const loading = ref(false)
export const error = ref(null)

/**
 * Carica il profilo dell'utente loggato dalla tabella 'profiles'.
 */
export async function fetchProfile() {
  if (!userSession.value) {
    profile.value = null;
    return;
  }

  const userId = userSession.value.user.id;

  try {
    loading.value = true
    error.value = null

    // 1. Chiediamo a Supabase il profilo
    const { data, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 = "nessuna riga trovata", non è un errore bloccante
      throw fetchError
    }

    if (data) {
      // 2. Profilo trovato, lo salviamo nello store
      profile.value = data
    } else {
      // 3. Nessun profilo trovato (es. primo login)
      // Inizializziamo un profilo vuoto con i valori di default
      profile.value = {
        id: userId,
        nome: '',
        sesso: 'Altro',
        data_di_nascita: null,
        tipo_misuratore: 'automatico',
        farmaci_pressione: false,
        farmaci_cuore: false,
        anticoagulanti: false,
        // Campi di memoria e terapia
        piano_terapeutico: '',
        terapia_farmacologica: '',
        // Campi Scheduler (default attivi)
        orario_mattina: '08:00',
        orario_pomeriggio: '14:00',
        orario_sera: '20:00',
        abilita_scheduler: true
      }
    }

  } catch (err) {
    console.error('Errore profilo:', err.message)
    error.value = err.message
  } finally {
    loading.value = false
  }
}

/**
 * Aggiorna (o crea) il profilo dell'utente loggato.
 */
export async function updateProfile(profileData) {
  if (!userSession.value) return;

  const updateData = {
    ...profileData,
    id: userSession.value.user.id, // Forza l'ID dell'utente loggato
    updated_at: new Date()
  };

  try {
    loading.value = true
    error.value = null

    const { error: upsertError } = await supabase
      .from('profiles')
      .upsert(updateData)

    if (upsertError) throw upsertError

    // Aggiorniamo lo stato locale con i dati salvati
    profile.value = updateData

  } catch (err) {
    console.error('Errore salvataggio profilo:', err.message)
    error.value = err.message
    throw err
  } finally {
    loading.value = false
  }
}

// Watcher: Se l'utente cambia (login/logout), ricarica il profilo.
watchEffect(() => {
  fetchProfile();
});
