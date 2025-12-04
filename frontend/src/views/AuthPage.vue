<template>
  <div class="p-6">
    <!--
      --- LA CORREZIONE È QUI ---
      Abbiamo sostituito il componente <Logo ... />
      con un tag <img> standard, passando l'URL importato a :src
    -->
    <img
      :src="logoUrl"
      alt="Logo LisaSalute"
      class="w-48 h-auto mx-auto mb-2"
    />

    <h1 class="text-2xl font-bold text-center sr-only">LisaSalute</h1>
    <p class="text-center text-gray-600 dark:text-gray-300 mb-6">Accedi o Registrati</p>

    <div class="max-w-md mx-auto bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md">

      <!-- Messaggio di Errore -->
      <div v-if="errorMessage" class="mb-4 p-3 bg-red-100 dark:bg-red-900 border border-red-400 text-red-700 dark:text-red-200 rounded-lg">
        {{ errorMessage }}
      </div>

      <!-- Messaggio di Successo (per registrazione) -->
      <div v-if="successMessage" class="mb-4 p-3 bg-green-100 dark:bg-green-900 border border-green-400 text-green-700 dark:text-green-200 rounded-lg">
        {{ successMessage }}
      </div>

      <form @submit.prevent="handleLogin">
        <div class="mb-4">
          <label for="email" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
          <input
            type="email"
            id="email"
            v-model="email"
            placeholder="tua@email.com"
            required
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
          />
        </div>

        <div class="mb-6">
          <label for="password" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
          <input
            type="password"
            id="password"
            v-model="password"
            placeholder="••••••••"
            minlength="6"
            required
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
          />
        </div>

        <!-- Tasti Login e Registrazione -->
        <div class="flex flex-col sm:flex-row gap-2">
          <button
            type="submit"
            :disabled="loading"
            class="flex-1 w-full px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ loading ? 'Caricamento...' : 'Accedi' }}
          </button>

          <button
            type="button"
            @click="handleSignUp"
            :disabled="loading"
            class="flex-1 w-full px-4 py-2 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ loading ? 'Caricamento...' : 'Registrati' }}
          </button>
        </div>
      </form>

    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { supabase } from '../supabase.js';
// --- CORREZIONE: importiamo l'URL del logo ---
import logoUrl from '../assets/logo.svg';

const router = useRouter();
const email = ref('');
const password = ref('');
const loading = ref(false);
const errorMessage = ref(null);
const successMessage = ref(null);

// Funzione per il LOGIN
const handleLogin = async () => {
  try {
    loading.value = true;
    errorMessage.value = null;
    successMessage.value = null;

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.value,
      password: password.value,
    });

    if (error) throw error;

    // Non serve il router.push() qui.
    // L'onAuthStateChange in router.js ci penserà.

  } catch (error) {
    console.error("Errore Login:", error.message);
    errorMessage.value = `Errore di accesso: ${error.message}`;
  } finally {
    loading.value = false;
  }
};

// Funzione per la REGISTRAZIONE
const handleSignUp = async () => {
  try {
    loading.value = true;
    errorMessage.value = null;
    successMessage.value = null;

    const { data, error } = await supabase.auth.signUp({
      email: email.value,
      password: password.value,
    });

    if (error) throw error;

    successMessage.value = 'Registrazione riuscita! Controlla la tua email per confermare l\'account.';
    email.value = '';
    password.value = '';

  } catch (error) {
    console.error("Errore Registrazione:", error.message);
    errorMessage.value = `Errore di registrazione: ${error.message}`;
  } finally {
    loading.value = false;
  }
};
</script>
