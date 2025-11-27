import { createRouter, createWebHistory } from 'vue-router'

// Importiamo i componenti delle viste
import ChatPage from './views/ChatPage.vue'
import DiaryPage from './views/DiaryPage.vue'
import ChartPage from './views/ChartPage.vue'
import EcgPage from './views/EcgPage.vue'
import ProfilePage from './views/ProfilePage.vue'
import AuthPage from './views/AuthPage.vue'
import AdminPage from './views/AdminPage.vue' // <-- NUOVO IMPORT

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
  // --- NUOVA ROTTA ADMIN ---
  {
    path: '/admin',
    name: 'Admin',
    component: AdminPage,
    meta: { requiresAuth: true, requiresAdmin: true } // <-- Flag speciale
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

  // --- CONTROLLO ADMIN ---
  if (requiresAdmin && isAuthenticated) {
    // Facciamo una query di sicurezza per essere certi che sia admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', session.user.id)
      .single();

    if (!profile || !profile.is_admin) {
      // Se non è admin, rispediscilo alla chat
      console.warn('Tentativo accesso admin non autorizzato');
      next({ name: 'Chat' })
      return
    }
  }
  // ---------------------

  if (to.name === 'Auth' && isAuthenticated) {
    next({ name: 'Chat' })
    return
  }

  next()
})

supabase.auth.onAuthStateChange((_event, session) => {
  userSession.value = session
  if (!session && router.currentRoute.value.meta.requiresAuth) {
    router.push({ name: 'Auth' })
  }
})

export default router
