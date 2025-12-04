import { ref } from 'vue'
import {supabase} from "../supabase.js";

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
