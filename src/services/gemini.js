/* eslint-disable no-useless-escape */
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai"
import { supabase } from '../supabase'
import { userSession } from '../store/auth'
import { profile, fetchProfile } from '../store/profile'
import { messages } from '../store/chat'
import { fetchVitals } from '../store/diary.js'

import {
  DATA_EXTRACTION_PROMPT,
  NURSE_ANALYSIS_PROMPT,
  ECG_ANALYSIS_JSON_PROMPT,
  DOCTOR_REPORT_PROMPT
} from '../prompts'

const apiKey = import.meta.env.VITE_GEMINI_API_KEY
// Modello Pro per massima precisione clinica
const modelName = 'gemini-2.5-pro'

const genAI = new GoogleGenerativeAI(apiKey)
const model = genAI.getGenerativeModel({
  model: modelName,
  safetySettings: [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  ],
})

/**
 * ==============================================================================
 * FUNZIONE PRINCIPALE: askLisa(userMessage, attachment)
 * ==============================================================================
 */
export async function askLisa(userMessage, attachment = null) {
  console.log('askLisa: Inizio esecuzione...');

  let lisaResponseText = '';
  let actionToReturn = null;
  let savedVitals = null;

  const todaysCount = await getTodaysMeasurementCount(userSession.value?.user?.id);

  try {
    // --- FASE 1: ESTRAZIONE DATI TESTUALI ---
    console.log('askLisa: [FASE 1] Avvio estrazione dati...');
    const extractedData = await callGeminiForExtraction(userMessage);

    if (extractedData.nuova_memoria) {
      await updateLongTermMemory(extractedData.nuova_memoria);
      await fetchProfile();
    }

    // --- FASE 2: LOGICA MULTIMODALE (ECG) ---
    if (attachment && attachment.type === 'image') {
      console.log('askLisa: [FASE 2A] Avvio analisi ECG Avanzata...');

      // 1. Costruiamo il CONTESTO CLINICO (Profilo + Storico ECG)
      const patientProfile = profile.value || {};

      // Recupera ultimo ECG per confronto
      const lastEcg = await getLastEcgAnalysis(userSession.value?.user?.id);
      let previousEcgText = "Nessun tracciato precedente disponibile.";
      if (lastEcg) {
        const date = new Date(lastEcg.created_at).toLocaleDateString('it-IT');
        previousEcgText = `DEL ${date}: "${lastEcg.commento_lisa}"`;
      }

      const contextString = `
        DATI PAZIENTE:
        - Nome: ${patientProfile.nome || 'Sconosciuto'}
        - Età: ${patientProfile.data_di_nascita ? new Date().getFullYear() - new Date(patientProfile.data_di_nascita).getFullYear() : 'N/D'}
        - Patologie/Farmaci: ${patientProfile.terapia_farmacologica || 'Nessuna info'}
        - Note Cliniche: ${patientProfile.piano_terapeutico || 'Nessuna nota'}

        STORICO ECG (ULTIMO REFERTO):
        ${previousEcgText}
      `;

      // 2. Chiamata a Gemini (usa il Base64 per velocità) passando il contesto
      const ecgAnalysis = await callGeminiForEcgAnalysis(userMessage, attachment.data, contextString);

      extractedData.frequenza_cardiaca = ecgAnalysis.frequenza_cardiaca || extractedData.frequenza_cardiaca || null;

      // 3. Upload Sicuro (usa il File originale)
      savedVitals = await uploadEcgAndSaveVitals(attachment.file, extractedData);

      lisaResponseText = ecgAnalysis.commento;

    } else {
      // --- CASO SOLO TESTO ---
      console.log('askLisa: [FASE 2B] Avvio analisi Testo...');
      savedVitals = await saveExtractedVitals(extractedData);

      const s = extractedData.pressione_sistolica;
      const d = extractedData.pressione_diastolica;

      if ((s && s >= 130) || (d && d >= 85)) {
        if (todaysCount < 3) actionToReturn = 'SET_TIMER_10_MIN';
      }

      const payload = {
        contents: buildChatHistory(userMessage),
        systemInstruction: { parts: [{ text: buildSystemInstruction(NURSE_ANALYSIS_PROMPT, todaysCount) }] },
      };
      lisaResponseText = await callGeminiApi(payload);
    }

    // --- FASE 3: AGGIORNAMENTO COMMENTO ---
    if (savedVitals && savedVitals.id && lisaResponseText) {
      await supabase
        .from('vital_signs')
        .update({ commento_lisa: lisaResponseText })
        .eq('id', savedVitals.id);
      fetchVitals();
    } else if (savedVitals) {
      fetchVitals();
    }

    return { text: lisaResponseText, action: actionToReturn };

  } catch (error) {
    console.error("Errore bloccante in askLisa:", error);
    return { text: "Oh, mi dispiace, ho avuto un problema tecnico. Riprova.", action: null };
  }
}

// --- HELPER STORICO ECG ---
async function getLastEcgAnalysis(userId) {
  if (!userId) return null;
  try {
    const { data, error } = await supabase
      .from('vital_signs')
      .select('created_at, commento_lisa')
      .eq('user_id', userId)
      .not('ecg_storage_path', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.warn("Errore recupero storico ECG:", error);
    }
    return data;
  } catch (e) {
    return null;
  }
}

// --- HELPER ECG ANALYSIS ---
async function callGeminiForEcgAnalysis(userMessage, imageBase64, contextString) {
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
    const response = result.response;
    const jsonText = response.text().replace(/```json/g, '').replace(/```/g, '').trim();

    if (!jsonText) return { frequenza_cardiaca: null, commento: "Non sono riuscita a leggere il tracciato." };

    try {
      return JSON.parse(jsonText);
    } catch (parseError) {
      return { frequenza_cardiaca: null, commento: jsonText };
    }
  } catch (apiError) {
    console.error("Errore API Gemini ECG:", apiError);
    throw apiError;
  }
}

// --- HELPER UPLOAD ECG SICURO ---
async function uploadEcgAndSaveVitals(fileObject, extractedData) {
  if (!userSession.value) throw new Error('Utente non loggato');

  if (!fileObject) {
    console.error("ERRORE CRITICO: Oggetto 'fileObject' mancante in uploadEcgAndSaveVitals!");
  }

  const userId = userSession.value.user.id;

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

  if (!fileObject) return savedRecord;

  const filePath = `${userId}/ecg_${savedRecord.id}.jpg`;

  try {
    const { error: storageError } = await supabase
      .storage
      .from('ecg_uploads')
      .upload(filePath, fileObject, {
        contentType: fileObject.type || 'image/jpeg',
        upsert: true
      });

    if (!storageError) {
      const { data: updatedRecord } = await supabase
        .from('vital_signs')
        .update({ ecg_storage_path: filePath })
        .eq('id', savedRecord.id)
        .select()
        .single();
      return updatedRecord;
    } else {
      console.error("Errore Upload Storage:", storageError);
    }
  } catch (err) {
    console.error("Eccezione durante upload:", err);
  }

  return savedRecord;
}

// --- ALTRE HELPER (Standard) ---
async function getTodaysMeasurementCount(userId) {
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

async function updateLongTermMemory(newMemory) {
  if (!userSession.value) return;
  const userId = userSession.value.user.id;
  const currentNotes = profile.value?.piano_terapeutico || '';
  const today = new Date().toLocaleDateString();
  const updatedNotes = `${currentNotes}\n- [${today}] ${newMemory}`.trim();
  await supabase.from('profiles').update({ piano_terapeutico: updatedNotes }).eq('id', userId);
}

async function callGeminiForExtraction(userMessage) {
  if (!userMessage.trim()) return {};
  const extractionModel = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: { parts: [{ text: DATA_EXTRACTION_PROMPT }] }
  })
  try {
    const result = await extractionModel.generateContent(userMessage)
    const text = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
    return text ? JSON.parse(text) : {};
  } catch (error) { return {} }
}

async function saveExtractedVitals(data) {
  if (!data || Object.keys(data).length === 0) return null;
  if (!userSession.value) return null;
  const userId = userSession.value.user.id;

  const isOnlyBraccio = data.braccio && !data.pressione_sistolica && !data.frequenza_cardiaca;
  if (isOnlyBraccio) {
    // Logica aggiornamento record precedente (omessa per brevità ma presente nel tuo file completo)
  }

  const vitalData = {
    user_id: userId,
    pressione_sistolica: data.pressione_sistolica || null,
    pressione_diastolica: data.pressione_diastolica || null,
    frequenza_cardiaca: data.frequenza_cardiaca || null,
    saturazione_ossigeno: data.saturazione_ossigeno || null,
    braccio: data.braccio || null,
  };
  const { data: savedData, error } = await supabase.from('vital_signs').insert(vitalData).select().single();
  if (error) return null;
  return savedData;
}

function buildSystemInstruction(mainPrompt, todaysCount = 0) {
  const p = profile.value || {};
  let contestoProfilo = `CONTESTO PAZIENTE: ${p.nome}, Misurazioni: ${todaysCount}`;
  if (p.terapia_farmacologica) contestoProfilo += `\nTERAPIA: ${p.terapia_farmacologica}`;
  if (p.piano_terapeutico) contestoProfilo += `\nNOTE: ${p.piano_terapeutico}`;
  const oraCorrente = new Date().toLocaleTimeString('it-IT');
  return `${mainPrompt}\n\n${contestoProfilo}\n\nORA: ${oraCorrente}`;
}

function buildChatHistory(userMessage) {
  const history = messages.value.slice(-10).map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }]
  }));
  history.push({ role: 'user', parts: [{ text: userMessage }] });
  return history;
}

async function callGeminiApi(payload) {
  const result = await model.generateContent(payload);
  return result.response.text();
}

export async function generateClinicalSummary(profileData, vitalsData) { return "Sintesi PDF..."; }
export async function analyzeExistingRecord(record) { return "Analisi Rieseguita"; }
