import { ref, watchEffect } from 'vue'
import { supabase } from '../supabase.js'
import { userSession } from './auth.js'
// Importiamo dalla nuova cartella services/gemini (prende index.js in automatico)
import { analyzeExistingRecord } from '../services/gemini/index.js'
import Papa from 'papaparse'

/**
 * Gestisce lo stato del diario (tabella vital_signs)
 */

export const vitals = ref([]) // I record della pagina corrente (RECORD COMPLETI)
export const ecgs = ref([])   // I record con ECG (per la galleria)
export const chartVitals = ref([]) // I record per i grafici (ultimi 20)
export const loading = ref(false)
export const error = ref(null)
export const currentPage = ref(1) // Pagina corrente
export const recordsPerPage = 4 // Record per pagina
export const batchProgress = ref(''); // Per la barra di stato

/**
 * Carica i record dei parametri vitali in modo paginato per la tabella.
 * FILTRO ATTIVO: Solo record che hanno la Pressione Sistolica valorizzata.
 * Questo esclude automaticamente le analisi ECG pure (che hanno solo frequenza).
 */
export async function fetchVitals() {
  if (!userSession.value) {
    console.log('FetchVitals: Utente non loggato, stop.');
    vitals.value = []
    return
  }

  const userId = userSession.value.user.id
  console.log(`FetchVitals: Caricamento pagina ${currentPage.value} per ${userId}`);

  try {
    loading.value = true
    error.value = null

    // Calcoliamo la paginazione
    const from = (currentPage.value - 1) * recordsPerPage
    const to = from + recordsPerPage - 1

    const { data, error: fetchError } = await supabase
      .from('vital_signs')
      .select('*')
      .eq('user_id', userId)
      .not('pressione_sistolica', 'is', null) // <--- FILTRO CHIAVE: Solo record con pressione
      .order('created_at', { ascending: false }) // Dal più recente al più vecchio
      .range(from, to) // PAGINAZIONE

    if (fetchError) throw fetchError

    vitals.value = data || []
    console.log(`FetchVitals: Caricati ${vitals.value.length} record.`);

    // Aggiorna anche i dati per il grafico
    await fetchChartVitals();

  } catch (err) {
    console.error('Errore caricamento vital_signs:', err.message)
    error.value = err.message
  } finally {
    loading.value = false
  }
}

/**
 * Carica gli ultimi 20 record validi per il grafico.
 * NOTA: Qui includiamo tutto (anche ECG) purché abbia dati di pressione.
 */
export async function fetchChartVitals() {
  if (!userSession.value) return;
  const userId = userSession.value.user.id;
  try {
    const { data } = await supabase
      .from('vital_signs')
      .select('created_at, pressione_sistolica, pressione_diastolica, frequenza_cardiaca, saturazione_ossigeno')
      .eq('user_id', userId)
      .not('pressione_sistolica', 'is', null)
      .order('created_at', { ascending: false })
      .limit(20);
    chartVitals.value = (data || []).reverse();
  } catch (err) { console.error(err); }
}

/**
 * Carica solo i record che hanno un ECG (per la galleria)
 */
export async function fetchEcgs() {
  if (!userSession.value) return;
  const userId = userSession.value.user.id;
  try {
    loading.value = true; // Mostriamo loader anche per ECG
    const { data } = await supabase
      .from('vital_signs')
      .select('*')
      .eq('user_id', userId)
      .not('ecg_storage_path', 'is', null)
      .order('created_at', { ascending: false });
    ecgs.value = data || [];
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

//
// --- FUNZIONE PER REPORT GIORNALIERO ---
//
/**
 * Recupera TUTTI i parametri vitali DELLA GIORNATA CORRENTE per il report.
 */
export async function fetchAllVitalsForReport() {
  if (!userSession.value) return [];
  const userId = userSession.value.user.id;

  // Calcola l'inizio della giornata di oggi (00:00:00)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = today.toISOString();

  try {
    const { data, error: fetchError } = await supabase
      .from('vital_signs')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', todayIso) // FILTRO: Solo dati creati dopo la mezzanotte di oggi
      .order('created_at', { ascending: false });

    if (fetchError) throw fetchError;
    return data || [];
  } catch (err) {
    console.error("Errore recupero dati report:", err);
    throw err;
  }
}
// --------------------------------------------------

// Funzioni per cambiare pagina
export function setPage(pageNumber) {
  if (pageNumber < 1) {
    pageNumber = 1;
  }
  currentPage.value = pageNumber;
}

// Watcher: Ricarica i dati quando l'utente cambia (login/logout)
watchEffect(() => {
  if (userSession.value) {
    fetchVitals()
  } else {
    // Se l'utente fa logout, pulisce tutto
    vitals.value = []
    chartVitals.value = []
    ecgs.value = []
    currentPage.value = 1
  }
})

/**
 * Chiede a Lisa di analizzare un record *singolo* già esistente.
 * @param {object} record - L'oggetto record da analizzare
 */
export async function requestAnalysis(record) {
  console.log(`requestAnalysis: Richiesta analisi per ID: ${record.id}`);
  try {
    loading.value = true;
    error.value = null;

    // 1. Chiama il motore (gemini/index.js) per avere il testo
    const commento = await analyzeExistingRecord(record);

    // 2. Aggiorna il DB
    await supabase
      .from('vital_signs')
      .update({ commento_lisa: commento })
      .eq('id', record.id);

    // 3. Ricarica SOLO la lista pertinente
    if (record.ecg_storage_path) {
      await fetchEcgs();
    } else {
      await fetchVitals();
    }

  } catch (err) {
    console.error('Errore in requestAnalysis:', err.message);
    error.value = `Errore Analisi: ${err.message}`;
    throw err;
  } finally {
    loading.value = false;
  }
}

/**
 * Analizza TUTTI i record nel DB che non hanno un commento.
 * (Solo quelli testuali, per ora)
 */
export async function batchAnalyzeRecords() {
  if (!userSession.value) {
    alert("Devi essere loggato.");
    return;
  }

  loading.value = true;
  error.value = null;
  batchProgress.value = 'Ricerca record da analizzare...';

  try {
    // 1. Trova TUTTI i record senza commento (e senza ECG puro)
    const { data: recordsToAnalyze, error: fetchError } = await supabase
      .from('vital_signs')
      .select('*')
      .eq('user_id', userSession.value.user.id)
      .is('commento_lisa', null)
      .is('ecg_storage_path', null);

    if (fetchError) throw fetchError;

    if (!recordsToAnalyze || recordsToAnalyze.length === 0) {
      batchProgress.value = '';
      alert('Nessun record da analizzare!');
      return;
    }

    console.log(`batchAnalyzeRecords: Trovati ${recordsToAnalyze.length} record.`);

    // 2. Loop: Analizza un record alla volta
    for (let i = 0; i < recordsToAnalyze.length; i++) {
      const record = recordsToAnalyze[i];
      batchProgress.value = `Analisi in corso: ${i + 1} di ${recordsToAnalyze.length}`;

      const commento = await analyzeExistingRecord(record);

      await supabase
        .from('vital_signs')
        .update({ commento_lisa: commento })
        .eq('id', record.id);

      // Piccolo delay per non intasare le chiamate
      await new Promise(res => setTimeout(res, 500));
    }

    console.log('batchAnalyzeRecords: Analisi di massa completata.');

    // 3. Ricarica la pagina corrente
    await fetchVitals();

  } catch (err) {
    console.error('Errore in batchAnalyzeRecords:', err.message);
    error.value = `Errore Analisi di Massa: ${err.message}`;
  } finally {
    loading.value = false;
    batchProgress.value = '';
  }
}


//
// --- LOGICA CSV ---
//

/**
 * Legge un file CSV e fa un bulk-insert nel DB.
 */
export async function importCSV(file) {
  if (!userSession.value) {
    error.value = "Utente non loggato.";
    return;
  }
  const userId = userSession.value.user.id;

  loading.value = true;
  error.value = null;

  console.log('importCSV: Avvio parsing...');

  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      transformHeader: header => header.toLowerCase().trim(),

      complete: async (results) => {
        console.log(`importCSV: Parsing completato. ${results.data.length} righe trovate.`);

        if (!results.data || results.data.length === 0) {
          error.value = "File vuoto o formattato male.";
          loading.value = false;
          reject(new Error(error.value));
          return;
        }

        try {
          const recordsToInsert = results.data.map(row => {
            let braccioMappato = null;
            if (row.comment && typeof row.comment === 'string') {
              if (row.comment.toLowerCase().includes('sinistro')) {
                braccioMappato = 'sinistro';
              } else if (row.comment.toLowerCase().includes('destro')) {
                braccioMappato = 'destro';
              }
            }

            return {
              user_id: userId,
              pressione_sistolica: row.systolic || null,
              pressione_diastolica: row.diastolic || null,
              frequenza_cardiaca: row.heartrate || null,
              saturazione_ossigeno: row.oxygen || null,
              created_at: row.measurement_date || new Date(),
              braccio: braccioMappato,
              commento_lisa: null
            };
          });

          console.log(`importCSV: Inserimento di ${recordsToInsert.length} record nel DB...`);

          const { error: insertError } = await supabase
            .from('vital_signs')
            .insert(recordsToInsert);

          if (insertError) throw insertError;

          console.log('importCSV: Importazione completata con successo!');
          await fetchVitals();
          resolve();

        } catch (err) {
          console.error("Errore durante l'importazione CSV:", err);
          error.value = `Errore DB: ${err.message}`;
          reject(err);
        } finally {
          loading.value = false;
        }
      },
      error: (err) => {
        console.error("Errore parsing CSV:", err);
        error.value = `Errore lettura file: ${err.message}`;
        loading.value = false;
        reject(err);
      }
    });
  });
}

/**
 * Esporta TUTTI i record dell'utente in un file CSV.
 */
export async function exportCSV() {
  if (!userSession.value) {
    alert("Devi essere loggato per esportare.");
    return;
  }
  const userId = userSession.value.user.id;

  console.log('exportCSV: Avvio esportazione...');

  try {
    const { data: allVitals, error: fetchError } = await supabase
      .from('vital_signs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (fetchError) throw fetchError;
    if (!allVitals || allVitals.length === 0) {
      alert("Nessun dato da esportare.");
      return;
    }

    console.log(`exportCSV: Trovati ${allVitals.length} record da esportare.`);

    const csvString = Papa.unparse(allVitals);

    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', 'lisasalute_export.csv');
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    console.log('exportCSV: Download avviato.');

  } catch (err) {
    console.error('Errore esportazione CSV:', err);
    alert(`Errore durante l'esportazione: ${err.message}`);
  }
}
