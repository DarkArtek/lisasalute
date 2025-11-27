<template>
  <div class="flex flex-col h-full">

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

    <div
      id="chat-container"
      class="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth"
    >
      <div v-if="loading" class="py-10">
        <Loader />
        <p class="text-center text-gray-500 dark:text-gray-400 mt-2">Caricamento cronologia...</p>
      </div>

      <div v-if="error" class="p-3 bg-red-100 dark:bg-red-900 border border-red-400 text-red-700 dark:text-red-200 rounded-lg">
        <p><strong>Errore:</strong> {{ error }}</p>
      </div>

      <div v-if="!loading && messages.length === 0" class="text-center text-gray-500 dark:text-gray-400 py-10">
        <font-awesome-icon icon="comment-dots" class="text-4xl mb-3" />
        <p>Inizia la tua conversazione con Lisa.</p>
        <p class="text-sm">Scrivi i tuoi parametri o fai una domanda.</p>
      </div>

      <ChatMessage
        v-for="msg in messages"
        :key="msg.id"
        :message="msg"
      />

      <div v-if="lisaIsTyping" class="flex justify-start">
        <div class="flex items-center max-w-xs px-4 py-3 rounded-lg shadow-md bg-white dark:bg-gray-700 rounded-bl-none">
          <font-awesome-icon icon="heart-pulse" class="text-xl mr-3 text-red-400 animate-pulse" />
          <p class="text-gray-600 dark:text-gray-300 italic">Lisa sta scrivendo...</p>
        </div>
      </div>
    </div>

    <form @submit.prevent="handleSend" class="p-4 bg-white dark:bg-gray-800 border-t dark:border-gray-700 shadow-inner">

      <div v-if="previewImageUrl" class="mb-2 p-2 border dark:border-gray-600 rounded-lg inline-flex items-start">
        <img :src="previewImageUrl" class="w-20 h-20 object-cover rounded-md" alt="ECG Preview" />
        <button @click="clearAttachments" type="button" class="ml-2 text-red-500 hover:text-red-700">Rimuovi</button>
      </div>

      <input type="file" ref="fileInputImage" @change="handleImageChange" hidden accept="image/jpeg" />

      <div class="flex items-center space-x-3">

        <button
          type="button"
          @click="triggerImageInput"
          :disabled="lisaIsTyping"
          class="w-10 h-10 flex-shrink-0 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-500 rounded-full flex items-center justify-center disabled:opacity-50"
          title="Allega ECG (JPG)"
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
import { ref, onMounted } from 'vue'
import {
  messages,
  loading,
  error,
  addMessage,
  clearChatHistory,
  setReminder,
  scrollToBottom
} from '../store/chat.js'
import ChatMessage from '../components/ChatMessage.vue'
import Loader from '../components/Loader.vue'
import { askLisa } from '../services/gemini.js'

const newMessage = ref('')
const lisaIsTyping = ref(false)

onMounted(() => {
  scrollToBottom();
});

// --- LOGICA ALLEGATI (Solo Immagini) ---
const fileInputImage = ref(null)
const imageBase64 = ref(null)
const previewImageUrl = ref(null)
const selectedFile = ref(null) // <--- NUOVO: Teniamo traccia del File originale

const triggerImageInput = () => fileInputImage.value.click()

const handleImageChange = (event) => {
  const file = event.target.files[0]
  if (!file) return;
  if (file.type !== 'image/jpeg') {
    alert('Per le immagini, carica solo file JPEG.')
    return
  }

  // Salviamo il file originale per l'upload
  selectedFile.value = file;

  // Leggiamo anche in Base64 per l'anteprima locale e per Gemini
  const reader = new FileReader()
  reader.onload = (e) => {
    previewImageUrl.value = e.target.result
    imageBase64.value = e.target.result.split(',')[1]
  }
  reader.readAsDataURL(file)
}

const clearAttachments = () => {
  imageBase64.value = null
  previewImageUrl.value = null
  selectedFile.value = null // Puliamo anche il file
  if (fileInputImage.value) fileInputImage.value.value = null
}
// --- FINE LOGICA ALLEGATI ---


const handleSend = async () => {
  const content = newMessage.value
  const img = imageBase64.value
  const file = selectedFile.value // <--- Prendiamo il file

  if (!content.trim() && !img) return

  let userMessage = content
  if (img) userMessage = content ? `${content} (Immagine ECG allegata)` : '(Immagine ECG allegata)'

  newMessage.value = ''

  try {
    await addMessage('user', userMessage)
    lisaIsTyping.value = true

    let response;
    if (img && file) {
      // Passiamo sia il file originale (per Storage) che il Base64 (per Gemini)
      response = await askLisa(content, {
        type: 'image',
        data: img,        // Per Gemini (Analisi)
        file: file,       // Per Supabase (Archiviazione Originale)
        mime: 'image/jpeg'
      })
    } else {
      response = await askLisa(content)
    }

    const { text: lisaResponse, action } = response

    await addMessage('assistant', lisaResponse)

    if (action === 'SET_TIMER_10_MIN') {
      setReminder(10);
    }

  } catch (err) {
    console.error('Errore in handleSend:', err)
    await addMessage('assistant', err.message || 'Ops, ho avuto un problema tecnico.')
  } finally {
    lisaIsTyping.value = false
    clearAttachments()
  }
}

const handleClearChat = async () => {
  console.log('Pulizia chat richiesta...');
  await clearChatHistory();
}
</script>

<style scoped>
.h-full {
  height: calc(100vh - 4rem);
}
</style>
