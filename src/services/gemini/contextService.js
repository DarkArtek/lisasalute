/* contextService.js - Costruzione Prompt e Contesti */
import { profile } from '../../store/profile'
import { messages } from '../../store/chat'

// Funzione Helper: Calcola il prossimo orario di misurazione
function getNextMeasurementTime(p) {
  if (!p.abilita_scheduler) return null;

  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTimeValue = currentHour * 60 + currentMinute;

  const schedules = [];
  if (p.orario_mattina) schedules.push({ label: 'mattina', time: p.orario_mattina });
  if (p.orario_pomeriggio) schedules.push({ label: 'pomeriggio', time: p.orario_pomeriggio });
  if (p.orario_sera) schedules.push({ label: 'sera', time: p.orario_sera });

  if (schedules.length === 0) return null;

  schedules.sort((a, b) => {
    const [h1, m1] = a.time.split(':').map(Number);
    const [h2, m2] = b.time.split(':').map(Number);
    return (h1 * 60 + m1) - (h2 * 60 + m2);
  });

  let nextSlot = null;
  for (const slot of schedules) {
    const [h, m] = slot.time.split(':').map(Number);
    const slotTimeValue = h * 60 + m;

    if (slotTimeValue > currentTimeValue) {
      nextSlot = slot;
      break;
    }
  }

  if (!nextSlot) {
    nextSlot = { ...schedules[0], label: 'domani mattina' };
  }

  return `La prossima misurazione programmata è alle ore ${nextSlot.time} (${nextSlot.label}).`;
}

// Costruisce il System Instruction (AGGIORNATA per accettare weeklyStats)
export function buildSystemInstruction(mainPrompt, todaysCount = 0, weeklyStats = null) {
  const p = profile.value || {};
  const nome = p.nome || 'Paziente';
  const eta = p.data_di_nascita ?
    new Date().getFullYear() - new Date(p.data_di_nascita).getFullYear() : 'sconosciuta';

  const nextMeasurementString = getNextMeasurementTime(p);

  let contestoProfilo = `
CONTESTO PAZIENTE:
- Nome: ${nome}
- Sesso: ${p.sesso || 'sconosciuto'}
- Età: ${eta}
- Tipo Misuratore: ${p.tipo_misuratore || 'sconosciuto'}
- Categorie Farmaci: ${p.farmaci_pressione ? 'Anti-Ipertensivi' : ''} ${p.farmaci_cuore ? 'Cardiaci' : ''} ${p.anticoagulanti ? 'Anticoagulanti' : ''}
- MISURAZIONI ODIERNE: ${todaysCount}
`;

  // INIEZIONE STATISTICHE SETTIMANALI (NUOVO)
  if (weeklyStats) {
    contestoProfilo += `
*** STATISTICHE ULTIMI 7 GIORNI ***
- Media Pressione: ${weeklyStats.avgSys}/${weeklyStats.avgDia} mmHg
- Stato Generale: ${weeklyStats.status}
- Numero misurazioni: ${weeklyStats.count}
(Usa questo dato per dare consigli a lungo termine: se la media è alta, suggerisci controllo medico anche se il valore di oggi è normale).
`;
  }

  if (nextMeasurementString) {
    contestoProfilo += `\n*** PROSSIMA MISURAZIONE CALCOLATA ***\n${nextMeasurementString}\n(Usa questo dato SE l'utente chiede quando misurare).\n`;
  } else {
    contestoProfilo += `\n*** PROSSIMA MISURAZIONE ***\nNessun orario specifico impostato. Consiglia mattina e sera.\n`;
  }

  if (p.terapia_farmacologica) {
    contestoProfilo += `\n*** TERAPIA FARMACOLOGICA ***\n${p.terapia_farmacologica}\n`;
  }

  if (p.piano_terapeutico) {
    contestoProfilo += `\n*** MEMORIA A LUNGO TERMINE / NOTE ***\n${p.piano_terapeutico}\n`;
  }

  const oraCorrente = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  return `${mainPrompt}\n\n${contestoProfilo}\n\nCONTESTO TEMPORALE:\n- ORA CORRENTE: ${oraCorrente}`;
}

// Prepara la cronologia per Gemini
export function buildChatHistory(userMessage) {
  const history = messages.value
    .slice(-10)
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
