import { NextResponse } from "next/server";
import { getSummary } from "../../../lib/xlsx";

// Route ini hanya membaca request GET tanpa API dinamis apa pun, jadi Next.js
// akan meng-cache-nya sebagai halaman statis kalau tidak dipaksa dinamis —
// akibatnya angka dashboard tidak akan pernah ter-update. Baris di bawah ini
// memaksa route selalu dieksekusi ulang & membaca file Excel terbaru.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const summary = await getSummary();
    return NextResponse.json(summary);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
