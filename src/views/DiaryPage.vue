<template>
  <div class="p-4">
    <h1 class="text-2xl font-semibold mb-4">Diario Parametri</h1>

    <!-- 1. Controlli (CSV) -->
    <div class="mb-4 flex flex-col sm:flex-row gap-2">
      <!-- Bottone Importa -->
      <button
        @click="triggerFileInput"
        :disabled="loading || analyzingRecordId"
        class="action-button bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800"
      >
        <font-awesome-icon icon="file-import" class="mr-2" />
        Importa CSV
      </button>

      <!-- Input File Nascosto -->
      <input
        type="file"
        ref="fileInput"
        @change="handleFileSelected"
        accept=".csv"
        class="hidden"
      />

      <!-- Bottone Esporta -->
      <button
        @click="handleExport"
        :disabled="loading || analyzingRecordId"
        class="action-button bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800"
      >
        <font-awesome-icon icon="file-export" class="mr-2" />
        Esporta CSV
      </button>
    </div>

    <!--
      --- BLOCCO ANALISI DI MASSA ---
    -->
    <div class="mb-4">
      <button
        @click="handleBatchAnalysis"
        :disabled="loading || analyzingRecordId"
        class="action-button bg-purple-600 hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-800"
      >
        <font-awesome-icon icon="comment-dots" class="mr-2" />
        Analizza tutti i record importati
      </button>
      <!-- Mostra lo stato di avanzamento -->
      <p v-if="batchProgress" class="text-sm text-purple-600 dark:text-purple-300 mt-2 animate-pulse">
        {{ batchProgress }}
      </p>
    </div>
    <!-- --- FINE BLOCCO --- -->

    <!-- Messaggio di stato Import/Export -->
    <div v-if="importError" class="mb-4 p-3 bg-red-100 dark:bg-red-900 border border-red-400 text-red-700 dark:text-red-200 rounded-lg">
      <p><strong>Errore Importazione:</strong> {{ importError }}</p>
    </div>
    <div v-if="importSuccess" class="mb-4 p-3 bg-green-100 dark:bg-green-900 border border-green-400 text-green-700 dark:text-green-200 rounded-lg">
      <p>Importazione riuscita!</p>
    </div>


    <!-- 2. Stato di Caricamento (Generale) -->
    <div v-if="loading && !analyzingRecordId" class="py-10">
      <Loader />
      <p class="text-center text-gray-500 dark:text-gray-400 mt-2">Caricamento...</p>
    </div>

    <!-- 3. Stato di Errore (Generale) -->
    <div v-if="error" class="mb-4 p-3 bg-red-100 dark:bg-red-900 border border-red-400 text-red-700 dark:text-red-200 rounded-lg">
      <p><strong>Errore:</strong> {{ error }}</p>
    </div>

    <!-- 4. Nessun Record Trovato -->
    <div v-if="!loading && vitals.length === 0" class="text-center text-gray-500 dark:text-gray-400 py-10">
      <font-awesome-icon icon="book-medical" class="text-4xl mb-3" />
      <p>Nessuna misurazione trovata.</p>
      <p class="text-sm">I dati che inserisci nella chat appariranno qui.</p>
    </div>

    <!-- 5. Lista dei Record (Card) -->
    <div class="space-y-4">
      <VitalSignCard
        v-for="record in vitals"
        :key="record.id"
        :record="record"
        :is-loading="record.id === analyzingRecordId"
        @request-analysis="handleAnalysis"
      />
    </div>

    <!-- 6. Paginazione -->
    <div class="mt-6 flex justify-between items-center">
      <button
        @click="handlePrevPage"
        :disabled="currentPage === 1 || loading || analyzingRecordId"
        class="pagination-button"
      >
        Precedente
      </button>

      <span class="text-sm text-gray-600 dark:text-gray-400">
        Pagina {{ currentPage }}
      </span>

      <button
        @click="handleNextPage"
        :disabled="vitals.length < recordsPerPage || loading || analyzingRecordId"
        class="pagination-button"
      >
        Successiva
      </button>
    </div>

  </div>
</template>

<script setup>
// --- MODIFICA ---
import { ref, watchEffect } from 'vue'; // Aggiunto watchEffect
import { useRoute, useRouter } from 'vue-router'; // Aggiunti
// ----------------

// Importiamo il nuovo store del diario
import {
  vitals,
  loading,
  error,
  currentPage,
  recordsPerPage,
  batchProgress,
  setPage, // <-- MODIFICA
  requestAnalysis,
  batchAnalyzeRecords,
  importCSV,
  exportCSV
} from '../store/diary.js';

// Importiamo i componenti
import Loader from '../components/Loader.vue';
import VitalSignCard from '../components/VitalSignCard.vue';

// --- MODIFICA ---
// Inizializza router e route
const route = useRoute();
const router = useRouter();
// ----------------

// Riferimento all'input file nascosto
const fileInput = ref(null);

// Stati per l'importazione
const importError = ref(null);
const importSuccess = ref(false);

// Stato di caricamento locale per l'analisi di *un* record
const analyzingRecordId = ref(null);

// --- LOGICA CSV ---
const triggerFileInput = () => {
  importError.value = null;
  importSuccess.value = false;
  fileInput.value.click();
};

const handleFileSelected = async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  try {
    await importCSV(file);
    importSuccess.value = true;
  } catch (err) {
    importError.value = err.message || "Errore sconosciuto";
  }

  event.target.value = null;
};

const handleExport = () => {
  exportCSV();
};
// --- FINE LOGICA CSV ---

// --- GESTIONE ANALISI (Singola e Massa) ---
const handleBatchAnalysis = () => {
  if (loading.value || analyzingRecordId.value) return;

  if (confirm("Sei sicuro di voler analizzare TUTTI i record senza commento? Potrebbe richiedere diversi minuti.")) {
    batchAnalyzeRecords();
  }
}

const handleAnalysis = async (record) => {
  if (loading.value || analyzingRecordId.value) return;

  if (confirm("Sei sicuro di voler chiedere a Lisa un consulto per questo record?")) {
    try {
      analyzingRecordId.value = record.id; // Imposta il loader locale
      await requestAnalysis(record); // Chiama lo store
    } catch (e) {
      // L'errore è già gestito (e mostrato) dallo store
    } finally {
      analyzingRecordId.value = null; // Rimuovi il loader locale
    }
  }
}

//
// --- MODIFICA: LOGICA DI PAGINAZIONE ---
//
// Ora i bottoni cambiano l'URL.
//
const handleNextPage = () => {
  if (vitals.value.length < recordsPerPage) return; // Già all'ultima pagina
  const nextPageNumber = currentPage.value + 1;
  router.push(`/diario/${nextPageNumber}`);
};

const handlePrevPage = () => {
  if (currentPage.value <= 1) return; // Già alla prima pagina
  const prevPageNumber = currentPage.value - 1;
  router.push(`/diario/${prevPageNumber}`);
};

//
// --- MODIFICA: WATCHER ---
//
// Questo "ascolta" l'URL (route.params.page)
// e dice allo store di cambiare pagina.
// Gestisce il caricamento iniziale E i click sui bottoni Indietro/Avanti.
//
watchEffect(() => {
  // Converte il parametro URL in un numero.
  // Se l'URL è solo /diario, params.page sarà 'undefined',
  // e 'Number(undefined) || 1' restituirà 1.
  const pageFromUrl = Number(route.params.page) || 1;

  // Aggiorna lo store (che poi farà ri-partire fetchVitals)
  setPage(pageFromUrl);
});
</script>

<style scoped>
.pagination-button {
  @apply px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed;
}

/* Stile per i nuovi bottoni CSV */
.action-button {
  @apply w-full sm:w-auto flex-1 sm:flex-none px-4 py-2 text-white font-semibold rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-opacity-75 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center;
}
</style>
