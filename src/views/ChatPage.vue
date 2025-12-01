<template>
  <div class="flex flex-col h-full bg-gray-50 dark:bg-gray-900">

    <!-- HEADER CON SWITCH SUEM -->
    <div class="bg-white dark:bg-gray-800 p-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center shadow-sm z-10">
      <div class="flex items-center">
        <!-- Titolo Dinamico -->
        <h1 class="text-lg font-bold flex items-center transition-colors duration-300"
            :class="isSuemMode ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'">
          <font-awesome-icon :icon="isSuemMode ? 'user-doctor' : 'user-nurse'" class="mr-2 text-xl" />
          {{ isSuemMode ? 'Dott.ssa Lisa (SUEM)' : 'Lisa Assistente' }}
        </h1>
      </div>

      <div class="flex items-center gap-3">
        <!-- SWITCH TOGGLE (Visibile solo se abilitato nel profilo) -->
        <div v-if="suemEnabledInProfile" class="flex items-center bg-gray-100 dark:bg-gray-700 rounded-full p-1 cursor-pointer select-none" @click="toggleMode">
          <div class="px-3 py-1 rounded-full text-xs font-bold transition-all duration-300 flex items-center"
               :class="!isSuemMode ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'">
            <font-awesome-icon icon="house-medical" class="mr-1" />
            Personale
          </div>
          <div class="px-3 py-1 rounded-full text-xs font-bold transition-all duration-300 flex items-center"
               :class="isSuemMode ? 'bg-red-600 text-white shadow-sm' : 'text-gray-500'">
            <font-awesome-icon icon="truck-medical" class="mr-1" />
            SUEM 118
          </div>
        </div>

        <!-- Bottone Pulisci -->
        <button @click="handleClearChat" title="Pulisci cronologia" class="text-gray-400 hover:text-red-500 transition-colors ml-2">
          <font-awesome-icon icon="trash-can" />
        </button>
      </div>
    </div>

    <!-- Area Messaggi -->
    <div id="chat-container" class="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth" ref="chatContainerRef">
      <div v-if="loading" class="py-10"><Loader /><p class="text-center text-gray-500 mt-2">Elaborazione...</p></div>
      <div v-if="error" class="p-3 bg-red-100 text-red-700 rounded-lg"><p><strong>Errore:</strong> {{ error }}</p></div>

      <!-- Empty State Dinamico -->
      <div v-if="!loading && messages.length === 0" class="text-center text-gray-500 py-10 opacity-60">
        <font-awesome-icon :icon="isSuemMode ? 'user-doctor' : 'comment-dots'" class="text-5xl mb-3" />
        <p class="font-medium">
          {{ isSuemMode
          ? "Modalità Operativa Attiva. Nessun dato clinico verrà salvato."
          : "Inizia la tua conversazione con Lisa." }}
        </p>
        <p v-if="!isSuemMode" class="text-sm text-gray-400">Puoi scrivere i tuoi valori o caricare un ECG veloce.</p>
      </div>

      <ChatMessage v-for="msg in messages" :key="msg.id" :message="msg" :is-suem="msg.isSuem" />

      <div v-if="lisaIsTyping" class="flex justify-start">
        <div class="flex items-center max-w-xs px-4 py-3 rounded-lg shadow-md bg-white dark:bg-gray-700 border border-gray-100 dark:border-gray-600">
          <font-awesome-icon icon="heart-pulse" class="text-xl mr-3 animate-pulse" :class="isSuemMode ? 'text-red-500' : 'text-blue-500'" />
          <p class="text-gray-600 dark:text-gray-300 italic text-sm">Lisa sta scrivendo...</p>
        </div>
      </div>
    </div>

    <!-- Input -->
    <form @submit.prevent="handleSend" class="p-4 bg-white dark:bg-gray-800 border-t dark:border-gray-700 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
      <!-- Preview Immagine -->
      <div v-if="previewImageUrl" class="mb-2 p-2 border border-blue-100 bg-blue-50 dark:bg-gray-700 dark:border-gray-600 rounded-lg inline-flex items-center relative group">
        <img :src="previewImageUrl" class="w-16 h-16 object-cover rounded-md border border-gray-200" />
        <div class="ml-3">
          <p class="text-xs font-bold text-gray-700 dark:text-gray-200">Immagine allegata</p>
          <p class="text-[10px] text-gray-500">{{ selectedFile?.name }}</p>
        </div>
        <button @click="clearAttachments" type="button" class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600 shadow-sm">
          ×
        </button>
      </div>

      <input type="file" ref="fileInputImage" @change="handleImageChange" hidden accept="image/jpeg" />

      <div class="flex items-center space-x-3">
        <!-- Bottone Graffetta (Solo Personale) -->
        <button
          v-if="!isSuemMode"
          type="button"
          @click="triggerImageInput"
          :disabled="lisaIsTyping"
          class="w-10 h-10 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full flex items-center justify-center transition-colors"
          title="Carica ECG veloce"
        >
          <font-awesome-icon icon="paperclip" class="text-lg" />
        </button>

        <!-- Input Testo -->
        <input
          type="text"
          v-model="newMessage"
          :placeholder="isSuemMode ? 'Richiesta operativa o dosaggio...' : 'Scrivi qui i tuoi sintomi o valori...'"
          :disabled="lisaIsTyping"
          class="flex-1 w-full px-5 py-3 border rounded-full shadow-sm dark:bg-gray-700 dark:text-white outline-none transition-all"
          :class="isSuemMode
            ? 'focus:ring-2 focus:ring-red-500 border-gray-300'
            : 'focus:ring-2 focus:ring-blue-500 border-gray-300'"
        />

        <button
          type="submit"
          :disabled="(!newMessage.trim() && !imageBase64) || lisaIsTyping"
          class="w-12 h-12 text-white rounded-full flex items-center justify-center shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 transform hover:-translate-y-0.5"
          :class="isSuemMode ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'"
        >
          <font-awesome-icon icon="paper-plane" class="text-lg" />
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, nextTick, watch } from 'vue'
import { messages, loading, error, sendMessage, addMessage, clearChatHistory, setReminder } from '../store/chat.js'
import { profile } from '../store/profile.js'
import ChatMessage from '../components/ChatMessage.vue'
import Loader from '../components/Loader.vue'
import { askLisa } from '../services/gemini/index.js'
import { library } from '@fortawesome/fontawesome-svg-core';
import { faPaperPlane, faTrashCan, faPaperclip, faHeartPulse, faCommentDots, faUserNurse, faUserDoctor, faTruckMedical, faHouseMedical } from '@fortawesome/free-solid-svg-icons';

library.add(faPaperPlane, faTrashCan, faPaperclip, faHeartPulse, faCommentDots, faUserNurse, faUserDoctor, faTruckMedical, faHouseMedical);

const newMessage = ref('')
const lisaIsTyping = ref(false)
const fileInputImage = ref(null)
const imageBase64 = ref(null)
const previewImageUrl = ref(null)
const selectedFile = ref(null)
const chatContainerRef = ref(null)
const isSuemMode = ref(false)

// 1. Verifica permesso SUEM dal profilo
const suemEnabledInProfile = computed(() => {
  return profile.value?.suem_enabled === true;
});

const toggleMode = () => {
  isSuemMode.value = !isSuemMode.value;
  // Opzionale: Pulisci la chat quando cambi contesto per evitare confusione
  // messages.value = [];
};

const scrollToBottom = async () => {
  await nextTick();
  if (chatContainerRef.value) {
    chatContainerRef.value.scrollTop = chatContainerRef.value.scrollHeight;
  }
};

onMounted(() => scrollToBottom());

watch(messages, () => scrollToBottom(), { deep: true });

const triggerImageInput = () => fileInputImage.value.click()

const handleImageChange = (event) => {
  const file = event.target.files[0]
  if (!file) return;
  if (file.type !== 'image/jpeg') { alert('Solo JPEG'); return; }

  console.log("ChatPage: File catturato:", file.name);
  selectedFile.value = file;

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

  newMessage.value = ''
  lisaIsTyping.value = true

  try {
    // --- SCENARIO A: MODALITÀ SUEM (Testo, No Dati, Prompt Dottoressa) ---
    if (isSuemMode.value) {
      // Usiamo la nuova action 'sendMessage' che gestisce i contesti (SUEM vs Personale)
      // Nota: Disabilitiamo l'invio immagini in SUEM per ora (telegrafico)
      await sendMessage(content, true);
    }
    // --- SCENARIO B: MODALITÀ PERSONALE CON IMMAGINE (ECG/Altro) ---
    else if (img) {
      // Manteniamo la tua logica esistente per l'upload immagini
      let userMessage = content ? `${content} (Immagine ECG allegata)` : '(Immagine ECG allegata)'
      await addMessage('user', userMessage, false) // false = non SUEM

      let response;
      if (file) {
        response = await askLisa(content, {
          type: 'image',
          data: img,
          file: file,
          mime: 'image/jpeg'
        })
      } else {
        response = await askLisa(content, { type: 'image', data: img, mime: 'image/jpeg' })
      }

      const { text: lisaResponse, action } = response
      await addMessage('assistant', lisaResponse, false)
      if (action === 'SET_TIMER_10_MIN') setReminder(10);
    }
    // --- SCENARIO C: MODALITÀ PERSONALE SOLO TESTO ---
    else {
      // Usiamo 'sendMessage' anche qui per sfruttare la memoria a lungo termine e l'estrazione dati
      await sendMessage(content, false);
    }

  } catch (err) {
    console.error('Errore handleSend:', err)
    // Fallback UI in caso di errore store
    if (messages.value[messages.value.length - 1]?.role === 'user') {
      await addMessage('assistant', 'Mi dispiace, si è verificato un errore di connessione.', isSuemMode.value)
    }
  } finally {
    lisaIsTyping.value = false
    clearAttachments()
    scrollToBottom()
  }
}

const handleClearChat = async () => { await clearChatHistory(); }
</script>

<style scoped>
.h-full { height: calc(100vh - 4rem); }
</style>
