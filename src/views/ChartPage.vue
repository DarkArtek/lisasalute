<template>
  <div class="p-4">
    <h1 class="text-2xl font-semibold mb-6 text-center">Andamento Salute</h1>

    <!-- Il componente Grafico -->
    <VitalsChart />

    <div class="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm text-gray-600 dark:text-gray-300">
      <p class="mb-2"><strong>Nota:</strong> Questo grafico mostra l'andamento delle tue ultime 20 misurazioni valide.</p>
      <ul class="list-disc list-inside space-y-1">
        <li><span class="text-red-500 font-bold">●</span> Pressione Sistolica (Massima)</li>
        <li><span class="text-orange-500 font-bold">●</span> Pressione Diastolica (Minima)</li>
        <li><span class="text-blue-500 font-bold">--</span> Frequenza Cardiaca (Tratteggiata)</li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import VitalsChart from '../components/VitalsChart.vue';
import { onMounted } from 'vue';
import { fetchChartVitals } from '../store/diary.js';

// Assicuriamoci che i dati del grafico siano aggiornati quando si apre la pagina
onMounted(() => {
  fetchChartVitals();
});
</script>
