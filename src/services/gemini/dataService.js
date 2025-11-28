/* dataService.js - Gestione Dati e DB */
import { supabase } from '../../supabase'
import { genAI } from './client'
import { DATA_EXTRACTION_PROMPT } from '../../prompts'
import { profile } from '../../store/profile'

const modelName = 'gemini-2.5-pro'

// Estrae i dati JSON dal messaggio utente
export async function callGeminiForExtraction(userMessage) {
  if (!userMessage.trim()) return {};

  const todayContext = `OGGI È: ${new Date().toISOString()}`;
  const promptWithDate = `${DATA_EXTRACTION_PROMPT}\n\n${todayContext}`;

  const extractionModel = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: { parts: [{ text: promptWithDate }] }
  })

  try {
    const result = await extractionModel.generateContent(userMessage)
    const text = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
    return text ? JSON.parse(text) : {};
  } catch (error) {
    console.error("Errore estrazione dati:", error);
    return {};
  }
}

// Salva i parametri vitali nel DB
export async function saveExtractedVitals(userId, data) {
  if (!data || Object.keys(data).length === 0) return null;
  if (!userId) return null;

  const createdAt = data.data_riferimento || new Date().toISOString();

  // Logica aggiornamento Braccio
  const isOnlyBraccio = data.braccio && !data.pressione_sistolica && !data.frequenza_cardiaca;
  if (isOnlyBraccio) {
    const refDate = new Date(createdAt);
    const timeWindow = new Date(refDate.getTime() - 5 * 60 * 1000).toISOString();

    const { data: lastRecord } = await supabase
      .from('vital_signs')
      .select('id')
      .eq('user_id', userId)
      .is('braccio', null)
      .gte('created_at', timeWindow)
      .lte('created_at', createdAt)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (lastRecord) {
      const { data: updatedData } = await supabase
        .from('vital_signs')
        .update({ braccio: data.braccio })
        .eq('id', lastRecord.id)
        .select()
        .single();
      return updatedData;
    }
  }

  const vitalData = {
    user_id: userId,
    created_at: createdAt,
    pressione_sistolica: data.pressione_sistolica || null,
    pressione_diastolica: data.pressione_diastolica || null,
    frequenza_cardiaca: data.frequenza_cardiaca || null,
    saturazione_ossigeno: data.saturazione_ossigeno || null,
    braccio: data.braccio || null,
  };

  const { data: savedData, error } = await supabase
    .from('vital_signs')
    .insert(vitalData)
    .select()
    .single();

  if (error) {
    console.error("Errore salvataggio vitals:", error);
    return null;
  }
  return savedData;
}

// Aggiorna la memoria a lungo termine
export async function updateLongTermMemory(userId, newMemory) {
  if (!userId) return;
  const currentNotes = profile.value?.piano_terapeutico || '';
  const today = new Date().toLocaleDateString();
  const updatedNotes = `${currentNotes}\n- [${today}] ${newMemory}`.trim();

  await supabase
    .from('profiles')
    .update({ piano_terapeutico: updatedNotes })
    .eq('id', userId);
}

// Conta le misurazioni odierne
export async function getTodaysMeasurementCount(userId) {
  if (!userId) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { count } = await supabase
    .from('vital_signs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', today.toISOString())
    .not('pressione_sistolica', 'is', null);

  return count || 0;
}

// --- NUOVA FUNZIONE: Calcolo Medie Settimanali ---
export async function getWeeklyStats(userId) {
  if (!userId) return null;

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const { data, error } = await supabase
    .from('vital_signs')
    .select('pressione_sistolica, pressione_diastolica')
    .eq('user_id', userId)
    .gte('created_at', oneWeekAgo.toISOString())
    .not('pressione_sistolica', 'is', null);

  if (error || !data || data.length === 0) return null;

  const total = data.reduce((acc, curr) => {
    acc.sys += curr.pressione_sistolica;
    acc.dia += curr.pressione_diastolica;
    return acc;
  }, { sys: 0, dia: 0 });

  const avgSys = Math.round(total.sys / data.length);
  const avgDia = Math.round(total.dia / data.length);

  return {
    avgSys,
    avgDia,
    count: data.length,
    status: getBloodPressureStatus(avgSys, avgDia)
  };
}

// Helper per classificare lo stato
function getBloodPressureStatus(sys, dia) {
  if (sys < 120 && dia < 80) return 'Ottimale';
  if (sys < 130 && dia < 85) return 'Normale';
  if (sys < 140 && dia < 90) return 'Normale-Alta';
  if (sys >= 140 || dia >= 90) return 'Ipertensione (Possibile non controllata)';
  return 'Indefinito';
}
