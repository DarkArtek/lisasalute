<template>
  <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
    <h3 class="text-sm font-bold text-gray-700 dark:text-gray-200 mb-3 flex items-center">
      <font-awesome-icon icon="pills" class="mr-2 text-blue-500" />
      Aggiungi Farmaco
    </h3>

    <!-- 1. BARRA DI RICERCA (Autocomplete) -->
    <div class="relative mb-4">
      <input
        type="text"
        v-model="searchQuery"
        @input="handleSearch"
        placeholder="Cerca nome farmaco o principio attivo..."
        class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
        :disabled="selectedDrug !== null"
      />

      <!-- Icona Reset -->
      <button
        v-if="selectedDrug || searchQuery"
        @click="resetSearch"
        class="absolute right-3 top-2.5 text-gray-400 hover:text-red-500"
      >
        &times;
      </button>

      <!-- Risultati Autocomplete -->
      <ul v-if="searchResults.length > 0 && !selectedDrug" class="absolute z-10 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg mt-1 max-h-48 overflow-y-auto shadow-lg">
        <li
          v-for="drug in searchResults"
          :key="drug.id"
          @click="selectDrug(drug)"
          class="px-4 py-2 hover:bg-blue-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-0"
        >
          <div class="font-bold text-gray-800 dark:text-gray-200">{{ drug.nome_commerciale }}</div>
          <div class="text-xs text-gray-500">{{ drug.principio_attivo }} - {{ drug.classe_terapeutica }}</div>
        </li>
      </ul>
    </div>

    <!-- 2. FORM DETTAGLI (Visibile solo dopo selezione) -->
    <div v-if="selectedDrug" class="animate-fade-in">

      <!-- Avviso / Toggle per Dosaggio Variabile -->
      <div class="flex items-center justify-between mb-3">
        <label class="flex items-center cursor-pointer">
          <input type="checkbox" v-model="isDynamicDose" class="form-checkbox h-4 w-4 text-blue-600 rounded border-gray-300">
          <span class="ml-2 text-xs text-gray-600 dark:text-gray-300 font-medium">Dosaggio Variabile (es. Insulina Rapida)</span>
        </label>
      </div>

      <div v-if="isDynamicDose" class="mb-3 p-2 bg-yellow-50 text-yellow-800 text-xs rounded border border-yellow-200">
        <font-awesome-icon icon="info-circle" class="mr-1"/>
        Inserisci la regola di calcolo o "Variabile" nel campo dosaggio.
      </div>

      <div class="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label class="block text-xs font-bold text-gray-500 mb-1">
            {{ isDynamicDose ? 'Regola / Fattore' : 'Dosaggio / Unità' }}
          </label>
          <input
            v-model="details.dosaggio"
            type="text"
            :placeholder="isDynamicDose ? 'Es. 1U ogni 10g CHO' : 'Es. 5mg o 10 UI'"
            class="input-mini"
          />
        </div>
        <div>
          <label class="block text-xs font-bold text-gray-500 mb-1">Frequenza</label>
          <select v-model="details.frequenza" class="input-mini">
            <option value="1 volta al dì">1 volta al dì</option>
            <option value="2 volte al dì">2 volte al dì (Mattina/Sera)</option>
            <option value="3 volte al dì">3 volte al dì (Pasti principali)</option>
            <option value="4 volte al dì">4 volte al dì</option>
            <option value="Al bisogno">Al bisogno</option>
            <option value="A giorni alterni">A giorni alterni</option>
            <option value="La sera">La sera</option>
            <option value="Personalizzata">Altro / Schema Complesso</option>
          </select>
        </div>
      </div>

      <!-- Campo Extra per Note o Frequenza Personalizzata -->
      <div v-if="details.frequenza === 'Personalizzata' || isInsulin || isDynamicDose" class="mb-4">
        <label class="block text-xs font-bold text-gray-500 mb-1">Dettagli / Note per Lisa</label>
        <input
          v-model="details.note"
          type="text"
          placeholder="Es. Calcolo basato su glicemia pre-pasto"
          class="input-mini"
        />
      </div>

      <button
        @click="confirmAdd"
        :disabled="loading"
        class="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm transition-colors"
      >
        {{ loading ? 'Salvataggio...' : 'Conferma e Aggiungi' }}
      </button>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { supabase } from '../supabase';

const emit = defineEmits(['drug-added']);

const searchQuery = ref('');
const searchResults = ref([]);
const selectedDrug = ref(null);
const loading = ref(false);
const isDynamicDose = ref(false); // Nuovo stato per dosaggio variabile

const details = ref({
  dosaggio: '',
  frequenza: '1 volta al dì',
  note: ''
});

// Computed per rilevare se è insulina (semplice check sul nome o categoria)
const isInsulin = computed(() => {
  if (!selectedDrug.value) return false;
  const name = selectedDrug.value.nome_commerciale.toLowerCase();
  const category = (selectedDrug.value.categoria || '').toLowerCase();
  return name.includes('insulin') || category.includes('insulin') ||
    name.includes('lantus') || name.includes('toujeo') ||
    name.includes('novorapid') || name.includes('humalog') ||
    name.includes('tresiba') || name.includes('apidra') ||
    name.includes('fiasp') || name.includes('lispro');
});

// Se è un'insulina rapida (o generica), attiviamo di default il dosaggio dinamico
watch(isInsulin, (val) => {
  if (val) {
    // Cerchiamo di capire se è rapida (spesso "Rapid", "Aspart", "Lispro") vs Basale ("Glargine", "Detemir", "Degludec")
    const name = selectedDrug.value?.nome_commerciale?.toLowerCase() || '';
    const isBasal = name.includes('lantus') || name.includes('toujeo') || name.includes('tresiba') || name.includes('levemir') || name.includes('basaglar');

    // Se è basale, probabilmente è fissa. Se è rapida (o non sappiamo), proponiamo variabile.
    if (!isBasal) {
      isDynamicDose.value = true;
      details.value.frequenza = 'Personalizzata'; // Spesso ai pasti
    } else {
      isDynamicDose.value = false; // Basale di solito è fissa
      details.value.frequenza = '1 volta al dì'; // O "La sera"
    }
  }
});

// Funzione di ricerca su Supabase (drug_catalog)
const handleSearch = async () => {
  if (searchQuery.value.length < 2) {
    searchResults.value = [];
    return;
  }

  const { data, error } = await supabase
    .from('drug_catalog')
    .select('*')
    .or(`nome_commerciale.ilike.%${searchQuery.value}%,principio_attivo.ilike.%${searchQuery.value}%`)
    .limit(5);

  if (!error) {
    searchResults.value = data;
  }
};

const selectDrug = (drug) => {
  selectedDrug.value = drug;
  searchQuery.value = drug.nome_commerciale; // Blocca il testo nell'input
  searchResults.value = []; // Nascondi dropdown
  // Il watcher su isInsulin gestirà i default, ma resettiamo per sicurezza
  isDynamicDose.value = false;
};

const resetSearch = () => {
  searchQuery.value = '';
  searchResults.value = [];
  selectedDrug.value = null;
  isDynamicDose.value = false;
  details.value = { dosaggio: '', frequenza: '1 volta al dì', note: '' };
};

const confirmAdd = async () => {
  if (!selectedDrug.value) return;
  loading.value = true;

  try {
    // Emettiamo l'evento al genitore (ProfilePage) che gestirà il salvataggio
    const medicationData = {
      drug_id: selectedDrug.value.id,
      nome_farmaco: selectedDrug.value.nome_commerciale,
      // Se dinamico, potremmo aggiungere un prefisso o lasciarlo come testo "Variabile: ..."
      dosaggio: isDynamicDose.value ? `(Variabile) ${details.value.dosaggio}` : details.value.dosaggio,
      frequenza: details.value.frequenza,
      note: details.value.note
    };

    emit('drug-added', medicationData);
    resetSearch(); // Pulisci dopo l'invio

  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.input-mini {
  @apply w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 dark:bg-gray-800 dark:text-white;
}
.animate-fade-in {
  animation: fadeIn 0.3s ease-in-out;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-5px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
