import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { checkRateLimit, recordFailedAttempt, resetRateLimit } from "../lib/rateLimit.js";
import {
  hashPassword,
  verifyPassword,
  isAdmin,
  isRegistrationAllowed,
  MIN_PASSWORD_LENGTH,
} from "../lib/auth.js";
import {
  getUserByUsername,
  getUserById,
  getAllUsers,
  countUsers,
  createUser,
  updateUser,
  deleteUser,
} from "../lib/db.js";
import {
  getTickets,
  getSummary,
  addTicket,
  updateTicket,
  deleteTicket,
  createBackup,
  BACKUP_DIR,
  FILE_PATH,
} from "../lib/xlsx.js";

async function runTests() {
  console.log("==================================================");
  console.log("🧪 RUNNING COMPREHENSIVE INTEGRITY & SECURITY TESTS");
  console.log("==================================================\n");

  // ----------------------------------------------------
  // TEST 1: Rate Limiting & Lockout Protection
  // ----------------------------------------------------
  console.log("▶ [Test 1] Rate Limiter & Brute-Force Lockout...");
  const testIp = "192.168.100.99";
  resetRateLimit(testIp, "test_login");

  let check = checkRateLimit(testIp, "test_login", 5);
  assert.strictEqual(check.allowed, true, "Initial attempt should be allowed");
  assert.strictEqual(check.remainingAttempts, 5, "Should have 5 attempts remaining");

  // 4 failed attempts
  for (let i = 1; i <= 4; i++) {
    const res = recordFailedAttempt(testIp, "test_login", 5);
    assert.strictEqual(res.isLocked, false, `Attempt ${i} should not be locked`);
    assert.strictEqual(res.remainingAttempts, 5 - i);
  }

  // 5th failed attempt -> Lockout!
  const fifth = recordFailedAttempt(testIp, "test_login", 5);
  assert.strictEqual(fifth.isLocked, true, "5th failed attempt must trigger lockout");
  assert.strictEqual(fifth.remainingAttempts, 0);
  assert(fifth.lockoutRemainingSec > 0, "Lockout remaining seconds should be > 0");

  // 6th attempt should be denied
  const blocked = checkRateLimit(testIp, "test_login", 5);
  assert.strictEqual(blocked.allowed, false, "Subsequent attempt while locked must be blocked");

  // Reset rate limit on success
  resetRateLimit(testIp, "test_login");
  const postReset = checkRateLimit(testIp, "test_login", 5);
  assert.strictEqual(postReset.allowed, true, "Rate limit should be reset");
  console.log("  ✅ Rate Limiting & Lockout Protection passed!");

  // ----------------------------------------------------
  // TEST 2: Password Minimum Length & Scrypt Hashing
  // ----------------------------------------------------
  console.log("\n▶ [Test 2] Password Policy & Scrypt Hashing...");
  assert.strictEqual(MIN_PASSWORD_LENGTH, 8, "Minimum password length must be 8");

  const rawPass = "MySecurePass#2026";
  const hash = await hashPassword(rawPass);
  assert(hash.startsWith("$scrypt$"), "Hash format must start with $scrypt$");

  const isMatch = await verifyPassword(rawPass, hash);
  assert.strictEqual(isMatch, true, "Valid password should verify successfully");

  const isWrongMatch = await verifyPassword("WrongPassword123", hash);
  assert.strictEqual(isWrongMatch, false, "Invalid password must fail verification");
  console.log("  ✅ Password Policy & Scrypt Hashing passed!");

  // ----------------------------------------------------
  // TEST 3: RBAC Roles & Database Helpers
  // ----------------------------------------------------
  console.log("\n▶ [Test 3] RBAC Roles & User Management...");
  assert.strictEqual(isAdmin({ role: "IT Administrator" }), true);
  assert.strictEqual(isAdmin({ role: "Administrator" }), true);
  assert.strictEqual(isAdmin({ role: "Admin" }), true);
  assert.strictEqual(isAdmin({ role: "Staff IT" }), false);
  assert.strictEqual(isAdmin({ role: "IT Helpdesk" }), false);
  assert.strictEqual(isAdmin(null), false);

  const initialCount = countUsers();
  assert(initialCount > 0, "Database should have seeded users");

  // Create temporary test user
  const tempUser = createUser({
    username: "test.staff.unit",
    name: "Staff Unit Test",
    role: "Staff IT",
    passwordHash: hash,
  });
  assert(tempUser.id > 0, "Created user should have valid id");

  const fetched = getUserById(tempUser.id);
  assert.strictEqual(fetched.username, "test.staff.unit");
  assert.strictEqual(fetched.role, "Staff IT");

  // Update user
  updateUser(tempUser.id, { name: "Staff Unit Test Updated", role: "IT Helpdesk" });
  const updated = getUserById(tempUser.id);
  assert.strictEqual(updated.name, "Staff Unit Test Updated");
  assert.strictEqual(updated.role, "IT Helpdesk");

  // Delete user
  deleteUser(tempUser.id);
  const deleted = getUserById(tempUser.id);
  assert.strictEqual(deleted, undefined, "Deleted user should no longer exist");
  console.log("  ✅ RBAC Roles & User Management passed!");

  // ----------------------------------------------------
  // TEST 4: Excel Rotating Backup & Ticket Operations
  // ----------------------------------------------------
  console.log("\n▶ [Test 4] Excel Rotating Backup & Ticket Operations...");
  assert(fs.existsSync(FILE_PATH), `Excel file must exist at ${FILE_PATH}`);

  // Test manual backup
  const bName = createBackup("unit_test");
  assert(bName !== null, "createBackup should succeed and return file name");
  const bPath = path.join(BACKUP_DIR, bName);
  assert(fs.existsSync(bPath), `Backup file must exist at ${bPath}`);

  // Test adding a ticket
  const newRow = await addTicket({
    tanggalLapor: "2026-08-20",
    namaClient: "PT. Unit Test Automation",
    departemen: "QA Engineering",
    kategori: "Software",
    deskripsi: "Automated test ticket for integrity verification",
    prioritas: "Tinggi",
    status: "Open",
    pic: "Automated QA",
    tanggalSelesai: null,
    solusi: "",
    catatan: "Temporary test ticket",
  });
  assert(typeof newRow === "number" && newRow >= 6, "New row should be >= 6");

  // Verify ticket exists
  const tickets = await getTickets();
  const found = tickets.find((t) => t.row === newRow);
  assert(found !== undefined, "Added ticket must be found in tickets list");
  assert.strictEqual(found.namaClient, "PT. Unit Test Automation");

  // Test updating ticket
  await updateTicket(newRow, {
    status: "Closed",
    tanggalSelesai: "2026-08-20",
    solusi: "Resolved by unit test runner",
  });
  const ticketsAfterUpdate = await getTickets();
  const updatedTicket = ticketsAfterUpdate.find((t) => t.row === newRow);
  assert.strictEqual(updatedTicket.status, "Closed");
  assert.strictEqual(updatedTicket.solusi, "Resolved by unit test runner");

  // Test summary
  const summary = await getSummary();
  assert(summary.total > 0, "Summary total should be > 0");

  // Test deleting ticket
  const delResult = await deleteTicket(newRow);
  assert.strictEqual(delResult.ok, true, "deleteTicket should return ok: true");
  const ticketsAfterDelete = await getTickets();
  const deletedTicket = ticketsAfterDelete.find((t) => t.row === newRow && t.namaClient === "PT. Unit Test Automation");
  assert.strictEqual(deletedTicket, undefined, "Deleted ticket must no longer exist");

  console.log("  ✅ Excel Rotating Backup & Ticket Operations passed!");

  // ----------------------------------------------------
  // TEST 5: .gitignore Integrity
  // ----------------------------------------------------
  console.log("\n▶ [Test 5] .gitignore Integrity...");
  const gitignorePath = path.join(process.cwd(), ".gitignore");
  assert(fs.existsSync(gitignorePath), ".gitignore must exist");
  const gitignoreContent = fs.readFileSync(gitignorePath, "utf-8");
  assert(gitignoreContent.includes("data/auth.db*"), ".gitignore must ignore data/auth.db*");
  assert(gitignoreContent.includes("data/*.xlsx"), ".gitignore must ignore data/*.xlsx");
  assert(gitignoreContent.includes("data/backups/*"), ".gitignore must ignore data/backups/*");
  console.log("  ✅ .gitignore Integrity passed!");

  console.log("\n==================================================");
  console.log("🎉 ALL TESTS COMPLETED SUCCESSFULLY!");
  console.log("==================================================");
}

runTests().catch((err) => {
  console.error("\n❌ Test Failed:", err);
  process.exit(1);
});
