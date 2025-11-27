/* dataService.js - Gestione Dati e DB */
import { supabase } from '../../supabase'
import { genAI } from './client'
import { DATA_EXTRACTION_PROMPT } from '../../prompts'
import { profile } from '../../store/profile'

const modelName = 'gemini-2.5-pro'

// Estrae i dati JSON dal messaggio utente
export async function callGeminiForExtraction(userMessage) {
  if (!userMessage.trim()) return {};

  // Aggiungiamo la data di oggi al prompt per dare un riferimento temporale all'IA
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

  // Determina la data di creazione: quella estratta o adesso
  const createdAt = data.data_riferimento || new Date().toISOString();

  // Logica aggiornamento Braccio (se specificato da solo)
  const isOnlyBraccio = data.braccio && !data.pressione_sistolica && !data.frequenza_cardiaca;
  if (isOnlyBraccio) {
    // Cerchiamo l'ultimo record vicino alla data di riferimento (o ora)
    const refDate = new Date(createdAt);
    const timeWindow = new Date(refDate.getTime() - 5 * 60 * 1000).toISOString(); // -5 min

    const { data: lastRecord } = await supabase
      .from('vital_signs')
      .select('id')
      .eq('user_id', userId)
      .is('braccio', null)
      .gte('created_at', timeWindow)
      .lte('created_at', createdAt) // Non nel futuro rispetto alla data indicata
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
    created_at: createdAt, // <-- USA LA DATA ESTRATTA
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

// Conta le misurazioni odierne (usando la data reale di oggi, non quella storica)
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
