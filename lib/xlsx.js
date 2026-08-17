import ExcelJS from "exceljs";
import path from "path";
import fs from "fs";

// ---- Konfigurasi lokasi & struktur file xlsx ----
// File xlsx ini adalah SUMBER DATA UTAMA. Setiap request baca/tulis akan
// membuka file ini langsung, jadi kalau dibuka juga di Excel pada saat yang
// sama, tutup dulu di Excel sebelum menyimpan dari WebUI (Excel mengunci file).
export const FILE_PATH = path.join(process.cwd(), "data", "IT_Support_Log_Keluhan_Client.xlsx");
const SHEET_NAME = "Log Keluhan";
const HEADER_ROW = 5;
const FIRST_DATA_ROW = 6;
const LAST_COL = 13; // A..M

const COLS = {
  no: 1,
  tanggalLapor: 2,
  namaClient: 3,
  departemen: 4,
  kategori: 5,
  deskripsi: 6,
  prioritas: 7,
  status: 8,
  pic: 9,
  tanggalSelesai: 10,
  durasi: 11,
  solusi: 12,
  catatan: 13,
};

export const OPTIONS = {
  kategori: ["Hardware", "Software", "Jaringan/Network", "Akun/Akses (Login)", "Printer/Peripheral", "Lainnya"],
  prioritas: ["Tinggi", "Sedang", "Rendah"],
  status: ["Open", "In Progress", "Menunggu Client", "Closed"],
};

// Mutex sederhana in-memory supaya tidak ada dua request yang menulis file
// xlsx secara bersamaan (mencegah file korup / race condition).
let writeLock = Promise.resolve();
function withLock(fn) {
  const run = writeLock.then(fn, fn);
  writeLock = run.catch(() => {});
  return run;
}

function assertFileExists() {
  if (!fs.existsSync(FILE_PATH)) {
    throw new Error(
      `File xlsx tidak ditemukan di ${FILE_PATH}. Pastikan file "IT_Support_Log_Keluhan_Client.xlsx" ada di folder /data.`
    );
  }
}

async function loadWorkbook() {
  assertFileExists();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(FILE_PATH);
  return wb;
}

async function saveWorkbook(wb) {
  // Paksa Excel menghitung ulang semua formula saat file dibuka,
  // supaya kolom No & Durasi (hasil formula) selalu akurat.
  wb.calcProperties.fullCalcOnLoad = true;
  await wb.xlsx.writeFile(FILE_PATH);
}

function cellToPlainValue(cell) {
  // Formula cells: ExcelJS exposes the cached result via cell.result,
  // not inside cell.value (cell.value only holds { formula, result }
  // for shared formulas — for normal formulas result lives on the cell).
  if (cell.formula !== undefined && cell.result !== undefined) {
    return cell.result;
  }
  const v = cell.value;
  if (v && typeof v === "object") {
    if (v.result !== undefined) return v.result; // formula cell -> cached result (fallback)
    if (v instanceof Date) return v;
    if (v.text !== undefined) return v.text; // rich text
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join("");
  }
  return v;
}

function toDateOnly(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

/**
 * Membaca semua tiket dari sheet "Log Keluhan".
 * Baris dianggap terisi kalau kolom "Nama Client" tidak kosong.
 */
export async function getTickets() {
  const wb = await loadWorkbook();
  const ws = wb.getWorksheet(SHEET_NAME);
  if (!ws) throw new Error(`Sheet "${SHEET_NAME}" tidak ditemukan di dalam file.`);

  const tickets = [];
  let row = FIRST_DATA_ROW;
  let emptyStreak = 0;

  while (emptyStreak < 25) {
    const r = ws.getRow(row);
    const namaClient = cellToPlainValue(r.getCell(COLS.namaClient));

    if (!namaClient || String(namaClient).trim() === "") {
      emptyStreak += 1;
      row += 1;
      continue;
    }
    emptyStreak = 0;

    const tanggalLapor = toDateOnly(cellToPlainValue(r.getCell(COLS.tanggalLapor)));
    const tanggalSelesai = toDateOnly(cellToPlainValue(r.getCell(COLS.tanggalSelesai)));

    // Kolom No & Durasi disimpan sebagai RUMUS di file (supaya tetap hidup
    // saat dibuka di Excel). Nilai cache rumus itu baru ter-update setelah
    // file dibuka & dihitung ulang oleh Excel/LibreOffice, jadi di sini kita
    // hitung sendiri di JS supaya WebUI selalu menampilkan angka yang benar
    // walau file belum pernah dibuka di Excel sejak ditulis oleh WebUI.
    const no = row - HEADER_ROW;
    let durasi = "";
    if (tanggalLapor && tanggalSelesai) {
      const ms = new Date(tanggalSelesai) - new Date(tanggalLapor);
      durasi = Math.round(ms / (1000 * 60 * 60 * 24));
    }

    tickets.push({
      row,
      no,
      tanggalLapor,
      namaClient: namaClient,
      departemen: cellToPlainValue(r.getCell(COLS.departemen)) || "",
      kategori: cellToPlainValue(r.getCell(COLS.kategori)) || "",
      deskripsi: cellToPlainValue(r.getCell(COLS.deskripsi)) || "",
      prioritas: cellToPlainValue(r.getCell(COLS.prioritas)) || "",
      status: cellToPlainValue(r.getCell(COLS.status)) || "",
      pic: cellToPlainValue(r.getCell(COLS.pic)) || "",
      tanggalSelesai,
      durasi,
      solusi: cellToPlainValue(r.getCell(COLS.solusi)) || "",
      catatan: cellToPlainValue(r.getCell(COLS.catatan)) || "",
    });
    row += 1;
  }

  return tickets.sort((a, b) => b.row - a.row); // terbaru di atas
}

export async function getSummary() {
  const tickets = await getTickets();
  const byStatus = { Open: 0, "In Progress": 0, "Menunggu Client": 0, Closed: 0 };
  const byKategori = Object.fromEntries(OPTIONS.kategori.map((k) => [k, 0]));
  let prioritasTinggi = 0;

  for (const t of tickets) {
    if (byStatus[t.status] !== undefined) byStatus[t.status] += 1;
    if (byKategori[t.kategori] !== undefined) byKategori[t.kategori] += 1;
    if (t.prioritas === "Tinggi") prioritasTinggi += 1;
  }

  return {
    total: tickets.length,
    byStatus,
    byKategori,
    prioritasTinggi,
  };
}

function findNextEmptyRow(ws) {
  let row = FIRST_DATA_ROW;
  let emptyStreak = 0;
  let lastRowWithContent = FIRST_DATA_ROW - 1;

  while (emptyStreak < 40) {
    const r = ws.getRow(row);
    const namaClient = cellToPlainValue(r.getCell(COLS.namaClient));
    if (namaClient && String(namaClient).trim() !== "") {
      lastRowWithContent = row;
      emptyStreak = 0;
    } else {
      emptyStreak += 1;
    }
    row += 1;
  }
  return lastRowWithContent + 1;
}

function applyRowFormulasAndFormats(ws, row) {
  const r = ws.getRow(row);
  r.getCell(COLS.no).value = { formula: `IF(C${row}="","",ROW()-${HEADER_ROW})` };
  r.getCell(COLS.durasi).value = {
    formula: `IF(AND(B${row}<>"",J${row}<>""),J${row}-B${row},"")`,
  };
  r.getCell(COLS.tanggalLapor).numFmt = "dd/mm/yyyy";
  r.getCell(COLS.tanggalSelesai).numFmt = "dd/mm/yyyy";

  // Salin style (font/border/fill/alignment) dari baris template (baris 6)
  // supaya baris baru tetap konsisten dengan format aslinya.
  const templateRow = ws.getRow(FIRST_DATA_ROW);
  for (let col = 1; col <= LAST_COL; col++) {
    const src = templateRow.getCell(col);
    const dst = r.getCell(col);
    dst.font = src.font;
    dst.border = src.border;
    dst.alignment = src.alignment;
    if (col !== COLS.no && col !== COLS.durasi) {
      dst.fill = src.fill;
    }
  }
  r.height = templateRow.height;
}

/**
 * Menambahkan tiket baru ke baris kosong berikutnya di sheet "Log Keluhan".
 */
export async function addTicket(data) {
  return withLock(async () => {
    const wb = await loadWorkbook();
    const ws = wb.getWorksheet(SHEET_NAME);
    if (!ws) throw new Error(`Sheet "${SHEET_NAME}" tidak ditemukan di dalam file.`);

    const row = findNextEmptyRow(ws);
    const r = ws.getRow(row);

    r.getCell(COLS.tanggalLapor).value = data.tanggalLapor ? new Date(data.tanggalLapor) : null;
    r.getCell(COLS.namaClient).value = data.namaClient || "";
    r.getCell(COLS.departemen).value = data.departemen || "";
    r.getCell(COLS.kategori).value = data.kategori || "";
    r.getCell(COLS.deskripsi).value = data.deskripsi || "";
    r.getCell(COLS.prioritas).value = data.prioritas || "";
    r.getCell(COLS.status).value = data.status || "Open";
    r.getCell(COLS.pic).value = data.pic || "";
    r.getCell(COLS.tanggalSelesai).value = data.tanggalSelesai ? new Date(data.tanggalSelesai) : null;
    r.getCell(COLS.solusi).value = data.solusi || "";
    r.getCell(COLS.catatan).value = data.catatan || "";

    applyRowFormulasAndFormats(ws, row);
    r.commit();

    await saveWorkbook(wb);
    return row;
  });
}

/**
 * Memperbarui sebagian field pada tiket yang sudah ada (misalnya update
 * status, tanggal selesai, solusi saat tiket ditutup).
 */
export async function updateTicket(row, updates) {
  return withLock(async () => {
    const wb = await loadWorkbook();
    const ws = wb.getWorksheet(SHEET_NAME);
    if (!ws) throw new Error(`Sheet "${SHEET_NAME}" tidak ditemukan di dalam file.`);

    const r = ws.getRow(Number(row));
    const existingNama = cellToPlainValue(r.getCell(COLS.namaClient));
    if (!existingNama) {
      throw new Error(`Baris ${row} tidak berisi tiket yang valid.`);
    }

    const map = {
      tanggalLapor: COLS.tanggalLapor,
      namaClient: COLS.namaClient,
      departemen: COLS.departemen,
      kategori: COLS.kategori,
      deskripsi: COLS.deskripsi,
      prioritas: COLS.prioritas,
      status: COLS.status,
      pic: COLS.pic,
      tanggalSelesai: COLS.tanggalSelesai,
      solusi: COLS.solusi,
      catatan: COLS.catatan,
    };

    for (const [key, col] of Object.entries(map)) {
      if (updates[key] === undefined) continue;
      if (key === "tanggalLapor" || key === "tanggalSelesai") {
        r.getCell(col).value = updates[key] ? new Date(updates[key]) : null;
      } else {
        r.getCell(col).value = updates[key];
      }
    }
    r.commit();

    await saveWorkbook(wb);
    return Number(row);
  });
}
