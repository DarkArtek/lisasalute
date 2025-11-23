<template>
  <div class="flex flex-col h-screen">
    <!-- Contenuto principale -->
    <main class="flex-1 overflow-y-auto pb-20">
      <!-- RouterView mostrerà il componente della pagina corrente -->
      <router-view />
    </main>

    <!-- Barra di Navigazione Inferiore -->
    <!-- Mostra la nav V-IF l'utente è loggato (preso dallo store) -->
    <nav
      v-if="showNav"
      class="fixed bottom-0 left-0 right-0 h-16 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-lg flex justify-around items-center"
    >
      <router-link to="/" class="nav-link" active-class="text-blue-500">
        <font-awesome-icon icon="comment-dots" class="text-2xl" />
        <span class="text-xs mt-1">Chat</span>
      </router-link>

      <router-link to="/diario" class="nav-link" active-class="text-blue-500">
        <font-awesome-icon icon="book-medical" class="text-2xl" />
        <span class="text-xs mt-1">Diario</span>
      </router-link>

      <router-link to="/profilo" class="nav-link" active-class="text-blue-500">
        <font-awesome-icon icon="user" class="text-2xl" />
        <span class="text-xs mt-1">Profilo</span>
      </router-link>

      <router-link to="/grafici" class="nav-link" active-class="text-blue-500">
        <font-awesome-icon icon="chart-line" class="text-2xl" />
        <span class="text-xs mt-1">Grafici</span>
      </router-link>
    </nav>
  </div>
</template>

<script setup>
import { computed } from 'vue'; // Rimosso onMounted
import { userSession } from './store/auth.js';
// Rimossa l'importazione delle notifiche

// Calcoliamo se mostrare la barra di navigazione.
const showNav = computed(() => !!userSession.value);

// Rimossa la logica onMounted
</script>

<style scoped>
/* Stile personalizzato per i link di navigazione */
.nav-link {
  @apply flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors;
}
</style>
