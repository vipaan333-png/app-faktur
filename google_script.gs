/**
 * Google Apps Script for App-Faktur (HARD-CODED ID VERSION)
 * Ganti SPREADSHEET_ID dengan ID Spreadsheet Anda
 */

const SPREADSHEET_ID = "1VCVp08S3Pk4Iq1k8tk9ZBH6oDDsTv9thMhhLSpO4Jj8";
const SS = SpreadsheetApp.openById(SPREADSHEET_ID);
const SHEET_INVOICES = SS.getSheetByName("invoices");
const SHEET_PAYMENTS = SS.getSheetByName("payments");
const SHEET_TAGIHAN = SS.getSheetByName("tagihan");
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
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);

    const data = JSON.parse((e.postData && e.postData.contents) || "{}");
    if (String(data.action || "") === "saveTagihanBatch") {
      return saveTagihanBatch(data);
    }

    const noFaktur = String(data.no_faktur || "").trim();
    const nominalBayar = parseAmount(data.nominal_bayar);

    if (!SHEET_INVOICES) return createResponse({ error: "Sheet 'invoices' tidak ditemukan!" });
    if (!SHEET_PAYMENTS) return createResponse({ error: "Sheet 'payments' tidak ditemukan!" });
    if (!noFaktur) return createResponse({ error: "No faktur wajib diisi" });
    if (!isFinite(nominalBayar) || nominalBayar <= 0) {
      return createResponse({ error: "Nominal bayar tidak valid" });
    }

    // Server-side validation: faktur harus ada dan nominal tidak boleh melebihi sisa.
    const summary = getInvoiceSummary();
    const invoice = summary.find(inv => String(inv.no_faktur).trim() === noFaktur);
    if (!invoice) {
      return createResponse({ error: "Faktur tidak ditemukan: " + noFaktur });
    }

    const sisaSaatIni = parseAmount(invoice.sisa);
    if (!isFinite(sisaSaatIni)) {
      return createResponse({ error: "Data sisa tagihan tidak valid untuk faktur: " + noFaktur });
    }
    if (nominalBayar > sisaSaatIni) {
      return createResponse({ error: "Nominal melebihi sisa tagihan. Sisa saat ini: " + sisaSaatIni });
    }

    let fileUrl = "No Image";

    if (data.image_base64 && data.image_base64.length > 100) {
      try {
        fileUrl = uploadToDrive(data.image_base64, data.image_name || "bukti_bayar.jpg");
      } catch (uploadError) {
        fileUrl = "Upload Error: " + uploadError.toString();
      }
    }
    const row = [
      noFaktur,
      data.tanggal_bayar ? new Date(data.tanggal_bayar) : new Date(),
      data.tipe || "N/A",
      nominalBayar,
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
      nominal_bayar: nominalBayar,
      sisa_sebelum_bayar: sisaSaatIni,
      sisa_setelah_bayar: sisaSaatIni - nominalBayar,
      row_added: SHEET_PAYMENTS.getLastRow()
    });
  } catch (err) {
    return createResponse({ error: "doPost Error: " + err.toString() });
  } finally {
    try {
      lock.releaseLock();
    } catch (lockErr) {
      // Ignore release errors when lock is not held.
    }
  }
}

function saveTagihanBatch(data) {
  if (!SHEET_TAGIHAN) return createResponse({ error: "Sheet 'tagihan' tidak ditemukan!" });
  if (!SHEET_INVOICES) return createResponse({ error: "Sheet 'invoices' tidak ditemukan!" });

  const tanggalRaw = String(data.tanggal || "").trim();
  const kolektor = String(data.nama_kolektor || "").trim();
  const items = Array.isArray(data.items) ? data.items : [];

  if (!tanggalRaw) return createResponse({ error: "Tanggal wajib diisi" });
  if (!kolektor) return createResponse({ error: "Nama kolektor wajib diisi" });
  if (items.length === 0) return createResponse({ error: "Minimal 1 faktur harus dipilih" });

  const summary = getInvoiceSummary();
  const invoiceMap = {};
  summary.forEach(inv => {
    invoiceMap[String(inv.no_faktur).trim()] = inv;
  });

  const createdAt = new Date();
  const tanggal = new Date(tanggalRaw);
  const rows = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i] || {};
    const noFaktur = String(item.no_faktur || "").trim();
    if (!noFaktur) return createResponse({ error: "No faktur kosong pada baris " + (i + 1) });

    const invoice = invoiceMap[noFaktur];
    if (!invoice) return createResponse({ error: "Faktur tidak ditemukan: " + noFaktur });

    const sisaPiutang = parseAmount(invoice.sisa);
    if (!isFinite(sisaPiutang)) {
      return createResponse({ error: "Sisa piutang tidak valid untuk faktur: " + noFaktur });
    }

    const tunai = parseOptionalAmount(item.tunai);
    const transfer = parseOptionalAmount(item.transfer);
    if (!isFinite(tunai) || tunai < 0) return createResponse({ error: "Nilai tunai tidak valid pada faktur: " + noFaktur });
    if (!isFinite(transfer) || transfer < 0) return createResponse({ error: "Nilai transfer tidak valid pada faktur: " + noFaktur });

    rows.push([
      tanggal,
      kolektor,
      noFaktur,
      String(invoice.nama_outlet || item.nama_outlet || ""),
      sisaPiutang,
      tunai,
      transfer,
      String(item.keterangan || "").trim(),
      createdAt
    ]);
  }

  const startRow = SHEET_TAGIHAN.getLastRow() + 1;
  SHEET_TAGIHAN.getRange(startRow, 1, rows.length, rows[0].length).setValues(rows);

  return createResponse({
    success: true,
    msg: "Data tagihan berhasil disimpan",
    saved_rows: rows.length,
    start_row: startRow
  });
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

function parseAmount(value) {
  if (typeof value === "number") return isFinite(value) ? value : NaN;
  if (value === null || value === undefined) return NaN;

  let text = String(value).trim();
  if (!text) return NaN;

  text = text.replace(/rp/ig, "").replace(/\s/g, "");
  if (!/^[0-9.,-]+$/.test(text)) return NaN;

  const negative = text.startsWith("-");
  text = text.replace(/-/g, "").replace(/[.,]/g, "");
  if (!/^\d+$/.test(text)) return NaN;

  const parsed = Number((negative ? "-" : "") + text);
  return isFinite(parsed) ? parsed : NaN;
}

function parseOptionalAmount(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "string" && String(value).trim() === "") return 0;
  const parsed = parseAmount(value);
  return isFinite(parsed) ? parsed : NaN;
}
