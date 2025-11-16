/* eslint-disable no-useless-escape */
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai"
import { supabase } from '../supabase'
import { userSession } from '../store/auth'
import { profile } from '../store/profile'
import { messages } from '../store/chat'
import { fetchVitals } from '../store/diary.js'

// Importiamo i "cervelli" di Lisa
import {
  DATA_EXTRACTION_PROMPT,
  NURSE_ANALYSIS_PROMPT,
  ECG_ANALYSIS_JSON_PROMPT, // <-- MODIFICATO
  NURSE_GUIDE_PROMPT
} from '../prompts'

// --- Configurazione API ---
const apiKey = import.meta.env.VITE_GEMINI_API_KEY
const modelName = 'gemini-2.5-flash-preview-09-2025'

// Inizializza l'SDK
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
 * FUNZIONE PRINCIPALE: askLisa(userMessage, imageBase64)
 * ==============================================================================
 */
export async function askLisa(userMessage, imageBase64 = null) {
  console.log('askLisa: Inizio esecuzione...');

  let lisaResponseText = ''; // Testo per la chat
  let actionToReturn = null;
  let savedVitals = null;

  try {
    //
    // --- FASE 1: ESTRAZIONE DATI (SEMPRE ESEGUITA) ---
    //
    console.log('askLisa: [FASE 1] Avvio estrazione dati...');
    const extractedData = await callGeminiForExtraction(userMessage);
    console.log('askLisa: [FASE 1] Estrazione completata.', extractedData);

    //
    // --- FASE 2: BIVIO (ECG o SOLO TESTO) ---
    //
    if (imageBase64) {
      //
      // --- PERCORSO A: ANALISI ECG (Multimodale) ---
      //
      console.log('askLisa: [FASE 2A] Avvio analisi ECG...');

      // 1. Chiama la funzione multimodale per ottenere il JSON {frequenza, commento}
      const ecgAnalysis = await callGeminiForEcgAnalysis(userMessage, imageBase64);

      // 2. Aggiungi i dati ECG estratti ai dati di testo estratti
      // (es. l'utente ha scritto "140/90" E ha caricato l'ECG)
      extractedData.frequenza_cardiaca = ecgAnalysis.frequenza_cardiaca || extractedData.frequenza_cardiaca || null;

      // 3. Salva i dati UNIFICATI (Testo + ECG) e carica l'immagine
      savedVitals = await uploadEcgAndSaveVitals(
        imageBase64,
        extractedData // Passiamo i dati UNIFICATI
      );

      lisaResponseText = ecgAnalysis.commento; // Questo è il commento dall'ECG

    } else {
      //
      // --- PERCORSO B: ANALISI SOLO TESTO ---
      //
      console.log('askLisa: [FASE 2B] Avvio analisi Testo...');

      // 1. Salva i dati estratti (senza ECG)
      savedVitals = await saveExtractedVitals(extractedData);
      console.log('askLisa: [FASE 2B] Dati DB salvati.', savedVitals);

      // 2. Controlla il trigger del timer
      const s = extractedData.pressione_sistolica;
      const d = extractedData.pressione_diastolica;
      if ((s && s >= 130) || (d && d >= 85)) {
        actionToReturn = 'SET_TIMER_10_MIN';
        console.log('askLisa: Pressione alta rilevata, imposto timer per UI.');
      }

      // 3. Prepara il payload (solo testo)
      const payload = {
        contents: buildChatHistory(userMessage),
        systemInstruction: {
          parts: [{ text: buildSystemInstruction(NURSE_ANALYSIS_PROMPT) }]
        },
      };

      // 4. Chiama Gemini per l'analisi
      lisaResponseText = await callGeminiApi(payload);
    }

    //
    // --- FASE 3: AGGIORNAMENTO COMMENTO (SEMPRE ESEGUITA) ---
    //
    if (savedVitals && savedVitals.id && lisaResponseText) {
      console.log('askLisa: Aggiorno vital_signs con commento finale.');
      await supabase
        .from('vital_signs')
        .update({ commento_lisa: lisaResponseText })
        .eq('id', savedVitals.id);

      // Ora che anche il commento è salvato, ricarichiamo il diario
      fetchVitals();

    } else if (savedVitals) {
      // Se abbiamo salvato un record ma non c'è una risposta di Lisa
      fetchVitals();
    }

    console.log('askLisa: Esecuzione terminata, restituisco risposta.');

    return {
      text: lisaResponseText,
      action: actionToReturn
    };

  } catch (error) {
    console.error("Errore bloccante in askLisa:", error);
    return {
      text: "Oh, mi dispiace, ho avuto un problema tecnico nell'analizzare i tuoi dati. Riprova.",
      action: null
    };
  }
}

//
// --- FUNZIONE REFACTORING ---
//
/**
 * Analizza un record *già esistente* (da CSV o vecchio)
 * e **restituisce** il commento di Lisa. (NON SALVA PIU' QUI)
 * @param {object} record - L'oggetto record da analizzare
 * @returns {string} - Il commento testuale di Lisa
 */
export async function analyzeExistingRecord(record) {
  console.log(`analyzeExistingRecord: Avvio analisi per ID: ${record.id}`);

  // 1. Costruisci un "falso" messaggio utente
  let fakeUserMessage = 'Ciao Lisa, analizza per favore questi dati salvati:\n';
  if (record.pressione_sistolica) {
    fakeUserMessage += `Pressione: ${record.pressione_sistolica}/${record.pressione_diastolica} mmHg\n`;
  }
  if (record.frequenza_cardiaca) {
    fakeUserMessage += `Frequenza: ${record.frequenza_cardiaca} bpm\n`;
  }
  if (record.saturazione_ossigeno) {
    fakeUserMessage += `Saturazione: ${record.saturazione_ossigeno} %\n`;
  }
  if (record.braccio) {
    fakeUserMessage += `Braccio: ${record.braccio}\n`;
  }

  // --- MODIFICA ---
  // Se il record ha un ECG, dobbiamo usare la logica multimodale!
  // (Questa è un'implementazione avanzata, per ora ci concentriamo sul testo)
  if (record.ecg_storage_path) {
    fakeUserMessage += "\n(Questo record ha anche un tracciato ECG associato)";
    // TODO: In futuro, dovremmo scaricare l'immagine dallo storage
    // e inviarla insieme a 'fakeUserMessage'
  }

  try {
    // 2. Prepara la chiamata (solo Fase 2)
    const analysisPrompt = NURSE_ANALYSIS_PROMPT;
    const systemInstruction = buildSystemInstruction(analysisPrompt);
    const chatHistory = [{
      role: 'user',
      parts: [{ text: fakeUserMessage }]
    }];

    const payload = {
      contents: chatHistory,
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      },
    };

    // 3. Chiama l'IA
    const lisaResponse = await callGeminiApi(payload);

    // 4. RESTITUISCE IL TESTO (NON SALVA)
    return lisaResponse;

  } catch (error) {
    console.error("Errore bloccante in analyzeExistingRecord:", error);
    // Rilancia l'errore per farlo gestire da diary.js
    throw error;
  }
}


/**
 * ==============================================================================
 * FUNZIONI HELPER (Logica interna)
 * ==============================================================================
 */

//
// --- HELPER ECG (MODIFICATO - SENZA SCHEMA) ---
//
/**
 * Chiama Gemini con (testo + immagine) e si aspetta un JSON di risposta.
 * @returns {object} - { frequenza_cardiaca: number, commento: string }
 */
async function callGeminiForEcgAnalysis(userMessage, imageBase64) {

  //
  // --- MODIFICA CHIAVE ---
  // Rimuoviamo il 'generationConfig' (responseSchema) che
  // causava il blocco. Ci fidiamo solo del prompt.
  //
  const extractionModel = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: {
      parts: [{ text: ECG_ANALYSIS_JSON_PROMPT }] // <-- USA IL PROMPT JSON
    }
    // NESSUN generationConfig
  })

  try {
    console.log('callGeminiForEcgAnalysis: Chiamo API per JSON ECG (senza schema)...');

    const result = await extractionModel.generateContent([
      // Passiamo sia il testo che l'immagine
      userMessage || "Analizza questo tracciato.",
      {
        inlineData: {
          mimeType: "image/jpeg",
          data: imageBase64
        }
      }
    ]);

    const response = result.response;
    const jsonText = response.text();

    const cleanedText = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();

    if (!cleanedText) {
      console.warn('callGeminiForEcgAnalysis: Risposta JSON vuota.');
      return { frequenza_cardiaca: null, commento: "Non sono riuscita a leggere il tracciato." };
    }

    const data = JSON.parse(cleanedText);
    console.log('callGeminiForEcgAnalysis: Dati ECG Estratti:', data);
    return data; // { frequenza_cardiaca: 115, commento: "..." }

  } catch (error) {
    console.error("Errore bloccante in callGeminiForEcgAnalysis:", error);
    // --- MODIFICA ---
    // Se il JSON.parse() fallisce (perché l'IA ha risposto con testo)
    // restituiamo un errore gestibile.
    return {
      frequenza_cardiaca: null,
      commento: "Errore tecnico nell'analisi dell'ECG. L'IA non ha restituito un JSON valido."
    };
    // throw error; // Non rilanciare, gestisci l'errore
  }
}

/**
 * Fase 1a: Chiama Gemini per estrarre il JSON dei parametri (SOLO TESTO).
 */
async function callGeminiForExtraction(userMessage) {
  if (!userMessage.trim()) {
    return {}; // Non chiamare l'IA se il testo è vuoto
  }

  const extractionModel = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: {
      parts: [{ text: DATA_EXTRACTION_PROMPT }]
    }
  })

  try {
    console.log('callGeminiForExtraction: Chiamo API per JSON (senza schema)...');
    const result = await extractionModel.generateContent(userMessage)
    const response = result.response
    const jsonText = response.text()

    const cleanedText = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();

    if (!cleanedText) {
      console.log('callGeminiForExtraction: Risposta vuota, nessun dato estratto.');
      return {};
    }

    const data = JSON.parse(cleanedText)
    console.log('callGeminiForExtraction: Dati Estratti:', data)
    return data

  } catch (error) {
    console.error("Errore bloccante in callGeminiForExtraction:", error)
    return {}
  }
}

/**
 * Fase 1b: Salva i dati estratti (SOLO TESTO) nella tabella vital_signs.
 */
async function saveExtractedVitals(data) {
  // Se non ci sono dati O se c'è solo il braccio (gestito da 'merge'), non inserire.
  if (!data || Object.keys(data).length === 0) {
    console.log('saveExtractedVitals: Nessun dato vitale da salvare.');
    return null;
  }

  if (!userSession.value) {
    console.error('saveExtractedVitals: Impossibile salvare, utente non loggato.');
    return null;
  }

  const userId = userSession.value.user.id;

  // Logica "Solo Braccio" (per UPDATE)
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

    if (findError || !lastRecord) {
      console.warn('saveExtractedVitals: Nessun record recente trovato da aggiornare.', findError);
    } else {
      console.log(`saveExtractedVitals: Trovato record ${lastRecord.id}. Aggiorno...`);
      const { data: updatedData, error: updateError } = await supabase
        .from('vital_signs')
        .update({ braccio: data.braccio })
        .eq('id', lastRecord.id)
        .select()
        .single();

      if (updateError) {
        console.error('saveExtractedVitals: Errore nell\'aggiornamento:', updateError);
      } else {
        console.log('saveExtractedVitals: Record aggiornato con successo.', updatedData);
        return updatedData;
      }
    }
  }

  // INSERT normale
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
    console.log('saveExtractedVitals: Dati vitali salvati nel DB:', savedData);
    return savedData;
  } catch (error) {
    console.error('Errore bloccante in saveExtractedVitals:', error);
    return null;
  }
}

//
// --- FUNZIONE HELPER (MODIFICATA) per ECG ---
//
/**
 * Salva i dati vitali E carica l'ECG su Storage.
 * Restituisce il record salvato (per l'aggiornamento del commento).
 */
async function uploadEcgAndSaveVitals(imageBase64, extractedData) {
  if (!userSession.value) throw new Error('Utente non loggato');

  const userId = userSession.value.user.id;

  // 1. Inserisci i dati vitali (estratti) E un placeholder per il commento
  const vitalData = {
    user_id: userId,
    pressione_sistolica: extractedData.pressione_sistolica || null,
    pressione_diastolica: extractedData.pressione_diastolica || null,
    frequenza_cardiaca: extractedData.frequenza_cardiaca || null,
    saturazione_ossigeno: extractedData.saturazione_ossigeno || null,
    braccio: extractedData.braccio || null,
    commento_lisa: 'Analisi ECG in corso...' // Placeholder
  };

  const { data: savedRecord, error: insertError } = await supabase
    .from('vital_signs')
    .insert(vitalData)
    .select()
    .single();

  if (insertError) {
    console.error('uploadEcgAndSaveVitals: Errore inserimento placeholder:', insertError);
    throw insertError;
  }

  // 2. Carica l'immagine (Base64) su Supabase Storage
  // (Supabase gestisce la decodifica Base64 sul server)
  const filePath = `${userId}/ecg_${savedRecord.id}.jpg`;

  const { error: storageError } = await supabase
    .storage
    .from('ecg_uploads')
    .upload(filePath, imageBase64, {
      contentType: 'image/jpeg',
      upsert: false, // Non sovrascrivere
      encoding: 'base64'
    });

  if (storageError) {
    console.error('uploadEcgAndSaveVitals: Errore upload Storage:', storageError);
  } else {
    // 3. (SUCCESSO) Associa il path al record
    console.log(`uploadEcgAndSaveVitals: Immagine caricata: ${filePath}`);
    const { data: updatedRecord, error: updateError } = await supabase
      .from('vital_signs')
      .update({ ecg_storage_path: filePath })
      .eq('id', savedRecord.id)
      .select()
      .single();

    if (updateError) throw updateError;
    return updatedRecord; // Restituisce il record completo (con path)
  }

  return savedRecord; // Restituisce il record parziale (senza path)
}


/**
 * Fase 2b (Helper): Costruisce il contesto (System Instruction) per Lisa.
 */
function buildSystemInstruction(mainPrompt) {
  // 1. Profilo utente
  const p = profile.value || {};
  const nome = p.nome || 'Paziente';
  const eta = p.data_di_nascita ?
    new Date().getFullYear() - new Date(p.data_di_nascita).getFullYear() :
    'sconosciuta';

  const contestoProfilo = `
CONTESTO PAZIENTE:
- Nome: ${nome}
- Sesso: ${p.sesso || 'sconosciuto'}
- Età: ${eta}
- Tipo Misuratore: ${p.tipo_misuratore || 'sconosciuto'}
- Farmaci Pressione: ${p.farmaci_pressione ? 'Si' : 'No'}
- Farmaci Cuore: ${p.farmaci_cuore ? 'Si' : 'No'}
- Anticoagulanti: ${p.anticoagulanti ? 'Si' : 'No'}
`;

  // 2. Ora corrente
  const oraCorrente = new Date().toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  // Combina tutto
  return `${mainPrompt}\n\n${contestoProfilo}\n\nCONTESTO TEMPORALE:\n- ORA CORRENTE: ${oraCorrente}`;
}

/**
 * Fase 2b (Helper): Formatta la cronologia chat per l'IA.
 */
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

/**
 * Funzione API: Esegue la chiamata a Gemini usando l'SDK.
 */
async function callGeminiApi(payload) {
  try {
    console.log('callGeminiApi: Chiamo API per Analisi...');
    const result = await model.generateContent(payload)
    const response = result.response
    const text = response.text()

    if (text) {
      console.log('callGeminiApi: Risposta ricevuta.');
      return text
    } else {
      console.warn('Risposta API Analisi inattesa:', result)
      throw new Error('Nessun contenuto valido da Gemini.')
    }

  } catch (error) {
    console.error('Errore bloccante in callGeminiApi:', error)
    throw error
  }
}
