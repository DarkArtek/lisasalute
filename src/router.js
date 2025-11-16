import { createRouter, createWebHistory } from 'vue-router'

// Importiamo i componenti delle viste (pagine)
import ChatPage from './views/ChatPage.vue'
import DiaryPage from './views/DiaryPage.vue'
import ProfilePage from './views/ProfilePage.vue'
import AuthPage from './views/AuthPage.vue' // Pagina per Login/Registrazione

// Importiamo il necessario per la guardia
import { supabase } from './supabase.js'
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
  //
  // --- MODIFICA CHIAVE ---
  // Il '?' rende il parametro :page opzionale.
  // Questo significa che sia /diario che /diario/1 (o /diario/2)
  // punteranno allo stesso componente.
  {
    path: '/diario/:page?', // <-- MODIFICATO
    name: 'Diario',
    component: DiaryPage,
    meta: { requiresAuth: true }
  },
  // -----------------------
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
