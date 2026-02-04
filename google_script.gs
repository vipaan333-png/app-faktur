/**
 * Google Apps Script for App-Faktur (Updated with Debugging and Column Safety)
 */

const SS = SpreadsheetApp.getActiveSpreadsheet();
const SHEET_INVOICES = SS.getSheetByName("invoices");
const SHEET_PAYMENTS = SS.getSheetByName("payments");
const FOLDER_ID = ""; // Opsional: Masukkan ID Folder Drive jika ingin simpan di folder tertentu

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

    // 1. Upload Gambar jika ada
    if (data.image_base64 && data.image_name) {
      try {
        fileUrl = uploadToDrive(data.image_base64, data.image_name);
      } catch (uploadError) {
        console.error("Upload error: " + uploadError);
        fileUrl = "Error: " + uploadError.toString();
      }
    }
    
    // 2. Pastikan Baris Header ada (untuk keamanan kolom)
    ensureHeaders();

    // 3. Simpan Transaksi
    const row = [
      data.no_faktur || "Unknown",
      data.tanggal_bayar ? new Date(data.tanggal_bayar) : new Date(),
      data.tipe || "Unknown",
      data.nominal_bayar || 0,
      data.keterangan_bank || "",
      new Date(), // time
      fileUrl     // bukti_bayar_url
    ];
    
    SHEET_PAYMENTS.appendRow(row);
    
    return createResponse({ success: true, url: fileUrl });
  } catch (err) {
    console.error("Critical error: " + err);
    return createResponse({ error: "Server Error: " + err.toString() });
  }
}

function uploadToDrive(base64Data, fileName) {
  // Format base64: "data:image/jpeg;base64,..."
  const parts = base64Data.split(',');
  const contentType = parts[0].split(':')[1].split(';')[0];
  const content = parts[1];
  const blob = Utilities.newBlob(Utilities.base64Decode(content), contentType, fileName);
  
  let folder;
  if (FOLDER_ID) {
    folder = DriveApp.getFolderById(FOLDER_ID);
  } else {
    folder = DriveApp.getRootFolder();
  }
  
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  
  return file.getUrl();
}

function ensureHeaders() {
  const headers = ["no_faktur", "tanggal_bayar", "tipe", "nominal_bayar", "keterangan_bank", "time", "bukti_bayar_url"];
  if (SHEET_PAYMENTS.getLastRow() === 0) {
    SHEET_PAYMENTS.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
}

// ... (getInvoiceSummary, getDashboardStats, getTrend7Days tetap sama seperti sebelumnya) ...
// Sertakan fungsi getSheetData dan createResponse di bawah

function getInvoiceSummary() {
  const invoices = getSheetData(SHEET_INVOICES);
  const payments = getSheetData(SHEET_PAYMENTS);
  
  return invoices.map(inv => {
    const terbayar = payments
      .filter(p => String(p.no_faktur) === String(inv.no_faktur))
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
  if (rows.length < 1) return [];
  const headers = rows[0];
  return rows.slice(1).map(row => {
    let obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}

function createResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
