/**
 * Google Apps Script for App-Faktur
 * Link: https://docs.google.com/spreadsheets/d/1VCVp08S3Pk4Iq1k8tk9ZBH6oDDsTv9thMhhLSpO4Jj8/edit
 */

const SS = SpreadsheetApp.getActiveSpreadsheet();
const SHEET_INVOICES = SS.getSheetByName("invoices");
const SHEET_PAYMENTS = SS.getSheetByName("payments");

function doGet(e) {
  const action = e.parameter.action;
  
  if (action === "getSummary") {
    return createResponse(getInvoiceSummary());
  }
  
  if (action === "getStats") {
    return createResponse(getDashboardStats());
  }
  
  if (action === "getTrend") {
    return createResponse(getTrend7Days());
  }
  
  return createResponse({ error: "Invalid action" });
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    
    // Add Payment
    const row = [
      data.no_faktur,
      new Date(data.tanggal_bayar),
      data.tipe,
      data.nominal_bayar,
      data.keterangan_bank,
      new Date()
    ];
    
    SHEET_PAYMENTS.appendRow(row);
    
    return createResponse({ success: true });
  } catch (err) {
    return createResponse({ error: err.toString() });
  }
}

function getInvoiceSummary() {
  const invoices = getSheetData(SHEET_INVOICES);
  const payments = getSheetData(SHEET_PAYMENTS);
  
  return invoices.map(inv => {
    const terbayar = payments
      .filter(p => p.no_faktur == inv.no_faktur)
      .reduce((sum, p) => sum + Number(p.nominal_bayar), 0);
    
    return {
      ...inv,
      terbayar: terbayar,
      sisa: Number(inv.total_nilai) - terbayar
    };
  }).sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
}

function getDashboardStats() {
  const summary = getInvoiceSummary();
  const payments = getSheetData(SHEET_PAYMENTS);
  const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
  
  const totalPiutang = summary.reduce((sum, s) => sum + s.sisa, 0);
  
  const paymentsToday = payments.filter(p => {
    const pDate = new Date(p.tanggal_bayar).toLocaleDateString('en-CA');
    return pDate === today;
  });
  
  const tunaiToday = paymentsToday
    .filter(p => p.tipe === 'Tunai')
    .reduce((sum, p) => sum + Number(p.nominal_bayar), 0);
    
  const transferToday = paymentsToday
    .filter(p => p.tipe === 'Transfer')
    .reduce((sum, p) => sum + Number(p.nominal_bayar), 0);
    
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
      .reduce((sum, p) => sum + Number(p.nominal_bayar), 0);
      
    result.push({ date: dateStr, amount: amount });
  }
  
  return result;
}

// Utility to get sheet data as Array of Objects
function getSheetData(sheet) {
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  return rows.slice(1).map(row => {
    let obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}

function createResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
