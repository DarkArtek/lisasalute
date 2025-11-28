<template>
  <div class="p-4 pb-24 max-w-4xl mx-auto"> <!-- Max width aumentata per layout migliore -->
    <h1 class="text-2xl font-semibold mb-4 flex items-center">
      <font-awesome-icon icon="user" class="mr-2 text-blue-600" />
      Profilo Utente
    </h1>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">

      <!-- COLONNA SX: Dati Anagrafici (Esistente) -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 h-fit">
        <h2 class="text-lg font-bold text-gray-800 dark:text-white mb-4">Dati Personali</h2>

        <div v-if="profileLoading" class="py-4">
          <Loader />
        </div>

        <form v-if="profile && !profileLoading" @submit.prevent="handleSaveProfile">
          <!-- Email -->
          <div v-if="user" class="mb-4">
            <label class="label">Email</label>
            <input type="email" :value="user.email" disabled class="input-field bg-gray-100 cursor-not-allowed" />
          </div>

          <!-- Nome -->
          <div class="mb-4">
            <label for="nome" class="label">Nome Completo</label>
            <input type="text" id="nome" v-model="profile.nome" class="input-field" />
          </div>

          <div class="grid grid-cols-2 gap-4 mb-4">
            <!-- Sesso -->
            <div>
              <label for="sesso" class="label">Sesso</label>
              <select id="sesso" v-model="profile.sesso" class="input-field">
                <option value="M">Maschile</option>
                <option value="F">Femminile</option>
                <option value="Altro">Altro</option>
              </select>
            </div>
            <!-- Data Nascita -->
            <div>
              <label for="data_nascita" class="label">Data di Nascita</label>
              <input type="date" id="data_nascita" v-model="profile.data_di_nascita" class="input-field" />
            </div>
          </div>

          <!-- Tipo Misuratore -->
          <div class="mb-4">
            <label for="tipo_misuratore" class="label">Tipo Misuratore</label>
            <select id="tipo_misuratore" v-model="profile.tipo_misuratore" class="input-field">
              <option value="automatico">Automatico (Digitale)</option>
              <option value="manuale">Manuale (Auscultatorio)</option>
            </select>
          </div>

          <!-- Orari -->
          <div class="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
            <div class="flex items-center justify-between mb-2">
              <label class="label text-purple-600 dark:text-purple-400">Orari Misurazioni</label>
              <div class="flex items-center">
                <input type="checkbox" id="scheduler" v-model="profile.abilita_scheduler" class="mr-2 h-4 w-4 text-purple-600 rounded">
                <label for="scheduler" class="text-xs">Attiva</label>
              </div>
            </div>
            <div class="grid grid-cols-3 gap-2" v-if="profile.abilita_scheduler">
              <input type="time" v-model="profile.orario_mattina" class="input-field text-center px-1" />
              <input type="time" v-model="profile.orario_pomeriggio" class="input-field text-center px-1" />
              <input type="time" v-model="profile.orario_sera" class="input-field text-center px-1" />
            </div>
          </div>

          <button type="submit" :disabled="saveLoading" class="mt-6 w-full btn-primary">
            {{ saveLoading ? 'Salvataggio...' : 'Salva Dati' }}
          </button>

          <p v-if="saveSuccessMessage" class="text-green-600 text-sm mt-2 text-center">{{ saveSuccessMessage }}</p>
        </form>
      </div>

      <!-- COLONNA DX: Gestione Farmaci (NUOVO) -->
      <div class="space-y-6">

        <!-- Componente Selettore -->
        <MedicationSelector @drug-added="handleDrugAdded" />

        <!-- Lista Farmaci -->
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 class="text-lg font-bold text-gray-800 dark:text-white mb-4 flex justify-between items-center">
            <span>La tua Terapia</span>
            <span class="text-xs font-normal text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full">{{ medications.length }} farmaci</span>
          </h2>

          <div v-if="medications.length === 0" class="text-center py-8 text-gray-400 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
            <font-awesome-icon icon="pills" class="text-3xl mb-2 opacity-50" />
            <p class="text-sm">Nessun farmaco inserito.</p>
            <p class="text-xs">Usa il box sopra per aggiungere la tua terapia.</p>
          </div>

          <ul v-else class="space-y-3">
            <li
              v-for="med in medications"
              :key="med.id"
              class="flex justify-between items-start p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-100 dark:border-gray-600 group"
            >
              <div>
                <div class="font-bold text-gray-800 dark:text-white">{{ med.nome_farmaco }}</div>
                <div class="text-sm text-blue-600 dark:text-blue-300 font-medium">
                  {{ med.dosaggio }} <span class="text-gray-400 mx-1">•</span> {{ med.frequenza }}
                </div>
                <div v-if="med.note" class="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">
                  "{{ med.note }}"
                </div>
              </div>
              <button
                @click="removeMedication(med.id)"
                class="text-gray-400 hover:text-red-500 p-1 transition-colors"
                title="Rimuovi"
              >
                <font-awesome-icon icon="trash-can" />
              </button>
            </li>
          </ul>
        </div>

        <!-- Logout -->
        <button
          @click="handleLogout"
          class="w-full py-2 bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 rounded-lg font-semibold text-sm transition-colors"
        >
          Disconnetti
        </button>

      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { supabase } from '../supabase';
import { userSession } from '../store/auth.js';
import {
  profile,
  loading as profileLoading,
  error as profileError,
  updateProfile,
  medications, // Lista dallo store
  addMedication, // Azione add
  removeMedication // Azione remove
} from '../store/profile.js';

import Loader from '../components/Loader.vue';
import MedicationSelector from '../components/MedicationSelector.vue'; // Import Componente

// Stati UI
const logoutLoading = ref(false);
const saveLoading = ref(false);
const saveSuccessMessage = ref(null);
const user = computed(() => userSession.value?.user ?? null);

// Gestione Aggiunta Farmaco (Evento dal componente figlio)
const handleDrugAdded = async (medData) => {
  try {
    await addMedication(medData);
    // Feedback visivo opzionale?
  } catch (e) {
    alert("Errore aggiunta farmaco: " + e.message);
  }
};

const handleSaveProfile = async () => {
  try {
    saveLoading.value = true;
    await updateProfile(profile.value);
    saveSuccessMessage.value = 'Dati salvati!';
    setTimeout(() => { saveSuccessMessage.value = null }, 3000);
  } catch (error) {
    alert(`Errore: ${error.message}`);
  } finally {
    saveLoading.value = false;
  }
};

const handleLogout = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) console.error(error);
  // Router gestirà il redirect
};
</script>

<style scoped>
.label {
  @apply block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1 tracking-wide;
}
.input-field {
  @apply w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white transition-all;
}
.btn-primary {
  @apply py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow transition-colors disabled:opacity-50;
}
</style>
