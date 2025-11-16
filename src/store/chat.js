import { ref, watchEffect, nextTick } from 'vue'
import { supabase } from '../supabase'
import { userSession } from './auth.js'
import { profile } from './profile.js' // Importiamo il profilo per il nome

/**
 * Gestisce lo stato della cronologia chat
 */

export const messages = ref([])
export const loading = ref(false)
export const error = ref(null)

/**
 * Carica la cronologia messaggi per l'utente loggato
 */
export async function fetchMessages() {
  if (!userSession.value) {
    console.log('FetchMessages: Utente non loggato, stop.');
    messages.value = []
    return
  }
  const userId = userSession.value.user.id
  console.log('FetchMessages: Caricamento messaggi per', userId)

  try {
    loading.value = true
    error.value = null // Resetta l'errore

    const { data, error: fetchError } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true }) // Ordina dal più vecchio al più nuovo

    if (fetchError) throw fetchError

    messages.value = data || []
    console.log(`FetchMessages: Caricati ${messages.value.length} messaggi.`);

    // Assicura che la UI scorra alla fine dopo il caricamento
    scrollToBottom();

  } catch (err) {
    console.error('Errore caricamento messaggi:', err.message)
    error.value = err.message // Assegna l'errore
  } finally {
    loading.value = false
  }
}

/**
 * Aggiunge un nuovo messaggio al DB e allo store locale
 * @param {'user' | 'assistant'} role
 * @param {string} content
 */
export async function addMessage(role, content) {
  if (!userSession.value) {
    console.error('AddMessage: Utente non loggato.');
    return;
  }

  //
  // --- BUG FIX (riga 62) ---
  // Dobbiamo controllare se 'content' esiste PRIMA di chiamare .trim()
  //
  if (!content || !content.trim()) {
    console.warn('AddMessage: Contenuto vuoto o undefined, stop.');
    return; // Non salvare messaggi vuoti
  }
  // --- FINE FIX ---

  const userId = userSession.value.user.id

  const newMessage = {
    user_id: userId,
    role: role,
    content: content // Ora sappiamo che 'content' è una stringa valida
  }

  try {
    // 1. Salva nel DB
    const { data, error: insertError } = await supabase
      .from('chat_messages')
      .insert(newMessage)
      .select() // Restituisce il record appena creato
      .single()

    if (insertError) throw insertError

    // 2. Aggiunge allo store locale (con l'ID e il created_at)
    messages.value.push(data)
    console.log('AddMessage: Messaggio salvato', data.role);

    // Assicura che la UI scorra alla fine
    scrollToBottom();

    // Restituisce il messaggio salvato (utile per la logica IA)
    return data

  } catch (err) {
    console.error('Errore salvataggio messaggio:', err.message)
    error.value = `Errore invio: ${err.message}` // Assegna l'errore
  }
}

/**
 * Funzione helper per scrollare la chat in fondo
 */
export async function scrollToBottom() {
  // Aspetta il prossimo "tick" del DOM, così Vue ha tempo di renderizzare
  await nextTick()
  // Seleziona il contenitore della chat (definito in ChatPage.vue)
  const container = document.getElementById('chat-container')
  if (container) {
    container.scrollTop = container.scrollHeight
  }
}

// Watcher: Carica i messaggi quando l'utente fa login
watchEffect(() => {
  if (userSession.value) {
    fetchMessages()
  } else {
    // Se l'utente fa logout, pulisce la chat
    messages.value = []
  }
})

/**
 * Pulisce la cronologia chat
 */
export async function clearChatHistory() {
  if (!userSession.value) {
    console.error('ClearChat: Utente non loggato.');
    return;
  }

  const userId = userSession.value.user.id;
  console.log('ClearChat: Avvio pulizia chat per', userId);

  try {
    // 1. Pulisce il DB
    const { error: deleteError } = await supabase
      .from('chat_messages')
      .delete()
      .eq('user_id', userId);

    if (deleteError) throw deleteError;

    // 2. Pulisce lo store locale
    messages.value = [];
    console.log('ClearChat: Pulizia completata.');

  } catch (err) {
    console.error('Errore pulizia chat:', err.message);
    error.value = `Errore pulizia: ${err.message}`;
  }
}


//
// --- NUOVA LOGICA REMINDER (SPOSTATA QUI) ---
//
/**
 * Imposta un reminder IN-CHAT dopo N minuti.
 * @param {number} minutes - Minuti di attesa.
 */
export function setReminder(minutes) {
  const nomeUtente = profile.value?.nome || 'Paziente'; // Prende il nome
  const delay = minutes * 60 * 1000; // Converti minuti in millisecondi

  console.log(`Timer IN-CHAT impostato: reminder tra ${minutes} minuti.`);

  setTimeout(() => {
    // --- MODIFICATO ---
    const messaggio = `Ciao ${nomeUtente}! Sono passati ${minutes} minuti. È il momento di effettuare la seconda misurazione della pressione come abbiamo discusso.`;

    console.log('Reminder: Invio messaggio in chat...');
    addMessage('assistant', messaggio);

  }, delay);
}
