import ExcelJS from "exceljs";
import path from "path";
import fs from "fs";

// ---- Konfigurasi lokasi & struktur file xlsx ----
export const DATA_DIR = path.join(process.cwd(), "data");
export const FILE_PATH = path.join(DATA_DIR, "IT_Support_Log_Keluhan_Client.xlsx");
export const BACKUP_DIR = path.join(DATA_DIR, "backups");
export const TEMPLATE_DIR = path.join(DATA_DIR, "templates");
export const TEMPLATE_PATH = path.join(TEMPLATE_DIR, "IT_Support_Log_Keluhan_Client.template.xlsx");

const SHEET_NAME = "Log Keluhan";
const HEADER_ROW = 5;
const FIRST_DATA_ROW = 6;
const LAST_COL = 13; // A..M
const MAX_BACKUPS_TO_KEEP = 20;

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

// Inisialisasi folder data, backups, templates
for (const dir of [DATA_DIR, BACKUP_DIR, TEMPLATE_DIR]) {
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {}
  }
}

// Mutex sederhana in-memory supaya tidak ada dua request yang menulis file
// xlsx secara bersamaan (mencegah file korup / race condition).
let writeLock = Promise.resolve();
function withLock(fn) {
  const run = writeLock.then(fn, fn);
  writeLock = run.catch(() => {});
  return run;
}

/**
 * Membuat backup rotasi file Excel sebelum dilakukan operasi penulisan/modifikasi.
 * Menyimpan maksimal 20 file backup terbaru dan menghapus backup yang lebih lama.
 */
export function createBackup(action = "write") {
  try {
    if (!fs.existsSync(FILE_PATH)) return null;

    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const padMs = (n) => String(n).padStart(3, "0");
    const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(
      now.getHours()
    )}${pad(now.getMinutes())}${pad(now.getSeconds())}_${padMs(now.getMilliseconds())}`;

    const cleanAction = String(action).replace(/[^a-zA-Z0-9_-]/g, "_");
    const backupFileName = `IT_Support_Log_Keluhan_Client_${timestamp}_${cleanAction}.xlsx`;
    const backupPath = path.join(BACKUP_DIR, backupFileName);

    fs.copyFileSync(FILE_PATH, backupPath);

    // Rotasi backup: pertahankan MAX_BACKUPS_TO_KEEP terakhir
    cleanOldBackups();

    return backupFileName;
  } catch (err) {
    console.warn("Gagal membuat backup xlsx:", err.message);
    return null;
  }
}

/**
 * Menghapus file backup lama agar tidak menumpuk melebihi kuota.
 */
function cleanOldBackups() {
  try {
    if (!fs.existsSync(BACKUP_DIR)) return;

    const files = fs
      .readdirSync(BACKUP_DIR)
      .filter((f) => f.endsWith(".xlsx") && f.startsWith("IT_Support_Log_Keluhan_Client_"))
      .map((f) => {
        const fullPath = path.join(BACKUP_DIR, f);
        try {
          return { name: f, fullPath, mtime: fs.statSync(fullPath).mtimeMs };
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => b.mtime - a.mtime); // terbaru di awal

    if (files.length > MAX_BACKUPS_TO_KEEP) {
      const filesToDelete = files.slice(MAX_BACKUPS_TO_KEEP);
      for (const item of filesToDelete) {
        try {
          fs.unlinkSync(item.fullPath);
        } catch {}
      }
    }
  } catch (err) {
    console.warn("Pembersihan backup lama mengalami kendala:", err.message);
  }
}

/**
 * Memastikan file xlsx ada. Jika belum ada, coba salin dari template
 * atau buat workbook default awal.
 */
function assertFileExists() {
  if (fs.existsSync(FILE_PATH)) {
    return;
  }

  // Jika file utama belum ada tapi template tersedia di data/templates
  if (fs.existsSync(TEMPLATE_PATH)) {
    try {
      fs.copyFileSync(TEMPLATE_PATH, FILE_PATH);
      return;
    } catch {}
  }

  throw new Error(
    `File xlsx tidak ditemukan di ${FILE_PATH}. Pastikan file "IT_Support_Log_Keluhan_Client.xlsx" ada di folder /data.`
  );
}

async function loadWorkbook() {
  assertFileExists();
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.readFile(FILE_PATH);
    return wb;
  } catch (err) {
    if (err.code === "EBUSY" || err.code === "EPERM" || String(err.message).includes("busy") || String(err.message).includes("locked")) {
      throw new Error(
        "File Excel sedang dibuka / dikunci oleh program lain (misal Microsoft Excel). Harap tutup file Excel terlebih dahulu dan coba lagi."
      );
    }
    throw err;
  }
}

async function saveWorkbook(wb) {
  // Paksa Excel menghitung ulang semua formula saat file dibuka,
  // supaya kolom No & Durasi (hasil formula) selalu akurat.
  wb.calcProperties.fullCalcOnLoad = true;
  try {
    await wb.xlsx.writeFile(FILE_PATH);
  } catch (err) {
    if (err.code === "EBUSY" || err.code === "EPERM" || String(err.message).includes("busy") || String(err.message).includes("locked")) {
      throw new Error(
        "Gagal menyimpan: File Excel sedang dibuka / dikunci oleh aplikasi lain (misal Microsoft Excel). Harap tutup file Excel di komputer Anda dan coba lagi."
      );
    }
    throw err;
  }
}

function cellToPlainValue(cell) {
  if (!cell) return "";
  if (cell.formula !== undefined && cell.result !== undefined) {
    return cell.result;
  }
  const v = cell.value;
  if (v && typeof v === "object") {
    if (v.result !== undefined) return v.result;
    if (v instanceof Date) return v;
    if (v.text !== undefined) return v.text;
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
      namaClient: String(namaClient).trim(),
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
  const templateRow = ws.getRow(FIRST_DATA_ROW);
  for (let col = 1; col <= LAST_COL; col++) {
    const src = templateRow.getCell(col);
    const dst = r.getCell(col);
    if (src.font) dst.font = src.font;
    if (src.border) dst.border = src.border;
    if (src.alignment) dst.alignment = src.alignment;
    if (col !== COLS.no && col !== COLS.durasi && src.fill) {
      dst.fill = src.fill;
    }
  }
  if (templateRow.height) {
    r.height = templateRow.height;
  }
}

/**
 * Menambahkan tiket baru ke baris kosong berikutnya di sheet "Log Keluhan".
 */
export async function addTicket(data) {
  return withLock(async () => {
    // Buat backup otomatis sebelum menulis
    createBackup("addTicket");

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
 * Memperbarui field pada tiket yang sudah ada.
 */
export async function updateTicket(row, updates) {
  return withLock(async () => {
    // Buat backup otomatis sebelum update
    createBackup(`updateTicket_row${row}`);

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

/**
 * Menghapus tiket pada baris tertentu (Hanya Administrator).
 */
export async function deleteTicket(row) {
  return withLock(async () => {
    const rowNum = Number(row);
    if (isNaN(rowNum) || rowNum < FIRST_DATA_ROW) {
      throw new Error("Nomor baris tiket tidak valid.");
    }

    // Buat backup otomatis sebelum menghapus
    createBackup(`deleteTicket_row${rowNum}`);

    const wb = await loadWorkbook();
    const ws = wb.getWorksheet(SHEET_NAME);
    if (!ws) throw new Error(`Sheet "${SHEET_NAME}" tidak ditemukan di dalam file.`);

    const r = ws.getRow(rowNum);
    const existingNama = cellToPlainValue(r.getCell(COLS.namaClient));
    if (!existingNama) {
      throw new Error(`Baris ${rowNum} tidak berisi tiket yang valid.`);
    }

    // Hapus 1 baris
    ws.spliceRows(rowNum, 1);

    // Re-apply formula & formats untuk baris-baris data yang tersisa
    let curr = FIRST_DATA_ROW;
    let emptyStreak = 0;
    while (emptyStreak < 20) {
      const rowObj = ws.getRow(curr);
      const nameVal = cellToPlainValue(rowObj.getCell(COLS.namaClient));
      if (nameVal && String(nameVal).trim() !== "") {
        emptyStreak = 0;
        applyRowFormulasAndFormats(ws, curr);
        rowObj.commit();
      } else {
        emptyStreak += 1;
      }
      curr += 1;
    }

    await saveWorkbook(wb);
    return { ok: true, deletedRow: rowNum };
  });
}
