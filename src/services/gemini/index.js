/* index.js - Punto di ingresso dei servizi AI */
import { model } from './client'
import { supabase } from '../../supabase'
import { userSession } from '../../store/auth'
import { profile, fetchProfile } from '../../store/profile'
import { fetchVitals } from '../../store/diary'
import { NURSE_ANALYSIS_PROMPT, DOCTOR_REPORT_PROMPT } from '../../prompts'

// Importiamo dai sotto-moduli
import { callGeminiForExtraction, saveExtractedVitals, updateLongTermMemory, getTodaysMeasurementCount } from './dataService'
import { callGeminiForEcgAnalysis, uploadEcgAndSaveVitals, getLastEcgAnalysis } from './ecgService'
import { buildSystemInstruction, buildChatHistory } from './contextService'

// Funzione Helper interna per chiamare l'API testo
async function callGeminiApi(payload) {
  try {
    const result = await model.generateContent(payload)
    return result.response.text()
  } catch (error) {
    console.error('Errore bloccante in callGeminiApi:', error)
    throw error
  }
}

/**
 * askLisa: Funzione principale chiamata dalla ChatPage
 */
export async function askLisa(userMessage, attachment = null) {
  console.log('askLisa (Modular): Inizio esecuzione...');

  if (!userSession.value) return { text: "Errore: Utente non loggato.", action: null };
  const userId = userSession.value.user.id;

  let lisaResponseText = '';
  let actionToReturn = null;
  let savedVitals = null;

  const todaysCount = await getTodaysMeasurementCount(userId);

  try {
    // 1. Estrazione Dati
    const extractedData = await callGeminiForExtraction(userMessage);

    if (extractedData.nuova_memoria) {
      await updateLongTermMemory(userId, extractedData.nuova_memoria);
      await fetchProfile();
    }

    // 2. Logica Multimodale (ECG)
    if (attachment && attachment.type === 'image') {
      console.log('askLisa: [FASE 2A] Avvio analisi ECG...');

      const patientProfile = profile.value || {};
      const lastEcg = await getLastEcgAnalysis(userId);

      let previousEcgText = "Nessun tracciato precedente.";
      if (lastEcg) {
        const date = new Date(lastEcg.created_at).toLocaleDateString('it-IT');
        previousEcgText = `DEL ${date}: "${lastEcg.commento_lisa}"`;
      }

      const contextString = `
        DATI PAZIENTE: ${patientProfile.nome || 'Sconosciuto'}
        STORICO ECG: ${previousEcgText}
      `;

      const ecgAnalysis = await callGeminiForEcgAnalysis(userMessage, attachment.data, contextString);

      extractedData.frequenza_cardiaca = ecgAnalysis.frequenza_cardiaca || extractedData.frequenza_cardiaca;

      // Upload
      savedVitals = await uploadEcgAndSaveVitals(userId, attachment.file, extractedData);

      lisaResponseText = ecgAnalysis.commento;

    } else {
      // Caso Testo
      console.log('askLisa: [FASE 2B] Avvio analisi Testo...');
      savedVitals = await saveExtractedVitals(userId, extractedData);

      // Timer Logic
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

    // 3. Aggiornamento Commento
    if (savedVitals && savedVitals.id && lisaResponseText) {
      await supabase.from('vital_signs').update({ commento_lisa: lisaResponseText }).eq('id', savedVitals.id);
      fetchVitals();
    } else if (savedVitals) {
      fetchVitals();
    }

    return { text: lisaResponseText, action: actionToReturn };

  } catch (error) {
    console.error("Errore in askLisa:", error);
    return { text: "Mi dispiace, ho avuto un problema tecnico. Riprova più tardi.", action: null };
  }
}

// --- FUNZIONE AGGIUNTA QUI (Sostituisce l'import sbagliato) ---
export async function generateClinicalSummary(profileData, vitalsData) {
  console.log('generateClinicalSummary: Elaborazione dati per il medico...');

  let sysSum = 0, diaSum = 0, hrSum = 0;
  let bpCount = 0, hrCount = 0;
  let maxSys = 0;

  const ecgRecords = vitalsData.filter(v => v.ecg_storage_path);
  let ecgSummaryText = "Nessun tracciato ECG registrato nel periodo.";

  if (ecgRecords.length > 0) {
    const ecgDescriptions = ecgRecords.map(v => {
      const data = new Date(v.created_at).toLocaleDateString();
      let note = v.commento_lisa || "Nessuna analisi registrata";
      note = note.replace(/\*\*ATTENZIONE:.*professionale\.\*\*/s, "").trim();
      note = note.replace(/Sono una IA.*?medico\./s, "").trim();
      if (note.length > 1000) note = note.substring(0, 1000) + "...";
      return `- Data ${data}: ${note}`;
    }).join('\n\n');
    ecgSummaryText = `Sono presenti ${ecgRecords.length} tracciati ECG. Ecco le note di osservazione:\n${ecgDescriptions}`;
  }

  vitalsData.forEach(v => {
    if (v.pressione_sistolica && v.pressione_diastolica) {
      sysSum += v.pressione_sistolica;
      diaSum += v.pressione_diastolica;
      if (v.pressione_sistolica > maxSys) maxSys = v.pressione_sistolica;
      bpCount++;
    }
    if (v.frequenza_cardiaca) {
      hrSum += v.frequenza_cardiaca;
      hrCount++;
    }
  });

  const avgSys = bpCount > 0 ? Math.round(sysSum / bpCount) : 0;
  const avgDia = bpCount > 0 ? Math.round(diaSum / bpCount) : 0;
  const avgHr = hrCount > 0 ? Math.round(hrSum / hrCount) : 0;

  const stats = {
    media_pa: bpCount > 0 ? `${avgSys}/${avgDia}` : "N/D",
    media_fc: hrCount > 0 ? avgHr : "N/D",
    picco_sistolico: maxSys > 0 ? maxSys : "N/D",
    totale_misurazioni: bpCount,
    periodo: vitalsData.length > 0
      ? `${new Date(vitalsData[vitalsData.length-1].created_at).toLocaleDateString()} - ${new Date(vitalsData[0].created_at).toLocaleDateString()}`
      : "N/D"
  };

  const message = `
    DATI PAZIENTE:
    Nome: ${profileData.nome}
    Età: ${profileData.data_di_nascita ? new Date().getFullYear() - new Date(profileData.data_di_nascita).getFullYear() : 'N/D'}
    TERAPIA: ${profileData.terapia_farmacologica || 'Nessuna indicata'}
    STATISTICHE PERIODO (${stats.periodo}):
    Misurazioni totali: ${stats.totale_misurazioni}
    Media Pressione: ${stats.media_pa} mmHg
    Picco Sistolico: ${stats.picco_sistolico} mmHg
    Media Frequenza: ${stats.media_fc} bpm
    REPORT TRACCIATI ECG: ${ecgSummaryText}
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

export async function analyzeExistingRecord(record) {
  // Implementazione semplificata per ri-analisi
  const analysisPrompt = NURSE_ANALYSIS_PROMPT;
  const systemInstruction = buildSystemInstruction(analysisPrompt);
  const chatHistory = [{ role: 'user', parts: [{ text: "Analizza questo record: " + JSON.stringify(record) }] }];
  const payload = { contents: chatHistory, systemInstruction: { parts: [{ text: systemInstruction }] } };
  return await callGeminiApi(payload);
}
