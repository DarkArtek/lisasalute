import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export async function downloadDoctorReport(profileData, vitalsData, clinicalSummary) {
  const doc = new jsPDF();

  // --- 1. INTESTAZIONE (HEADER) ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(41, 128, 185); // Blu istituzionale
  doc.text("LisaSalute - Report Clinico", 14, 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generato il: ${new Date().toLocaleString()}`, 14, 28);

  // Linea divisoria
  doc.setDrawColor(200);
  doc.line(14, 32, 196, 32);

  let currentY = 40; // Punto di partenza verticale

  // --- PREPARAZIONE TESTO ---
  // Sostituzione placeholder e pulizia
  let processedSummary = clinicalSummary || "";
  const nowStr = new Date().toLocaleString('it-IT', { dateStyle: 'long', timeStyle: 'short' });
  processedSummary = processedSummary.replace('[Data e Ora corrente]', nowStr);

  // Separazione Intro vs Analisi
  // Cerchiamo il punto di divisione definito nel prompt ("Commento alla visita:")
  const splitMarker = "Commento alla visita:";
  let introText = "";
  let analysisText = processedSummary;

  // Se troviamo il separatore, dividiamo il testo
  if (processedSummary.includes(splitMarker)) {
    const parts = processedSummary.split(splitMarker);
    introText = parts[0].trim();
    // Rimettiamo il titolo "Commento alla visita" in grassetto o come inizio della seconda parte
    analysisText = splitMarker + " " + parts.slice(1).join(splitMarker).trim();
  } else {
    // Fallback: se l'IA non ha usato il separatore esatto,
    // proviamo a prendere la prima frase come intro se è breve,
    // altrimenti mettiamo tutto dopo la tabella per sicurezza.
    if (processedSummary.length > 0 && processedSummary.indexOf('\n') < 200) {
      // Se c'è un a capo presto, usalo come divisore
      const firstBreak = processedSummary.indexOf('\n');
      introText = processedSummary.substring(0, firstBreak).trim();
      analysisText = processedSummary.substring(firstBreak).trim();
    }
  }

  // --- 2. NOTA INTRODUTTIVA (PRIMA DELLA TABELLA) ---
  if (introText) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(0);

    const splitIntro = doc.splitTextToSize(introText, 180);
    doc.text(splitIntro, 14, currentY);

    // Aggiorna Y in base all'altezza del testo (circa 5mm per riga)
    currentY += (splitIntro.length * 5) + 5;
  }

  // --- 3. TABELLA RILEVAZIONI ---
  const tableData = vitalsData.map(v => [
    new Date(v.created_at).toLocaleString('it-IT', {
      day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute:'2-digit'
    }),
    `${v.pressione_sistolica || '-'}/${v.pressione_diastolica || '-'}`,
    v.frequenza_cardiaca || '-',
    v.saturazione_ossigeno ? `${v.saturazione_ossigeno}%` : '-',
    v.braccio ? v.braccio.charAt(0).toUpperCase() + v.braccio.slice(1) : '-',
    v.ecg_storage_path ? 'SÌ' : '-'
  ]);

  autoTable(doc, {
    startY: currentY, // Inizia subito dopo l'intro
    head: [['Data/Ora', 'PA (mmHg)', 'FC', 'SpO2', 'Braccio', 'ECG']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [41, 128, 185], textColor: 255, fontSize: 9 },
    styles: { fontSize: 8, cellPadding: 3 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: {
      0: { cellWidth: 35 },
      5: { cellWidth: 15, halign: 'center' }
    },
    margin: { bottom: 30 }
  });

  // Aggiorna Y alla fine della tabella
  currentY = doc.lastAutoTable.finalY + 15;

  // --- 4. COMMENTO ALLA VISITA (DOPO LA TABELLA) ---
  if (analysisText) {
    // Controllo cambio pagina
    if (currentY > 250) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(0);

    // Rimuovi eventuali markdown residui (come **) per pulizia base
    let cleanAnalysis = analysisText.replace(/\*\*/g, "");

    const splitAnalysis = doc.splitTextToSize(cleanAnalysis, 180);
    doc.text(splitAnalysis, 14, currentY);
  }

  // --- 5. FOOTER E NUMERI PAGINA ---
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);

    const footerText = `Pagina ${i} di ${pageCount} - Generato da LisaSalute. Documento informativo di supporto, non sostituisce referto medico ufficiale.`;

    const textWidth = doc.getStringUnitWidth(footerText) * doc.internal.getFontSize() / doc.internal.scaleFactor;
    const textOffset = (doc.internal.pageSize.width - textWidth) / 2;

    doc.text(footerText, textOffset, 290);
  }

  // --- 6. SALVATAGGIO FILE ---
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');

  const safeName = (profileData.nome || 'Paziente').replace(/[^a-z0-9]/gi, '_').toLowerCase();

  const filename = `referto_${safeName}_${year}${month}${day}_${hour}${minute}.pdf`;

  doc.save(filename);
}
