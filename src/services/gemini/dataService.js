/* dataService.js - Gestione estrazione dati e memoria */
import { model } from './client';
import { supabase } from '../../supabase';
import { DATA_EXTRACTION_PROMPT } from '../../prompts';

// Funzione principale di estrazione
export async function callGeminiForExtraction(userMessage) {
  try {
    const extractionPayload = {
      contents: [{ role: 'user', parts: [{ text: userMessage }] }],
      systemInstruction: {
        parts: [{
          text: `
          ${DATA_EXTRACTION_PROMPT}

          AGGIUNTA MEMORIA:
          Se nel testo l'utente menziona preferenze personali, abitudini o dettagli medici permanenti che dovresti ricordare per il futuro (es. "Uso il braccio destro", "Il mio medico è il Dr. House", "Odio le pastiglie grandi", "Uso il fonendoscopio Littmann"), estrai questo testo nel campo JSON "nuova_memoria".
          Se non c'è nulla da ricordare a lungo termine, lascia il campo vuoto o null.

          Esempio Output: { "pressione_sistolica": 120, "nuova_memoria": "Preferisce misurare sul braccio destro" }
          `
        }]
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

// Salva i parametri vitali (logica esistente)
export async function saveExtractedVitals(userId, data) {
  if (!data || (!data.pressione_sistolica && !data.frequenza_cardiaca && !data.saturazione)) {
    return null;
  }

  const { error, data: savedData } = await supabase
    .from('vital_signs')
    .insert({
      user_id: userId,
      pressione_sistolica: data.pressione_sistolica,
      pressione_diastolica: data.pressione_diastolica,
      frequenza_cardiaca: data.frequenza_cardiaca,
      saturazione: data.saturazione,
      metodo_misurazione: 'automatico',
      commento_lisa: "Analisi in corso..."
    })
    .select()
    .single();

  if (error) throw error;
  return savedData;
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

// --- NUOVA FUNZIONE MEMORIA A LUNGO TERMINE ---
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

    // 2. Aggiungi nuova nota con data
    const date = new Date().toLocaleDateString('it-IT');
    // Aggiungiamo solo se non è già presente una nota simile (controllo base)
    if (!currentMemory.includes(newMemoryText)) {
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
