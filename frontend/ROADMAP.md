# Roadmap: Fascicolo Sanitario Digitale (Vue.js + JavaScript)

Questo documento delinea le fasi di sviluppo per l'applicazione, utilizzando la stack tecnologica Vue 3, Vite, JavaScript (ESM), Pinia, Supabase e le API Gemini.

---

## Milestone 0: Setup Progetto (Completato)

Obiettivo: Configurare l'ambiente di sviluppo JavaScript-only e Vite.

- [x] Rimuovere TypeScript e dipendenze correlate.
- [x] Configurare `package.json` (Vue, Pinia, Router, Supabase, Tailwind).
- [x] Configurare `vite.config.js` (con alias `@/`).
- [x] Configurare `tailwind.config.js` e `postcss.config.js`.
- [x] Creare `index.html` e `src/style.css` (mobile-first).

---

## Milestone 1: Autenticazione e Struttura (In Corso)

Obiettivo: Creare la struttura base dell'app, l'autenticazione e la navigazione.

- [x] Creare `src/main.js` (con init di Pinia e Router).
- [x] Creare `src/App.vue` (con loader iniziale).
- [x] Creare `src/components/Header.vue` e `src/components/Footer.vue`.
- [x] Creare `src/components/Layout.vue` (che usa Header/Footer).
- [x] Creare `src/router/index.js` (con Navigation Guards).
- [x] Creare `src/lib/supabaseClient.js`.
- [x] Creare `src/stores/authStore.js`.
- [x] Aggiornare `src/main.js` per chiamare `initializeSession()`.
- [ ] Creare `src/views/AuthView.vue` (pagina di Login/Registrazione).

---

## Milestone 2: Parametri Vitali e AI Core

Obiettivo: Implementare l'inserimento e l'analisi dei parametri vitali.

- [ ] Creare `src/stores/vitalsStore.js` (load, save, update, subscribe).
- [ ] Creare `src/stores/chatStore.js` (askNurse, addMessage).
- [ ] Creare `src/constants.js` per i prompt dell'IA.
- [ ] Creare `src/components/VitalsComponent.vue` (Form + Storico).
- [ ] Creare `src/components/ChatComponent.vue` (UI della Chat).
- [ ] Creare `src/views/DashboardView.vue` (assembla Vitals + Chat).
- [ ] Creare `src/views/ChatView.vue`.
- [ ] Creare `src/views/SettingsView.vue`.

---

## Milestone 3: Funzionalità ECG (Appena Iniziato)

Obiettivo: Implementare l'upload e l'analisi dei PDF ECG.

- [x] **Setup Database (Completato)**
    - [x] Aggiornato `supabase-setup.sql` con tabella `ecg_uploads`.
    - [x] Configurato Supabase Storage (Bucket `ecg_files` e policy).
- [ ] **Logica (Store)**
    - [ ] Creare `src/stores/ecgStore.js` (uploadFile, loadHistory, deleteFile).
- [ ] **UI (Componente)**
    - [ ] Creare `src/components/EcgUploader.vue`.
    - [ ] Aggiungere una nuova vista/pagina per l'uploader ECG.
- [ ] **AI (Analisi Immagine)**
    - [ ] Integrare `pdf.js` per estrarre l'immagine dal PDF.
    - [ ] Chiamare Gemini (multimodale) per l'analisi dell'immagine (con disclaimer).
    - [ ] Salvare l'analisi nel database.

---

## Milestone 4: Rifinitura e Test

Obiettivo: Pul