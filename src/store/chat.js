import { ref, watchEffect, nextTick } from 'vue'
import { supabase } from '../supabase'
import { userSession } from './auth.js'
import { profile } from './profile.js'

// --- IMPORT PER L'INTELLIGENZA ARTIFICIALE (GEMINI) ---
import { model } from '../services/gemini/client';
import { buildSystemInstruction, buildChatHistory } from '../services/gemini/contextService';
import {
  callGeminiForExtraction,
  saveExtractedVitals,
  getTodaysMeasurementCount,
  getWeeklyStats,
  updateLongTermMemory
} from '../services/gemini/dataService';

// Importiamo i prompt per le due personalità
import { NURSE_ANALYSIS_PROMPT, SUEM_ASSISTANT_PROMPT } from '../prompts';

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
    messages.value = []
    return
  }
  const userId = userSession.value.user.id
  // console.log('FetchMessages: Caricamento messaggi per', userId)

  try {
    // Non settiamo loading globale qui per evitare flicker all'avvio se c'è cache
    // loading.value = true
    error.value = null

    const { data, error: fetchError } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })

    if (fetchError) throw fetchError

    // Mappiamo i dati per aggiungere un flag visivo locale se necessario
    // (Nota: suem_mode non è salvato nel DB per ora, quindi lo storico sarà neutro)
    messages.value = data || []

    scrollToBottom();

  } catch (err) {
    console.error('Errore caricamento messaggi:', err.message)
    error.value = err.message
  } finally {
    // loading.value = false
  }
}

/**
 * Aggiunge un nuovo messaggio al DB e allo store locale
 * @param {'user' | 'assistant'} role
 * @param {string} content
 * @param {boolean} isSuem - Flag locale per stilizzare il messaggio corrente (non persistito nel DB standard)
 */
export async function addMessage(role, content, isSuem = false) {
  if (!userSession.value) return;
  if (!content || !content.trim()) return;

  const userId = userSession.value.user.id

  const newMessagePayload = {
    user_id: userId,
    role: role,
    content: content
  }

  try {
    // 1. Salva nel DB
    const { data, error: insertError } = await supabase
      .from('chat_messages')
      .insert(newMessagePayload)
      .select()
      .single()

    if (insertError) throw insertError

    // 2. Aggiunge allo store locale arricchendolo con il flag SUEM per la UI corrente
    const localMessage = { ...data, isSuem: isSuem };
    messages.value.push(localMessage)

    scrollToBottom();
    return localMessage

  } catch (err) {
    console.error('Errore salvataggio messaggio:', err.message)
    error.value = `Errore invio: ${err.message}`
  }
}

/**
 * NUOVA FUNZIONE CORE: Invia messaggio a Gemini gestendo la logica Personale vs SUEM
 * @param {string} userMessage - Il testo dell'utente
 * @param {boolean} isSuemMode - Se TRUE, attiva la Dottoressa SUEM
 */
export async function sendMessage(userMessage, isSuemMode = false) {
  if (!userMessage.trim()) return;

  // 1. Salva il messaggio dell'utente nel DB (e lo mostra a schermo)
  await addMessage('user', userMessage, isSuemMode);

  loading.value = true;
  const userId = userSession.value?.user?.id;

  try {
    let systemInstructionText = "";

    // --- RAMIFICAZIONE LOGICA: SUEM vs PERSONALE ---

    if (isSuemMode) {
      // === MODALITÀ SUEM (OPERATIVA) ===
      // Carichiamo il prompt "Collega Dottoressa" e solo contesto anagrafico base.
      // SALTANDO completamente l'estrazione dati clinici per privacy pazienti.
      systemInstructionText = buildSystemInstruction(SUEM_ASSISTANT_PROMPT, 0, null, true);

      console.log("Chat: Modalità SUEM attiva. Nessun dato salvato.");

    } else {
      // === MODALITÀ PERSONALE (MEDICO CURANTE) ===

      // A. Estrazione Dati e Memoria (Parallela per velocità)
      const [extractionResult, todaysCount, weeklyStats] = await Promise.all([
        callGeminiForExtraction(userMessage),
        userId ? getTodaysMeasurementCount(userId) : 0,
        userId ? getWeeklyStats(userId) : null
      ]);

      // B. Salvataggio Dati (Se presenti e validi per l'utente)
      if (userId && extractionResult) {
        // Salvataggio Parametri Vitali
        if (extractionResult.pressione_sistolica || extractionResult.frequenza_cardiaca || extractionResult.saturazione_ossigeno) {
          await saveExtractedVitals(userId, extractionResult);
        }
        // Aggiornamento Memoria Lungo Termine
        if (extractionResult.nuova_memoria) {
          await updateLongTermMemory(userId, extractionResult.nuova_memoria);
        }
      }

      // C. Costruzione Prompt Infermiera/MMG
      systemInstructionText = buildSystemInstruction(NURSE_ANALYSIS_PROMPT, todaysCount, weeklyStats, false);
    }

    // 2. Chiamata a Gemini
    const chatPayload = {
      contents: buildChatHistory(userMessage),
      systemInstruction: { parts: [{ text: systemInstructionText }] }
    };

    const result = await model.generateContent(chatPayload);
    const responseText = result.response.text();

    // 3. Salva la risposta dell'AI nel DB
    await addMessage('assistant', responseText, isSuemMode);

  } catch (error) {
    console.error("Errore Chat Gemini:", error);
    // Messaggio di errore locale (non salvato nel DB per non sporcarlo, o salvato se preferisci)
    messages.value.push({
      id: Date.now(),
      role: 'assistant',
      content: "Mi dispiace, ho avuto un problema di connessione col server cerebrale. Riprova tra poco.",
      isError: true
    });
  } finally {
    loading.value = false;
  }
}

/**
 * Funzione helper per scrollare la chat in fondo.
 */
export async function scrollToBottom() {
  await nextTick()
  const container = document.getElementById('chat-container')
  // Se stiamo usando ref nel componente, questo ID deve esistere nel template
  if (container) {
    container.scrollTop = container.scrollHeight;
    setTimeout(() => {
      if (container) container.scrollTop = container.scrollHeight;
    }, 100);
  }
}

/**
 * Pulisce la cronologia chat
 */
export async function clearChatHistory() {
  if (!userSession.value) return;

  const userId = userSession.value.user.id;

  try {
    const { error: deleteError } = await supabase
      .from('chat_messages')
      .delete()
      .eq('user_id', userId);

    if (deleteError) throw deleteError;

    messages.value = [];

  } catch (err) {
    console.error('Errore pulizia chat:', err.message);
    error.value = `Errore pulizia: ${err.message}`;
  }
}

// Watcher: Carica i messaggi quando l'utente fa login
watchEffect(() => {
  if (userSession.value) {
    fetchMessages()
  } else {
    messages.value = []
  }
})

// --- LOGICA REMINDER ---
export function setReminder(minutes) {
  const nomeUtente = profile.value?.nome || 'Utente';
  const delay = minutes * 60 * 1000;

  console.log(`Timer IN-CHAT impostato: reminder tra ${minutes} minuti.`);

  setTimeout(() => {
    const messaggio = `Ciao ${nomeUtente}! Sono passati ${minutes} minuti. È il momento di effettuare la seconda misurazione della pressione come abbiamo discusso.`;
    addMessage('assistant', messaggio);
  }, delay);
}
