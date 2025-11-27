import { createRouter, createWebHistory } from 'vue-router'

// Importiamo i componenti delle viste
import ChatPage from './views/ChatPage.vue'
import DiaryPage from './views/DiaryPage.vue'
import ChartPage from './views/ChartPage.vue'
import EcgPage from './views/EcgPage.vue'
import EcgDetailPage from './views/EcgDetailPage.vue' // <-- NUOVO COMPONENTE
import ProfilePage from './views/ProfilePage.vue'
import AuthPage from './views/AuthPage.vue'
import AdminPage from './views/AdminPage.vue'

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
  // --- NUOVA ROTTA DETTAGLIO ECG ---
  {
    path: '/ecg/:id',
    name: 'EcgDetail',
    component: EcgDetailPage,
    meta: { requiresAuth: true }
  },
  // -------------------------------
  {
    path: '/profilo',
    name: 'Profilo',
    component: ProfilePage,
    meta: { requiresAuth: true }
  },
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

// GUARDIANO DI SICUREZZA
router.beforeEach(async (to, from, next) => {
  const { data: { session } } = await supabase.auth.getSession()

  if (!userSession.value) {
    userSession.value = session
  }

  const isAuthenticated = !!session;
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth)
  const requiresAdmin = to.matched.some(record => record.meta.requiresAdmin)

  if (requiresAuth && !isAuthenticated) {
    next({ name: 'Auth' })
    return
  }

  if (requiresAdmin && isAuthenticated) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', session.user.id)
      .single();

    if (!profile || !profile.is_admin) {
      next({ name: 'Chat' })
      return
    }
  }

  if (to.name === 'Auth' && isAuthenticated) {
    next({ name: 'Chat' })
    return
  }

  next()
})

supabase.auth.onAuthStateChange((_event, session) => {
  userSession.value = session
  const currentRoute = router.currentRoute.value

  if (!session && currentRoute.meta.requiresAuth) {
    router.push({ name: 'Auth' })
  }
  if (session && currentRoute.name === 'Auth') {
    router.push({ name: 'Chat' })
  }
})

export default router
