import { ref, watchEffect } from 'vue'
import { supabase } from '../supabase'
import { userSession } from './auth.js' // Importiamo la sessione utente

/**
 * Gestisce lo stato del profilo medico dell'utente.
 */

// 'null' finché non è caricato. Conterrà { nome, sesso, ... }
export const profile = ref(null)
export const loading = ref(false) // Flag per il caricamento
export const error = ref(null)   // Flag per errori

/**
 * Carica il profilo dell'utente loggato dalla tabella 'profiles'.
 */
export async function fetchProfile() {
    if (!userSession.value) {
        console.log('FetchProfile: Utente non loggato, stop.');
        profile.value = null;
        return;
    }

    const userId = userSession.value.user.id;
    console.log('FetchProfile: Caricamento profilo per utente', userId);

    try {
        loading.value = true
        error.value = null

        // 1. Chiediamo a Supabase il profilo
        const { data, error: fetchError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single() // Ci aspettiamo solo un risultato

        if (fetchError && fetchError.code !== 'PGRST116') {
            // PGRST116 = "nessuna riga trovata", non è un errore bloccante
            throw fetchError
        }

        if (data) {
            // 2. Profilo trovato, lo salviamo nello store
            console.log('FetchProfile: Profilo trovato', data);
            profile.value = data
        } else {
            // 3. Nessun profilo trovato (es. primo login)
            // Inizializziamo un profilo vuoto nello store
            console.log('FetchProfile: Profilo non trovato, inizializzo.');
            profile.value = {
                id: userId,
                nome: '',
                sesso: 'Altro',
                data_di_nascita: null,
                tipo_misuratore: 'automatico',
                farmaci_pressione: false,
                farmaci_cuore: false,
                anticoagulanti: false
            }
        }

    } catch (err) {
        console.error('Errore nel caricamento del profilo:', err.message)
        error.value = err.message
    } finally {
        loading.value = false
    }
}

/**
 * Aggiorna (o crea) il profilo dell'utente loggato.
 * Usa 'upsert' per creare se non esiste o aggiornare se esiste.
 * @param {object} profileData - I dati da salvare.
 */
export async function updateProfile(profileData) {
    if (!userSession.value) {
        console.error('UpdateProfile: Utente non loggato.');
        return;
    }

    // Assicuriamoci che l'ID sia corretto
    const updateData = {
        ...profileData,
        id: userSession.value.user.id, // Forza l'ID dell'utente loggato
        updated_at: new Date()
    };

    console.log('UpdateProfile: Salvataggio dati...', updateData);

    try {
        loading.value = true
        error.value = null

        const { error: upsertError } = await supabase
            .from('profiles')
            .upsert(updateData)

        if (upsertError) throw upsertError

        // Aggiorniamo lo stato locale con i dati salvati
        profile.value = updateData
        console.log('UpdateProfile: Salvataggio completato.');

    } catch (err) {
        console.error('Errore nel salvataggio del profilo:', err.message)
        error.value = err.message
        throw err // Rilanciamo l'errore per gestirlo nel componente
    } finally {
        loading.value = false
    }
}

// Watcher: Se l'utente cambia (login/logout), ricarica il profilo.
watchEffect(() => {
    fetchProfile();
});