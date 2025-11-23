import { ref, watchEffect } from 'vue'
import { supabase } from '../supabase'
import { userSession } from './auth.js'
import { analyzeExistingRecord } from '../services/gemini.js'
import Papa from 'papaparse'

/**
 * Gestisce lo stato del diario (tabella vital_signs)
 */

export const vitals = ref([]) // Record della pagina corrente (Tabella)
export const chartVitals = ref([]) // Record per il grafico (Storico recente)
export const loading = ref(false)
export const error = ref(null)
export const currentPage = ref(1)
export const recordsPerPage = 4
export const batchProgress = ref('');

/**
 * Carica i record paginati per la tabella
 */
export async function fetchVitals() {
  if (!userSession.value) {
    vitals.value = []
    return
  }

  const userId = userSession.value.user.id

  try {
    loading.value = true
    error.value = null

    const from = (currentPage.value - 1) * recordsPerPage
    const to = from + recordsPerPage - 1

    const { data, error: fetchError } = await supabase
      .from('vital_signs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (fetchError) throw fetchError

    vitals.value = data || []

    // --- NUOVO: Carica anche i dati per il grafico ---
    // Lo facciamo qui per semplicità, ogni volta che i dati cambiano
    await fetchChartVitals();

  } catch (err) {
    console.error('Errore caricamento vital_signs:', err.message)
    error.value = err.message
  } finally {
    loading.value = false
  }
}

/**
 * --- NUOVA FUNZIONE ---
 * Carica gli ultimi 20 record validi per il grafico
 */
export async function fetchChartVitals() {
  if (!userSession.value) return;
  const userId = userSession.value.user.id;

  try {
    // Prendiamo gli ultimi 20 record
    const { data, error: chartError } = await supabase
      .from('vital_signs')
      .select('created_at, pressione_sistolica, pressione_diastolica, frequenza_cardiaca, saturazione_ossigeno')
      .eq('user_id', userId)
      // Escludiamo record vuoti (solo ECG o solo commenti)
      .not('pressione_sistolica', 'is', null)
      .order('created_at', { ascending: false })
      .limit(20); // Ultimi 20 punti

    if (chartError) throw chartError;

    // Invertiamo l'array perché il grafico vuole i dati dal più vecchio al più nuovo (sx -> dx)
    chartVitals.value = (data || []).reverse();

  } catch (err) {
    console.error("Errore caricamento dati grafico:", err);
  }
}

// ... (setPage, requestAnalysis, batchAnalyzeRecords rimangono invariati)
export function setPage(pageNumber) {
  if (pageNumber < 1) pageNumber = 1;
  currentPage.value = pageNumber;
}

watchEffect(() => {
  if (userSession.value) {
    fetchVitals()
  } else {
    vitals.value = []
    chartVitals.value = [] // Reset grafico
    currentPage.value = 1
  }
})

export async function requestAnalysis(record) {
  // ... (invariato)
  try {
    error.value = null;
    const commento = await analyzeExistingRecord(record);
    await supabase
      .from('vital_signs')
      .update({ commento_lisa: commento })
      .eq('id', record.id);
    await fetchVitals();
  } catch (err) {
    console.error('Errore in requestAnalysis:', err.message);
    error.value = `Errore Analisi: ${err.message}`;
    throw err;
  }
}

export async function batchAnalyzeRecords() {
  // ... (invariato)
  // ... (codice lungo della funzione batchAnalyzeRecords che abbiamo già scritto)
  // ... Assicurati di mantenere tutto il corpo della funzione come nel file precedente
  if (!userSession.value) { alert("Devi essere loggato."); return; }

  loading.value = true;
  batchProgress.value = 'Ricerca record...';

  try {
    const { data: recordsToAnalyze } = await supabase
      .from('vital_signs')
      .select('*')
      .eq('user_id', userSession.value.user.id)
      .is('commento_lisa', null)
      .is('ecg_storage_path', null); // Ignoriamo ECG puri

    if (!recordsToAnalyze || recordsToAnalyze.length === 0) {
      batchProgress.value = '';
      alert('Nessun record da analizzare!');
      return;
    }

    for (let i = 0; i < recordsToAnalyze.length; i++) {
      const record = recordsToAnalyze[i];
      batchProgress.value = `Analisi: ${i + 1} / ${recordsToAnalyze.length}`;
      const commento = await analyzeExistingRecord(record);
      await supabase.from('vital_signs').update({ commento_lisa: commento }).eq('id', record.id);
      await new Promise(res => setTimeout(res, 500));
    }
    await fetchVitals();
  } catch (err) {
    error.value = `Errore Batch: ${err.message}`;
  } finally {
    loading.value = false;
    batchProgress.value = '';
  }
}

export async function importCSV(file) {
  // ... (Logica import CSV invariata)
  // ... (Ricopia la funzione importCSV dal file precedente per completezza)
  if (!userSession.value) return;
  const userId = userSession.value.user.id;
  loading.value = true;

  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      transformHeader: header => header.toLowerCase().trim(),
      complete: async (results) => {
        try {
          const recordsToInsert = results.data.map(row => {
            // Mappatura... (invariata)
            let braccioMappato = null;
            if (row.comment && typeof row.comment === 'string') {
              if (row.comment.toLowerCase().includes('sinistro')) braccioMappato = 'sinistro';
              else if (row.comment.toLowerCase().includes('destro')) braccioMappato = 'destro';
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

          const { error: insertError } = await supabase.from('vital_signs').insert(recordsToInsert);
          if (insertError) throw insertError;
          await fetchVitals();
          resolve();
        } catch (err) {
          error.value = `Errore DB: ${err.message}`;
          reject(err);
        } finally {
          loading.value = false;
        }
      },
      error: (err) => { loading.value = false; reject(err); }
    });
  });
}

export async function exportCSV() {
  // ... (Logica export CSV invariata)
  // ... (Ricopia la funzione exportCSV dal file precedente)
  if (!userSession.value) return;
  const userId = userSession.value.user.id;
  try {
    const { data: allVitals } = await supabase
      .from('vital_signs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (!allVitals || allVitals.length === 0) { alert("Nessun dato."); return; }

    const csvString = Papa.unparse(allVitals);
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'lisasalute_export.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    alert(`Errore: ${err.message}`);
  }
}
