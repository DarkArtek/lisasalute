/* ecgService.js - Logica ECG (Analisi + Upload) */
import { supabase } from '../../supabase'
import { genAI } from './client'
import { ECG_ANALYSIS_JSON_PROMPT } from '../../prompts'
import { saveExtractedVitals } from './dataService'

const modelName = 'gemini-2.5-pro'

// Recupera l'ultimo ECG per il confronto storico
export async function getLastEcgAnalysis(userId) {
  if (!userId) return null;
  try {
    const { data } = await supabase
      .from('vital_signs')
      .select('created_at, commento_lisa')
      .eq('user_id', userId)
      .not('ecg_storage_path', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    return data;
  } catch (e) {
    return null;
  }
}

// Chiama Gemini per analizzare l'immagine Base64
export async function callGeminiForEcgAnalysis(userMessage, imageBase64, contextString) {
  const extractionModel = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: { parts: [{ text: ECG_ANALYSIS_JSON_PROMPT }] }
  })

  const fullPrompt = `${contextString}\nRICHIESTA UTENTE: "${userMessage || "Analizza questo tracciato."}"`;

  try {
    const result = await extractionModel.generateContent([
      fullPrompt,
      { inlineData: { mimeType: "image/jpeg", data: imageBase64 } }
    ]);
    const jsonText = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();

    try {
      return JSON.parse(jsonText);
    } catch (parseError) {
      // Fallback se l'IA non risponde con JSON valido
      return { frequenza_cardiaca: null, commento: jsonText };
    }
  } catch (apiError) {
    console.error("Errore API Gemini ECG:", apiError);
    throw apiError;
  }
}

// Upload sicuro del file originale su Storage
export async function uploadEcgAndSaveVitals(userId, fileObject, extractedData) {
  if (!userId) throw new Error('Utente non loggato');

  if (!fileObject) {
    console.warn("Nessun file da caricare, salvo solo i dati.");
    return await saveExtractedVitals(userId, extractedData);
  }

  // 1. Crea record DB
  const vitalData = {
    user_id: userId,
    pressione_sistolica: extractedData.pressione_sistolica || null,
    pressione_diastolica: extractedData.pressione_diastolica || null,
    frequenza_cardiaca: extractedData.frequenza_cardiaca || null,
    saturazione_ossigeno: extractedData.saturazione_ossigeno || null,
    braccio: extractedData.braccio || null,
    commento_lisa: 'Analisi ECG in corso...'
  };

  const { data: savedRecord, error: insertError } = await supabase
    .from('vital_signs')
    .insert(vitalData)
    .select()
    .single();

  if (insertError) throw insertError;

  // 2. Upload File su Storage
  const filePath = `${userId}/ecg_${savedRecord.id}.jpg`;

  const { error: storageError } = await supabase
    .storage
    .from('ecg_uploads')
    .upload(filePath, fileObject, {
      contentType: fileObject.type || 'image/jpeg',
      upsert: true
    });

  if (!storageError) {
    // 3. Aggiorna record con path
    const { data: updatedRecord } = await supabase
      .from('vital_signs')
      .update({ ecg_storage_path: filePath })
      .eq('id', savedRecord.id)
      .select()
      .single();
    return updatedRecord;
  } else {
    console.error("Errore Upload Storage:", storageError);
    return savedRecord;
  }
}
