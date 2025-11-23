<template>
  <div class="p-4">
    <h1 class="text-2xl font-semibold mb-4">Diario Parametri</h1>

    <!-- 1. Controlli (CSV e PDF) -->
    <div class="mb-6 flex flex-col sm:flex-row gap-2 flex-wrap">
      <button
        @click="triggerFileInput"
        :disabled="loading || analyzingRecordId"
        class="action-button bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800"
      >
        <font-awesome-icon icon="file-import" class="mr-2" />
        Importa CSV
      </button>

      <input type="file" ref="fileInput" @change="handleFileSelected" accept=".csv" class="hidden" />

      <button
        @click="handleExport"
        :disabled="loading || analyzingRecordId"
        class="action-button bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800"
      >
        <font-awesome-icon icon="file-export" class="mr-2" />
        Esporta CSV
      </button>

      <!-- NUOVO: Bottone PDF -->
      <button
        @click="handleDoctorReport"
        :disabled="loading || analyzingRecordId"
        class="action-button bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-700 dark:hover:bg-indigo-800"
      >
        <font-awesome-icon icon="user-md" class="mr-2" />
        Report PDF
      </button>
    </div>

    <!-- BLOCCO ANALISI DI MASSA -->
    <div class="mb-4">
      <button
        @click="handleBatchAnalysis"
        :disabled="loading || analyzingRecordId"
        class="action-button bg-purple-600 hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-800 w-full sm:w-auto"
      >
        <font-awesome-icon icon="comment-dots" class="mr-2" />
        Analizza tutti i record importati
      </button>
      <p v-if="batchProgress" class="text-sm text-purple-600 dark:text-purple-300 mt-2 animate-pulse">
        {{ batchProgress }}
      </p>
    </div>

    <!-- Messaggi di stato -->
    <div v-if="importError" class="mb-4 p-3 bg-red-100 dark:bg-red-900 border border-red-400 text-red-700 dark:text-red-200 rounded-lg">
      <p><strong>Errore Importazione:</strong> {{ importError }}</p>
    </div>
    <div v-if="importSuccess" class="mb-4 p-3 bg-green-100 dark:bg-green-900 border border-green-400 text-green-700 dark:text-green-200 rounded-lg">
      <p>Importazione riuscita!</p>
    </div>

    <!-- Stato di Caricamento -->
    <div v-if="loading && !analyzingRecordId" class="py-10">
      <Loader />
      <p class="text-center text-gray-500 dark:text-gray-400 mt-2">Caricamento...</p>
    </div>

    <!-- Stato di Errore -->
    <div v-if="error" class="mb-4 p-3 bg-red-100 dark:bg-red-900 border border-red-400 text-red-700 dark:text-red-200 rounded-lg">
      <p><strong>Errore:</strong> {{ error }}</p>
    </div>

    <!-- Nessun Record -->
    <div v-if="!loading && vitals.length === 0" class="text-center text-gray-500 dark:text-gray-400 py-10">
      <font-awesome-icon icon="book-medical" class="text-4xl mb-3" />
      <p>Nessuna misurazione trovata.</p>
    </div>

    <!-- Lista dei Record -->
    <div class="space-y-4">
      <VitalSignCard
        v-for="record in vitals"
        :key="record.id"
        :record="record"
        :is-loading="record.id === analyzingRecordId"
        @request-analysis="handleAnalysis"
      />
    </div>

    <!-- Paginazione -->
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
import { ref, watchEffect } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  vitals,
  loading,
  error,
  currentPage,
  recordsPerPage,
  batchProgress,
  setPage,
  requestAnalysis,
  batchAnalyzeRecords,
  importCSV,
  exportCSV
} from '../store/diary.js';

// --- IMPORT NECESSARI PER PDF ---
import { generateClinicalSummary } from '../services/gemini.js';
import { downloadDoctorReport } from '../utils/pdfGenerator.js';
import { profile } from '../store/profile.js';
// ------------------------------

import Loader from '../components/Loader.vue';
import VitalSignCard from '../components/VitalSignCard.vue';

const route = useRoute();
const router = useRouter();

const fileInput = ref(null);
const importError = ref(null);
const importSuccess = ref(false);
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

// --- LOGICA PDF ---
const handleDoctorReport = async () => {
  if (vitals.value.length === 0) {
    alert("Nessun dato da inserire nel report.");
    return;
  }

  if (!confirm("Vuoi generare un report PDF per il tuo medico? Lisa scriverà una sintesi clinica dei dati visualizzati.")) return;

  // Salviamo lo stato di loading attuale per non sovrascriverlo
  const wasLoading = loading.value;
  loading.value = true;

  try {
    // 1. Genera la sintesi clinica con Gemini
    const summary = await generateClinicalSummary(profile.value, vitals.value);

    // 2. Genera e scarica il PDF
    await downloadDoctorReport(profile.value, vitals.value, summary);

  } catch (e) {
    console.error(e);
    alert("Errore durante la generazione del report.");
  } finally {
    loading.value = wasLoading; // Ripristina o metti a false
    if (!wasLoading) loading.value = false;
  }
};
// -----------------

// --- GESTIONE ANALISI ---
const handleBatchAnalysis = () => {
  if (loading.value || analyzingRecordId.value) return;
  if (confirm("Sei sicuro di voler analizzare TUTTI i record senza commento?")) {
    batchAnalyzeRecords();
  }
}

const handleAnalysis = async (record) => {
  if (loading.value || analyzingRecordId.value) return;
  if (confirm("Sei sicuro di voler chiedere a Lisa un consulto per questo record?")) {
    try {
      analyzingRecordId.value = record.id;
      await requestAnalysis(record);
    } catch (e) {
    } finally {
      analyzingRecordId.value = null;
    }
  }
}

const handleNextPage = () => {
  if (vitals.value.length < recordsPerPage) return;
  const nextPageNumber = currentPage.value + 1;
  router.push(`/diario/${nextPageNumber}`);
};

const handlePrevPage = () => {
  if (currentPage.value <= 1) return;
  const prevPageNumber = currentPage.value - 1;
  router.push(`/diario/${prevPageNumber}`);
};

watchEffect(() => {
  const pageFromUrl = Number(route.params.page) || 1;
  setPage(pageFromUrl);
});
</script>

<style scoped>
.pagination-button {
  @apply px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed;
}
.action-button {
  @apply flex-1 px-4 py-2 text-white font-semibold rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-opacity-75 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[140px];
}
</style>
