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

  // --- 2. DATI PAZIENTE (ANAGRAFICA) ---
  doc.setTextColor(0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Anagrafica Paziente:", 14, 42);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  // Calcolo età
  const eta = profileData.data_di_nascita
    ? new Date().getFullYear() - new Date(profileData.data_di_nascita).getFullYear()
    : 'N/D';

  doc.text(`Nome: ${profileData.nome || 'N/D'}`, 14, 48);
  doc.text(`Data di Nascita: ${profileData.data_di_nascita || 'N/D'} (Età: ${eta} anni)`, 14, 54);

  // --- 3. NOTA CLINICA (GENERATA DA LISA) ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Nota Clinica di Sintesi:", 14, 66);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(50); // Grigio scuro per il corpo del testo

  // "splitTextToSize" gestisce automaticamente il "word wrap" (a capo)
  // per evitare che il testo esca dai margini
  const splitSummary = doc.splitTextToSize(clinicalSummary, 180);
  doc.text(splitSummary, 14, 72);

  // Calcoliamo dove finisce il testo per posizionare la tabella
  // (72 è l'inizio Y, splitSummary.length è il numero di righe, 5 è l'altezza riga)
  let finalY = 72 + (splitSummary.length * 5) + 15;

  // Se il testo è molto lungo, controlliamo di non essere finiti a fine pagina
  if (finalY > 250) {
    doc.addPage();
    finalY = 20;
  }

  // --- 4. TABELLA RILEVAZIONI ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.text("Tabella Rilevazioni (Periodo recente):", 14, finalY);

  const tableData = vitalsData.map(v => [
    new Date(v.created_at).toLocaleString('it-IT', {
      day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute:'2-digit'
    }),
    `${v.pressione_sistolica || '-'}/${v.pressione_diastolica || '-'}`,
    v.frequenza_cardiaca || '-',
    v.saturazione_ossigeno ? `${v.saturazione_ossigeno}%` : '-',
    v.braccio ? v.braccio.charAt(0).toUpperCase() + v.braccio.slice(1) : '-', // Capitalizza
    v.ecg_storage_path ? 'SÌ' : '-'
  ]);

  autoTable(doc, {
    startY: finalY + 5,
    head: [['Data/Ora', 'PA (mmHg)', 'FC', 'SpO2', 'Braccio', 'ECG']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [41, 128, 185], textColor: 255, fontSize: 9 },
    styles: { fontSize: 8, cellPadding: 3 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: {
      0: { cellWidth: 35 }, // Data un po' più larga
      5: { cellWidth: 15, halign: 'center' } // ECG centrato
    }
  });

  // --- 5. FOOTER E NUMERI PAGINA ---
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);

    const footerText = `Pagina ${i} di ${pageCount} - Generato da LisaSalute. Documento informativo di supporto, non sostituisce referto medico ufficiale.`;

    // Centra il footer
    const textWidth = doc.getStringUnitWidth(footerText) * doc.internal.getFontSize() / doc.internal.scaleFactor;
    const textOffset = (doc.internal.pageSize.width - textWidth) / 2;

    doc.text(footerText, textOffset, 290);
  }

  // --- 6. SALVATAGGIO FILE ---
  const now = new Date();
  // Formato: YYYYMMDD_HHmm
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');

  // Sanitizza il nome del paziente per il file (rimuove spazi e caratteri speciali)
  const safeName = (profileData.nome || 'Paziente').replace(/[^a-z0-9]/gi, '_').toLowerCase();

  const filename = `referto_${safeName}_${year}${month}${day}_${hour}${minute}.pdf`;

  doc.save(filename);
}
