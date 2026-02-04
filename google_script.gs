/**
 * Google Apps Script for App-Faktur (HARD-CODED ID VERSION)
 * Ganti SPREADSHEET_ID dengan ID Spreadsheet Anda
 */

const SPREADSHEET_ID = "1VCVp08S3Pk4Iq1k8tk9ZBH6oDDsTv9thMhhLSpO4Jj8";
const SS = SpreadsheetApp.openById(SPREADSHEET_ID);
const SHEET_INVOICES = SS.getSheetByName("invoices");
const SHEET_PAYMENTS = SS.getSheetByName("payments");
const FOLDER_ID = ""; // Opsional: Masukkan ID Folder Drive jika ingin simpan di folder tertentu

/**
 * LANGKAH UNTUK MEMPERBAIKI ERROR IZIN (AUTHORIZATION):
 * 1. Simpan (Ctrl+S) kode ini di editor Google Apps Script.
 * 2. Di toolbar atas (dekat tombol 'Jalankan'), pilih fungsi 'triggerAuthorization'.
 * 3. Klik tombol 'Jalankan' (Run).
 * 4. Akan muncul popup "Izin diperlukan", klik 'Tinjau Izin'.
 * 5. Pilih akun Google Anda.
 * 6. Jika muncul "Aplikasi tidak diverifikasi", klik 'Lanjutan' (Advanced) -> 'Buka App-Faktur (tidak aman)'.
 * 7. Klik 'Izinkan' (Allow).
 * 8. Setelah sukses, Deploy ulang: Klik 'Terapkan' (Deploy) -> 'Kelola Penerapan' -> Edit -> Versi Baru -> Terapkan.
 */
function triggerAuthorization() {
  // Fungsi ini dipanggil manual sekali saja untuk memicu popup izin
  const folder = DriveApp.getRootFolder();
  const dummyFile = folder.createFile("temp.txt", "Pemberian izin sukses");
  dummyFile.setTrashed(true); // Hapus file dummy setelah dibuat
  console.log("Izin Drive (Simpan File) berhasil diberikan!");
}

function doGet(e) {
  const action = e.parameter.action;
  if (action === "getSummary") return createResponse(getInvoiceSummary());
  if (action === "getStats") return createResponse(getDashboardStats());
  if (action === "getTrend") return createResponse(getTrend7Days());
  return createResponse({ error: "Invalid action" });
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    let fileUrl = "No Image";

    if (data.image_base64 && data.image_base64.length > 100) {
      try {
        fileUrl = uploadToDrive(data.image_base64, data.image_name || "bukti_bayar.jpg");
      } catch (uploadError) {
        fileUrl = "Upload Error: " + uploadError.toString();
      }
    }
    
    // Pastikan Sheet ada
    if (!SHEET_PAYMENTS) return createResponse({ error: "Sheet 'payments' tidak ditemukan!" });

    const row = [
      data.no_faktur || "Empty",
      data.tanggal_bayar ? new Date(data.tanggal_bayar) : new Date(),
      data.tipe || "N/A",
      data.nominal_bayar || 0,
      data.keterangan_bank || "",
      new Date(), 
      fileUrl     
    ];
    
    SHEET_PAYMENTS.appendRow(row);
    
    // Return lebih banyak info untuk debugging di console browser
    return createResponse({ 
      success: true, 
      msg: "Data berhasil masuk ke Spreadsheet ID: " + SPREADSHEET_ID,
      url: fileUrl,
      row_added: SHEET_PAYMENTS.getLastRow()
    });
  } catch (err) {
    return createResponse({ error: "doPost Error: " + err.toString() });
  }
}

function uploadToDrive(base64Data, fileName) {
  const parts = base64Data.split(',');
  const contentType = parts[0].split(':')[1].split(';')[0];
  const content = parts[1];
  const blob = Utilities.newBlob(Utilities.base64Decode(content), contentType, fileName);
  
  const folder = FOLDER_ID ? DriveApp.getFolderById(FOLDER_ID) : DriveApp.getRootFolder();
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  
  return file.getUrl();
}

function getInvoiceSummary() {
  const invoices = getSheetData(SHEET_INVOICES);
  const payments = getSheetData(SHEET_PAYMENTS);
  
  return invoices.map(inv => {
    const terbayar = payments
      .filter(p => String(p.no_faktur).trim() === String(inv.no_faktur).trim())
      .reduce((sum, p) => sum + Number(p.nominal_bayar || 0), 0);
    
    return {
      ...inv,
      terbayar: terbayar,
      sisa: Number(inv.total_nilai || 0) - terbayar
    };
  }).sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
}

function getDashboardStats() {
  const summary = getInvoiceSummary();
  const payments = getSheetData(SHEET_PAYMENTS);
  const today = new Date().toLocaleDateString('en-CA');
  
  const totalPiutang = summary.reduce((sum, s) => sum + s.sisa, 0);
  const paymentsToday = payments.filter(p => new Date(p.tanggal_bayar).toLocaleDateString('en-CA') === today);
  
  const tunaiToday = paymentsToday.filter(p => p.tipe === 'Tunai').reduce((sum, p) => sum + Number(p.nominal_bayar || 0), 0);
  const transferToday = paymentsToday.filter(p => p.tipe === 'Transfer').reduce((sum, p) => sum + Number(p.nominal_bayar || 0), 0);
    
  return { totalPiutang, tunaiToday, transferToday };
}

function getTrend7Days() {
  const payments = getSheetData(SHEET_PAYMENTS);
  const result = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toLocaleDateString('en-CA');
    const amount = payments
      .filter(p => new Date(p.tanggal_bayar).toLocaleDateString('en-CA') === dateStr)
      .reduce((sum, p) => sum + Number(p.nominal_bayar || 0), 0);
    result.push({ date: dateStr, amount: amount });
  }
  return result;
}

function getSheetData(sheet) {
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1).filter(row => row.join("").length > 0).map(row => {
    let obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}

function createResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
