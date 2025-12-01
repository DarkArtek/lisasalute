/* contextService.js - Costruzione del contesto per il Prompt */
import { profile } from '../../store/profile';
import { medications } from '../../store/profile';

// Modificato per accettare il flag isSuemMode
export function buildSystemInstruction(basePrompt, todaysCount = 0, weeklyStats = null, isSuemMode = false) {
  const userProfile = profile.value || {};

  // --- MODALITÀ SUEM (LAVORO) ---
  if (isSuemMode) {
    return `
      ${basePrompt}

      CONTESTO UTENTE (TUO COLLEGA):
      Nome: ${userProfile.nome || 'Collega'}
      Sesso: ${userProfile.sesso || 'Non specificato'}

      NOTA SISTEMA: Sei in modalità operativa. Ignora i dati medici personali dell'utente salvati nel database.
      Mantieni il filo del discorso basandoti sulla cronologia della chat fornita.
    `;
  }

  // --- MODALITÀ PERSONALE (STANDARD) ---

  // Costruzione della stringa farmaci (se presenti)
  let medsList = "Nessuna terapia registrata.";
  if (medications.value && medications.value.length > 0) {
    medsList = medications.value.map(m => `- ${m.nome_farmaco} (${m.dosaggio})`).join('\n');
  } else if (userProfile.terapia_farmacologica) {
    medsList = userProfile.terapia_farmacologica;
  }

  // Costruzione info statistiche (se presenti)
  let statsInfo = "";
  if (weeklyStats) {
    statsInfo = `
    STATISTICHE SETTIMANALI:
    - Media Pressione: ${weeklyStats.avgSys}/${weeklyStats.avgDia} mmHg
    - Stato Attuale: ${weeklyStats.status}
    - Misurazioni Oggi: ${todaysCount}
    `;
  }

  // Costruzione Memoria a Lungo Termine
  const longTermMemory = userProfile.lisa_memory
    ? `\n\nMEMORIA A LUNGO TERMINE (Note personali su ${userProfile.nome}):\n"${userProfile.lisa_memory}"\nUsa queste informazioni per personalizzare la risposta.`
    : "";

  return `
    ${basePrompt}

    CONTESTO UTENTE:
    Nome: ${userProfile.nome || 'Utente'}
    Sesso: ${userProfile.sesso || 'Non specificato'}
    Terapia:
    ${medsList}
    ${statsInfo}
    ${longTermMemory}

    NOTA: Se l'utente ti dice qualcosa di importante che dovresti ricordare per sempre (es. "Non mi piace il dottor Rossi", "Uso un fonendoscopio Littmann", "Sono allergico alle noci"), la tua risposta deve essere normale, ma internamente useremo il sistema di estrazione per salvare questa info.
  `;
}

// --- FIX MEMORIA CONTESTUALE ---
// Ora accetta anche 'previousMessages' (lo storico) per evitare che Lisa perda il filo
export function buildChatHistory(userMessage, previousMessages = []) {
  // 1. Convertiamo i messaggi precedenti dal formato DB (role: 'user'/'assistant')
  // al formato Gemini (role: 'user'/'model')
  const history = previousMessages
    .slice(-15) // Prendiamo solo gli ultimi 15 messaggi per non intasare il contesto
    .map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

  // 2. Aggiungiamo il messaggio corrente dell'utente in fondo
  history.push({
    role: "user",
    parts: [{ text: userMessage }]
  });

  return history;
}
