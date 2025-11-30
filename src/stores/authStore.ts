import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { supabase } from '@/lib/supabaseClient'
import type { User } from '@supabase/supabase-js'

export const useAuthStore = defineStore('auth', () => {
  // --- State ---
  const user = ref<User | null>(null)
  const isLoading = ref(true) // Indica il caricamento della sessione iniziale

  // --- Getters ---
  const userId = computed(() => user.value?.id || null)
  const isAuthenticated = computed(() => !!user.value)

  // --- Actions ---

  /**
   * Prova a recuperare la sessione corrente all'avvio dell'app
   */
  async function initializeSession() {
    isLoading.value = true
    const { data: { session } } = await supabase.auth.getSession()

    user.value = session?.user || null
    isLoading.value = false

    // Ascolta i cambiamenti di stato (login, logout)
    supabase.auth.onAuthStateChange((_event, session) => {
      user.value = session?.user || null
    })
  }

  /**
   * Registra un nuovo utente con email e password
   */
  async function signUp(email: string, password: string) {
    isLoading.value = true
    try {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) throw error
      user.value = data.user
      return data.user
    } catch (error) {
      console.error("Errore durante la registrazione:", error)
      throw error // Rilancia l'errore per gestirlo nel UI
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Esegue il login con email e password
   */
  async function signIn(email: string, password: string) {
    isLoading.value = true
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      user.value = data.user
      return data.user
    } catch (error) {
      console.error("Errore durante il login:", error)
      throw error // Rilancia l'errore per gestirlo nel UI
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Esegue il logout
   */
  async function signOut() {
    isLoading.value = true
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      user.value = null
    } catch (error) {
      console.error("Errore durante il logout:", error)
    } finally {
      isLoading.value = false
    }
  }

  return {
    user,
    isLoading,
    userId,
    isAuthenticated,
    initializeSession,
    signUp,
    signIn,
    signOut
  }
})
