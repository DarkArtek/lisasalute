/* contextService.js - Costruzione Prompt e Contesti */
import { profile } from '../../store/profile'
import { messages } from '../../store/chat'

// Costruisce il System Instruction per l'analisi clinica
export function buildSystemInstruction(mainPrompt, todaysCount = 0) {
  const p = profile.value || {};
  const nome = p.nome || 'Paziente';
  const eta = p.data_di_nascita ?
    new Date().getFullYear() - new Date(p.data_di_nascita).getFullYear() : 'sconosciuta';

  let contestoProfilo = `
CONTESTO PAZIENTE:
- Nome: ${nome}
- Sesso: ${p.sesso || 'sconosciuto'}
- Età: ${eta}
- Tipo Misuratore: ${p.tipo_misuratore || 'sconosciuto'}
- Categorie Farmaci: ${p.farmaci_pressione ? 'Anti-Ipertensivi' : ''} ${p.farmaci_cuore ? 'Cardiaci' : ''} ${p.anticoagulanti ? 'Anticoagulanti' : ''}
- MISURAZIONI ODIERNE: ${todaysCount} (Se >= 3, evita di chiedere altre misurazioni di routine)
`;

  if (p.terapia_farmacologica) {
    contestoProfilo += `\n*** TERAPIA FARMACOLOGICA ***\n${p.terapia_farmacologica}\n`;
  }

  if (p.piano_terapeutico) {
    contestoProfilo += `\n*** MEMORIA A LUNGO TERMINE / NOTE ***\n${p.piano_terapeutico}\n`;
  }

  // Qui aggiungeremo in futuro la lista strutturata dei farmaci da 'medications'

  const oraCorrente = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  return `${mainPrompt}\n\n${contestoProfilo}\n\nCONTESTO TEMPORALE:\n- ORA CORRENTE: ${oraCorrente}`;
}

// Prepara la cronologia per Gemini
export function buildChatHistory(userMessage) {
  const history = messages.value
    .slice(-10) // Ultimi 10 messaggi
    .map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

  history.push({
    role: 'user',
    parts: [{ text: userMessage }]
  });

  return history;
}
