<template>
  <div class="p-4">
    <h1 class="text-2xl font-bold mb-6 text-center text-red-600">Pannello Admin</h1>

    <div class="max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <h2 class="text-lg font-semibold mb-4">Aggiungi Farmaco al Catalogo</h2>

      <form @submit.prevent="handleAddDrug" class="space-y-4">

        <div>
          <label class="block text-sm font-medium mb-1">Nome Commerciale</label>
          <input v-model="newDrug.nome_commerciale" type="text" class="input-field" placeholder="Es. Triatec" required />
        </div>

        <div>
          <label class="block text-sm font-medium mb-1">Principio Attivo</label>
          <input v-model="newDrug.principio_attivo" type="text" class="input-field" placeholder="Es. Ramipril" required />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium mb-1">Classe Terapeutica</label>
            <select v-model="newDrug.classe_terapeutica" class="input-field">
              <option value="Antipertensivo">Antipertensivo</option>
              <option value="Antidiabetico">Antidiabetico</option>
              <option value="Antiaritmico">Antiaritmico</option>
              <option value="Altro">Altro</option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium mb-1">Categoria Specifica</label>
            <input v-model="newDrug.categoria" type="text" class="input-field" placeholder="Es. ACE-Inibitore" />
          </div>
        </div>

        <button type="submit" :disabled="loading" class="w-full py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg">
          {{ loading ? 'Salvataggio...' : 'Aggiungi al Database' }}
        </button>

        <p v-if="message" :class="{'text-green-500': !error, 'text-red-500': error}" class="text-center text-sm mt-2">
          {{ message }}
        </p>
      </form>
    </div>

    <!-- Lista ultimi inserimenti -->
    <div class="max-w-2xl mx-auto mt-8">
      <h3 class="text-md font-semibold mb-2">Ultimi Farmaci Inseriti</h3>
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <ul class="divide-y divide-gray-200 dark:divide-gray-700">
          <li v-for="drug in recentDrugs" :key="drug.id" class="p-3 text-sm flex justify-between">
            <span>
              <strong class="text-blue-600">{{ drug.nome_commerciale }}</strong>
              <span class="text-gray-500">({{ drug.principio_attivo }})</span>
            </span>
            <span class="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">{{ drug.categoria }}</span>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { supabase } from '../supabase';

const loading = ref(false);
const message = ref('');
const error = ref(false);
const recentDrugs = ref([]);

const newDrug = ref({
  nome_commerciale: '',
  principio_attivo: '',
  categoria: '',
  classe_terapeutica: 'Antipertensivo'
});

const fetchRecent = async () => {
  const { data } = await supabase
    .from('drug_catalog')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);
  recentDrugs.value = data || [];
};

const handleAddDrug = async () => {
  loading.value = true;
  message.value = '';
  error.value = false;

  try {
    const { error: insertError } = await supabase
      .from('drug_catalog')
      .insert([{ ...newDrug.value }]);

    if (insertError) throw insertError;

    message.value = 'Farmaco inserito con successo!';
    // Reset form
    newDrug.value = { nome_commerciale: '', principio_attivo: '', categoria: '', classe_terapeutica: 'Antipertensivo' };
    fetchRecent();

  } catch (err) {
    console.error(err);
    error.value = true;
    message.value = 'Errore: ' + err.message;
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchRecent();
});
</script>

<style scoped>
.input-field {
  @apply w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 dark:bg-gray-700 dark:text-white;
}
</style>
