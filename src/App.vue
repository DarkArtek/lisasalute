<template>
  <div class="flex flex-col h-screen">
    <main class="flex-1 overflow-y-auto pb-20">
      <router-view />
    </main>

    <nav
      v-if="showNav"
      class="fixed bottom-0 left-0 right-0 h-16 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-lg flex justify-around items-center z-50"
    >
      <router-link to="/" class="nav-link" active-class="text-blue-500">
        <font-awesome-icon icon="comment-dots" class="text-xl" />
        <span class="text-[10px] mt-1">Chat</span>
      </router-link>

      <router-link to="/diario" class="nav-link" active-class="text-blue-500">
        <font-awesome-icon icon="book-medical" class="text-xl" />
        <span class="text-[10px] mt-1">Diario</span>
      </router-link>

      <router-link to="/ecg" class="nav-link" active-class="text-purple-600 font-bold">
        <font-awesome-icon icon="heartbeat" class="text-xl" />
        <span class="text-[10px] mt-1">ECG</span>
      </router-link>

      <router-link to="/grafici" class="nav-link" active-class="text-blue-500">
        <font-awesome-icon icon="chart-line" class="text-xl" />
        <span class="text-[10px] mt-1">Grafici</span>
      </router-link>

      <router-link to="/profilo" class="nav-link" active-class="text-blue-500">
        <font-awesome-icon icon="user" class="text-xl" />
        <span class="text-[10px] mt-1">Profilo</span>
      </router-link>
    </nav>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { userSession } from './store/auth.js';

// Calcoliamo se mostrare la barra di navigazione.
// La mostriamo solo se l'utente è loggato (userSession non è null)
const showNav = computed(() => !!userSession.value);
</script>

<style scoped>
/* Stile personalizzato per i link di navigazione */
.nav-link {
  @apply flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors py-1 px-2;
}
</style>
