import { ref, watchEffect } from 'vue'
import { supabase } from '../supabase'
import { userSession } from './auth.js'
import { analyzeExistingRecord } from '../services/gemini.js'
import Papa from 'papaparse'

/**
 * Gestisce lo stato del diario (tabella vital_signs)
 */

export const vitals = ref([]) // I record della pagina corrente
export const loading = ref(false) // <
export const error = ref(null)
export const currentPage = ref(1) // Pagina corrente
export const recordsPerPage = 4 // Record per pagina (come da roadmap)
export const batchProgress = ref(''); // Per la barra di stato (es. "Analisi 5 di 100")

/**
 * Carica i record dei parametri vitali in modo paginato
 */
export async function fetchVitals() {
  if (!userSession.value) {
    console.log('FetchVitals: Utente non loggato, stop.');
    vitals.value = []
    return
  }

  const userId = userSession.value.user.id
  // Ora il log mostra la pagina che STA caricando
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
      .order('created_at', { ascending: false }) // Dal più recente al più vecchio
      .range(from, to) // PAGINAZIONE

    if (fetchError) throw fetchError

    vitals.value = data || []
    console.log(`FetchVitals: Caricati ${vitals.value.length} record.`);

  } catch (err) {
    console.error('Errore caricamento vital_signs:', err.message)
    error.value = err.message
  } finally {
    loading.value = false
  }
}

//
// --- MODIFICA CHIAVE ---
// Rimosse nextPage e prevPage.
// Aggiunta 'setPage' per essere controllati dall'URL.
//
/**
 * Imposta la pagina corrente (chiamato dal componente)
 * @param {number} pageNumber
 */
export function setPage(pageNumber) {
  if (pageNumber < 1) {
    pageNumber = 1;
  }
  currentPage.value = pageNumber;
}
// -----------------------

// Watcher: Ricarica i dati quando l'utente cambia
// (o quando cambia la pagina, grazie a setPage)
watchEffect(() => {
  if (userSession.value) {
    fetchVitals()
  } else {
    // Se l'utente fa logout, pulisce il diario
    vitals.value = []
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
    error.value = null;

    // 1. Chiama il motore (gemini.js) per avere il testo
    const commento = await analyzeExistingRecord(record);

    // 2. Aggiorna il DB
    await supabase
      .from('vital_signs')
      .update({ commento_lisa: commento })
      .eq('id', record.id);

    // 3. Ricarica i dati del diario
    await fetchVitals();

  } catch (err) {
    console.error('Errore in requestAnalysis:', err.message);
    error.value = `Errore Analisi: ${err.message}`;
    // Rilancia l'errore così DiaryPage.vue può fermare il loader
    throw err;
  }
}

/**
 * Analizza TUTTI i record nel DB che non hanno un commento.
 */
export async function batchAnalyzeRecords() {
  if (!userSession.value) {
    alert("Devi essere loggato.");
    return;
  }

  console.log('batchAnalyzeRecords: Avvio analisi di massa...');
  loading.value = true;
  error.value = null;
  batchProgress.value = 'Ricerca record da analizzare...';

  try {
    // 1. Trova TUTTI i record senza commento
    const { data: recordsToAnalyze, error: fetchError } = await supabase
      .from('vital_signs')
      .select('*')
      .eq('user_id', userSession.value.user.id)
      .is('commento_lisa', null); // Dove il commento è NULL

    if (fetchError) throw fetchError;

    if (!recordsToAnalyze || recordsToAnalyze.length === 0) {
      batchProgress.value = '';
      alert('Nessun record (solo testo) da analizzare!');
      return;
    }

    console.log(`batchAnalyzeRecords: Trovati ${recordsToAnalyze.length} record.`);

    // 2. Loop: Analizza un record alla volta (per non sovraccaricare l'API)
    for (let i = 0; i < recordsToAnalyze.length; i++) {
      const record = recordsToAnalyze[i];
      batchProgress.value = `Analisi in corso: ${i + 1} di ${recordsToAnalyze.length}`;
      console.log(batchProgress.value);

      // 2a. Chiama il motore per il testo
      const commento = await analyzeExistingRecord(record);

      // 2b. Aggiorna il record nel DB
      await supabase
        .from('vital_signs')
        .update({ commento_lisa: commento })
        .eq('id', record.id);

      // Piccola pausa per non superare i rate limit dell'API
      await new Promise(res => setTimeout(res, 500)); // 0.5 sec di pausa
    }

    console.log('batchAnalyzeRecords: Analisi di massa completata.');

    // 3. Ricarica la pagina corrente
    await fetchVitals();

  } catch (err) {
    console.error('Errore in batchAnalyzeRecords:', err.message);
    error.value = `Errore Analisi di Massa: ${err.message}`;
  } finally {
    loading.value = false;
    batchProgress.value = ''; // Resetta la progress bar
  }
}


//
// --- LOGICA CSV (Invariata) ---
//
/**
 * Legge un file CSV e fa un bulk-insert nel DB.
 * @param {File} file - Il file CSV caricato dall'utente
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

      // Funzione chiamata al completamento
      complete: async (results) => {
        console.log(`importCSV: Parsing completato. ${results.data.length} righe trovate.`);

        if (!results.data || results.data.length === 0) {
          error.value = "File vuoto o formattato male.";
          loading.value = false;
          reject(new Error(error.value));
          return;
        }

        try {
          // --- MAPPATURA (Basata sui Nomi dell'Header) ---
          const recordsToInsert = results.data.map(row => {

            // --- Logica speciale per il Braccio ---
            let braccioMappato = null;
            // Cerca nel campo 'comment' (ora minuscolo)
            if (row.comment && typeof row.comment === 'string') {
              if (row.comment.toLowerCase().includes('sinistro')) {
                braccioMappato = 'sinistro';
              } else if (row.comment.toLowerCase().includes('destro')) {
                braccioMappato = 'destro';
              }
            }
            // ------------------------------------

            return {
              user_id: userId,
              // NOME NUOVO  <-- NOME COLONNA (tutto minuscolo)
              pressione_sistolica: row.systolic || null,
              pressione_diastolica: row.diastolic || null,
              frequenza_cardiaca: row.heartrate || null,
              saturazione_ossigeno: row.oxygen || null,
              created_at: row.measurement_date || new Date(),
              braccio: braccioMappato,
              commento_lisa: null
            };
          });
          // --- FINE MAPPATURA ---

          console.log(`importCSV: Inserimento di ${recordsToInsert.length} record nel DB...`);

          // Esegui il bulk insert
          const { error: insertError } = await supabase
            .from('vital_signs')
            .insert(recordsToInsert);

          if (insertError) throw insertError;

          console.log('importCSV: Importazione completata con successo!');
          await fetchVitals(); // Ricarica i dati
          resolve();

        } catch (err) {
          console.error("Errore durante l'importazione CSV:", err);
          error.value = `Errore DB: ${err.message}`;
          reject(err);
        } finally {
          loading.value = false;
        }
      },
      // Funzione chiamata in caso di errore di parsing
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
    // 1. Carica TUTTI i dati (senza paginazione)
    const { data: allVitals, error: fetchError } = await supabase
      .from('vital_signs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true }); // Dal più vecchio

    if (fetchError) throw fetchError;
    if (!allVitals || allVitals.length === 0) {
      alert("Nessun dato da esportare.");
      return;
    }

    console.log(`exportCSV: Trovati ${allVitals.length} record da esportare.`);

    // 2. Converti i dati in formato CSV
    const csvString = Papa.unparse(allVitals);

    // 3. Crea un "blob" e simula un clic per il download
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
