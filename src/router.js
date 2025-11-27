import { createRouter, createWebHistory } from 'vue-router'

// Importiamo i componenti delle viste
import ChatPage from './views/ChatPage.vue'
import DiaryPage from './views/DiaryPage.vue'
import ChartPage from './views/ChartPage.vue'
import EcgPage from './views/EcgPage.vue'
import ProfilePage from './views/ProfilePage.vue'
import AuthPage from './views/AuthPage.vue'
import AdminPage from './views/AdminPage.vue' // <-- Pagina Admin

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
    meta: { requiresAuth: true }
  },
  {
    path: '/diario/:page?',
    name: 'Diario',
    component: DiaryPage,
    meta: { requiresAuth: true }
  },
  {
    path: '/grafici',
    name: 'Grafici',
    component: ChartPage,
    meta: { requiresAuth: true }
  },
  {
    path: '/ecg',
    name: 'EcgGallery',
    component: EcgPage,
    meta: { requiresAuth: true }
  },
  {
    path: '/profilo',
    name: 'Profilo',
    component: ProfilePage,
    meta: { requiresAuth: true }
  },
  // --- ROTTA ADMIN ---
  {
    path: '/admin',
    name: 'Admin',
    component: AdminPage,
    meta: { requiresAuth: true, requiresAdmin: true }
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// GUARDIANO DI SICUREZZA (Navigation Guard)
router.beforeEach(async (to, from, next) => {
  // Recuperiamo la sessione corrente da Supabase
  const { data: { session } } = await supabase.auth.getSession()

  // Aggiorniamo lo store se necessario
  if (!userSession.value) {
    userSession.value = session
  }

  const isAuthenticated = !!session;
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth)
  const requiresAdmin = to.matched.some(record => record.meta.requiresAdmin)

  // 1. Se serve auth ma non sei loggato -> Vai a Auth
  if (requiresAuth && !isAuthenticated) {
    next({ name: 'Auth' })
    return
  }

  // 2. Controllo specifico per ADMIN
  if (requiresAdmin && isAuthenticated) {
    // Verifichiamo nel DB se l'utente ha il flag is_admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', session.user.id)
      .single();

    if (!profile || !profile.is_admin) {
      console.warn('Tentativo accesso admin non autorizzato');
      next({ name: 'Chat' }) // Rispedisci alla home
      return
    }
  }

  // 3. Se sei loggato e provi ad andare su Auth -> Vai a Chat
  if (to.name === 'Auth' && isAuthenticated) {
    next({ name: 'Chat' })
    return
  }

  // Altrimenti procedi
  next()
})

// GESTIONE REATTIVA LOGIN/LOGOUT
supabase.auth.onAuthStateChange((_event, session) => {
  userSession.value = session

  // Otteniamo la rotta corrente in modo sicuro
  const currentRoute = router.currentRoute.value

  // Caso 1: Logout (sessione persa) mentre si è in una pagina protetta -> Vai a Login
  if (!session && currentRoute.meta.requiresAuth) {
    router.push({ name: 'Auth' })
  }

  // Caso 2: Login (sessione acquisita) mentre si è nella pagina di Login -> Vai a Chat
  // (Questo è il fix per il problema del refresh)
  if (session && currentRoute.name === 'Auth') {
    router.push({ name: 'Chat' })
  }
})

export default router
