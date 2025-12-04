<template>
  <div class="p-6 max-w-md mx-auto">

    <!-- Header con Back -->
    <div class="flex items-center mb-6">
      <button @click="$router.back()" class="text-gray-500 hover:text-purple-600 mr-4">
        <font-awesome-icon icon="arrow-left" class="text-xl" />
      </button>
      <h1 class="text-2xl font-bold text-gray-800 dark:text-white">Carica Tracciato ECG</h1>
    </div>

    <!-- Form Upload -->
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-100 dark:border-gray-700">

      <!-- 1. Selezione File -->
      <div
        class="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors"
        :class="file ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' : 'border-gray-300 hover:border-purple-400 dark:border-gray-600'"
        @click="triggerFileInput"
        @dragover.prevent
        @drop.prevent="handleDrop"
      >
        <input type="file" ref="fileInput" @change="handleFileSelect" accept="image/jpeg,image/png" hidden />

        <div v-if="previewUrl">
          <img :src="previewUrl" class="max-h-48 mx-auto rounded shadow-sm" />
          <p class="text-xs text-purple-600 mt-2 font-semibold">Clicca per cambiare</p>
        </div>
        <div v-else>
          <font-awesome-icon icon="cloud-upload-alt" class="text-4xl text-gray-400 mb-2" />
          <p class="text-gray-500 dark:text-gray-400 font-medium">Tocca per caricare l'immagine</p>
          <p class="text-xs text-gray-400 mt-1">Supportati: JPG, PNG</p>
        </div>
      </div>

      <!-- 2. Data del Tracciato (Retroattiva) -->
      <div class="mt-6">
        <label class="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Data del Tracciato</label>
        <input
          type="datetime-local"
          v-model="recordDate"
          class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
        />
        <p class="text-xs text-gray-500 mt-1">Lascia invariato se è di oggi.</p>
      </div>

      <!-- 3. Note Opzionali -->
      <div class="mt-4">
        <label class="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Note per Lisa (Opzionale)</label>
        <textarea
          v-model="userNotes"
          rows="3"
          placeholder="Es. Sentivo batticuore dopo pranzo..."
          class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
        ></textarea>
      </div>

      <!-- Bottoni Azione -->
      <div class="mt-8 flex flex-col gap-3">
        <button
          @click="handleUpload"
          :disabled="!file || uploading"
          class="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg shadow-md disabled:opacity-50 flex justify-center items-center"
        >
          <span v-if="uploading"><font-awesome-icon icon="spinner" spin class="mr-2"/> Analisi in corso...</span>
          <span v-else>Analizza e Salva</span>
        </button>
      </div>

      <!-- Messaggi Errore -->
      <p v-if="error" class="mt-4 text-sm text-red-600 text-center bg-red-50 p-2 rounded">{{ error }}</p>

    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { askLisa } from '../services/gemini/index.js'; // Usiamo il service modulare

const router = useRouter();
const fileInput = ref(null);
const file = ref(null);
const previewUrl = ref(null);
const recordDate = ref(new Date().toISOString().slice(0, 16)); // Default: Adesso
const userNotes = ref('');
const uploading = ref(false);
const error = ref(null);

// Gestione File
const triggerFileInput = () => fileInput.value.click();

const handleFileSelect = (event) => {
  const selected = event.target.files[0];
  if (selected) processFile(selected);
};

const handleDrop = (event) => {
  const dropped = event.dataTransfer.files[0];
  if (dropped) processFile(dropped);
};

const processFile = (fileObj) => {
  if (!fileObj.type.startsWith('image/')) {
    error.value = "Per favore carica un'immagine valida.";
    return;
  }
  file.value = fileObj;
  error.value = null;

  // Anteprima
  const reader = new FileReader();
  reader.onload = (e) => {
    previewUrl.value = e.target.result;
  };
  reader.readAsDataURL(fileObj);
};

// Logica Upload
const handleUpload = async () => {
  if (!file.value) return;

  uploading.value = true;
  error.value = null;

  try {
    // Converti l'immagine in Base64 per Gemini (la funzione processFile lo fa per l'anteprima,
    // ma qui serve pulita senza header data:image...)
    const base64Data = previewUrl.value.split(',')[1];

    // Costruiamo un messaggio fittizio per l'IA che include la data e le note
    // Questo permette a 'askLisa' (che usa 'callGeminiForExtraction') di estrarre la data corretta!
    const contextMessage = `
      Analizza questo ECG.
      Data del tracciato: ${recordDate.value}.
      Note utente: ${userNotes.value}
    `;

    // Chiamiamo il servizio centrale
    // Nota: askLisa gestisce già upload + analisi + salvataggio DB
    await askLisa(contextMessage, {
      type: 'image',
      data: base64Data,
      file: file.value, // Il file originale per l'upload sicuro
      mime: file.value.type
    });

    // Successo -> Vai alla galleria
    router.push('/ecg');

  } catch (err) {
    console.error(err);
    error.value = "Errore durante l'upload: " + err.message;
  } finally {
    uploading.value = false;
  }
};
</script>
