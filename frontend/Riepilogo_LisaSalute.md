Certo, ecco il riepilogo aggiornato del progetto "LisaSalute". Contiene tutti i file che abbiamo creato e la roadmap con i prossimi step (incluso il campo `braccio` e le nuove feature del diario).

***

<br>
# Riepilogo Progetto LisaSalute (Vue.js + Supabase)


Questo documento riepiloga tutti i file e la configurazione del progetto "LisaSalute".

***

<br>
## 1\. File di Configurazione e Dipendenze


<br>
### `package.json`


*Elenco delle dipendenze (Vue, Router, Supabase, Tailwind, FontAwesome) e script (Vite).*
JSON

```
{
  "name": "lisasalute",
  "version": "0.1.0",
  "private": true,
  "description": "LisaSalute: App Vue.js per monitoraggio parametri vitali con Supabase.",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@fortawesome/fontawesome-svg-core": "^6.5.2",
    "@fortawesome/free-regular-svg-icons": "^6.5.2",
    "@fortawesome/free-solid-svg-icons": "^6.5.2",
    "@fortawesome/vue-fontawesome": "^3.0.8",
    "@supabase/supabase-js": "^2.43.5",
    "vue": "^3.4.27",
    "vue-router": "^4.3.3"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.0.5",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.38",
    "tailwindcss": "^3.4.4",
    "vite": "^5.2.13"
  }
}
```


### `vite.config.js`


*Configurazione di Vite.*
JavaScript

```
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
})
```


### `tailwind.config.js`


*Configurazione di Tailwind CSS (inclusi i percorsi dei file `src`).*
JavaScript

```
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}", // Dice a Tailwind di "guardare" tutti i file Vue e JS
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```


### `postcss.config.js`


*Configurazione di PostCSS per caricare Tailwind e Autoprefixer.*
JavaScript

```
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

***

<br>
## 2\. Struttura Base App \(HTML/CSS/JS\)


<br>
### `index.html`


*Punto di ingresso principale.*
HTML

```
<!doctype html>
<html lang="it">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>LisaSalute</title>
    <!-- Favicon (da salvare in /public/favicon.svg) -->
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <!-- Il nostro CSS principale (che includerà Tailwind) -->
    <link rel="stylesheet" href="/src/style.css" />
  </head>
  <body class="bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
    <!-- Questo è il div dove Vue monterà l'applicazione -->
    <div id="app"></div>
    
    <!-- Questo è il punto di ingresso JavaScript per Vite -->
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```


### `src/style.css`


*Importazione layer di Tailwind.*
CSS

```
/* Questo file importa i "layer" fondamentali di Tailwind CSS.
  Vite li prenderà e li processerà con PostCSS (come da configurazione)
  per generare il file CSS finale.
*/

@tailwind base;
@tailwind components;
@tailwind utilities;
```


### `src/main.js`


*Inizializzazione Vue, Router e FontAwesome.*
JavaScript

```
import { createApp } from 'vue'

// 1. Stili e Guscio
import './style.css' // Carica gli stili Tailwind
import App from './App.vue'

// 2. Router (per le pagine)
import router from './router'

// 3. Supabase (il nostro database e auth)
// Non c'è bisogno di importarlo qui se non globalmente, 
// lo importeremo nei componenti dove serve. Ma lo prepariamo.

// 4. Font Awesome (Icone)
import { library } from '@fortawesome/fontawesome-svg-core'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
// Importiamo le icone che ci servono (esempio)
import { 
  faHeartPulse, 
  faBookMedical, 
  faUser, 
  faPaperPlane,
  faCommentDots 
} from '@fortawesome/free-solid-svg-icons'

// Aggiungiamo le icone alla libreria
library.add(faHeartPulse, faBookMedical, faUser, faPaperPlane, faCommentDots)

// Creazione dell'istanza dell'app
const app = createApp(App)

// Registriamo il componente FontAwesome globalmente
app.component('font-awesome-icon', FontAwesomeIcon)

// Usiamo il router
app.use(router)

// Montiamo l'app nell'HTML
app.mount('#app')
```


### `src/supabase.js`


*Configurazione del client Supabase.*
JavaScript

```
import { createClient } from '@supabase/supabase-js'

// ATTENZIONE: Sostituisci questi valori con le tue chiavi Supabase
// Le trovi nel pannello di controllo del tuo progetto Supabase > Settings > API
const supabaseUrl = 'IL_TUO_SUPABASE_URL'
const supabaseAnonKey = 'LA_TUA_SUPABASE_ANON_KEY'

if (!supabaseUrl || supabaseUrl === 'IL_TUO_SUPABASE_URL') {
  console.warn('Supabase URL non impostato. Inseriscilo in /src/supabase.js');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

***

<br>
## 3\. Router e Viste \(Pagine\)


<br>
### `src/router.js`


*Definizione delle rotte e "Navigation Guard" (guardia di sicurezza) per l'autenticazione.*
JavaScript

```
import { createRouter, createWebHistory } from 'vue-router'

// Importiamo i componenti delle viste (pagine)
// Li creiamo subito dopo come placeholder
import ChatPage from './views/ChatPage.vue'
import DiaryPage from './views/DiaryPage.vue'
import ProfilePage from './views/ProfilePage.vue'
import AuthPage from './views/AuthPage.vue' // Pagina per Login/Registrazione

// Importiamo il necessario per la guardia
import { supabase } from './supabase.js'
// AGGIORNATO: Importa dallo store specifico
import { userSession } from './store/auth.js'

const routes = [
  { 
    path: '/auth', 
    name: 'Auth', 
    component: AuthPage 
  },
  { 
    path: '/', 
    name: 'Chat', 
    component: ChatPage,
    meta: { requiresAuth: true } // Questa rotta richiede autenticazione
  },
  { 
    path: '/diario', 
    name: 'Diario', 
    component: DiaryPage,
    meta: { requiresAuth: true } 
  },
  { 
    path: '/profilo', 
    name: 'Profilo', 
    component: ProfilePage,
    meta: { requiresAuth: true } 
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// "GUARDIANO" DI SICUREZZA (Navigation Guard)
router.beforeEach(async (to, from, next) => {
  // 1. Chiediamo a Supabase la sessione corrente
  //    (serve per il primo caricamento della pagina)
  const { data: { session } } = await supabase.auth.getSession()
  
  // Se non c'è una sessione locale, la impostiamo nello store
  if (!userSession.value) {
    userSession.value = session
  }

  const requiresAuth = to.matched.some(record => record.meta.requiresAuth)
  const isAuthenticated = userSession.value && userSession.value.user

  if (requiresAuth && !isAuthenticated) {
    // 2. Se la pagina richiede auth e l'utente NON è loggato
    //    lo mandiamo alla pagina di /auth
    console.log('Accesso non autorizzato, reindirizzo a /auth');
    next({ name: 'Auth' })
  } else if (to.name === 'Auth' && isAuthenticated) {
    // 3. Se l'utente è GIA' loggato e cerca di andare in /auth
    //    lo mandiamo alla chat (pagina principale)
    console.log('Utente già loggato, reindirizzo a /');
    next({ name: 'Chat' })
  } else {
    // 4. Altrimenti, tutto ok, vai pure.
    next()
  }
})

// Gestiamo i cambiamenti di stato (login/logout) in modo reattivo
supabase.auth.onAuthStateChange((_event, session) => {
  userSession.value = session
  
  // Definiamo esplicitamente la logica
  const currentMeta = router.currentRoute.value.meta
  const isCurrentlyOnProtectedRoute = currentMeta && currentMeta.requiresAuth

  // Se l'utente fa logout (no session) E si trova in una pagina protetta
  if (!session && isCurrentlyOnProtectedRoute) {
    console.log('Sessione scaduta, reindirizzo a /auth');
    router.push({ name: 'Auth' })
  }
  
  // Se l'utente fa login (sì session) E si trova sulla pagina /auth
  if (session && router.currentRoute.value.name === 'Auth') {
    console.log('Sessione attiva, reindirizzo da /auth a /');
    router.push({ name: 'Chat' })
  }
})


export default router
```


### `src/App.vue`


*Guscio principale dell'app (include la barra di navigazione).*
Snippet di codice

```
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
    </nav>
  </div>
</template>

<script setup>
import { computed } from 'vue';
// Non ci serve più useRoute, usiamo lo stato globale
// AGGIORNATO: Importa dallo store specifico
import { userSession } from './store/auth.js'; // Importiamo lo store

// Calcoliamo se mostrare la barra di navigazione.
// La mostriamo solo se l'utente è loggato (userSession non è null)
const showNav = computed(() => !!userSession.value);

</script>

<style scoped>
/* Stile personalizzato per i link di navigazione */
.nav-link {
  @apply flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors;
}
</style>
```


### `src/views/AuthPage.vue`


*Pagina di Login e Registrazione.*
Snippet di codice

```
<template>
  <div class="p-6">
    <!-- Logo (importato) -->
    <Logo class="w-48 h-auto mx-auto mb-2" />
    
    <h1 class="text-2xl font-bold text-center sr-only">LisaSalute</h1>
    <p class="text-center text-gray-600 dark:text-gray-300 mb-6">Accedi o Registrati</p>
    
    <!-- Qui inseriremo il form di login/registrazione di Supabase -->
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
import { supabase } from '../supabase';
import Logo from '../assets/Logo.svg';

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
      // Opzioni aggiuntive (es. redirect)
      // options: {
      //   emailRedirectTo: 'http://localhost:5173/' // O il tuo URL di deploy
      // }
    });

    if (error) throw error;
    
    successMessage.value = 'Registrazione riuscita! Controlla la tua email per confermare l'account.';
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
```


### `src/views/ProfilePage.vue`


*Pagina Profilo (con form dati medici e logout).*
Snippet di codice

```
<template>
  <div class="p-4">
    <h1 class="text-2xl font-semibold mb-4">Profilo Utente</h1>
    
    <div class="max-w-md mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      
      <!-- 1. Stato di Caricamento -->
      <div v-if="profileLoading" class="py-8">
        <Loader />
        <p class="text-center text-gray-500 dark:text-gray-400 mt-2">Caricamento profilo...</p>
      </div>

      <!-- 2. Stato di Errore -->
      <div v-if="profileError" class="mb-4 p-3 bg-red-100 dark:bg-red-900 border border-red-400 text-red-700 dark:text-red-200 rounded-lg">
        <p><strong>Errore:</strong> {{ profileError }}</p>
        <p class="text-sm">Impossibile caricare il profilo. Riprova più tardi.</p>
      </div>

      <!-- 3. Form del Profilo (mostrato solo se il profilo è caricato) -->
      <form v-if="profile && !profileLoading" @submit.prevent="handleSaveProfile">
        
        <!-- Email (non modificabile) -->
        <div v-if="user" class="mb-4">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
          <input 
             type="email" 
             :value="user.email" 
             disabled
             class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
           />
        </div>

        <!-- Nome -->
        <div class="mb-4">
          <label for="nome" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome Completo</label>
          <input 
             type="text" 
             id="nome" 
             v-model="profile.nome"
             placeholder="Mario Rossi"
             class="input-field"
           />
        </div>

        <!-- Sesso -->
        <div class="mb-4">
          <label for="sesso" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sesso Biologico</label>
          <select id="sesso" v-model="profile.sesso" class="input-field">
            <option value="M">Maschile</option>
            <option value="F">Femminile</option>
            <option value="Altro">Altro / Non specificato</option>
          </select>
        </div>

        <!-- Data di Nascita -->
        <div class="mb-4">
          <label for="data_nascita" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Data di Nascita</label>
          <input 
             type="date" 
             id="data_nascita" 
             v-model="profile.data_di_nascita"
             class="input-field"
           />
        </div>

        <!-- Tipo Misuratore -->
        <div class="mb-4">
          <label for="tipo_misuratore" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipo Misuratore Pressione</label>
          <select id="tipo_misuratore" v-model="profile.tipo_misuratore" class="input-field">
            <option value="automatico">Automatico (Digitale)</option>
            <option value="manuale">Manuale (Auscultatorio)</option>
          </select>
        </div>

        <!-- Checkbox Farmaci -->
        <fieldset class="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
          <legend class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Terapie Farmacologiche</legend>
          
          <div class="checkbox-wrapper">
            <input type="checkbox" id="farmaci_pressione" v-model="profile.farmaci_pressione" class="checkbox-input">
            <label for="farmaci_pressione" class="checkbox-label">Assumo farmaci per la Pressione (Anti-ipertensivi)</label>
          </div>
          
          <div class="checkbox-wrapper">
            <input type="checkbox" id="farmaci_cuore" v-model="profile.farmaci_cuore" class="checkbox-input">
            <label for="farmaci_cuore" class="checkbox-label">Assumo farmaci per il Cuore (es. Beta-bloccanti)</label>
          </div>

          <div class="checkbox-wrapper">
            <input type="checkbox" id="anticoagulanti" v-model="profile.anticoagulanti" class="checkbox-input">
            <label for="anticoagulanti" class="checkbox-label">Assumo farmaci Anticoagulanti o Antiaggreganti</label>
          </div>
        </fieldset>

        <!-- Bottone Salva Profilo -->
        <button 
          type="submit"
          :disabled="saveLoading"
          class="mt-6 w-full px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 disabled:opacity-50"
        >
          {{ saveLoading ? 'Salvataggio...' : 'Salva Profilo' }}
        </button>

        <!-- Messaggio di Successo/Errore Salvataggio -->
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
```


### `src/views/ChatPage.vue`


*(Placeholder per Step 3)*
Snippet di codice

```
<template>
  <div class="p-4">
    <h1 class="text-2xl font-semibold mb-4">Chat con Lisa</h1>
    <!-- Qui costruiremo l'interfaccia della chat -->
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md h-[60vh] p-4">
      <p>L'interfaccia della chat andrà qui...</p>
      <p>(Ricorda: la cronologia sarà caricata da Supabase)</p>
    </div>
  </div>
</template>

<script setup>
// Logica della chat (chiamate API a Gemini, salvataggio in Supabase)
</script>
```


### `src/views/DiaryPage.vue`


*(Placeholder per Step 5)*
Snippet di codice

```
<template>
  <div class="p-4">
    <h1 class="text-2xl font-semibold mb-4">Diario Parametri</h1>
    <!-- Qui visualizzeremo lo storico dei dati (grafici, liste) -->
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
      <p>Lo storico delle misurazioni (da Supabase) andrà qui.</p>
    </div>
  </div>
</template>

<script setup>
// Logica per recuperare e visualizzare i dati da Supabase
</script>
```

***

<br>
## 4\. Gestione Stato \(Store\)


<br>
### `src/store/auth.js`


*Gestisce lo stato di autenticazione dell'utente.*
JavaScript

```
import { ref } from 'vue'
import { supabase } from '../supabase'

/**
 * Un semplice store reattivo per l'autenticazione.
 * Esporta la sessione utente e un flag per sapere
 * quando il controllo iniziale è completato.
 */

// 'null' se l'utente non è loggato, altrimenti contiene la sessione
export const userSession = ref(null)

// Diventa 'true' dopo che onAuthStateChange è stato chiamato la prima volta
export const isAuthReady = ref(false)

// Ascolta i cambiamenti dello stato di autenticazione (login, logout)
supabase.auth.onAuthStateChange((_event, session) => {
  console.log("Auth state è cambiato, sessione:", session ? session.user.email : 'Nessuna sessione');
  userSession.value = session
  isAuthReady.value = true // Segnaliamo che il controllo iniziale è Fatto
})
```


### `src/store/profile.js`


*Gestisce il caricamento e salvataggio del profilo medico utente.*
JavaScript

```
import { ref, watchEffect } from 'vue'
import { supabase } from '../supabase'
import { userSession } from './auth.js' // Importiamo la sessione utente

/**
 * Gestisce lo stato del profilo medico dell'utente.
 */

// 'null' finché non è caricato. Conterrà { nome, sesso, ... }
export const profile = ref(null)
export const loading = ref(false) // Flag per il caricamento
export const error = ref(null)   // Flag per errori

/**
 * Carica il profilo dell'utente loggato dalla tabella 'profiles'.
 */
export async function fetchProfile() {
  if (!userSession.value) {
    console.log('FetchProfile: Utente non loggato, stop.');
    profile.value = null;
    return;
  }

  const userId = userSession.value.user.id;
  console.log('FetchProfile: Caricamento profilo per utente', userId);

  try {
    loading.value = true
    error.value = null
    
    // 1. Chiediamo a Supabase il profilo
    const { data, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single() // Ci aspettiamo solo un risultato

    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 = "nessuna riga trovata", non è un errore bloccante
      throw fetchError
    }

    if (data) {
      // 2. Profilo trovato, lo salviamo nello store
      console.log('FetchProfile: Profilo trovato', data);
      profile.value = data
    } else {
      // 3. Nessun profilo trovato (es. primo login)
      // Inizializziamo un profilo vuoto nello store
      console.log('FetchProfile: Profilo non trovato, inizializzo.');
      profile.value = {
        id: userId,
        nome: '',
        sesso: 'Altro',
        data_di_nascita: null,
        tipo_misuratore: 'automatico',
        farmaci_pressione: false,
        farmaci_cuore: false,
        anticoagulanti: false
      }
    }

  } catch (err) {
    console.error('Errore nel caricamento del profilo:', err.message)
    error.value = err.message
  } finally {
    loading.value = false
  }
}

/**
 * Aggiorna (o crea) il profilo dell'utente loggato.
 * Usa 'upsert' per creare se non esiste o aggiornare se esiste.
 * @param {object} profileData - I dati da salvare.
 */
export async function updateProfile(profileData) {
  if (!userSession.value) {
    console.error('UpdateProfile: Utente non loggato.');
    return;
  }
  
  // Assicuriamoci che l'ID sia corretto
  const updateData = {
    ...profileData,
    id: userSession.value.user.id, // Forza l'ID dell'utente loggato
    updated_at: new Date()
  };

  console.log('UpdateProfile: Salvataggio dati...', updateData);

  try {
    loading.value = true
    error.value = null

    const { error: upsertError } = await supabase
      .from('profiles')
      .upsert(updateData)

    if (upsertError) throw upsertError

    // Aggiorniamo lo stato locale con i dati salvati
    profile.value = updateData
    console.log('UpdateProfile: Salvataggio completato.');
    
  } catch (err) {
    console.error('Errore nel salvataggio del profilo:', err.message)
    error.value = err.message
    throw err // Rilanciamo l'errore per gestirlo nel componente
  } finally {
    loading.value = false
  }
}

// Watcher: Se l'utente cambia (login/logout), ricarica il profilo.
watchEffect(() => {
  fetchProfile();
});
```

***

<br>
<h2>5. Asset Grafici (SVG)</h2>

<h3>`src/components/Loader.vue`</h3>


*Loader animato (tracciato ECG) da usare durante i caricamenti.*
Snippet di codice

```
<template>
  <div class="ecg-loader">
    <div class="heartbeat"></div>
  </div>
</template>

<style scoped>
/* Stile del loader ECG dalla roadmap */
.ecg-loader {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100px; /* O l'altezza che preferisci */
  width: 100%;
  overflow: hidden;
}

.heartbeat {
  width: 100px; /* Larghezza del tracciato visibile */
  height: 2px; /* Spessore del tracciato */
  background-color: transparent;
  position: relative;
  overflow: hidden;
}

.heartbeat::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100px; /* Inizia fuori dallo schermo a sinistra */
  width: 200px; /* Deve essere più lungo del contenitore per coprire l'animazione */
  height: 2px;
  background: linear-gradient(to right, 
              transparent 0%, 
              transparent 20%, 
              #E11D48 20%, 
              #E11D48 80%, 
              transparent 80%, 
              transparent 100%);
  animation: ecg-pulse 1.5s infinite linear;
}

@keyframes ecg-pulse {
  0% { transform: translateX(0); }
  100% { transform: translateX(200px); } /* Sposta a destra */
}

.heartbeat::after {
  content: '';
  position: absolute;
  top: -15px; /* Centra l'onda */
  left: 50%;
  width: 0; 
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-bottom: 30px solid #E11D48; /* La forma dell'onda */
  transform: translateX(-50%) scaleY(0);
  animation: ecg-peak 1.5s infinite ease-in-out;
  transform-origin: bottom;
  opacity: 0;
}

@keyframes ecg-peak {
  0% { transform: translateX(-50%) scaleY(0); opacity: 0; }
  20% { transform: translateX(-50%) scaleY(0); opacity: 0; }
  30% { transform: translateX(-50%) scaleY(1); opacity: 1; }
  40% { transform: translateX(-50%) scaleY(0.5); opacity: 0.8; }
  50% { transform: translateX(-50%) scaleY(0.1); opacity: 0.5; }
  60% { transform: translateX(-50%) scaleY(0); opacity: 0; }
  100% { transform: translateX(-50%) scaleY(0); opacity: 0; }
}
</style>
```


### `src/assets/Logo.svg`


*Logo vettoriale dell'app.*
XML

```
<svg 
  xmlns="http://www.w3.org/2000/svg" 
  viewBox="0 0 100 40" 
  width="200" 
  height="80">
  
  <!-- Definizione per il contorno del testo -->
  <defs>
    <filter id="text-outline" x="-0.05" y="-0.05" width="1.1" height="1.1">
      <feFlood flood-color="#E11D48" result="bg" />
      <feMorphology in="SourceAlpha" operator="dilate" radius="0.5" result="dilated" />
      <feMerge>
        <feMergeNode in="bg" />
        <feMergeNode in="dilated" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>

  <!-- Tracciato ECG (Rosso) -->
  <path 
    d="M 0 20 H 20 C 23 20, 23 15, 25 15 C 27 15, 27 20, 30 20 H 35 L 38 23 L 42 5 L 46 35 L 49 20 H 55 C 58 20, 58 15, 60 15 C 62 15, 62 20, 65 20 H 100"
    fill="none"
    stroke="#E11D48"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
  />

  <!-- Testo "LisaSalute" (Bianco con contorno rosso) -->
  <text
    x="50"
    y="23"
    font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    font-size="12"
    font-weight="bold"
    fill="#FFFFFF"
    stroke="#E11D48"
    stroke-width="0.5"
    text-anchor="middle"
  >
    LisaSalute
  </text>
</svg>
```


### `favicon.svg` (da mettere in `public/`)


*Favicon vettoriale (solo tracciato).*
XML

```
<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M4 16H8L11 8L15 24L18 16H28" stroke="#E11D48" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
```

***

<br>
## 6\. PROSSIMI STEP \(Roadmap\)


<br>
### Step 1: Autenticazione e Gestione Utente (FATTO)


* [X] Creare `AuthPage.vue` con form di login e registrazione (Supabase Auth).
* [X] Creare `ProfilePage.vue` con bottone Logout.
* [X] Creare `src/store/auth.js` per stato reattivo.
* [X] Implementare "Navigation Guard" in `router.js` per proteggere le rotte.
* [X] Nascondere la `navbar` (`App.vue`) se l'utente non è loggato.


### Step 2: Profilo Utente (Dati Medici) (FATTO)


* [X] Creare Tabella `profiles` su Supabase (SQL fornito).
* [X] Creare `src/store/profile.js` con logica `fetchProfile` e `updateProfile`.
* [X] Creare form in `ProfilePage.vue` collegato allo store.
* [X] Campi: `nome`, `sesso`, `data_di_nascita`, `tipo_misuratore`, `farmaci_pressione`, `farmaci_cuore`, `anticoagulanti`.
* [X] Assicurarsi che il profilo venga caricato al login (tramite `watchEffect`).


### Step 3: Interfaccia Chat (DA FARE)


* [ ] Creare Tabella `chat_messages` su Supabase (SQL).
* [ ] Creare `src/store/chat.js` (fetch/add messaggi).
* [ ] Costruire l'interfaccia in `ChatPage.vue` (bolle messaggi, input).
* [ ] Mostrare il loader durante la risposta di Lisa.
* [ ] Assicurarsi che la chat scorra automaticamente all'ultimo messaggio.


### Step 4: Logica Chiamata IA (Gemini) (DA FARE)


* [ ] Creare `src/gemini.js` (o una funzione nello store chat).
* [ ] Funzione `askLisa` che:
    * Prende i `prompts.js` (li creeremo).
    * Prende il profilo utente (`store/profile.js`) come CONTESTO.
    * Prende la cronologia chat (`store/chat.js`) come CONTESTO.
    * Chiama l'API di Gemini.
    * Salva la risposta di Lisa (assistente) nello store e DB.


### Step 5: Diario e Salvataggio Parametri (DA FARE)


* [ ] **Tabella `vital_signs` (SQL):**
    * `id` (PK), `user_id` (FK), `created_at`
    * `pressione_sistolica` (INT), `pressione_diastolica` (INT), `frequenza_cardiaca` (INT), `saturazione_ossigeno` (INT)
    * `braccio` (TEXT) - (es. 'destro', 'sinistro')
    * `commento_lisa` (TEXT, nullable) - *Aggiunto per la nuova feature*
* [ ] **Logica di Salvataggio:** Modificare `askLisa` (Step 4) per estrarre i parametri dalla conversazione e salvarli in `vital_signs` dopo l'analisi.
* [ ] **Pagina Diario (`DiaryPage.vue`):**
    * Visualizzare i record (lista o card).
    * **Paginazione:** Caricare N record alla volta (es. 4 per pagina).
* [ ] **Import/Export CSV:**
    * Bottone "Esporta" (converte i dati Supabase in CSV).
    * Bottone "Importa" (legge un CSV e carica i dati in `vital_signs`).
* [ ] **Consulto A Posteriori:**
    * Per i record importati (o quelli senza `commento_lisa`), mostrare un bottone "Analizza con Lisa".
    * Alla pressione, invia i dati del record a `askLisa` (come se l'utente li avesse appena inseriti) e salva il `commento_lisa` nel record.