<template>
  <div class="p-4 pb-24">

    <!-- Intestazione con Bottone Upload -->
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-2xl font-bold text-purple-700 dark:text-purple-400 flex items-center">
        <font-awesome-icon icon="heartbeat" class="mr-2" />
        Galleria ECG
      </h1>

      <router-link
        to="/ecg/upload"
        class="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-md flex items-center"
      >
        <font-awesome-icon icon="plus" class="mr-2" />
        Nuovo
      </router-link>
    </div>

    <!-- ... (Resto del template della galleria: loader, errori, griglia...) ... -->
    <div v-if="loading" class="py-10">
      <Loader />
      <p class="text-center text-gray-500 mt-2">Caricamento tracciati...</p>
    </div>

    <div v-if="error" class="p-4 mb-4 bg-red-100 text-red-700 rounded-lg">
      {{ error }}
    </div>

    <div v-if="!loading && ecgsWithUrls.length === 0" class="text-center text-gray-500 py-10">
      <p>Non hai ancora caricato nessun tracciato ECG.</p>
      <p class="text-sm mt-2">Usa il tasto "Nuovo" per iniziare.</p>
    </div>

    <!-- Griglia ECG (INVARIATA) -->
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <!-- ... (contenuto card v-for identico a prima) ... -->
      <div
        v-for="ecg in ecgsWithUrls"
        :key="ecg.id"
        class="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border border-gray-200 dark:border-gray-700 flex flex-col hover:shadow-xl transition-shadow cursor-pointer"
        @click="goToDetail(ecg.id)"
      >
        <!-- Anteprima Immagine -->
        <div class="h-48 bg-gray-100 dark:bg-gray-900 relative flex items-center justify-center overflow-hidden">
          <img
            v-if="ecg.signedUrl"
            :src="ecg.signedUrl"
            class="w-full h-full object-cover opacity-90 hover:opacity-100 transition-opacity"
            loading="lazy"
          />
          <div v-else class="text-gray-400 text-xs">
            <font-awesome-icon icon="image" class="text-2xl mb-1 block mx-auto"/>
            Anteprima non disponibile
          </div>

          <!-- Badge Data Overlay -->
          <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
            <span class="text-white text-xs font-semibold">
              {{ formatDate(ecg.created_at) }}
            </span>
          </div>
        </div>

        <!-- Info Rapide -->
        <div class="p-3 flex-1 flex flex-col">
          <div class="flex justify-between items-center mb-2">
            <span v-if="ecg.frequenza_cardiaca" class="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full font-bold">
              FC: {{ ecg.frequenza_cardiaca }} bpm
            </span>
            <span v-else class="text-xs text-gray-400 italic">FC non rilevata</span>
          </div>

          <!-- Anteprima Testo -->
          <div class="mt-auto">
            <p v-if="ecg.commento_lisa" class="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mb-2">
              {{ getShortComment(ecg.commento_lisa) }}
            </p>
            <p v-else class="text-xs text-purple-500 italic mb-2">
              Da analizzare
            </p>

            <button
              class="w-full text-center text-xs font-bold text-purple-600 uppercase tracking-wide border border-purple-200 rounded py-1 hover:bg-purple-50 dark:hover:bg-gray-700 transition-colors"
            >
              Vedi Dettaglio
            </button>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
// ... (script setup invariato, ricorda di importare le icone necessarie in main.js se "plus" o "arrow-left" mancano) ...
import { onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ecgs, fetchEcgs, loading, error } from '../store/diary.js';
import { supabase } from '../supabase.js';
import Loader from '../components/Loader.vue';

const router = useRouter();
const ecgsWithUrls = ref([]);

const generateSignedUrls = async (records) => {
  if (!records || records.length === 0) {
    ecgsWithUrls.value = [];
    return;
  }
  const promises = records.map(async (record) => {
    if (!record.ecg_storage_path) return { ...record, signedUrl: null };
    const { data, error } = await supabase.storage.from('ecg_uploads').createSignedUrl(record.ecg_storage_path, 3600);
    if (error) return { ...record, signedUrl: null };
    return { ...record, signedUrl: data.signedUrl };
  });
  ecgsWithUrls.value = await Promise.all(promises);
};

onMounted(async () => {
  await fetchEcgs();
});

watch(ecgs, (newEcgs) => {
  generateSignedUrls(newEcgs);
});

const formatDate = (isoString) => {
  return new Date(isoString).toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const getShortComment = (text) => {
  const clean = text.replace(/[#*]/g, '');
  return clean.length > 60 ? clean.substring(0, 60) + '...' : clean;
};

const goToDetail = (id) => {
  router.push(`/ecg/${id}`);
};
</script>
