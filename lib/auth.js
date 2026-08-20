import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import {
  getUserByUsername,
  getUserById,
  getAllUsers,
  countUsers,
  createUser,
  updateUser,
  deleteUser,
  createSession,
  getSession,
  deleteSession,
  updateLastLogin,
  cleanExpiredSessions,
} from "./db.js";

export const SESSION_COOKIE_NAME = "auth_session";
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 hari
export const MIN_PASSWORD_LENGTH = 8;

/**
 * Memeriksa apakah user memiliki role Administrator.
 */
export function isAdmin(user) {
  if (!user || !user.role) return false;
  const r = String(user.role).trim().toLowerCase();
  return r === "admin" || r === "administrator" || r === "it administrator";
}

/**
 * Memeriksa apakah registrasi publik diizinkan.
 * Registrasi publik hanya diizinkan jika database belum memiliki user sama sekali (inisialisasi awal)
 * atau jika diaktifkan secara eksplisit via environment variable ALLOW_PUBLIC_REGISTRATION=true.
 */
export function isRegistrationAllowed() {
  if (process.env.ALLOW_PUBLIC_REGISTRATION === "true") {
    return true;
  }
  const total = countUsers();
  return total === 0; // Hanya izinkan jika 0 user (first setup)
}

/**
 * Hash password menggunakan algoritma Scrypt bawaan Node.js (memory-hard, tahan serangan brute force & GPU).
 * Format hash: $scrypt$<N>$<r>$<p>$<salt_hex>$<derived_key_hex>
 */
export function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString("hex");
    // N=16384 (CPU/memory cost), r=8 (block size), p=1 (parallelization)
    crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`$scrypt$16384$8$1$${salt}$${derivedKey.toString("hex")}`);
    });
  });
}

/**
 * Verifikasi password dengan dukungan Scrypt dan komparasi aman timingSafeEqual,
 * serta backward compatibility untuk akun dengan hash Bcrypt ($2a$, $2b$).
 */
export function verifyPassword(password, storedHash) {
  return new Promise((resolve) => {
    if (!storedHash || !password) return resolve(false);

    // 1. Dukungan akun legacy berformat Bcrypt
    if (storedHash.startsWith("$2")) {
      return bcrypt
        .compare(password, storedHash)
        .then(resolve)
        .catch(() => resolve(false));
    }

    // 2. Format Scrypt
    const parts = storedHash.split("$");
    if (parts.length < 7 || parts[1] !== "scrypt") {
      return resolve(false);
    }

    const N = parseInt(parts[2], 10);
    const r = parseInt(parts[3], 10);
    const p = parseInt(parts[4], 10);
    const salt = parts[5];
    const originalHash = parts[6];

    crypto.scrypt(password, salt, 64, { N, r, p }, (err, derivedKey) => {
      if (err) return resolve(false);
      try {
        const originalBuffer = Buffer.from(originalHash, "hex");
        if (derivedKey.length !== originalBuffer.length) {
          return resolve(false);
        }
        resolve(crypto.timingSafeEqual(derivedKey, originalBuffer));
      } catch {
        resolve(false);
      }
    });
  });
}

export function generateSessionToken() {
  return crypto.randomBytes(32).toString("hex");
}

export async function getCurrentUser(request = null) {
  try {
    let token = null;

    // 1. Coba baca dari header cookie langsung (paling cepat & kompatibel dengan Request standar)
    if (request && request.headers && typeof request.headers.get === "function") {
      const cookieHeader = request.headers.get("cookie") || "";
      const match = cookieHeader.match(/(?:^|;\s*)auth_session=([^;]*)/);
      if (match) {
        token = decodeURIComponent(match[1]);
      }
    }

    // 2. Coba baca dari request.cookies (NextRequest)
    if (!token && request && request.cookies && typeof request.cookies.get === "function") {
      token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    }

    // 3. Coba baca dari next/headers cookies() secara dinamis
    if (!token) {
      try {
        const { cookies } = await import("next/headers");
        const cookieStore = await cookies();
        token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
      } catch {}
    }

    if (!token) {
      return null;
    }

    const sessionData = getSession(token);
    if (!sessionData) {
      return null;
    }

    return {
      id: sessionData.id,
      username: sessionData.username,
      name: sessionData.name,
      role: sessionData.role,
      isAdmin: isAdmin(sessionData),
      token,
    };
  } catch (err) {
    console.error("Error pada getCurrentUser:", err);
    return null;
  }
}

export async function loginUser(username, password) {
  cleanExpiredSessions();

  const user = getUserByUsername(username);
  if (!user) {
    throw new Error("Username atau password salah.");
  }

  const isValid = await verifyPassword(password, user.password_hash);
  if (!isValid) {
    throw new Error("Username atau password salah.");
  }

  updateLastLogin(user.id);

  const token = generateSessionToken();
  const expiresAt = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  createSession(token, user.id, expiresAt);

  return {
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      isAdmin: isAdmin(user),
    },
    token,
  };
}

export async function registerUser({ username, name, role, password }, isInternalAdminCreation = false) {
  cleanExpiredSessions();

  const totalUsers = countUsers();

  // Jika bukan dibuat oleh admin internal dan registrasi publik tidak diizinkan
  if (!isInternalAdminCreation && !isRegistrationAllowed()) {
    throw new Error("Pendaftaran akun publik ditutup. Silakan hubungi Administrator untuk pembuatan akun.");
  }

  const trimmedUsername = String(username || "").trim();
  const trimmedName = String(name || "").trim();
  // Jika user pertama kali dibuat di sistem, jadikan default Administrator
  const defaultRole = totalUsers === 0 ? "IT Administrator" : "Staff IT";
  const trimmedRole = String(role || defaultRole).trim();

  if (!trimmedUsername || trimmedUsername.length < 3) {
    throw new Error("Username minimal 3 karakter.");
  }

  if (!/^[a-zA-Z0-9_.-]+$/.test(trimmedUsername)) {
    throw new Error("Username hanya boleh berisi huruf, angka, titik, strip, dan underscore.");
  }

  if (!trimmedName || trimmedName.length < 2) {
    throw new Error("Nama lengkap wajib diisi minimal 2 karakter.");
  }

  if (!password || String(password).length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password minimal ${MIN_PASSWORD_LENGTH} karakter.`);
  }

  const existing = getUserByUsername(trimmedUsername);
  if (existing) {
    throw new Error("Username sudah terdaftar. Silakan gunakan username lain.");
  }

  const passwordHash = await hashPassword(password);
  const newUser = createUser({
    username: trimmedUsername,
    name: trimmedName,
    role: trimmedRole,
    passwordHash,
  });

  return {
    user: {
      ...newUser,
      isAdmin: isAdmin(newUser),
    },
  };
}

export async function logoutUser(request = null) {
  let token = null;

  if (request && request.headers && typeof request.headers.get === "function") {
    const cookieHeader = request.headers.get("cookie") || "";
    const match = cookieHeader.match(/(?:^|;\s*)auth_session=([^;]*)/);
    if (match) {
      token = decodeURIComponent(match[1]);
    }
  }

  if (!token && request && request.cookies && typeof request.cookies.get === "function") {
    token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  }

  if (!token) {
    try {
      const { cookies } = await import("next/headers");
      const cookieStore = await cookies();
      token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    } catch {}
  }

  if (token) {
    deleteSession(token);
  }
}
