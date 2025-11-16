<template>
  <!-- Contenitore principale della pagina chat -->
  <div class="flex flex-col h-full">

    <!-- Header (Modificato) -->
    <div class="flex justify-between items-center p-4 border-b dark:border-gray-700">
      <div class="w-6"></div>
      <h1 class="text-2xl font-semibold text-center">Chat con Lisa</h1>
      <button
        @click="handleClearChat"
        title="Pulisci cronologia"
        class="text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 transition-colors"
      >
        <font-awesome-icon icon="trash-can" class="text-lg" />
      </button>
    </div>

    <!-- 1. Area Messaggi -->
    <div
      id="chat-container"
      class="flex-1 overflow-y-auto p-4 space-y-4"
    >
      <!-- ... (Loader, Errore, Benvenuto, v-for dei messaggi - tutto invariato) ... -->
      <ChatMessage
        v-for="msg in messages"
        :key="msg.id"
        :message="msg"
      />

      <!-- "Lisa sta scrivendo..." -->
      <div v-if="lisaIsTyping" class="flex justify-start">
        <div class="flex items-center max-w-xs px-4 py-3 rounded-lg shadow-md bg-white dark:bg-gray-700 rounded-bl-none">
          <font-awesome-icon icon="heart-pulse" class="text-xl mr-3 text-red-400 animate-pulse" />
          <p class="text-gray-600 dark:text-gray-300 italic">Lisa sta scrivendo...</p>
        </div>
      </div>
    </div>

    <!-- 2. Barra di Input (fissa in fondo) -->
    <form @submit.prevent="handleSend" class="p-4 bg-white dark:bg-gray-800 border-t dark:border-gray-700 shadow-inner">

      <!-- NUOVO: Anteprima Immagine Caricata -->
      <div v-if="previewImageUrl" class="mb-2 p-2 border dark:border-gray-600 rounded-lg inline-flex items-start">
        <img :src="previewImageUrl" class="w-20 h-20 object-cover rounded-md" alt="ECG Preview" />
        <button
          @click="clearImage"
          type="button"
          class="ml-2 text-red-500 hover:text-red-700"
        >
          Rimuovi
        </button>
      </div>

      <!-- Input file nascosto (per la graffetta) -->
      <input
        type="file"
        ref="fileInput"
        @change="handleFileChange"
        hidden
        accept="image/jpeg"
      />

      <div class="flex items-center space-x-3">

        <!-- NUOVO: Bottone Graffetta -->
        <button
          type="button"
          @click="triggerFileInput"
          :disabled="lisaIsTyping"
          class="w-10 h-10 flex-shrink-0 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-500 rounded-full flex items-center justify-center disabled:opacity-50"
        >
          <font-awesome-icon icon="paperclip" class="text-lg" />
        </button>

        <input
          type="text"
          v-model="newMessage"
          placeholder="Allega un ECG o scrivi qui..."
          :disabled="lisaIsTyping"
          class="flex-1 w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-full shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
        />

        <button
          type="submit"
          :disabled="(!newMessage.trim() && !imageBase64) || lisaIsTyping"
          class="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <font-awesome-icon icon="paper-plane" class="text-lg" />
        </button>

      </div>
    </form>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import {
  messages,
  loading,
  error,
  addMessage,
  clearChatHistory,
  setReminder
} from '../store/chat.js'
import ChatMessage from '../components/ChatMessage.vue'
import Loader from '../components/Loader.vue'
import { askLisa } from '../services/gemini.js'

const newMessage = ref('')
const lisaIsTyping = ref(false)

// --- NUOVA LOGICA ECG ---
const fileInput = ref(null)      // Riferimento all'input nascosto
const imageBase64 = ref(null)    // Stringa Base64 per Gemini
const previewImageUrl = ref(null) // URL per l'anteprima <img>

// 1. Bottone "Graffetta" clicca l'input
const triggerFileInput = () => {
  fileInput.value.click()
}

// 2. L'utente sceglie un file
const handleFileChange = (event) => {
  const file = event.target.files[0]
  if (!file) return;
  if (file.type !== 'image/jpeg') {
    alert('Funzionalità al momento limitata: per favore carica solo file JPEG (.jpg o .jpeg).')
    return
  }

  // Convertiamo l'immagine in Base64
  const reader = new FileReader()

  reader.onload = (e) => {
    previewImageUrl.value = e.target.result // Per l'anteprima

    // Estrai SOLO la stringa Base64 (tutto dopo la virgola)
    const base64String = e.target.result.split(',')[1]
    imageBase64.value = base64String

    console.log('Immagine JPEG convertita in Base64.');
  }

  // Avvia la lettura
  reader.readAsDataURL(file)
}

// 3. Rimuovi l'anteprima
const clearImage = () => {
  imageBase64.value = null
  previewImageUrl.value = null
  fileInput.value.value = null // Resetta l'input file
}
// --- FINE LOGICA ECG ---


const handleSend = async () => {
  const content = newMessage.value
  const image = imageBase64.value

  if (!content.trim() && !image) return // Non inviare se è tutto vuoto

  // Resetta gli input
  newMessage.value = ''
  clearImage()

  try {
    // Aggiungi il messaggio dell'utente alla chat
    // (Se c'è un'immagine, aggiungiamo una nota al messaggio)
    let userMessage = content
    if (image) {
      userMessage = content ? `${content} (Immagine ECG allegata)` : '(Immagine ECG allegata)'
    }

    await addMessage('user', userMessage)

    lisaIsTyping.value = true

    // --- MODIFICA CHIAVE ---
    // Invia a Lisa sia il testo che l'immagine (Base64)
    const { text: lisaResponse, action } = await askLisa(content, image)
    // -----------------------

    await addMessage('assistant', lisaResponse)

    // Gestisci il timer
    if (action === 'SET_TIMER_10_MIN') {
      setReminder(10);
    }

  } catch (err) {
    console.error('Errore in handleSend:', err)
    await addMessage('assistant', err.message || 'Ops, ho avuto un problema tecnico. Riprova, per favore.')
  } finally {
    lisaIsTyping.value = false
  }
}

// Funzione per il bottone Pulisci
const handleClearChat = async () => {
  console.log('Pulizia chat richiesta...');
  await clearChatHistory();
}
</script>

<style scoped>
/* Assicura che la pagina chat occupi l'altezza corretta */
.h-full {
  height: calc(100vh - 4rem); /* 100vh - altezza navbar */
}
</style>
