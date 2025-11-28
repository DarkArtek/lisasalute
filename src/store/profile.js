import { ref, watchEffect } from 'vue'
import { supabase } from '../supabase'
import { userSession } from './auth.js'

export const profile = ref(null)
export const medications = ref([]) // <--- NUOVO: Lista farmaci utente
export const loading = ref(false)
export const error = ref(null)

export async function fetchProfile() {
  if (!userSession.value) {
    profile.value = null;
    medications.value = []; // Reset farmaci
    return;
  }

  const userId = userSession.value.user.id;

  try {
    loading.value = true
    error.value = null

    // 1. Carica Profilo
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
        terapia_farmacologica: '', // Questo diventerà legacy, sostituito da medications
        modalita_soccorritore: false,
        orario_mattina: '08:00',
        orario_pomeriggio: '14:00',
        orario_sera: '20:00',
        abilita_scheduler: true,
        is_admin: false
      }
    }

    // 2. Carica Farmaci (NUOVO)
    await fetchMedications();

  } catch (err) {
    console.error('Errore profilo:', err.message)
    error.value = err.message
  } finally {
    loading.value = false
  }
}

export async function fetchMedications() {
  if (!userSession.value) return;
  const userId = userSession.value.user.id;

  try {
    const { data, error: fetchError } = await supabase
      .from('medications')
      .select('*') // Prende tutto dalla tabella medications
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (fetchError) throw fetchError;
    medications.value = data || [];

    // Aggiorniamo anche il campo testuale legacy per compatibilità con i prompt vecchi
    updateLegacyTherapyString();

  } catch (err) {
    console.error('Errore caricamento farmaci:', err);
  }
}

export async function addMedication(medData) {
  if (!userSession.value) return;
  const userId = userSession.value.user.id;

  try {
    loading.value = true;

    const newMed = {
      user_id: userId,
      ...medData
    };

    const { data, error: insertError } = await supabase
      .from('medications')
      .insert(newMed)
      .select()
      .single();

    if (insertError) throw insertError;

    // Aggiorna lista locale
    medications.value.unshift(data);
    updateLegacyTherapyString();

  } catch (err) {
    console.error('Errore aggiunta farmaco:', err);
    error.value = err.message;
    throw err;
  } finally {
    loading.value = false;
  }
}

export async function removeMedication(id) {
  try {
    const { error: delError } = await supabase
      .from('medications')
      .delete()
      .eq('id', id);

    if (delError) throw delError;

    // Rimuovi localmente
    medications.value = medications.value.filter(m => m.id !== id);
    updateLegacyTherapyString();

  } catch (err) {
    console.error('Errore rimozione farmaco:', err);
    error.value = err.message;
  }
}

export async function updateProfile(profileData) {
  if (!userSession.value) return;

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

// Funzione Helper per mantenere retrocompatibilità con i prompt attuali
// Converte la lista strutturata in una stringa leggibile per Gemini
function updateLegacyTherapyString() {
  if (!profile.value) return;

  const therapyString = medications.value.map(m => {
    let line = `- ${m.nome_farmaco} (${m.dosaggio})`;
    if (m.frequenza) line += `: ${m.frequenza}`;
    if (m.note) line += `. Note: ${m.note}`;
    return line;
  }).join('\n');

  // Aggiorniamo solo localmente per i prompt, opzionalmente potremmo salvare su DB
  profile.value.terapia_farmacologica = therapyString;
}

watchEffect(() => {
  fetchProfile();
});
