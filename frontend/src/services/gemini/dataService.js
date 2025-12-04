/* dataService.js - Gestione estrazione dati e memoria */
import { model } from './client.js';
import { supabase } from '../../supabase.js';
// IMPORT CORRETTO: Puntiamo direttamente al file rinominato dataExtraction.js
import { EXTRACTION_PROMPT } from '../../prompts/dataExtraction.js';

// Funzione principale di estrazione
export async function callGeminiForExtraction(userMessage) {
  try {
    const extractionPayload = {
      contents: [{ role: 'user', parts: [{ text: userMessage }] }],
      systemInstruction: {
        parts: [{ text: EXTRACTION_PROMPT }]
      },
      generationConfig: { responseMimeType: "application/json" }
    };

    const result = await model.generateContent(extractionPayload);
    const text = result.response.text();
    return JSON.parse(text);

  } catch (error) {
    console.error("Errore estrazione JSON:", error);
    return {};
  }
}

// Salva i parametri vitali (ALLINEATO ALLO SCHEMA DB)
export async function saveExtractedVitals(userId, data) {
  // Se non c'è nessun dato vitale, usciamo (evitiamo di salvare righe vuote o solo memoria)
  if (!data || (!data.pressione_sistolica && !data.frequenza_cardiaca && !data.saturazione_ossigeno)) {
    return null;
  }

  // Gestione della data: se l'utente ha detto "ieri", usiamo quella, altrimenti ADESSO.
  const dataMisurazione = data.data_riferimento ? new Date(data.data_riferimento) : new Date();

  const { error, data: savedData } = await supabase
    .from('vital_signs')
    .insert({
      user_id: userId,
      created_at: dataMisurazione.toISOString(), // Fondamentale per il diario
      pressione_sistolica: data.pressione_sistolica,
      pressione_diastolica: data.pressione_diastolica,
      frequenza_cardiaca: data.frequenza_cardiaca,
      saturazione_ossigeno: data.saturazione_ossigeno,
      braccio: data.braccio,
      metodo_misurazione: 'manuale', // Default Sfigmomanometro
      commento_lisa: "Analisi in corso..." // Placeholder momentaneo
    })
    .select()
    .single();

  if (error) {
    console.error("Errore Supabase:", error);
    throw error;
  }
  return savedData;
}

// --- NUOVA FUNZIONE: Aggiorna il commento DOPO che Lisa ha risposto ---
export async function updateVitalSignComment(recordId, commentText) {
  if (!recordId || !commentText) return;

  const { error } = await supabase
    .from('vital_signs')
    .update({ commento_lisa: commentText })
    .eq('id', recordId);

  if (error) {
    console.error("Errore aggiornamento commento Lisa:", error);
  } else {
    // console.log("Commento Lisa aggiornato nel DB per record:", recordId);
  }
}

// Funzione per contare misurazioni odierne (per contextService)
export async function getTodaysMeasurementCount(userId) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { count } = await supabase
    .from('vital_signs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', startOfDay.toISOString());

  return count || 0;
}

// Funzione per statistiche settimanali
export async function getWeeklyStats(userId) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data } = await supabase
    .from('vital_signs')
    .select('pressione_sistolica, pressione_diastolica')
    .eq('user_id', userId)
    .gte('created_at', sevenDaysAgo.toISOString())
    .not('pressione_sistolica', 'is', null);

  if (!data || data.length === 0) return null;

  const avgSys = Math.round(data.reduce((acc, cur) => acc + cur.pressione_sistolica, 0) / data.length);
  const avgDia = Math.round(data.reduce((acc, cur) => acc + cur.pressione_diastolica, 0) / data.length);

  let status = 'Normale';
  if (avgSys >= 135 || avgDia >= 85) status = 'Normale-Alta';
  if (avgSys >= 140 || avgDia >= 90) status = 'Ipertensione (Possibile non controllata)';
  if (avgSys < 120 && avgDia < 80) status = 'Ottimale';

  return { avgSys, avgDia, status, count: data.length };
}

// --- FUNZIONE MEMORIA A LUNGO TERMINE ---
export async function updateLongTermMemory(userId, newMemoryText) {
  if (!newMemoryText) return;

  try {
    // 1. Recupera memoria attuale
    const { data: profile } = await supabase
      .from('profiles')
      .select('lisa_memory')
      .eq('id', userId)
      .single();

    let currentMemory = profile?.lisa_memory || "";

    // 2. Aggiungi nuova nota con data se non è già presente
    if (!currentMemory.includes(newMemoryText)) {
      const date = new Date().toLocaleDateString('it-IT');
      const updatedMemory = currentMemory
        ? `${currentMemory}\n[${date}] ${newMemoryText}`
        : `[${date}] ${newMemoryText}`;

      // 3. Salva
      await supabase
        .from('profiles')
        .update({ lisa_memory: updatedMemory })
        .eq('id', userId);

      console.log("Memoria a lungo termine aggiornata:", newMemoryText);
    }

  } catch (err) {
    console.error("Errore salvataggio memoria:", err);
  }
}
