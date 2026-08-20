import { NextResponse } from "next/server";
import { loginUser, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "@/lib/auth";
import { getClientIp, checkRateLimit, recordFailedAttempt, resetRateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const ip = getClientIp(request);

  // 1. Periksa status rate limit / lockout
  const limitCheck = checkRateLimit(ip, "login", 5, 15 * 60 * 1000);
  if (!limitCheck.allowed) {
    return NextResponse.json(
      {
        error: `Terlalu banyak percobaan login gagal. Akses dari IP Anda dikunci sementara. Silakan coba lagi dalam ${limitCheck.retryAfterMin} menit.`,
        locked: true,
        retryAfterMin: limitCheck.retryAfterMin,
      },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username dan password wajib diisi." },
        { status: 400 }
      );
    }

    // 2. Coba autentikasi pengguna
    const { user, token } = await loginUser(username, password);

    // 3. Login sukses -> reset counter percobaan gagal
    resetRateLimit(ip, "login");

    const response = NextResponse.json({
      ok: true,
      message: "Login berhasil!",
      user,
    });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE_SECONDS,
      path: "/",
    });

    return response;
  } catch (err) {
    // 4. Catat kegagalan dan periksa apakah perlu lockout
    const failRecord = recordFailedAttempt(ip, "login", 5, 15 * 60 * 1000);

    if (failRecord.isLocked) {
      return NextResponse.json(
        {
          error: `Terlalu banyak percobaan login gagal (5x). Akses dari IP Anda dikunci selama 15 menit.`,
          locked: true,
          retryAfterMin: failRecord.retryAfterMin,
        },
        { status: 429 }
      );
    }

    const remainingText =
      failRecord.remainingAttempts <= 2
        ? ` (Sisa ${failRecord.remainingAttempts} percobaan sebelum akun/IP dikunci)`
        : "";

    return NextResponse.json(
      { error: (err.message || "Username atau password salah.") + remainingText },
      { status: 401 }
    );
  }
}
