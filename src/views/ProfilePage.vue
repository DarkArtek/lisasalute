<template>
  <div class="p-4">
    <h1 class="text-2xl font-semibold mb-4">Profilo Utente</h1>

    <div class="max-w-md mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">

      <div v-if="profileLoading" class="py-8">
        <Loader />
        <p class="text-center text-gray-500 dark:text-gray-400 mt-2">Caricamento profilo...</p>
      </div>

      <div v-if="profileError" class="mb-4 p-3 bg-red-100 dark:bg-red-900 border border-red-400 text-red-700 dark:text-red-200 rounded-lg">
        <p><strong>Errore:</strong> {{ profileError }}</p>
      </div>

      <form v-if="profile && !profileLoading" @submit.prevent="handleSaveProfile">

        <!-- Dati Anagrafici -->
        <div v-if="user" class="mb-4">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
          <input
            type="email"
            :value="user.email"
            disabled
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
          />
        </div>

        <div class="mb-4">
          <label for="nome" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome Completo</label>
          <input
            type="text"
            id="nome"
            v-model="profile.nome"
            class="input-field"
          />
        </div>

        <div class="mb-4">
          <label for="sesso" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sesso Biologico</label>
          <select id="sesso" v-model="profile.sesso" class="input-field">
            <option value="M">Maschile</option>
            <option value="F">Femminile</option>
            <option value="Altro">Altro / Non specificato</option>
          </select>
        </div>

        <div class="mb-4">
          <label for="data_nascita" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data di Nascita</label>
          <input
            type="date"
            id="data_nascita"
            v-model="profile.data_di_nascita"
            class="input-field"
          />
        </div>

        <div class="mb-4">
          <label for="tipo_misuratore" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipo Misuratore Pressione</label>
          <select id="tipo_misuratore" v-model="profile.tipo_misuratore" class="input-field">
            <option value="automatico">Automatico (Digitale)</option>
            <option value="manuale">Manuale (Auscultatorio)</option>
          </select>
        </div>

        <!-- Categorie Farmaci (Checkbox Rapidi) -->
        <fieldset class="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
          <legend class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Categorie Farmaci (Rapido)</legend>
          <div class="checkbox-wrapper">
            <input type="checkbox" id="farmaci_pressione" v-model="profile.farmaci_pressione" class="checkbox-input">
            <label for="farmaci_pressione" class="checkbox-label">Assumo farmaci per la Pressione</label>
          </div>
          <div class="checkbox-wrapper">
            <input type="checkbox" id="farmaci_cuore" v-model="profile.farmaci_cuore" class="checkbox-input">
            <label for="farmaci_cuore" class="checkbox-label">Assumo farmaci per il Cuore</label>
          </div>
          <div class="checkbox-wrapper">
            <input type="checkbox" id="anticoagulanti" v-model="profile.anticoagulanti" class="checkbox-input">
            <label for="anticoagulanti" class="checkbox-label">Assumo Anticoagulanti</label>
          </div>
        </fieldset>

        <!-- NUOVO: Terapia Farmacologica Dettagliata -->
        <div class="mt-4">
          <label for="terapia" class="block text-sm font-bold text-green-600 dark:text-green-400 mb-2">
            Elenco Farmaci (Terapia)
          </label>
          <p class="text-xs text-gray-500 mb-2">
            Inserisci qui i nomi e i dosaggi dei farmaci (es. "Ramipril 5mg ore 8:00"). Questo aiuterà Lisa a essere più precisa.
          </p>
          <textarea
            id="terapia"
            v-model="profile.terapia_farmacologica"
            rows="3"
            class="input-field"
            placeholder="Es. Bisoprololo 1.25mg mattina, Cardioaspirina dopo pranzo..."
          ></textarea>
        </div>

        <!-- Note per Lisa -->
        <div class="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
          <label for="piano" class="block text-sm font-bold text-blue-600 dark:text-blue-400 mb-2">
            <font-awesome-icon icon="comment-dots" class="mr-1"/> Note Comportamentali per Lisa
          </label>
          <p class="text-xs text-gray-500 mb-2">
            Istruzioni speciali per Lisa (es. "Ricordami di misurare 3 volte al giorno", "Attenzione al braccio sinistro").
          </p>
          <textarea
            id="piano"
            v-model="profile.piano_terapeutico"
            rows="3"
            class="input-field"
            placeholder="Esempio: Il cardiologo ha detto di controllare la pressione ogni volta che ho mal di testa."
          ></textarea>
        </div>

        <button type="submit" :disabled="saveLoading" class="mt-6 w-full px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 disabled:opacity-50">
          {{ saveLoading ? 'Salvataggio...' : 'Salva Profilo' }}
        </button>

        <div v-if="saveSuccessMessage" class="mt-4 p-3 bg-green-100 dark:bg-green-900 border border-green-400 text-green-700 dark:text-green-200 rounded-lg">
          {{ saveSuccessMessage }}
        </div>
        <div v-if="saveErrorMessage" class="mt-4 p-3 bg-red-100 dark:bg-red-900 border border-red-400 text-red-700 dark:text-red-200 rounded-lg">
          {{ saveErrorMessage }}
        </div>

      </form>

      <!-- Bottone Logout -->
      <button
        @click="handleLogout"
        :disabled="logoutLoading"
        class="mt-4 w-full px-4 py-2 bg-red-500 text-white font-semibold rounded-lg shadow-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75 disabled:opacity-50"
      >
        {{ logoutLoading ? 'Uscita...' : 'Logout' }}
      </button>

      <!-- Messaggio di Errore Logout (spostato da 'errorMessage' a 'logoutErrorMessage') -->
      <div v-if="logoutErrorMessage" class="mt-4 p-3 bg-red-100 dark:bg-red-900 border border-red-400 text-red-700 dark:text-red-200 rounded-lg">
        {{ logoutErrorMessage }}
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { supabase } from '../supabase';
import { userSession } from '../store/auth.js'; // Store per l'Auth
// Importiamo lo store del PROFILO
import { profile, loading as profileLoading, error as profileError, updateProfile } from '../store/profile.js';
// Importiamo il Loader
import Loader from '../components/Loader.vue';

// Stato per il Logout
const logoutLoading = ref(false);
const logoutErrorMessage = ref(null);
const user = computed(() => userSession.value?.user ?? null);

// Stato per il Salvataggio Profilo
const saveLoading = ref(false);
const saveErrorMessage = ref(null);
const saveSuccessMessage = ref(null);

// Funzione per il SALVATAGGIO PROFILO
const handleSaveProfile = async () => {
  try {
    saveLoading.value = true;
    saveErrorMessage.value = null;
    saveSuccessMessage.value = null;

    // Chiamiamo la funzione dello store, passando i dati dal form (profile.value)
    await updateProfile(profile.value);

    saveSuccessMessage.value = 'Profilo aggiornato con successo!';
    // Nascondi il messaggio dopo 3 secondi
    setTimeout(() => { saveSuccessMessage.value = null }, 3000);

  } catch (error) {
    console.error("Errore Salvataggio Profilo:", error.message);
    saveErrorMessage.value = `Errore salvataggio: ${error.message}`;
  } finally {
    saveLoading.value = false;
  }
};

// Funzione per il LOGOUT
const handleLogout = async () => {
  try {
    logoutLoading.value = true;
    logoutErrorMessage.value = null;

    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    // L'onAuthStateChange in router.js gestirà il redirect

  } catch (error) {
    console.error("Errore Logout:", error.message);
    logoutErrorMessage.value = `Errore di logout: ${error.message}`;
  } finally {
    logoutLoading.value = false;
  }
};
</script>

<style scoped>
/* Stili utility per i campi del form */
.input-field {
  @apply w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white;
}

.checkbox-wrapper {
  @apply flex items-center mb-2;
}

.checkbox-input {
  @apply h-4 w-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 dark:bg-gray-700 dark:focus:ring-blue-600;
}

.checkbox-label {
  @apply ml-2 block text-sm text-gray-700 dark:text-gray-300;
}
</style>
