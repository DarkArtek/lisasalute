<template>
  <div :class="wrapperClass">
    <div :class="bubbleClass">
      <!-- Icona per Lisa (assistente) -->
      <font-awesome-icon
        v-if="message.role === 'assistant'"
        icon="heart-pulse"
        class="text-xl mr-3 text-red-400 flex-shrink-0"
      />

      <!--
        --- MODIFICA MARKDOWN ---
        Usiamo v-html per renderizzare il contenuto formattato (ora include tabelle, heading, ecc.)
      -->
      <div class="flex-1" v-html="formattedContent"></div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
// --- MODIFICA MARKDOWN ---
// Importiamo la libreria 'marked'
import { marked } from 'marked'
// -------------------------

const props = defineProps({
  message: {
    type: Object,
    required: true,
  }
})

// Stile del contenitore (allinea a dx o sx)
const wrapperClass = computed(() => [
  'flex',
  'mb-3',
  props.message.role === 'user' ? 'justify-end' : 'justify-start'
])

// Stile della "bolla" (colore)
const bubbleClass = computed(() => [
  'flex',
  'items-start',
  'max-w-xs',
  'px-4 py-3',
  'rounded-lg',
  'shadow-md',
  props.message.role === 'user'
    ? 'bg-blue-500 text-white rounded-br-none'
    : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-bl-none'
])

//
// --- MODIFICA MARKDOWN (Logica) ---
// Sostituiamo la nostra funzione "ingenuo"
// con la chiamata diretta a 'marked'
//
const formattedContent = computed(() => {
  if (!props.message.content) return '';
  // 'marked' converte tutto (heading, tabelle, grassetto, ecc.)
  return marked(props.message.content);
});

</script>

<style scoped>
.flex-1 {
  word-break: break-word;
}
</style>
