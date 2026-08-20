#!/usr/bin/env node

/**
 * Script CLI untuk membuat / menginisialisasi akun Administrator awal.
 *
 * Cara penggunaan:
 *   npm run seed
 *   atau
 *   node scripts/seed-admin.js [username] [nama] [password] [role]
 *
 * Contoh:
 *   node scripts/seed-admin.js admin "Administrator IT" "Admin#Support2026" "IT Administrator"
 */

import crypto from "node:crypto";
import { getUserByUsername, createUser, updateUser } from "../lib/db.js";

function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString("hex");
    crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`$scrypt$16384$8$1$${salt}$${derivedKey.toString("hex")}`);
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  const username = args[0] || process.env.ADMIN_USERNAME || "admin";
  const name = args[1] || process.env.ADMIN_NAME || "Administrator IT";
  const password = args[2] || process.env.ADMIN_PASSWORD || "Admin#Support2026";
  const role = args[3] || process.env.ADMIN_ROLE || "IT Administrator";

  console.log("==================================================");
  console.log("🛡️  IT SUPPORT WEBUI — INITIALIZE ADMIN SEED");
  console.log("==================================================");
  console.log(`👤 Username : ${username}`);
  console.log(`📛 Nama     : ${name}`);
  console.log(`🔑 Password : ${password}`);
  console.log(`🏷️  Role     : ${role}`);
  console.log("--------------------------------------------------");

  if (password.length < 8) {
    console.error("❌ Error: Password minimal harus 8 karakter!");
    process.exit(1);
  }

  try {
    const existing = getUserByUsername(username);
    const passwordHash = await hashPassword(password);

    if (existing) {
      console.log(`⚠️  User "${username}" sudah ada di database. Memperbarui password & data...`);
      updateUser(existing.id, { name, role, passwordHash });
      console.log(`✅ Berhasil memperbarui data Administrator (ID: ${existing.id}).`);
    } else {
      const newUser = createUser({
        username,
        name,
        role,
        passwordHash,
      });
      console.log(`✅ Berhasil membuat akun Administrator baru (ID: ${newUser.id})!`);
    }

    console.log("--------------------------------------------------");
    console.log("🚀 Anda sekarang dapat login ke WebUI dengan akun di atas.");
    console.log("==================================================");
    process.exit(0);
  } catch (err) {
    console.error("❌ Gagal melakukan seeding admin:", err.message);
    process.exit(1);
  }
}

main();
