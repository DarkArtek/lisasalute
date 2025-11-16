<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 border-l-4" :class="borderColor">

    <!-- Data e Ora -->
    <div class="mb-3 flex justify-between items-center">
      <div>
        <span class="font-semibold text-lg text-gray-800 dark:text-gray-100">Misurazione</span>
        <span class="block text-sm text-gray-500 dark:text-gray-400">{{ formattedDate }}</span>
      </div>
      <!--
        --- NUOVO ---
        Mostra un'icona se c'è un ECG
      -->
      <div v-if="record.ecg_storage_path" class="flex items-center text-xs text-purple-600 dark:text-purple-300 bg-purple-100 dark:bg-purple-900 px-2 py-1 rounded-full">
        <font-awesome-icon icon="heartbeat" class="mr-1" />
        ECG Allegato
      </div>
    </div>

    <!-- Parametri -->
    <div class="grid grid-cols-2 gap-x-4 gap-y-2 mb-4">

      <!-- Pressione -->
      <div v-if="record.pressione_sistolica" class="flex items-center">
        <font-awesome-icon icon="heart-pulse" class="text-red-500 mr-2" />
        <div>
          <span class="text-sm text-gray-600 dark:text-gray-300">Pressione</span>
          <span class="block font-bold text-gray-900 dark:text-white">
            {{ record.pressione_sistolica || 'N/A' }} / {{ record.pressione_diastolica || 'N/A' }}
            <span class="text-xs">mmHg</span>
          </span>
        </div>
      </div>

      <!-- Frequenza -->
      <div v-if="record.frequenza_cardiaca" class="flex items-center">
        <font-awesome-icon icon="heart-pulse" class="text-blue-500 mr-2" />
        <div>
          <span class="text-sm text-gray-600 dark:text-gray-300">Frequenza</span>
          <span class="block font-bold text-gray-900 dark:text-white">
            {{ record.frequenza_cardiaca || 'N/A' }} <span class="text-xs">bpm</span>
          </span>
        </div>
      </div>

      <!-- Saturazione -->
      <div v-if="record.saturazione_ossigeno" class="flex items-center">
        <font-awesome-icon icon="heart-pulse" class="text-green-500 mr-2" />
        <div>
          <span class="text-sm text-gray-600 dark:text-gray-300">Saturazione</span>
          <span class="block font-bold text-gray-900 dark:text-white">
            {{ record.saturazione_ossigeno || 'N/A' }} <span class="text-xs">%</span>
          </span>
        </div>
      </div>

      <!-- Braccio -->
      <div v-if="record.braccio" class="flex items-center">
        <font-awesome-icon icon="user" class="text-gray-500 mr-2" />
        <div>
          <span class="text-sm text-gray-600 dark:text-gray-300">Braccio</span>
          <span class="block font-bold text-gray-900 dark:text-white capitalize">
            {{ record.braccio || 'N/A' }}
          </span>
        </div>
      </div>
    </div>

    <!-- Commento di Lisa -->
    <div class="border-t border-gray-200 dark:border-gray-700 pt-3">
      <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Commento di Lisa:</h4>

      <!-- Se c'è il commento -->
      <p
        v-if="record.commento_lisa"
        class="text-sm text-gray-600 dark:text-gray-400 italic"
        v-html="formattedComment"
      ></p>

      <!-- Loader locale -->
      <div
        v-else-if="isLoading"
        class="py-2"
      >
        <Loader />
        <p class="text-xs text-center text-gray-500 dark:text-gray-400 -mt-4">Lisa sta analizzando...</p>
      </div>

      <!-- Se manca il commento E non sta caricando -->
      <button
        v-else
        @click="$emit('request-analysis', record)"
        class="text-sm w-full px-3 py-2 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200 rounded-md hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
      >
        <font-awesome-icon icon="comment-dots" class="mr-1" />
        Chiedi un consulto a Lisa
      </button>
    </div>

  </div>
</template>

<script setup>
import { computed } from 'vue';
import Loader from '../components/Loader.vue';
import { marked } from 'marked'

const emit = defineEmits(['request-analysis'])

const props = defineProps({
  record: {
    type: Object,
    required: true
  },
  isLoading: {
    type: Boolean,
    default: false
  }
});

// Formattiamo la data
const formattedDate = computed(() => {
  return new Date(props.record.created_at).toLocaleString('it-IT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
});

// Colore bordo
const borderColor = computed(() => {
  const s = props.record.pressione_sistolica;
  if (s >= 160) return 'border-red-600';
  if (s >= 140) return 'border-orange-500';
  if (s >= 130) return 'border-yellow-500';
  if (s > 0) return 'border-green-500';
  return 'border-gray-400';
});

// Formattazione Markdown
const formattedComment = computed(() => {
  if (!props.record.commento_lisa) return '';
  return marked(props.record.commento_lisa);
});

</script>

<style scoped>
.dark .text-gray-600 {
  color: #d1d5db;
}
</style>
