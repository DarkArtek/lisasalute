import { createRouter, createWebHistory } from 'vue-router'

// Importiamo i componenti delle viste (pagine)
import ChatPage from './views/ChatPage.vue'
import DiaryPage from './views/DiaryPage.vue'
import ChartPage from './views/ChartPage.vue' // <-- NUOVA PAGINA
import ProfilePage from './views/ProfilePage.vue'
import AuthPage from './views/AuthPage.vue'

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
  // --- NUOVA ROTTA GRAFICI ---
  {
    path: '/grafici',
    name: 'Grafici',
    component: ChartPage,
    meta: { requiresAuth: true }
  },
  // --------------------------
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
  const { data: { session } } = await supabase.auth.getSession()

  if (!userSession.value) {
    userSession.value = session
  }

  const requiresAuth = to.matched.some(record => record.meta.requiresAuth)
  const isAuthenticated = userSession.value && userSession.value.user

  if (requiresAuth && !isAuthenticated) {
    console.log('Accesso non autorizzato, reindirizzo a /auth');
    next({ name: 'Auth' })
  } else if (to.name === 'Auth' && isAuthenticated) {
    console.log('Utente già loggato, reindirizzo a /');
    next({ name: 'Chat' })
  } else {
    next()
  }
})

// Gestiamo i cambiamenti di stato (login/logout) in modo reattivo
supabase.auth.onAuthStateChange((_event, session) => {
  userSession.value = session

  const currentMeta = router.currentRoute.value.meta
  const isCurrentlyOnProtectedRoute = currentMeta && currentMeta.requiresAuth

  if (!session && isCurrentlyOnProtectedRoute) {
    console.log('Sessione scaduta, reindirizzo a /auth');
    router.push({ name: 'Auth' })
  }

  if (session && router.currentRoute.value.name === 'Auth') {
    console.log('Sessione attiva, reindirizzo da /auth a /');
    router.push({ name: 'Chat' })
  }
})

export default router
