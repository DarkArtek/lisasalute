import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
// --- IMPORT FIRMA ---
// Assicurati che il file esista in src/assets/lisa_signature.png
import signatureImg from '../assets/lisa_signature.png';
// --------------------

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

  // --- PREPARAZIONE DATI (FILTRO) ---
  // FIX: Escludiamo i record che sono solo note/auscultazioni (senza pressione)
  // Così la tabella non mostra righe vuote o parziali.
  const validVitals = vitalsData.filter(v => v.pressione_sistolica != null);

  // --- PREPARAZIONE TESTO ---
  let processedSummary = clinicalSummary || "";
  const nowStr = new Date().toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' });
  processedSummary = processedSummary.replace('[Data e Ora corrente]', nowStr);

  // --- LOGICA DI DIVISIONE TESTO (MIGLIORATA) ---
  const splitMarker = "--- TABELLA DATI ---";
  const fallbackMarkers = ["Analisi del periodo:", "**Analisi del periodo:**", "Osservazioni:", "Commento alla visita:"];

  let introText = "";
  let analysisText = processedSummary;

  if (processedSummary.includes(splitMarker)) {
    // Caso ideale: l'IA ha usato il marker
    const parts = processedSummary.split(splitMarker);
    introText = parts[0].trim();
    analysisText = parts[1].trim();
  } else {
    // Fallback intelligente: cerca altri punti di rottura logici
    let foundSplit = false;
    for (const marker of fallbackMarkers) {
      if (processedSummary.includes(marker)) {
        const idx = processedSummary.indexOf(marker);
        introText = processedSummary.substring(0, idx).trim();
        analysisText = processedSummary.substring(idx).trim(); // Mantiene il titolo della sezione
        foundSplit = true;
        break;
      }
    }

    // Fallback estremo: se non trova nulla, prova a prendere il primo paragrafo come intro
    if (!foundSplit && processedSummary.length > 0) {
      const paragraphs = processedSummary.split('\n\n');
      if (paragraphs.length > 1) {
        introText = paragraphs[0];
        analysisText = paragraphs.slice(1).join('\n\n');
      } else {
        // Se è tutto un blocco unico, meglio metterlo dopo la tabella per sicurezza
        introText = "";
        analysisText = processedSummary;
      }
    }
  }

  // --- 2. NOTA INTRODUTTIVA (PRIMA DELLA TABELLA) ---
  if (introText) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(0);

    const splitIntro = doc.splitTextToSize(introText, 180);
    doc.text(splitIntro, 14, currentY);

    // Aggiorna Y
    currentY += (splitIntro.length * 5) + 5;
  }

  // --- 3. TABELLA RILEVAZIONI (USANDO DATI FILTRATI) ---
  const tableData = validVitals.map(v => [
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
    startY: currentY,
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

  // --- 4. COMMENTO ALLA VISITA + FIRMA (DOPO LA TABELLA) ---
  if (analysisText) {
    // Controllo cambio pagina
    if (currentY > 220) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(0);

    let cleanAnalysis = analysisText.replace(/\*\*/g, "").replace(/__/g, "");
    const splitAnalysis = doc.splitTextToSize(cleanAnalysis, 180);

    doc.text(splitAnalysis, 14, currentY);

    // --- 5. LOGICA FIRMA ---
    const textHeight = splitAnalysis.length * 5;

    // Dimensioni
    const originalWidth = 211;
    const originalHeight = 66;
    const targetWidth = 45;
    const targetHeight = (originalHeight / originalWidth) * targetWidth;

    // Posizione Y (sovrapposta)
    const signatureY = currentY + textHeight - 22;

    try {
      // FIX: Spostata a sinistra (X=10 invece di 14)
      doc.addImage(signatureImg, 'PNG', 10, signatureY, targetWidth, targetHeight);
    } catch (e) {
      console.error("Impossibile caricare immagine firma", e);
    }
  }

  // --- 6. FOOTER ---
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);

    const footerText = `Pagina ${i} di ${pageCount} - Generato da LisaSalute. Documento informativo di supporto.`;

    const textWidth = doc.getStringUnitWidth(footerText) * doc.internal.getFontSize() / doc.internal.scaleFactor;
    const textOffset = (doc.internal.pageSize.width - textWidth) / 2;

    doc.text(footerText, textOffset, 290);
  }

  // --- 7. SALVATAGGIO ---
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
