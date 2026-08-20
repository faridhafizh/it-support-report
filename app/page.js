"use client";

import { useEffect, useState, useCallback } from "react";

const emptyForm = {
  tanggalLapor: new Date().toISOString().slice(0, 10),
  namaClient: "",
  departemen: "",
  kategori: "Hardware",
  deskripsi: "",
  prioritas: "Sedang",
  status: "Open",
  pic: "",
  tanggalSelesai: "",
  solusi: "",
  catatan: "",
};

function slug(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function StatusBadge({ value }) {
  return <span className={`badge status-${slug(value)}`}>{value || "-"}</span>;
}

function PrioBadge({ value }) {
  return <span className={`badge prio-${slug(value)}`}>{value || "-"}</span>;
}

async function safeJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    if (res.status === 401) {
      throw new Error("Sesi Anda belum login atau telah berakhir.");
    }
    if (res.status === 403) {
      throw new Error("Akses ditolak: Anda tidak memiliki wewenang untuk tindakan ini.");
    }
    if (res.status === 429) {
      throw new Error("Terlalu banyak permintaan. Sistem mengunci sementara akses Anda.");
    }
    throw new Error(`Terjadi kesalahan server (${res.status}). Silakan muat ulang halaman.`);
  }
}

export default function Home() {
  // State Autentikasi
  const [authChecking, setAuthChecking] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [authSuccess, setAuthSuccess] = useState(null);

  // Form State Login
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // State Dashboard Tiket
  const [options, setOptions] = useState({ kategori: [], prioritas: [], status: [] });
  const [tickets, setTickets] = useState([]);
  const [summary, setSummary] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null); // {type, text}
  const [editingRow, setEditingRow] = useState(null);
  const [editDraft, setEditDraft] = useState({});

  // State Modal Manajemen Pengguna (Khusus Admin)
  const [showUserModal, setShowUserModal] = useState(false);
  const [userModalTab, setUserModalTab] = useState("list"); // 'list' | 'create'
  const [usersList, setUsersList] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userActionMsg, setUserActionMsg] = useState(null);
  const [newUserForm, setNewUserForm] = useState({
    username: "",
    name: "",
    role: "Staff IT",
    password: "",
    confirmPassword: "",
  });
  const [showNewUserPwd, setShowNewUserPwd] = useState(false);
  const [userSubmitting, setUserSubmitting] = useState(false);

  // Cek Status Login Pengguna
  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await safeJson(res);
        if (data.authenticated && data.user) {
          setCurrentUser(data.user);
          setForm((f) => ({ ...f, pic: f.pic || data.user.name }));
        } else {
          setCurrentUser(null);
        }
      } else {
        setCurrentUser(null);
      }
    } catch {
      setCurrentUser(null);
    } finally {
      setAuthChecking(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Load Data Tiket & Summary
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, sRes] = await Promise.all([fetch("/api/tickets"), fetch("/api/summary")]);

      if (tRes.status === 401 || sRes.status === 401) {
        setCurrentUser(null);
        return;
      }

      const tData = await safeJson(tRes);
      const sData = await safeJson(sRes);

      if (!tRes.ok || tData.error) throw new Error(tData.error || "Gagal memuat daftar tiket.");
      if (!sRes.ok || sData.error) throw new Error(sData.error || "Gagal memuat ringkasan tiket.");

      setTickets(tData.tickets || []);
      setOptions(tData.options || { kategori: [], prioritas: [], status: [] });
      setSummary(sData);
    } catch (err) {
      setMessage({ type: "error", text: `Gagal memuat data: ${err.message}` });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      loadAll();
    }
  }, [currentUser, loadAll]);

  // Load Daftar User (Admin)
  const loadUsersList = useCallback(async () => {
    if (!currentUser?.isAdmin) return;
    setUsersLoading(true);
    setUserActionMsg(null);
    try {
      const res = await fetch("/api/users");
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error || "Gagal mengambil daftar pengguna.");
      setUsersList(data.users || []);
    } catch (err) {
      setUserActionMsg({ type: "error", text: err.message });
    } finally {
      setUsersLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (showUserModal && currentUser?.isAdmin) {
      loadUsersList();
    }
  }, [showUserModal, currentUser, loadUsersList]);

  // Handler Login
  async function handleLoginSubmit(e) {
    e.preventDefault();
    setAuthSubmitting(true);
    setAuthError(null);
    setAuthSuccess(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginForm),
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error || "Gagal masuk ke akun.");

      setCurrentUser(data.user);
      setForm((f) => ({ ...f, pic: data.user.name }));
      setLoginForm({ username: "", password: "" });
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthSubmitting(false);
    }
  }

  // Handler Logout
  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setCurrentUser(null);
      setTickets([]);
      setSummary(null);
      setAuthError(null);
      setAuthSuccess(null);
      setShowUserModal(false);
    }
  }

  function updateField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Handler Tambah Tiket Baru
  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await safeJson(res);
      if (!res.ok) {
        if (res.status === 401) {
          setCurrentUser(null);
          throw new Error("Sesi telah berakhir. Silakan login kembali.");
        }
        throw new Error(data.error || "Gagal menyimpan tiket.");
      }
      setMessage({
        type: "success",
        text: `Tiket baru berhasil disimpan ke file Excel (baris ${data.row}). Backup otomatis telah dibuat.`,
      });
      setForm({
        ...emptyForm,
        tanggalLapor: new Date().toISOString().slice(0, 10),
        pic: currentUser?.name || "",
      });
      await loadAll();
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  // Handler Ganti Status Cepat
  async function handleStatusChange(row, newStatus) {
    setMessage(null);
    try {
      const updates = { status: newStatus };
      if (newStatus === "Closed") {
        updates.tanggalSelesai = new Date().toISOString().slice(0, 10);
      }
      const res = await fetch(`/api/tickets/${row}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await safeJson(res);
      if (!res.ok) {
        if (res.status === 401) {
          setCurrentUser(null);
          throw new Error("Sesi telah berakhir. Silakan login kembali.");
        }
        throw new Error(data.error || "Gagal memperbarui status.");
      }
      await loadAll();
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    }
  }

  function startEdit(t) {
    setEditingRow(t.row);
    setEditDraft({
      solusi: t.solusi || "",
      catatan: t.catatan || "",
      pic: t.pic || (currentUser ? currentUser.name : ""),
      tanggalSelesai: t.tanggalSelesai || "",
    });
  }

  // Handler Simpan Edit Tiket
  async function saveEdit(row) {
    setMessage(null);
    try {
      const res = await fetch(`/api/tickets/${row}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editDraft),
      });
      const data = await safeJson(res);
      if (!res.ok) {
        if (res.status === 401) {
          setCurrentUser(null);
          throw new Error("Sesi telah berakhir. Silakan login kembali.");
        }
        throw new Error(data.error || "Gagal menyimpan perubahan.");
      }
      setEditingRow(null);
      await loadAll();
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    }
  }

  // Handler Hapus Tiket (Khusus Administrator)
  async function handleDeleteTicket(t) {
    if (!currentUser?.isAdmin) {
      alert("Hanya Administrator yang memiliki wewenang untuk menghapus tiket.");
      return;
    }

    const confirmDelete = window.confirm(
      `Apakah Anda yakin ingin menghapus tiket #${t.no} (Client: "${t.namaClient}")?\n\nBackup otomatis file Excel akan disimpan ke data/backups/ sebelum dihapus.`
    );
    if (!confirmDelete) return;

    setMessage(null);
    try {
      const res = await fetch(`/api/tickets/${t.row}`, {
        method: "DELETE",
      });
      const data = await safeJson(res);
      if (!res.ok) {
        throw new Error(data.error || "Gagal menghapus tiket.");
      }

      setMessage({
        type: "success",
        text: `Tiket #${t.no} ("${t.namaClient}") berhasil dihapus. Backup otomatis telah disimpan di folder data/backups/.`,
      });
      await loadAll();
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    }
  }

  // Handler Tambah User Baru (Khusus Administrator)
  async function handleCreateUserSubmit(e) {
    e.preventDefault();
    setUserSubmitting(true);
    setUserActionMsg(null);

    if (newUserForm.password !== newUserForm.confirmPassword) {
      setUserActionMsg({ type: "error", text: "Konfirmasi password tidak cocok." });
      setUserSubmitting(false);
      return;
    }

    if (newUserForm.password.length < 8) {
      setUserActionMsg({ type: "error", text: "Password minimal harus 8 karakter." });
      setUserSubmitting(false);
      return;
    }

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: newUserForm.username,
          name: newUserForm.name,
          role: newUserForm.role,
          password: newUserForm.password,
        }),
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error || "Gagal menambahkan user baru.");

      setUserActionMsg({ type: "success", text: `User "${newUserForm.username}" berhasil didaftarkan!` });
      setNewUserForm({
        username: "",
        name: "",
        role: "Staff IT",
        password: "",
        confirmPassword: "",
      });
      setUserModalTab("list");
      await loadUsersList();
    } catch (err) {
      setUserActionMsg({ type: "error", text: err.message });
    } finally {
      setUserSubmitting(false);
    }
  }

  // Handler Reset Password User (Khusus Administrator)
  async function handleResetUserPassword(userItem) {
    const newPassword = window.prompt(
      `Masukkan password baru untuk user "${userItem.username}" (minimal 8 karakter):`
    );
    if (!newPassword) return;

    if (newPassword.length < 8) {
      alert("Password minimal harus 8 karakter!");
      return;
    }

    try {
      const res = await fetch(`/api/users/${userItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error || "Gagal mereset password.");

      alert(`Password untuk ${userItem.username} berhasil diperbarui.`);
      await loadUsersList();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  }

  // Handler Hapus User (Khusus Administrator)
  async function handleDeleteUser(userItem) {
    if (userItem.id === currentUser.id) {
      alert("Anda tidak dapat menghapus akun Anda sendiri.");
      return;
    }

    const confirmDel = window.confirm(
      `Apakah Anda yakin ingin menghapus akun "${userItem.username}" (${userItem.name})?`
    );
    if (!confirmDel) return;

    try {
      const res = await fetch(`/api/users/${userItem.id}`, {
        method: "DELETE",
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error || "Gagal menghapus user.");

      alert(`User "${userItem.username}" berhasil dihapus.`);
      await loadUsersList();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  }

  // Layar Loading Sesi
  if (authChecking) {
    return (
      <div className="auth-loading-screen">
        <div className="spinner"></div>
        <div>Memeriksa sesi login...</div>
      </div>
    );
  }

  // Layar Belum Login (Portal Login Aman & Anti Brute-Force)
  if (!currentUser) {
    return (
      <>
        <div className="auth-wrapper">
          <div className="auth-card">
            <div className="auth-header">
              <div className="auth-header-icon">🛡️</div>
              <h2>Portal Autentikasi IT Support</h2>
              <p>Silakan masuk dengan akun terdaftar untuk mengakses sistem.</p>
            </div>

            <div className="auth-body">
              {authError && (
                <div className="msg error">
                  <span>{authError}</span>
                </div>
              )}
              {authSuccess && (
                <div className="msg success">
                  <span>{authSuccess}</span>
                </div>
              )}

              <form className="auth-form" onSubmit={handleLoginSubmit}>
                <div className="field">
                  <label>Username</label>
                  <input
                    type="text"
                    placeholder="Masukkan username Anda"
                    value={loginForm.username}
                    onChange={(e) => setLoginForm((f) => ({ ...f, username: e.target.value }))}
                    required
                    autoFocus
                  />
                </div>

                <div className="field">
                  <label>Password</label>
                  <div className="password-input-wrap">
                    <input
                      type={showLoginPassword ? "text" : "password"}
                      placeholder="Masukkan password"
                      value={loginForm.password}
                      onChange={(e) => setLoginForm((f) => ({ ...f, password: e.target.value }))}
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      className="btn-toggle-pwd"
                      onClick={() => setShowLoginPassword((v) => !v)}
                      title={showLoginPassword ? "Sembunyikan password" : "Lihat password"}
                    >
                      {showLoginPassword ? "👁️‍🗨️" : "👁️"}
                    </button>
                  </div>
                </div>

                <button type="submit" className="btn-auth-submit" disabled={authSubmitting}>
                  {authSubmitting ? "Memverifikasi Kredensial..." : "Masuk ke Dashboard"}
                </button>
              </form>

              <div className="security-badge">
                <span className="icon">🔒</span>
                <span>
                  Dilindungi proteksi brute-force (lockout 15 menit), enkripsi Scrypt/Bcrypt, dan RBAC.
                  Pendaftaran akun dikelola langsung oleh Administrator.
                </span>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Layar Dashboard (Setelah Login)
  const userInitials = (currentUser?.name || currentUser?.username || "IT")
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");

  return (
    <>
      <header className="app-header">
        <div className="header-inner">
          <div className="header-brand">
            <h1>IT Support — Log Keluhan Client</h1>
            <p>Terhubung langsung ke file IT_Support_Log_Keluhan_Client.xlsx</p>
          </div>

          <div className="header-actions">
            {currentUser.isAdmin && (
              <button
                className="btn-admin-manage"
                onClick={() => {
                  setShowUserModal(true);
                  setUserModalTab("list");
                }}
                title="Kelola akun pengguna & role"
              >
                <span>👥</span>
                <span>Kelola User</span>
              </button>
            )}

            <div className="user-profile-badge">
              <div className="user-avatar">{userInitials}</div>
              <div className="user-info">
                <span className="user-name">{currentUser.name}</span>
                <span className="user-role">{currentUser.role || "Staff IT"}</span>
              </div>
              <button className="btn-logout" onClick={handleLogout} title="Keluar dari sesi ini">
                Keluar
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="container">
        {message && (
          <div className={`msg ${message.type}`}>
            <span>{message.text}</span>
            <button
              style={{ background: "none", border: "none", cursor: "pointer", fontWeight: "bold" }}
              onClick={() => setMessage(null)}
            >
              ✕
            </button>
          </div>
        )}

        <div className="cards">
          <div className="card">
            <div className="label">Total Tiket</div>
            <div className="value">{summary ? summary.total : "-"}</div>
          </div>
          <div className="card">
            <div className="label">Open</div>
            <div className="value">{summary ? summary.byStatus.Open : "-"}</div>
          </div>
          <div className="card">
            <div className="label">In Progress</div>
            <div className="value">{summary ? summary.byStatus["In Progress"] : "-"}</div>
          </div>
          <div className="card">
            <div className="label">Closed</div>
            <div className="value">{summary ? summary.byStatus.Closed : "-"}</div>
          </div>
          <div className="card">
            <div className="label">Prioritas Tinggi</div>
            <div className="value">{summary ? summary.prioritasTinggi : "-"}</div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">Tambah Tiket Keluhan Baru</div>
          <div className="panel-body">
            <form className="ticket-form" onSubmit={handleSubmit}>
              <div className="field">
                <label>Tanggal Lapor</label>
                <input
                  type="date"
                  value={form.tanggalLapor}
                  onChange={(e) => updateField("tanggalLapor", e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label>Nama Client *</label>
                <input
                  type="text"
                  placeholder="Contoh: PT. Sumber Makmur"
                  value={form.namaClient}
                  onChange={(e) => updateField("namaClient", e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label>Departemen / Unit</label>
                <input
                  type="text"
                  placeholder="Contoh: Divisi Keuangan"
                  value={form.departemen}
                  onChange={(e) => updateField("departemen", e.target.value)}
                />
              </div>
              <div className="field">
                <label>Kategori Masalah</label>
                <select value={form.kategori} onChange={(e) => updateField("kategori", e.target.value)}>
                  {(options.kategori || []).map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </div>
              <div className="field full">
                <label>Deskripsi Keluhan *</label>
                <textarea
                  placeholder="Jelaskan keluhan client secara singkat dan jelas"
                  value={form.deskripsi}
                  onChange={(e) => updateField("deskripsi", e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label>Prioritas</label>
                <select value={form.prioritas} onChange={(e) => updateField("prioritas", e.target.value)}>
                  {(options.prioritas || []).map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Status Awal</label>
                <select value={form.status} onChange={(e) => updateField("status", e.target.value)}>
                  {(options.status || []).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>PIC (Ditugaskan)</label>
                <input
                  type="text"
                  placeholder="Nama staf IT Support"
                  value={form.pic}
                  onChange={(e) => updateField("pic", e.target.value)}
                />
              </div>
              <div className="field">
                <label>Tanggal Selesai (jika sudah)</label>
                <input
                  type="date"
                  value={form.tanggalSelesai}
                  onChange={(e) => updateField("tanggalSelesai", e.target.value)}
                />
              </div>
              <div className="field full">
                <label>Solusi / Tindakan</label>
                <textarea
                  placeholder="Isi jika tiket sudah ditangani"
                  value={form.solusi}
                  onChange={(e) => updateField("solusi", e.target.value)}
                />
              </div>
              <div className="field full">
                <label>Catatan</label>
                <input
                  type="text"
                  value={form.catatan}
                  onChange={(e) => updateField("catatan", e.target.value)}
                />
              </div>
              <div className="actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    setForm({
                      ...emptyForm,
                      tanggalLapor: new Date().toISOString().slice(0, 10),
                      pic: currentUser?.name || "",
                    })
                  }
                >
                  Bersihkan Form
                </button>
                <button type="submit" className="primary" disabled={submitting}>
                  {submitting ? "Menyimpan ke Excel..." : "Simpan Tiket"}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <span>Daftar Tiket ({tickets.length})</span>
            <span style={{ fontSize: 11, fontWeight: "normal", opacity: 0.9 }}>
              🛡️ Backup rotasi aktif otomatis sebelum perubahan
            </span>
          </div>
          <div className="panel-body" style={{ padding: 0 }}>
            {loading ? (
              <div className="empty">Memuat data dari file Excel...</div>
            ) : tickets.length === 0 ? (
              <div className="empty">Belum ada tiket. Tambahkan lewat form di atas.</div>
            ) : (
              <div className="table-wrap">
                <table className="tickets">
                  <thead>
                    <tr>
                      <th>No</th>
                      <th>Tanggal Lapor</th>
                      <th>Client</th>
                      <th>Departemen</th>
                      <th>Kategori</th>
                      <th>Deskripsi</th>
                      <th>Prioritas</th>
                      <th>Status</th>
                      <th>PIC</th>
                      <th>Selesai</th>
                      <th>Durasi</th>
                      <th>Solusi / Catatan</th>
                      <th style={{ textAlign: "center" }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.map((t) => (
                      <tr key={t.row}>
                        <td>{t.no}</td>
                        <td>{t.tanggalLapor || "-"}</td>
                        <td>{t.namaClient}</td>
                        <td>{t.departemen || "-"}</td>
                        <td>{t.kategori || "-"}</td>
                        <td style={{ maxWidth: 220 }}>{t.deskripsi}</td>
                        <td><PrioBadge value={t.prioritas} /></td>
                        <td>
                          <select
                            className="status-select"
                            value={t.status}
                            onChange={(e) => handleStatusChange(t.row, e.target.value)}
                          >
                            {(options.status || []).map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </td>
                        <td>{t.pic || "-"}</td>
                        <td>{t.tanggalSelesai || "-"}</td>
                        <td>{t.durasi === "" || t.durasi === undefined || t.durasi === null ? "-" : `${t.durasi} hari`}</td>
                        <td style={{ maxWidth: 240 }}>
                          {editingRow === t.row ? (
                            <div style={{ display: "grid", gap: 6 }}>
                              <textarea
                                value={editDraft.solusi}
                                onChange={(e) => setEditDraft((d) => ({ ...d, solusi: e.target.value }))}
                                placeholder="Solusi / tindakan"
                              />
                              <input
                                type="text"
                                value={editDraft.pic}
                                onChange={(e) => setEditDraft((d) => ({ ...d, pic: e.target.value }))}
                                placeholder="PIC"
                              />
                              <input
                                type="date"
                                value={editDraft.tanggalSelesai || ""}
                                onChange={(e) => setEditDraft((d) => ({ ...d, tanggalSelesai: e.target.value }))}
                              />
                              <input
                                type="text"
                                value={editDraft.catatan}
                                onChange={(e) => setEditDraft((d) => ({ ...d, catatan: e.target.value }))}
                                placeholder="Catatan"
                              />
                              <div style={{ display: "flex", gap: 6 }}>
                                <button className="primary" onClick={() => saveEdit(t.row)}>Simpan</button>
                                <button className="secondary" onClick={() => setEditingRow(null)}>Batal</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div>{t.solusi || <span className="muted">Belum ada solusi</span>}</div>
                              {t.catatan && <div className="muted">{t.catatan}</div>}
                            </>
                          )}
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 6, justifyContent: "center", alignItems: "center" }}>
                            {editingRow !== t.row && (
                              <button className="secondary" onClick={() => startEdit(t)} title="Edit solusi & PIC">
                                Edit
                              </button>
                            )}
                            {currentUser.isAdmin && (
                              <button
                                className="btn-danger-sm"
                                onClick={() => handleDeleteTicket(t)}
                                title="Hapus tiket (Hanya Admin)"
                              >
                                Hapus
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Manajemen Pengguna (Khusus Administrator) */}
      {showUserModal && currentUser.isAdmin && (
        <div className="modal-backdrop" onClick={() => setShowUserModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>👥 Manajemen Pengguna & Hak Akses (RBAC)</h3>
              <button className="btn-close-modal" onClick={() => setShowUserModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              {userActionMsg && (
                <div className={`msg ${userActionMsg.type}`}>
                  <span>{userActionMsg.text}</span>
                  <button
                    style={{ background: "none", border: "none", cursor: "pointer", fontWeight: "bold" }}
                    onClick={() => setUserActionMsg(null)}
                  >
                    ✕
                  </button>
                </div>
              )}

              <div className="modal-tabs">
                <button
                  className={`modal-tab ${userModalTab === "list" ? "active" : ""}`}
                  onClick={() => {
                    setUserModalTab("list");
                    setUserActionMsg(null);
                  }}
                >
                  Daftar Pengguna ({usersList.length})
                </button>
                <button
                  className={`modal-tab ${userModalTab === "create" ? "active" : ""}`}
                  onClick={() => {
                    setUserModalTab("create");
                    setUserActionMsg(null);
                  }}
                >
                  + Tambah Pengguna Baru
                </button>
              </div>

              {userModalTab === "list" ? (
                <div>
                  {usersLoading ? (
                    <div className="empty">Memuat daftar pengguna...</div>
                  ) : usersList.length === 0 ? (
                    <div className="empty">Tidak ada data pengguna.</div>
                  ) : (
                    <div className="table-wrap">
                      <table className="admin-users-table">
                        <thead>
                          <tr>
                            <th>No</th>
                            <th>Username</th>
                            <th>Nama Lengkap</th>
                            <th>Role / Wewenang</th>
                            <th>Terakhir Login</th>
                            <th style={{ textAlign: "center" }}>Aksi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {usersList.map((u, idx) => {
                            const isUserAdmin =
                              u.role?.toLowerCase() === "it administrator" ||
                              u.role?.toLowerCase() === "admin" ||
                              u.role?.toLowerCase() === "administrator";
                            return (
                              <tr key={u.id}>
                                <td>{idx + 1}</td>
                                <td><strong>{u.username}</strong></td>
                                <td>{u.name}</td>
                                <td>
                                  <span className={`role-badge ${isUserAdmin ? "admin" : "staff"}`}>
                                    {u.role}
                                  </span>
                                </td>
                                <td style={{ fontSize: 11, color: "#64748b" }}>
                                  {u.last_login_at ? new Date(u.last_login_at).toLocaleString("id-ID") : "Belum pernah"}
                                </td>
                                <td>
                                  <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                                    <button
                                      className="secondary"
                                      onClick={() => handleResetUserPassword(u)}
                                      title="Reset Password Pengguna"
                                    >
                                      Reset Pwd
                                    </button>
                                    {u.id !== currentUser.id && (
                                      <button
                                        className="btn-danger-sm"
                                        onClick={() => handleDeleteUser(u)}
                                        title="Hapus Pengguna"
                                      >
                                        Hapus
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : (
                <form className="auth-form" onSubmit={handleCreateUserSubmit}>
                  <div className="field">
                    <label>Nama Lengkap *</label>
                    <input
                      type="text"
                      placeholder="Contoh: Budi Santoso"
                      value={newUserForm.name}
                      onChange={(e) => setNewUserForm((f) => ({ ...f, name: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="field">
                    <label>Username *</label>
                    <input
                      type="text"
                      placeholder="Contoh: budi.it"
                      value={newUserForm.username}
                      onChange={(e) => setNewUserForm((f) => ({ ...f, username: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="field">
                    <label>Role / Hak Akses *</label>
                    <select
                      value={newUserForm.role}
                      onChange={(e) => setNewUserForm((f) => ({ ...f, role: e.target.value }))}
                    >
                      <option value="Staff IT">Staff IT (Standar - Akses Tiket)</option>
                      <option value="IT Helpdesk">IT Helpdesk (Standar - Akses Tiket)</option>
                      <option value="Network Engineer">Network Engineer (Standar - Akses Tiket)</option>
                      <option value="Technical Support">Technical Support (Standar - Akses Tiket)</option>
                      <option value="IT Administrator">IT Administrator (Penuh - Kelola User & Hapus Tiket)</option>
                    </select>
                  </div>

                  <div className="field">
                    <label>Password (Min. 8 karakter) *</label>
                    <div className="password-input-wrap">
                      <input
                        type={showNewUserPwd ? "text" : "password"}
                        placeholder="Buat password minimal 8 karakter"
                        value={newUserForm.password}
                        onChange={(e) => setNewUserForm((f) => ({ ...f, password: e.target.value }))}
                        required
                        minLength={8}
                      />
                      <button
                        type="button"
                        className="btn-toggle-pwd"
                        onClick={() => setShowNewUserPwd((v) => !v)}
                      >
                        {showNewUserPwd ? "👁️‍🗨️" : "👁️"}
                      </button>
                    </div>
                  </div>

                  <div className="field">
                    <label>Konfirmasi Password *</label>
                    <input
                      type="password"
                      placeholder="Ulangi password"
                      value={newUserForm.confirmPassword}
                      onChange={(e) => setNewUserForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                      required
                      minLength={8}
                    />
                  </div>

                  <div className="actions" style={{ marginTop: 12 }}>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => setUserModalTab("list")}
                    >
                      Kembali ke Daftar
                    </button>
                    <button type="submit" className="primary" disabled={userSubmitting}>
                      {userSubmitting ? "Menyimpan User..." : "Daftarkan Pengguna"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
