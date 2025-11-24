/* eslint-disable no-useless-escape */
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai"
import { supabase } from '../supabase'
import { userSession } from '../store/auth'
import { profile } from '../store/profile'
import { messages } from '../store/chat' 
import { fetchVitals } from '../store/diary.js' 

import { 
  DATA_EXTRACTION_PROMPT, 
  NURSE_ANALYSIS_PROMPT, 
  ECG_ANALYSIS_JSON_PROMPT,
  DOCTOR_REPORT_PROMPT, 
  NURSE_GUIDE_PROMPT 
} from '../prompts'

const apiKey = import.meta.env.VITE_GEMINI_API_KEY
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
  
  try {
    // --- FASE 1: ESTRAZIONE DATI ---
    console.log('askLisa: [FASE 1] Avvio estrazione dati...');
    const extractedData = await callGeminiForExtraction(userMessage);
    console.log('askLisa: [FASE 1] Estrazione completata.', extractedData);
    
    // --- FASE 2: LOGICA MULTIMODALE ---
    if (attachment && attachment.type === 'image') {
      // --- CASO ECG ---
      console.log('askLisa: [FASE 2A] Avvio analisi ECG...');
      const ecgAnalysis = await callGeminiForEcgAnalysis(userMessage, attachment.data);
      extractedData.frequenza_cardiaca = ecgAnalysis.frequenza_cardiaca || extractedData.frequenza_cardiaca || null;
      savedVitals = await uploadEcgAndSaveVitals(attachment.data, extractedData);
      lisaResponseText = ecgAnalysis.commento;

    } else {
      // --- CASO SOLO TESTO ---
      console.log('askLisa: [FASE 2B] Avvio analisi Testo...');
      savedVitals = await saveExtractedVitals(extractedData);
      console.log('askLisa: [FASE 2B] Dati DB salvati.', savedVitals);
      
      const s = extractedData.pressione_sistolica;
      const d = extractedData.pressione_diastolica;
      if ((s && s >= 130) || (d && d >= 85)) {
        actionToReturn = 'SET_TIMER_10_MIN'; 
      }
      
      const payload = {
        contents: buildChatHistory(userMessage),
        systemInstruction: { parts: [{ text: buildSystemInstruction(NURSE_ANALYSIS_PROMPT) }] },
      };
      lisaResponseText = await callGeminiApi(payload);
    }
    
    // --- FASE 3: AGGIORNAMENTO COMMENTO ---
    if (savedVitals && savedVitals.id && lisaResponseText) {
       console.log('askLisa: Aggiorno vital_signs con commento finale.');
       await supabase
         .from('vital_signs')
         .update({ commento_lisa: lisaResponseText })
         .eq('id', savedVitals.id);
       fetchVitals(); 
    } else if (savedVitals) {
       fetchVitals();
    }
    
    console.log('askLisa: Esecuzione terminata.');
    return { text: lisaResponseText, action: actionToReturn };

  } catch (error) {
    console.error("Errore bloccante in askLisa:", error);
    return { text: "Oh, mi dispiace, ho avuto un problema tecnico. Riprova.", action: null };
  }
}

// --- ANALISI RECORD ESISTENTE ---
export async function analyzeExistingRecord(record) {
  console.log(`analyzeExistingRecord: Avvio analisi per ID: ${record.id}`);
  
  let fakeUserMessage = 'Buongiorno Dottoressa, analizza per favore questi dati salvati:\n';
  if (record.pressione_sistolica) fakeUserMessage += `Pressione: ${record.pressione_sistolica}/${record.pressione_diastolica} mmHg\n`;
  if (record.frequenza_cardiaca) fakeUserMessage += `Frequenza: ${record.frequenza_cardiaca} bpm\n`;
  if (record.saturazione_ossigeno) fakeUserMessage += `Saturazione: ${record.saturazione_ossigeno} %\n`;
  if (record.braccio) fakeUserMessage += `Braccio: ${record.braccio}\n`;
  
  if (record.ecg_storage_path) {
     fakeUserMessage += "\n(Questo record ha anche un tracciato ECG associato)";
  }
  
  try {
    const analysisPrompt = NURSE_ANALYSIS_PROMPT; 
    const systemInstruction = buildSystemInstruction(analysisPrompt);
    const chatHistory = [{
      role: 'user',
      parts: [{ text: fakeUserMessage }]
    }]; 

    const payload = {
      contents: chatHistory,
      systemInstruction: { parts: [{ text: systemInstruction }] },
    };

    const lisaResponse = await callGeminiApi(payload);
    return lisaResponse;
  } catch (error) {
     console.error("Errore bloccante in analyzeExistingRecord:", error);
     throw error;
  }
}

//
// --- FUNZIONE PER IL REPORT PDF (MEDICO) ---
//
export async function generateClinicalSummary(profileData, vitalsData) {
  console.log('generateClinicalSummary: Elaborazione dati per il medico...');

  let sysSum = 0, diaSum = 0, hrSum = 0, count = 0;
  let maxSys = 0;
  
  // --- 1. RACCOLTA DATI ECG (MIGLIORATA) ---
  const ecgRecords = vitalsData.filter(v => v.ecg_storage_path);
  let ecgSummaryText = "Nessun tracciato ECG registrato nel periodo.";
  
  if (ecgRecords.length > 0) {
    const ecgDescriptions = ecgRecords.map(v => {
      const data = new Date(v.created_at).toLocaleDateString();
      let note = v.commento_lisa || "Nessuna analisi registrata";
      
      // --- PULIZIA DISCLAIMER ---
      // Rimuoviamo il disclaimer standard per risparmiare spazio e dare focus ai dati
      note = note.replace(/\*\*ATTENZIONE:.*professionale\.\*\*/s, "").trim();
      note = note.replace(/Sono una IA.*?medico\./s, "").trim();
      
      // Prendiamo più testo (fino a 1000 caratteri) per includere i dettagli clinici
      if (note.length > 1000) note = note.substring(0, 1000) + "...";
      
      return `- Data ${data}: ${note}`;
    }).join('\n\n'); // Doppio a capo per separare bene
    
    ecgSummaryText = `Sono presenti ${ecgRecords.length} tracciati ECG. Ecco le note di osservazione (pulite dal disclaimer):\n${ecgDescriptions}`;
  }
  // ----------------------------

  vitalsData.forEach(v => {
    if (v.pressione_sistolica) {
      sysSum += v.pressione_sistolica;
      diaSum += v.pressione_diastolica;
      if (v.pressione_sistolica > maxSys) maxSys = v.pressione_sistolica;
    }
    if (v.frequenza_cardiaca) {
      hrSum += v.frequenza_cardiaca;
    }
    count++;
  });

  const stats = count > 0 ? {
    media_pa: `${Math.round(sysSum/count)}/${Math.round(diaSum/count)}`,
    media_fc: Math.round(hrSum/count),
    picco_sistolico: maxSys,
    totale_misurazioni: count,
    periodo: `${new Date(vitalsData[vitalsData.length-1].created_at).toLocaleDateString()} - ${new Date(vitalsData[0].created_at).toLocaleDateString()}`
  } : { nota: "Dati insufficienti" };

  const message = `
    DATI PAZIENTE:
    Nome: ${profileData.nome}
    Età: ${profileData.data_di_nascita ? new Date().getFullYear() - new Date(profileData.data_di_nascita).getFullYear() : 'N/D'}
    
    TERAPIA FARMACOLOGICA (Riferita):
    ${profileData.terapia_farmacologica || 'Nessuna indicata'}
    
    STATISTICHE PERIODO (${stats.periodo}):
    Misurazioni totali: ${stats.totale_misurazioni}
    Media Pressione: ${stats.media_pa} mmHg
    Picco Sistolico: ${stats.picco_sistolico} mmHg
    Media Frequenza: ${stats.media_fc} bpm
    
    REPORT TRACCIATI ECG:
    ${ecgSummaryText}
  `;

  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: message }] }],
      systemInstruction: { parts: [{ text: DOCTOR_REPORT_PROMPT }] }
    });
    
    return result.response.text();
  } catch (error) {
    console.error("Errore generazione riassunto clinico:", error);
    return "Non è stato possibile generare il riassunto clinico automatico.";
  }
}


/**
 * ==============================================================================
 * FUNZIONI HELPER (Logica interna)
 * ==============================================================================
 */

// --- HELPER ECG ---
async function callGeminiForEcgAnalysis(userMessage, imageBase64) {
  const extractionModel = genAI.getGenerativeModel({
    model: modelName, 
    systemInstruction: { parts: [{ text: ECG_ANALYSIS_JSON_PROMPT }] }
  })

  try {
    console.log('callGeminiForEcgAnalysis: Chiamo API per JSON ECG...');
    const result = await extractionModel.generateContent([
      userMessage || "Analizza questo tracciato.",
      { inlineData: { mimeType: "image/jpeg", data: imageBase64 } }
    ]);
    const response = result.response;
    const jsonText = response.text();
    const cleanedText = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    if (!cleanedText) return { frequenza_cardiaca: null, commento: "Non sono riuscita a leggere il tracciato." };

    try {
      const data = JSON.parse(cleanedText);
      console.log('callGeminiForEcgAnalysis: Dati ECG Estratti:', data);
      return data; 
    } catch (parseError) {
      console.error("Errore parsing JSON ECG:", parseError);
      return { frequenza_cardiaca: null, commento: cleanedText }; 
    }
  } catch (apiError) {
    console.error("Errore bloccante (API) in callGeminiForEcgAnalysis:", apiError);
    throw apiError; 
  }
}

// --- HELPER UPLOAD ECG ---
async function uploadEcgAndSaveVitals(imageBase64, extractedData) {
  if (!userSession.value) throw new Error('Utente non loggato');
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

  const filePath = `${userId}/ecg_${savedRecord.id}.jpg`;
  const { error: storageError } = await supabase
    .storage
    .from('ecg_uploads')
    .upload(filePath, imageBase64, {
      contentType: 'image/jpeg',
      upsert: false, 
      encoding: 'base64'
    });

  if (!storageError) {
    console.log(`uploadEcgAndSaveVitals: Immagine caricata: ${filePath}`);
    const { data: updatedRecord } = await supabase
      .from('vital_signs')
      .update({ ecg_storage_path: filePath })
      .eq('id', savedRecord.id)
      .select()
      .single();
    return updatedRecord; 
  }
  
  return savedRecord; 
}

// --- HELPER ESTRAZIONE ---
async function callGeminiForExtraction(userMessage) {
  if (!userMessage.trim()) return {};
  const extractionModel = genAI.getGenerativeModel({
    model: modelName, 
    systemInstruction: { parts: [{ text: DATA_EXTRACTION_PROMPT }] }
  })

  try {
    console.log('callGeminiForExtraction: Chiamo API per JSON...');
    const result = await extractionModel.generateContent(userMessage)
    const response = result.response
    const jsonText = response.text()
    const cleanedText = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();                 
    if (!cleanedText) return {};
    const data = JSON.parse(cleanedText)
    console.log('callGeminiForExtraction: Dati Estratti:', data)
    return data
  } catch (error) {
    console.error("Errore bloccante in callGeminiForExtraction:", error)
    return {} 
  }
}

// --- HELPER SALVATAGGIO VITALS ---
async function saveExtractedVitals(data) {
  if (!data || Object.keys(data).length === 0) return null;
  if (!userSession.value) return null;
  const userId = userSession.value.user.id;

  // Logica "Solo Braccio"
  const isOnlyBraccio = data.braccio && !data.pressione_sistolica && !data.frequenza_cardiaca;
  if (isOnlyBraccio) {
    console.log('saveExtractedVitals: Ricevuto solo braccio. Tento un aggiornamento...');
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: lastRecord, error: findError } = await supabase
      .from('vital_signs')
      .select('id')
      .eq('user_id', userId)
      .is('braccio', null) 
      .gte('created_at', fiveMinutesAgo) 
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!findError && lastRecord) {
      console.log(`saveExtractedVitals: Trovato record ${lastRecord.id}. Aggiorno...`);
      const { data: updatedData, error: updateError } = await supabase
        .from('vital_signs')
        .update({ braccio: data.braccio })
        .eq('id', lastRecord.id)
        .select()
        .single();
      if (!updateError) return updatedData; 
    }
  }
  
  const vitalData = {
    user_id: userId,
    pressione_sistolica: data.pressione_sistolica || null,
    pressione_diastolica: data.pressione_diastolica || null,
    frequenza_cardiaca: data.frequenza_cardiaca || null,
    saturazione_ossigeno: data.saturazione_ossigeno || null,
    braccio: data.braccio || null,
  };

  try {
    console.log('saveExtractedVitals: Eseguo INSERT...', vitalData); 
    const { data: savedData, error } = await supabase
      .from('vital_signs')
      .insert(vitalData)
      .select()
      .single();
    if (error) throw error;
    return savedData; 
  } catch (error) {
    console.error('Errore bloccante in saveExtractedVitals:', error);
    return null;
  }
}

function buildSystemInstruction(mainPrompt) {
  const p = profile.value || {};
  const nome = p.nome || 'Paziente';
  const eta = p.data_di_nascita ? 
    new Date().getFullYear() - new Date(p.data_di_nascita).getFullYear() : 'sconosciuta';
    
  let contestoProfilo = `
CONTESTO PAZIENTE:
- Nome: ${nome}
- Sesso: ${p.sesso || 'sconosciuto'}
- Età: ${eta}
- Tipo Misuratore: ${p.tipo_misuratore || 'sconosciuto'}
- Categorie Farmaci: ${p.farmaci_pressione ? 'Anti-Ipertensivi' : ''} ${p.farmaci_cuore ? 'Cardiaci' : ''} ${p.anticoagulanti ? 'Anticoagulanti' : ''}
`;

  if (p.terapia_farmacologica && p.terapia_farmacologica.trim() !== '') {
    contestoProfilo += `
*** TERAPIA FARMACOLOGICA IN ATTO ***
${p.terapia_farmacologica}
*************************************
`;
  }

  if (p.piano_terapeutico && p.piano_terapeutico.trim() !== '') {
    contestoProfilo += `
*** NOTE IMPORTANTI / PIANO COMPORTAMENTALE ***
(Istruzioni specifiche per l'interazione con questo paziente):
${p.piano_terapeutico}
***********************************************
`;
  }

  const oraCorrente = new Date().toLocaleTimeString('it-IT', { 
    hour: '2-digit', minute: '2-digit', hour12: false 
  });
  return `${mainPrompt}\n\n${contestoProfilo}\n\nCONTESTO TEMPORALE:\n- ORA CORRENTE: ${oraCorrente}`;
}

function buildChatHistory(userMessage) {
  const history = messages.value
    .slice(-10) 
    .map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model', 
      parts: [{ text: msg.content }]
    }));
  history.push({
    role: 'user',
    parts: [{ text: userMessage }]
  });
  return history;
}

async function callGeminiApi(payload) {
  try {
    console.log('callGeminiApi: Chiamo API per Analisi...');
    const result = await model.generateContent(payload)
    const response = result.response
    const text = response.text()
    if (text) return text;
    throw new Error('Nessun contenuto valido da Gemini.')
  } catch (error) {
    console.error('Errore bloccante in callGeminiApi:', error)
    throw error
  }
}
