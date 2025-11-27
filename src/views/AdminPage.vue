<template>
  <div class="p-4 max-w-6xl mx-auto">
    <h1 class="text-3xl font-bold mb-8 text-center text-gray-800 dark:text-white">
      <font-awesome-icon icon="user-md" class="mr-2 text-red-600" />
      Pannello Amministrazione
    </h1>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">

      <div class="lg:col-span-1">
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 sticky top-6">
          <h2 class="text-xl font-semibold mb-4 text-gray-700 dark:text-gray-200">
            {{ isEditing ? 'Modifica Farmaco' : 'Nuovo Farmaco' }}
          </h2>

          <form @submit.prevent="handleSubmit" class="space-y-4">
            <div>
              <label class="label">Nome Commerciale</label>
              <input v-model="formData.nome_commerciale" type="text" class="input-field" placeholder="Es. Triatec" required />
            </div>

            <div>
              <label class="label">Principio Attivo</label>
              <input v-model="formData.principio_attivo" type="text" class="input-field" placeholder="Es. Ramipril" required />
            </div>

            <div class="grid grid-cols-1 gap-4">
              <div>
                <label class="label">Classe Terapeutica</label>
                <select v-model="formData.classe_terapeutica" class="input-field">
                  <option value="Antipertensivo">Antipertensivo</option>
                  <option value="Antidiabetico">Antidiabetico</option>
                  <option value="Antiaritmico">Antiaritmico</option>
                  <option value="Anticoagulante">Anticoagulante</option>
                  <option value="Altro">Altro</option>
                </select>
              </div>

              <div>
                <label class="label">Categoria Specifica</label>
                <input v-model="formData.categoria" type="text" class="input-field" placeholder="Es. ACE-Inibitore" />
              </div>
            </div>

            <div class="flex gap-2 pt-2">
              <button type="submit" :disabled="loading"
                      class="flex-1 py-2 px-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors disabled:opacity-50">
                {{ loading ? 'Salvataggio...' : (isEditing ? 'Aggiorna' : 'Aggiungi') }}
              </button>

              <button v-if="isEditing" type="button" @click="resetForm"
                      class="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors">
                Annulla
              </button>
            </div>

            <p v-if="message" :class="{'text-green-500': !error, 'text-red-500': error}" class="text-center text-sm mt-2">
              {{ message }}
            </p>
          </form>
        </div>
      </div>

      <div class="lg:col-span-2">
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden flex flex-col h-[600px]">

          <div class="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900">
            <h3 class="font-semibold text-lg">Catalogo Farmaci ({{ filteredDrugs.length }})</h3>
            <div class="relative w-64">
              <input
                v-model="searchQuery"
                type="text"
                placeholder="Cerca farmaco..."
                class="w-full pl-8 pr-3 py-1 text-sm border rounded-full bg-white dark:bg-gray-800 dark:border-gray-600 focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
              <span class="absolute left-3 top-1.5 text-gray-400">🔍</span>
            </div>
          </div>

          <div class="overflow-y-auto flex-1 p-0">
            <table class="w-full text-left border-collapse">
              <thead class="bg-gray-100 dark:bg-gray-700 sticky top-0 z-10">
              <tr>
                <th class="p-3 text-xs font-bold text-gray-500 dark:text-gray-300 uppercase">Nome</th>
                <th class="p-3 text-xs font-bold text-gray-500 dark:text-gray-300 uppercase">Principio</th>
                <th class="p-3 text-xs font-bold text-gray-500 dark:text-gray-300 uppercase hidden sm:table-cell">Categoria</th>
                <th class="p-3 text-xs font-bold text-gray-500 dark:text-gray-300 uppercase text-center">Azioni</th>
              </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              <tr v-if="loadingList" class="text-center">
                <td colspan="4" class="p-8 text-gray-500">Caricamento dati...</td>
              </tr>
              <tr v-else-if="filteredDrugs.length === 0" class="text-center">
                <td colspan="4" class="p-8 text-gray-500">Nessun farmaco trovato.</td>
              </tr>

              <tr v-for="drug in filteredDrugs" :key="drug.id" class="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group">
                <td class="p-3">
                  <div class="font-bold text-gray-800 dark:text-gray-100">{{ drug.nome_commerciale }}</div>
                  <div class="text-xs text-gray-500 sm:hidden">{{ drug.classe_terapeutica }}</div>
                </td>
                <td class="p-3 text-sm text-gray-600 dark:text-gray-300">{{ drug.principio_attivo }}</td>
                <td class="p-3 hidden sm:table-cell">
                    <span class="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                      {{ drug.categoria }}
                    </span>
                </td>
                <td class="p-3 text-center">
                  <div class="flex justify-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button @click="startEdit(drug)" class="text-blue-500 hover:text-blue-700 p-1" title="Modifica">
                      ✏️
                    </button>
                    <button @click="deleteDrug(drug.id)" class="text-red-500 hover:text-red-700 p-1" title="Elimina">
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { supabase } from '../supabase';

// Stati
const drugs = ref([]);
const loading = ref(false);
const loadingList = ref(false);
const message = ref('');
const error = ref(false);
const searchQuery = ref('');
const isEditing = ref(false);
const editingId = ref(null);

// Form Data Iniziale
const initialForm = {
  nome_commerciale: '',
  principio_attivo: '',
  categoria: '',
  classe_terapeutica: 'Antipertensivo'
};
const formData = ref({ ...initialForm });

// --- GESTIONE DATI ---

// 1. Carica lista farmaci
const fetchDrugs = async () => {
  loadingList.value = true;
  try {
    const { data, error: fetchError } = await supabase
      .from('drug_catalog')
      .select('*')
      .order('nome_commerciale', { ascending: true });

    if (fetchError) throw fetchError;
    drugs.value = data || [];
  } catch (err) {
    console.error(err);
  } finally {
    loadingList.value = false;
  }
};

// 2. Computed per la ricerca
const filteredDrugs = computed(() => {
  if (!searchQuery.value) return drugs.value;
  const q = searchQuery.value.toLowerCase();
  return drugs.value.filter(d =>
    d.nome_commerciale.toLowerCase().includes(q) ||
    d.principio_attivo.toLowerCase().includes(q) ||
    (d.categoria && d.categoria.toLowerCase().includes(q))
  );
});

// 3. Salva o Aggiorna (Submit)
const handleSubmit = async () => {
  loading.value = true;
  message.value = '';
  error.value = false;

  try {
    if (isEditing.value) {
      // UPDATE
      const { error: updateError } = await supabase
        .from('drug_catalog')
        .update(formData.value)
        .eq('id', editingId.value);

      if (updateError) throw updateError;
      message.value = 'Farmaco aggiornato!';
    } else {
      // INSERT
      const { error: insertError } = await supabase
        .from('drug_catalog')
        .insert([formData.value]);

      if (insertError) throw insertError;
      message.value = 'Farmaco aggiunto!';
    }

    resetForm();
    await fetchDrugs(); // Ricarica la lista

  } catch (err) {
    console.error(err);
    error.value = true;
    message.value = 'Errore: ' + err.message;
  } finally {
    loading.value = false;
    // Pulisce il messaggio dopo 3 sec
    setTimeout(() => { message.value = '' }, 3000);
  }
};

// 4. Inizia Modifica
const startEdit = (drug) => {
  isEditing.value = true;
  editingId.value = drug.id;
  // Copia i dati nel form
  formData.value = {
    nome_commerciale: drug.nome_commerciale,
    principio_attivo: drug.principio_attivo,
    categoria: drug.categoria,
    classe_terapeutica: drug.classe_terapeutica
  };
  window.scrollTo({ top: 0, behavior: 'smooth' }); // Torna su al form
};

// 5. Elimina
const deleteDrug = async (id) => {
  if (!confirm("Sei sicuro di voler eliminare questo farmaco dal catalogo?")) return;

  try {
    const { error: delError } = await supabase
      .from('drug_catalog')
      .delete()
      .eq('id', id);

    if (delError) throw delError;

    // Rimuovi localmente per velocità
    drugs.value = drugs.value.filter(d => d.id !== id);
  } catch (err) {
    alert("Errore eliminazione: " + err.message);
  }
};

// 6. Reset
const resetForm = () => {
  isEditing.value = false;
  editingId.value = null;
  formData.value = { ...initialForm };
};

onMounted(() => {
  fetchDrugs();
});
</script>

<style scoped>
.label {
  @apply block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1 tracking-wide;
}
.input-field {
  @apply w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all;
}
</style>
