<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-6">
    <h3 class="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200">Andamento Parametri (Ultimi 20)</h3>

    <div class="relative h-64 w-full">
      <!-- Il grafico viene renderizzato qui se ci sono dati -->
      <Line v-if="chartData.labels.length > 0" :data="chartData" :options="chartOptions" />

      <!-- Messaggio vuoto -->
      <div v-else class="flex items-center justify-center h-full text-gray-400 text-sm">
        Dati insufficienti per il grafico
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { chartVitals } from '../store/diary.js' // Importiamo i dati dello storico

// Importiamo i componenti di vue-chartjs e chart.js
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js'

// Registriamo i moduli necessari di Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
)

// Configuriamo i dati del grafico
const chartData = computed(() => {
  // 1. Estraiamo le etichette (Date)
  const labels = chartVitals.value.map(v => {
    const d = new Date(v.created_at);
    return `${d.getDate()}/${d.getMonth()+1}`; // Formato "DD/MM"
  });

  // 2. Estraiamo i valori
  const sysData = chartVitals.value.map(v => v.pressione_sistolica);
  const diaData = chartVitals.value.map(v => v.pressione_diastolica);
  const hrData = chartVitals.value.map(v => v.frequenza_cardiaca);
  const oxyData = chartVitals.value.map(v => v.saturazione_ossigeno);

  return {
    labels,
    datasets: [
      {
        label: 'Sistolica',
        backgroundColor: '#EF4444', // Red-500
        borderColor: '#EF4444',
        data: sysData,
        tension: 0.3
      },
      {
        label: 'Diastolica',
        backgroundColor: '#F97316', // Orange-500
        borderColor: '#F97316',
        data: diaData,
        tension: 0.3
      },
      {
        label: 'Frequenza',
        backgroundColor: '#3B82F6', // Blue-500
        borderColor: '#3B82F6',
        data: hrData,
        borderDash: [5, 5], // Linea tratteggiata per distinguerla
        tension: 0.3
      },
      {
        label: 'Saturazione',
        backgroundColor: '#10B981', // Green-500
        borderColor: '#10B981',
        data: oxyData,
        hidden: true, // Nascondiamo di default perché la scala è diversa (90-100 vs 60-140)
        tension: 0.3
      }
    ]
  }
})

// Opzioni del grafico (Responsive, colori scuri/chiari)
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    y: {
      beginAtZero: false, // Non partire da 0, focalizzati sui valori (es. 60-140)
      grid: {
        color: '#374151' // Grigio scuro per la griglia (adatto a dark mode)
      }
    },
    x: {
      grid: {
        display: false
      }
    }
  },
  plugins: {
    legend: {
      position: 'bottom'
    }
  }
}
</script>
