import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export async function downloadDoctorReport(profileData, vitalsData, clinicalSummary) {
  const doc = new jsPDF();

  // --- INTESTAZIONE ---
  doc.setFontSize(18);
  doc.text("Report Clinico - LisaSalute", 14, 20);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generato il: ${new Date().toLocaleString()}`, 14, 28);

  // --- DATI PAZIENTE ---
  doc.setTextColor(0);
  doc.setFontSize(12);
  doc.text("Anagrafica Paziente:", 14, 40);
  doc.setFontSize(10);
  doc.text(`Nome: ${profileData.nome || 'N/D'}`, 14, 46);
  doc.text(`Data di Nascita: ${profileData.data_di_nascita || 'N/D'}`, 14, 52);

  // --- RIASSUNTO CLINICO (IA) ---
  doc.setFontSize(12);
  doc.text("Sintesi Clinica (Generata da IA):", 14, 65);
  doc.setFontSize(10);
  doc.setFont("helvetica", "italic");

  // Split text serve per andare a capo automaticamente se il testo è lungo
  const splitSummary = doc.splitTextToSize(clinicalSummary, 180);
  doc.text(splitSummary, 14, 72);

  // Calcola dove finisce il testo per iniziare la tabella
  let finalY = 72 + (splitSummary.length * 5) + 10;

  // --- TABELLA DATI ---
  const tableData = vitalsData.map(v => [
    new Date(v.created_at).toLocaleString(),
    `${v.pressione_sistolica || '-'}/${v.pressione_diastolica || '-'}`,
    v.frequenza_cardiaca || '-',
    v.saturazione_ossigeno ? `${v.saturazione_ossigeno}%` : '-',
    v.braccio || '-',
    v.ecg_storage_path ? 'SI' : 'NO'
  ]);

  autoTable(doc, {
    startY: finalY,
    head: [['Data', 'PA (mmHg)', 'FC (bpm)', 'SpO2', 'Braccio', 'ECG']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [41, 128, 185] }, // Blu medico
    styles: { fontSize: 9 },
    alternateRowStyles: { fillColor: [240, 240, 240] }
  });

  // --- FOOTER ---
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text('Report generato da LisaSalute - Documento non avente valore legale se non validato da medico.', 14, 290);
  }

  doc.save(`Report_Medico_${profileData.nome || 'Paziente'}.pdf`);
}
