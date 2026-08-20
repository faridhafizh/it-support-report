/**
 * In-memory rate limiter per IP / identifier.
 * Memberikan proteksi brute-force login & registrasi dengan sistem lockout sementara.
 */

// Key: `${prefix}:${ip}`, Value: { count: number, firstAttemptAt: number, lockedUntil: number | null }
const attemptStore = new Map();

// Bersihkan data lama setiap 10 menit agar memori tetap bersih
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of attemptStore.entries()) {
      // Hapus jika sudah melewati lockout dan window
      if (record.lockedUntil && record.lockedUntil < now) {
        attemptStore.delete(key);
      } else if (!record.lockedUntil && now - record.firstAttemptAt > 30 * 60 * 1000) {
        attemptStore.delete(key);
      }
    }
  }, 10 * 60 * 1000);
}

/**
 * Mendapatkan alamat IP klien dari NextRequest / Request standard
 */
export function getClientIp(request) {
  if (!request) return "127.0.0.1";

  try {
    const forwarded = request.headers?.get?.("x-forwarded-for");
    if (forwarded) {
      return forwarded.split(",")[0].trim();
    }
    const realIp = request.headers?.get?.("x-real-ip");
    if (realIp) {
      return realIp.trim();
    }
    const cfIp = request.headers?.get?.("cf-connecting-ip");
    if (cfIp) {
      return cfIp.trim();
    }
  } catch {}

  return "127.0.0.1";
}

/**
 * Memeriksa apakah IP sedang dalam status lockout atau melebihi batas.
 * @param {string} ip - IP address klien
 * @param {string} prefix - Nama konteks (mis. 'login', 'register')
 * @param {number} maxAttempts - Jumlah percobaan sebelum lockout (default: 5)
 * @param {number} lockoutMs - Durasi lockout dalam milidetik (default: 15 menit)
 * @returns {{ allowed: boolean, remainingAttempts: number, lockoutRemainingSec: number, retryAfterMin: number }}
 */
export function checkRateLimit(ip, prefix = "login", maxAttempts = 5, lockoutMs = 15 * 60 * 1000) {
  const key = `${prefix}:${ip}`;
  const record = attemptStore.get(key);
  const now = Date.now();

  if (!record) {
    return {
      allowed: true,
      remainingAttempts: maxAttempts,
      lockoutRemainingSec: 0,
      retryAfterMin: 0,
    };
  }

  // Cek apakah sedang dalam masa lockout
  if (record.lockedUntil && record.lockedUntil > now) {
    const lockoutRemainingSec = Math.ceil((record.lockedUntil - now) / 1000);
    const retryAfterMin = Math.ceil(lockoutRemainingSec / 60);
    return {
      allowed: false,
      remainingAttempts: 0,
      lockoutRemainingSec,
      retryAfterMin,
    };
  }

  // Jika masa lockout sudah habis, reset counter
  if (record.lockedUntil && record.lockedUntil <= now) {
    attemptStore.delete(key);
    return {
      allowed: true,
      remainingAttempts: maxAttempts,
      lockoutRemainingSec: 0,
      retryAfterMin: 0,
    };
  }

  const remainingAttempts = Math.max(0, maxAttempts - record.count);
  return {
    allowed: remainingAttempts > 0,
    remainingAttempts,
    lockoutRemainingSec: 0,
    retryAfterMin: 0,
  };
}

/**
 * Mencatat percobaan gagal dan mengaktifkan lockout jika mencapai batas.
 * @returns {{ isLocked: boolean, remainingAttempts: number, lockoutRemainingSec: number, retryAfterMin: number }}
 */
export function recordFailedAttempt(ip, prefix = "login", maxAttempts = 5, lockoutMs = 15 * 60 * 1000) {
  const key = `${prefix}:${ip}`;
  const now = Date.now();
  let record = attemptStore.get(key);

  if (!record) {
    record = {
      count: 1,
      firstAttemptAt: now,
      lockedUntil: null,
    };
  } else {
    record.count += 1;
  }

  if (record.count >= maxAttempts) {
    record.lockedUntil = now + lockoutMs;
    attemptStore.set(key, record);
    const lockoutRemainingSec = Math.ceil(lockoutMs / 1000);
    const retryAfterMin = Math.ceil(lockoutRemainingSec / 60);
    return {
      isLocked: true,
      remainingAttempts: 0,
      lockoutRemainingSec,
      retryAfterMin,
    };
  }

  attemptStore.set(key, record);
  return {
    isLocked: false,
    remainingAttempts: maxAttempts - record.count,
    lockoutRemainingSec: 0,
    retryAfterMin: 0,
  };
}

/**
 * Mereset percobaan (dipanggil saat login berhasil)
 */
export function resetRateLimit(ip, prefix = "login") {
  const key = `${prefix}:${ip}`;
  attemptStore.delete(key);
}
