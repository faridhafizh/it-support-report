import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "auth.db");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Gunakan singleton di globalThis untuk mencegah pembukaan file berulang saat Next.js Fast Refresh
const globalForDb = globalThis;

export function getDb() {
  if (!globalForDb.authDbInstance) {
    const db = new DatabaseSync(DB_PATH);

    // Konfigurasi performa dan integritas database
    db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL COLLATE NOCASE,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'Staff IT',
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login_at DATETIME
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    `);

    globalForDb.authDbInstance = db;
  }
  return globalForDb.authDbInstance;
}

export function getUserByUsername(username) {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT id, username, name, role, password_hash, created_at, last_login_at
    FROM users
    WHERE username = ?
  `);
  return stmt.get(String(username).trim());
}

export function getUserById(id) {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT id, username, name, role, created_at, last_login_at
    FROM users
    WHERE id = ?
  `);
  return stmt.get(Number(id));
}

export function countUsers() {
  const db = getDb();
  const stmt = db.prepare(`SELECT COUNT(*) as count FROM users`);
  const row = stmt.get();
  return row ? Number(row.count) : 0;
}

export function getAllUsers() {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT id, username, name, role, created_at, last_login_at
    FROM users
    ORDER BY id ASC
  `);
  return stmt.all();
}

export function createUser({ username, name, role = "Staff IT", passwordHash }) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO users (username, name, role, password_hash)
    VALUES (?, ?, ?, ?)
  `);
  const info = stmt.run(
    String(username).trim(),
    String(name).trim(),
    String(role).trim() || "Staff IT",
    passwordHash
  );
  return {
    id: Number(info.lastInsertRowid),
    username: String(username).trim(),
    name: String(name).trim(),
    role: String(role).trim() || "Staff IT",
  };
}

export function updateUser(id, { name, role, passwordHash }) {
  const db = getDb();
  const updates = [];
  const params = [];

  if (name !== undefined) {
    updates.push("name = ?");
    params.push(String(name).trim());
  }
  if (role !== undefined) {
    updates.push("role = ?");
    params.push(String(role).trim());
  }
  if (passwordHash !== undefined && passwordHash) {
    updates.push("password_hash = ?");
    params.push(passwordHash);
  }

  if (updates.length === 0) return getUserById(id);

  params.push(Number(id));
  const sql = `UPDATE users SET ${updates.join(", ")} WHERE id = ?`;
  const stmt = db.prepare(sql);
  stmt.run(...params);

  return getUserById(id);
}

export function deleteUser(id) {
  const db = getDb();
  const stmt = db.prepare(`DELETE FROM users WHERE id = ?`);
  const info = stmt.run(Number(id));
  return info.changes > 0;
}

export function updateLastLogin(userId) {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE users
    SET last_login_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  stmt.run(Number(userId));
}

export function createSession(token, userId, expiresAt) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO sessions (id, user_id, expires_at)
    VALUES (?, ?, ?)
  `);
  stmt.run(token, Number(userId), Number(expiresAt));
}

export function getSession(token) {
  if (!token) return null;
  const db = getDb();
  const now = Date.now();
  const stmt = db.prepare(`
    SELECT s.id as session_id, s.expires_at, u.id, u.username, u.name, u.role, u.created_at, u.last_login_at
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.id = ? AND s.expires_at > ?
  `);
  const row = stmt.get(token, now);
  return row || null;
}

export function deleteSession(token) {
  if (!token) return;
  const db = getDb();
  const stmt = db.prepare(`DELETE FROM sessions WHERE id = ?`);
  stmt.run(token);
}

export function cleanExpiredSessions() {
  const db = getDb();
  const now = Date.now();
  const stmt = db.prepare(`DELETE FROM sessions WHERE expires_at <= ?`);
  stmt.run(now);
}
