import { NextResponse } from "next/server";
import {
  registerUser,
  isRegistrationAllowed,
  getCurrentUser,
  MIN_PASSWORD_LENGTH,
} from "@/lib/auth";
import { getClientIp, checkRateLimit, recordFailedAttempt, resetRateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const ip = getClientIp(request);

  // 1. Rate limiting pada endpoint registrasi
  const limitCheck = checkRateLimit(ip, "register", 5, 15 * 60 * 1000);
  if (!limitCheck.allowed) {
    return NextResponse.json(
      {
        error: `Terlalu banyak percobaan registrasi. Silakan coba lagi dalam ${limitCheck.retryAfterMin} menit.`,
        locked: true,
        retryAfterMin: limitCheck.retryAfterMin,
      },
      { status: 429 }
    );
  }

  try {
    const currentUser = await getCurrentUser(request);
    const isPublicAllowed = isRegistrationAllowed();

    // Jika registrasi publik tidak dibuka dan tidak ada admin yang sedang login
    if (!isPublicAllowed && (!currentUser || !currentUser.isAdmin)) {
      return NextResponse.json(
        {
          error:
            "Pendaftaran akun publik dinonaktifkan demi keamanan sistem internal. Pembuatan akun baru hanya dapat dilakukan oleh Administrator.",
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { username, name, role, password, confirmPassword } = body;

    if (!password || !confirmPassword) {
      return NextResponse.json(
        { error: "Password dan konfirmasi password wajib diisi." },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: "Konfirmasi password tidak cocok dengan password." },
        { status: 400 }
      );
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `Password harus memiliki panjang minimal ${MIN_PASSWORD_LENGTH} karakter.` },
        { status: 400 }
      );
    }

    // Role yang didaftarkan: jika dibuat oleh admin, gunakan role pilihan; jika inisialisasi awal, IT Administrator
    const assignedRole = currentUser && currentUser.isAdmin ? (role || "Staff IT") : "IT Administrator";

    const { user } = await registerUser(
      { username, name, role: assignedRole, password },
      Boolean(currentUser && currentUser.isAdmin)
    );

    resetRateLimit(ip, "register");

    return NextResponse.json({
      ok: true,
      message: "Akun berhasil didaftarkan!",
      user,
    });
  } catch (err) {
    recordFailedAttempt(ip, "register", 5, 15 * 60 * 1000);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
