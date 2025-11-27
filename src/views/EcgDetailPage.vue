<template>
  <div class="p-4 pb-24 max-w-4xl mx-auto">

    <button @click="$router.back()" class="mb-4 text-purple-600 hover:text-purple-800 flex items-center font-medium">
      <span class="mr-2">←</span> Torna alla Galleria
    </button>

    <div v-if="loading" class="py-20 flex justify-center">
      <Loader />
    </div>

    <div v-else-if="error" class="p-4 bg-red-100 text-red-700 rounded-lg">
      {{ error }}
    </div>

    <div v-else-if="record" class="bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden">

      <div class="p-4 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <div>
          <h1 class="text-xl font-bold text-gray-800 dark:text-gray-100">Analisi Tracciato</h1>
          <p class="text-sm text-gray-500 dark:text-gray-400">Del {{ formatDate(record.created_at) }}</p>
        </div>
        <div v-if="record.frequenza_cardiaca" class="text-center">
          <span class="block text-2xl font-bold text-red-600">{{ record.frequenza_cardiaca }}</span>
          <span class="text-xs text-gray-500 uppercase font-semibold">BPM</span>
        </div>
      </div>

      <div class="bg-black p-4 flex justify-center min-h-[300px]">
        <img
          v-if="signedUrl"
          :src="signedUrl"
          class="max-w-full max-h-[500px] object-contain rounded border border-gray-700"
          alt="Tracciato ECG"
        />
        <div v-else class="flex items-center text-gray-500">
          <p>Immagine non disponibile o scaduta.</p>
        </div>
      </div>

      <div class="p-6">
        <h2 class="text-lg font-semibold text-purple-700 dark:text-purple-400 mb-4 flex items-center">
          <font-awesome-icon icon="user-md" class="mr-2" />
          Il Parere di Lisa
        </h2>

        <div v-if="record.commento_lisa" class="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 leading-relaxed">
          <div v-html="formattedComment"></div>
        </div>

        <div v-else class="text-center py-8 bg-gray-50 dark:bg-gray-900 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
          <p class="text-gray-500 mb-4">Nessuna analisi presente per questo tracciato.</p>
          <button
            @click="handleAnalyze"
            :disabled="analyzing"
            class="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-full shadow transition-all disabled:opacity-50"
          >
            {{ analyzing ? 'Analisi in corso...' : 'Chiedi a Lisa di analizzare ora' }}
          </button>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { supabase } from '../supabase';
import { requestAnalysis } from '../store/diary';
import { marked } from 'marked';
import Loader from '../components/Loader.vue';

const route = useRoute();
const record = ref(null);
const loading = ref(true);
const analyzing = ref(false);
const error = ref(null);
const signedUrl = ref(null);

const formattedComment = computed(() => {
  return record.value?.commento_lisa ? marked(record.value.commento_lisa) : '';
});

const formatDate = (isoStr) => {
  return new Date(isoStr).toLocaleString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
};

const fetchRecord = async () => {
  loading.value = true;
  try {
    // 1. Recupera i dati del record
    const { data, error: fetchError } = await supabase
      .from('vital_signs')
      .select('*')
      .eq('id', route.params.id)
      .single();

    if (fetchError) throw fetchError;
    record.value = data;

    // 2. Genera URL firmato se esiste un path
    if (data.ecg_storage_path) {
      const { data: urlData, error: urlError } = await supabase
        .storage
        .from('ecg_uploads') // Controlla sempre che il nome bucket coincida
        .createSignedUrl(data.ecg_storage_path, 3600);

      if (!urlError) {
        signedUrl.value = urlData.signedUrl;
      }
    }

  } catch (err) {
    error.value = "Impossibile caricare il tracciato: " + err.message;
  } finally {
    loading.value = false;
  }
};

const handleAnalyze = async () => {
  if (!record.value) return;
  analyzing.value = true;
  try {
    await requestAnalysis(record.value);
    await fetchRecord();
  } catch (err) {
    alert("Errore analisi: " + err.message);
  } finally {
    analyzing.value = false;
  }
};

onMounted(() => {
  fetchRecord();
});
</script>
