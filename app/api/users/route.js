import { NextResponse } from "next/server";
import { getCurrentUser, isAdmin, registerUser, MIN_PASSWORD_LENGTH } from "@/lib/auth";
import { getAllUsers } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/users - Mengambil daftar seluruh pengguna (Hanya Administrator)
 */
export async function GET(request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { error: "Akses ditolak. Silakan login terlebih dahulu." },
        { status: 401 }
      );
    }

    if (!isAdmin(user)) {
      return NextResponse.json(
        { error: "Akses ditolak. Hanya Administrator yang dapat melihat daftar pengguna." },
        { status: 403 }
      );
    }

    const users = getAllUsers();
    return NextResponse.json({ users });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/users - Menambahkan pengguna baru (Hanya Administrator)
 */
export async function POST(request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { error: "Akses ditolak. Silakan login terlebih dahulu." },
        { status: 401 }
      );
    }

    if (!isAdmin(user)) {
      return NextResponse.json(
        { error: "Akses ditolak. Hanya Administrator yang dapat mendaftarkan akun baru." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { username, name, role, password } = body;

    if (!username || !name || !password) {
      return NextResponse.json(
        { error: "Username, Nama Lengkap, dan Password wajib diisi." },
        { status: 400 }
      );
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `Password minimal ${MIN_PASSWORD_LENGTH} karakter.` },
        { status: 400 }
      );
    }

    const result = await registerUser(
      {
        username,
        name,
        role: role || "Staff IT",
        password,
      },
      true // isInternalAdminCreation = true
    );

    return NextResponse.json({
      ok: true,
      message: `Pengguna ${username} berhasil dibuat.`,
      user: result.user,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
