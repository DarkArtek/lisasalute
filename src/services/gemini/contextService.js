/* contextService.js - Costruzione del contesto per il Prompt */
import { profile } from '../../store/profile';
import { medications } from '../../store/profile';

export function buildSystemInstruction(basePrompt, todaysCount = 0, weeklyStats = null) {
  const userProfile = profile.value || {};

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

  // --- MEMORIA A LUNGO TERMINE (NUOVO) ---
  // Qui leggiamo il campo 'lisa_memory' dal profilo
  const longTermMemory = userProfile.lisa_memory
    ? `\n\nMEMORIA A LUNGO TERMINE (Note personali su ${userProfile.nome}):\n"${userProfile.lisa_memory}"\nUsa queste informazioni per personalizzare la risposta.`
    : "";

  return `
    ${basePrompt}

    CONTESTO UTENTE:
    Nome: ${userProfile.nome || 'Utente'}
    Terapia:
    ${medsList}
    ${statsInfo}
    ${longTermMemory}

    NOTA: Se l'utente ti dice qualcosa di importante che dovresti ricordare per sempre (es. "Non mi piace il dottor Rossi", "Uso un fonendoscopio Littmann", "Sono allergico alle noci"), la tua risposta deve essere normale, ma internamente useremo il sistema di estrazione per salvare questa info.
  `;
}

export function buildChatHistory(userMessage) {
  return [
    {
      role: "user",
      parts: [{ text: userMessage }]
    }
  ];
}
