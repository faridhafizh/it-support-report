import { NextResponse } from "next/server";
import { updateTicket, deleteTicket } from "@/lib/xlsx";
import { getCurrentUser, isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/tickets/[row] - Memperbarui status / detail tiket
 */
export async function PATCH(request, { params }) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { error: "Akses ditolak. Silakan login terlebih dahulu." },
        { status: 401 }
      );
    }

    const resolvedParams = await params;
    const rowParam = resolvedParams?.row || params?.row;

    const body = await request.json();
    const row = await updateTicket(rowParam, body);
    return NextResponse.json({ ok: true, row });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * DELETE /api/tickets/[row] - Menghapus tiket dari file Excel (Hanya Administrator)
 */
export async function DELETE(request, { params }) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { error: "Akses ditolak. Silakan login terlebih dahulu." },
        { status: 401 }
      );
    }

    // Role-Based Access Control: Hanya Admin yang dapat menghapus tiket
    if (!isAdmin(user)) {
      return NextResponse.json(
        { error: "Akses ditolak. Hanya pengguna dengan role Administrator yang berwenang menghapus tiket." },
        { status: 403 }
      );
    }

    const resolvedParams = await params;
    const rowParam = resolvedParams?.row || params?.row;

    const result = await deleteTicket(rowParam);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
