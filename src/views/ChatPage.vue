<template>
  <div class="flex flex-col h-full">
    <!-- Header -->
    <div class="flex justify-between items-center p-4 border-b dark:border-gray-700">
      <div class="w-6"></div>
      <h1 class="text-2xl font-semibold text-center">Chat con Lisa</h1>
      <button @click="handleClearChat" title="Pulisci cronologia" class="text-gray-500 hover:text-red-500 transition-colors">
        <font-awesome-icon icon="trash-can" class="text-lg" />
      </button>
    </div>

    <!-- Area Messaggi -->
    <div id="chat-container" class="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth">
      <div v-if="loading" class="py-10"><Loader /><p class="text-center text-gray-500 mt-2">Caricamento...</p></div>
      <div v-if="error" class="p-3 bg-red-100 text-red-700 rounded-lg"><p><strong>Errore:</strong> {{ error }}</p></div>
      <div v-if="!loading && messages.length === 0" class="text-center text-gray-500 py-10">
        <font-awesome-icon icon="comment-dots" class="text-4xl mb-3" />
        <p>Inizia la tua conversazione con Lisa.</p>
        <p class="text-sm text-gray-400">Puoi scrivere i tuoi valori o caricare un ECG veloce.</p>
      </div>
      <ChatMessage v-for="msg in messages" :key="msg.id" :message="msg" />
      <div v-if="lisaIsTyping" class="flex justify-start">
        <div class="flex items-center max-w-xs px-4 py-3 rounded-lg shadow-md bg-white dark:bg-gray-700">
          <font-awesome-icon icon="heart-pulse" class="text-xl mr-3 text-red-400 animate-pulse" />
          <p class="text-gray-600 dark:text-gray-300 italic">Lisa sta scrivendo...</p>
        </div>
      </div>
    </div>

    <!-- Input -->
    <form @submit.prevent="handleSend" class="p-4 bg-white dark:bg-gray-800 border-t dark:border-gray-700 shadow-inner">
      <div v-if="previewImageUrl" class="mb-2 p-2 border rounded-lg inline-flex items-start">
        <img :src="previewImageUrl" class="w-20 h-20 object-cover rounded-md" />
        <button @click="clearAttachments" type="button" class="ml-2 text-red-500 text-sm">Rimuovi</button>
      </div>
      <input type="file" ref="fileInputImage" @change="handleImageChange" hidden accept="image/jpeg" />
      <div class="flex items-center space-x-3">
        <!-- Bottone Graffetta ATTIVO -->
        <button
          type="button"
          @click="triggerImageInput"
          :disabled="lisaIsTyping"
          class="w-10 h-10 text-gray-500 hover:text-blue-600 rounded-full flex items-center justify-center transition-colors"
          title="Carica ECG veloce"
        >
          <font-awesome-icon icon="paperclip" class="text-lg" />
        </button>

        <input
          type="text"
          v-model="newMessage"
          placeholder="Scrivi qui..."
          :disabled="lisaIsTyping"
          class="flex-1 w-full px-4 py-2 border rounded-full shadow-sm dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
        />

        <button
          type="submit"
          :disabled="(!newMessage.trim() && !imageBase64) || lisaIsTyping"
          class="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-transform active:scale-95"
        >
          <font-awesome-icon icon="paper-plane" class="text-lg" />
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { messages, loading, error, addMessage, clearChatHistory, setReminder, scrollToBottom } from '../store/chat.js'
import ChatMessage from '../components/ChatMessage.vue'
import Loader from '../components/Loader.vue'
// Assicurati che l'import punti al file/cartella corretto
import { askLisa } from '../services/gemini/index.js'

const newMessage = ref('')
const lisaIsTyping = ref(false)
const fileInputImage = ref(null)
const imageBase64 = ref(null)
const previewImageUrl = ref(null)
const selectedFile = ref(null) // Variabile File fondamentale

onMounted(() => scrollToBottom());

const triggerImageInput = () => fileInputImage.value.click()

const handleImageChange = (event) => {
  const file = event.target.files[0]
  if (!file) return;
  if (file.type !== 'image/jpeg') { alert('Solo JPEG'); return; }

  console.log("ChatPage: File catturato:", file.name);
  selectedFile.value = file; // Salvataggio File

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
  selectedFile.value = null
  if (fileInputImage.value) fileInputImage.value.value = null
}

const handleSend = async () => {
  const content = newMessage.value
  const img = imageBase64.value
  const file = selectedFile.value

  if (!content.trim() && !img) return

  let userMessage = content
  if (img) userMessage = content ? `${content} (Immagine ECG allegata)` : '(Immagine ECG allegata)'

  newMessage.value = ''

  try {
    await addMessage('user', userMessage)
    lisaIsTyping.value = true

    let response;

    // Logica di invio ibrida (Testo / Immagine)
    if (img && file) {
      console.log("ChatPage: Invio IMG + FILE a Gemini...");
      response = await askLisa(content, {
        type: 'image',
        data: img,
        file: file, // Passaggio File per upload sicuro
        mime: 'image/jpeg'
      })
    } else if (img && !file) {
      console.error("ChatPage ERRORE: File mancante. Riprova.");
      // Fallback per evitare blocco, ma l'upload fallirà
      response = await askLisa(content, { type: 'image', data: img, mime: 'image/jpeg' })
    } else {
      response = await askLisa(content)
    }

    const { text: lisaResponse, action } = response
    await addMessage('assistant', lisaResponse)
    if (action === 'SET_TIMER_10_MIN') setReminder(10);

  } catch (err) {
    console.error('Errore handleSend:', err)
    await addMessage('assistant', 'Errore tecnico.')
  } finally {
    lisaIsTyping.value = false
    clearAttachments()
  }
}

const handleClearChat = async () => { await clearChatHistory(); }
</script>

<style scoped>
.h-full { height: calc(100vh - 4rem); }
</style>
