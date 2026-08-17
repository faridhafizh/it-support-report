import { NextResponse } from "next/server";
import { getTickets, addTicket, OPTIONS } from "../../../lib/xlsx";

// Selalu baca ulang file Excel, jangan pernah di-cache oleh Next.js.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const tickets = await getTickets();
    return NextResponse.json({ tickets, options: OPTIONS });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();

    if (!body.namaClient || String(body.namaClient).trim() === "") {
      return NextResponse.json({ error: "Nama Client wajib diisi." }, { status: 400 });
    }
    if (!body.deskripsi || String(body.deskripsi).trim() === "") {
      return NextResponse.json({ error: "Deskripsi keluhan wajib diisi." }, { status: 400 });
    }

    const row = await addTicket({
      tanggalLapor: body.tanggalLapor || new Date().toISOString().slice(0, 10),
      namaClient: body.namaClient,
      departemen: body.departemen,
      kategori: body.kategori,
      deskripsi: body.deskripsi,
      prioritas: body.prioritas || "Sedang",
      status: body.status || "Open",
      pic: body.pic,
      tanggalSelesai: body.tanggalSelesai,
      solusi: body.solusi,
      catatan: body.catatan,
    });

    return NextResponse.json({ ok: true, row });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
