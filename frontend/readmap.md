# Roadmap Progetto LisaSalute

Questo documento definisce i prossimi step di sviluppo per l'app LisaSalute.

---

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

### Step 3: Interfaccia Chat (FATTO)
* [X] Creare Tabella `chat_messages` su Supabase (SQL fornito).
* [X] Creare `src/store/chat.js` (fetch/add messaggi).
* [X] Costruire l'interfaccia in `ChatPage.vue` (bolle messaggi, input).
* [X] Mostrare il loader during la risposta di Lisa.
* [X] Assicurarsi che la chat scorra automaticamente all'ultimo messaggio.

### Step 4: Logica Chiamata IA (Gemini) (FATTO)
* [X] **Creare `src/prompts.js`:**
    * [X] Spostare i prompt di Lisa (`NURSE_ANALYSIS_PROMPT`, ecc.).
    * [X] **Creare `DATA_EXTRACTION_PROMPT`:** (JSON).
    * [X] Arricchire i prompt con conoscenze (Auscultazione, ECG 3 derivazioni).
* [X] **Creare `src/services/gemini.js`:**
    * [X] Creare una funzione `askLisa(userMessage)`.
    * [X] **Refactoring con SDK `@google/generative-ai`**.
* [X] **Implementare la logica a 2 fasi in `askLisa`:**
    1.  **[X] Estrazione (Step 5):**
        * [X] Chiamare Gemini la 1° volta con `DATA_EXTRACTION_PROMPT` + `userMessage`.
        * [X] Prendere il JSON di risposta.
        * [X] **Salvare i dati nella tabella `vital_signs` (logica dello Step 5).**
    2.  **[X] Analisi (Step 4):**
        * [X] Chiamare Gemini la 2° volta con `NURSE_ANALYSIS_PROMPT`, il contesto del profilo (`store/profile.js`) e la cronologia chat.
        * [X] Prendere la risposta testuale di Lisa.
* [X] **Aggiornare `ChatPage.vue`:**
    * [X] Sostituire la `setTimeout` (simulazione) con la chiamata reale a `askLisa`.
    * [X] Mostrare `lisaIsTyping = true` durante le chiamate.
    * [X] Salvare la risposta di Lisa (`assistant`) nello store e DB.

### Step 5: Diario e Salvataggio Parametri (IN CORSO)
* [X] **Tabella `vital_signs` (SQL):** (Fornito e creato)
    * `id` (PK), `user_id` (FK), `created_at`
    * `pressione_sistolica` (INT), `pressione_diastolica` (INT), `frequenza_cardiaca` (INT), `saturazione_ossigeno` (INT)
    * `braccio` (TEXT)
    * `commento_lisa` (TEXT, nullable)
* [X] **Logica di Salvataggio:** Implementata nello `Step 4 (Estrazione)`.
* [ ] **Pagina Diario (`DiaryPage.vue`):** (DA FARE)
    * Creare `src/store/diary.js` per caricare i dati da `vital_signs`.
    * Visualizzare i record (lista o card).
    * **Paginazione:** Caricare N record alla volta (es. 4 per pagina).
* [ ] **Import/Export CSV:** (DA FARE)
    * Bottone "Esporta" (converte i dati Supabase in CSV).
    * Bottone "Importa" (legge un CSV e carica i dati in `vital_signs`).
* [ ] **Consulto A Posteriori:** (DA FARE)
    * Per i record importati (o quelli senza `commento_lisa`), mostrare un bottone "Analizza con Lisa".
    * Alla pressione, invia i dati del record a `askLisa` (come se l'utente li avesse appena inseriti) e salva il `commento_lisa` nel record.