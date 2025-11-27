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
const selectedFile = ref(null) // <--- 1. IMPORTANTE: Variabile per il file originale

const triggerImageInput = () => fileInputImage.value.click()

const handleImageChange = (event) => {
  const file = event.target.files[0]
  if (!file) return;
  if (file.type !== 'image/jpeg') {
    alert('Per le immagini, carica solo file JPEG.')
    return
  }

  // 2. IMPORTANTE: Salviamo il file originale per l'upload
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
  selectedFile.value = null // Puliamo anche il file
  if (fileInputImage.value) fileInputImage.value.value = null
}
// --- FINE LOGICA ALLEGATI ---


const handleSend = async () => {
  const content = newMessage.value
  const img = imageBase64.value
  const file = selectedFile.value // <--- Prendiamo il riferimento al file

  if (!content.trim() && !img) return

  let userMessage = content
  if (img) userMessage = content ? `${content} (Immagine ECG allegata)` : '(Immagine ECG allegata)'

  newMessage.value = ''

  try {
    await addMessage('user', userMessage)
    lisaIsTyping.value = true

    let response;
    // 3. IMPORTANTE: Controlliamo se abbiamo sia img che file
    if (img && file) {
      // Passiamo sia il file originale (per Storage) che il Base64 (per Gemini)
      response = await askLisa(content, {
        type: 'image',
        data: img,        // Per Gemini (Analisi)
        file: file,       // Per Supabase (Archiviazione Originale) <-- FONDAMENTALE
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
