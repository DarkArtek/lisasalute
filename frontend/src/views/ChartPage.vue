<template>
  <div class="p-4 max-w-4xl mx-auto">
    <h1 class="text-2xl font-semibold mb-6 text-center">Andamento Salute</h1>

    <!-- DASHBOARD STATO SETTIMANALE (NUOVO) -->
    <div v-if="weeklyStats" class="mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">

      <!-- Card Media -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border-l-8" :class="statusColorClass">
        <h2 class="text-sm uppercase tracking-wide text-gray-500 dark:text-gray-400 font-bold mb-1">
          Media Ultimi 7 Giorni
        </h2>
        <div class="flex items-baseline">
          <span class="text-4xl font-extrabold text-gray-800 dark:text-white">
            {{ weeklyStats.avgSys }}<span class="text-xl text-gray-400 font-normal">/</span>{{ weeklyStats.avgDia }}
          </span>
          <span class="ml-2 text-sm text-gray-500">mmHg</span>
        </div>
        <div class="mt-4">
          <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium" :class="statusBadgeClass">
            <font-awesome-icon :icon="statusIcon" class="mr-2" />
            {{ weeklyStats.status }}
          </span>
        </div>
      </div>

      <!-- Card Feedback -->
      <div class="bg-blue-50 dark:bg-gray-700 rounded-xl shadow-md p-6 flex flex-col justify-center">
        <h3 class="font-bold text-blue-800 dark:text-blue-200 mb-2">
          <font-awesome-icon icon="user-md" class="mr-2" />
          Il Consiglio della dottoressa
        </h3>
        <p class="text-sm text-blue-900 dark:text-blue-100 italic">
          "{{ feedbackMessage }}"
        </p>
        <p class="text-xs text-blue-400 dark:text-blue-300 mt-4 text-right">
          Basato su {{ weeklyStats.count }} misurazioni
        </p>
      </div>

    </div>

    <!-- Loader Statistiche -->
    <div v-else-if="loadingStats" class="py-10 flex justify-center">
      <Loader />
    </div>

    <!-- Stato Vuoto Statistiche -->
    <div v-else class="mb-8 p-6 bg-gray-100 dark:bg-gray-800 rounded-xl text-center text-gray-500">
      <p>Nessun dato sufficiente negli ultimi 7 giorni per calcolare la media.</p>
    </div>

    <!-- GRAFICO STORICO (ESISTENTE) -->
    <VitalsChart />

    <div class="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
      <p class="mb-2 font-semibold">Legenda Grafico:</p>
      <ul class="list-disc list-inside space-y-1 ml-2">
        <li><span class="text-red-500 font-bold">●</span> Pressione Sistolica (Massima)</li>
        <li><span class="text-orange-500 font-bold">●</span> Pressione Diastolica (Minima)</li>
        <li><span class="text-blue-500 font-bold">--</span> Frequenza Cardiaca (Tratteggiata)</li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import VitalsChart from '../components/VitalsChart.vue';
import Loader from '../components/Loader.vue';
import { fetchChartVitals } from '../store/diary.js';
import { getWeeklyStats } from '../services/gemini/dataService.js'; // Importiamo il servizio
import { userSession } from '../store/auth.js';

const weeklyStats = ref(null);
const loadingStats = ref(true);

// Logica Colori e Icone
const statusColorClass = computed(() => {
  switch (weeklyStats.value?.status) {
    case 'Ottimale': return 'border-green-500';
    case 'Normale': return 'border-green-400';
    case 'Normale-Alta': return 'border-yellow-400';
    default: return 'border-red-500';
  }
});

const statusBadgeClass = computed(() => {
  switch (weeklyStats.value?.status) {
    case 'Ottimale': return 'bg-green-100 text-green-800';
    case 'Normale': return 'bg-green-50 text-green-700';
    case 'Normale-Alta': return 'bg-yellow-100 text-yellow-800';
    default: return 'bg-red-100 text-red-800';
  }
});

const statusIcon = computed(() => {
  switch (weeklyStats.value?.status) {
    case 'Ottimale': case 'Normale': return 'check-circle';
    case 'Normale-Alta': return 'exclamation-circle';
    default: return 'heart-pulse';
  }
});

const feedbackMessage = computed(() => {
  switch (weeklyStats.value?.status) {
    case 'Ottimale':
      return "Eccellente! I tuoi valori sono perfetti. Continua così con la terapia e lo stile di vita.";
    case 'Normale':
      return "Tutto sotto controllo. La pressione è nei limiti di sicurezza.";
    case 'Normale-Alta':
      return "Attenzione, siamo ai limiti superiori. Cerca di monitorare con più costanza e adatta il tuo stile di vita.";
    case 'Ipertensione (Possibile non controllata)':
      return "La media settimanale è alta. Ti consiglio di parlarne col tuo medico per valutare la terapia.";
    default:
      return "Continua a misurare per avere un quadro più chiaro.";
  }
});

onMounted(async () => {
  // 1. Carica dati grafico (store)
  fetchChartVitals();

  // 2. Calcola statistiche settimanali (service)
  if (userSession.value) {
    try {
      loadingStats.value = true;
      weeklyStats.value = await getWeeklyStats(userSession.value.user.id);
    } catch (e) {
      console.error("Errore statistiche:", e);
    } finally {
      loadingStats.value = false;
    }
  }
});
</script>
