import { ref, watchEffect } from 'vue'
import { supabase } from '../supabase'
import { userSession } from './auth.js'

export const profile = ref(null)
export const loading = ref(false)
export const error = ref(null)

export async function fetchProfile() {
  if (!userSession.value) {
    profile.value = null;
    return;
  }

  const userId = userSession.value.user.id;

  try {
    loading.value = true
    error.value = null

    const { data, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw fetchError
    }

    if (data) {
      profile.value = data
    } else {
      profile.value = {
        id: userId,
        nome: '',
        sesso: 'Altro',
        data_di_nascita: null,
        tipo_misuratore: 'automatico',
        farmaci_pressione: false,
        farmaci_cuore: false,
        anticoagulanti: false,
        piano_terapeutico: '',
        terapia_farmacologica: '',
        modalita_soccorritore: false,
        orario_mattina: '08:00',
        orario_pomeriggio: '14:00',
        orario_sera: '20:00',
        abilita_scheduler: true,
        // --- NUOVO CAMPO ---
        is_admin: false
        // -------------------
      }
    }

  } catch (err) {
    console.error('Errore profilo:', err.message)
    error.value = err.message
  } finally {
    loading.value = false
  }
}

export async function updateProfile(profileData) {
  if (!userSession.value) return;

  // Nota: non permettiamo di aggiornare 'is_admin' da qui per sicurezza,
  // quello si cambia solo da DB.
  const updateData = {
    ...profileData,
    id: userSession.value.user.id,
    updated_at: new Date()
  };

  try {
    loading.value = true
    error.value = null

    const { error: upsertError } = await supabase
      .from('profiles')
      .upsert(updateData)

    if (upsertError) throw upsertError

    profile.value = updateData

  } catch (err) {
    console.error('Errore salvataggio profilo:', err.message)
    error.value = err.message
    throw err
  } finally {
    loading.value = false
  }
}

watchEffect(() => {
  fetchProfile();
});
