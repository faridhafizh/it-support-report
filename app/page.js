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

export default function Home() {
  const [options, setOptions] = useState({ kategori: [], prioritas: [], status: [] });
  const [tickets, setTickets] = useState([]);
  const [summary, setSummary] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null); // {type, text}
  const [editingRow, setEditingRow] = useState(null);
  const [editDraft, setEditDraft] = useState({});

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, sRes] = await Promise.all([fetch("/api/tickets"), fetch("/api/summary")]);
      const tData = await tRes.json();
      const sData = await sRes.json();
      if (tData.error) throw new Error(tData.error);
      if (sData.error) throw new Error(sData.error);
      setTickets(tData.tickets);
      setOptions(tData.options);
      setSummary(sData);
    } catch (err) {
      setMessage({ type: "error", text: `Gagal memuat data: ${err.message}` });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  function updateField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan tiket.");
      setMessage({ type: "success", text: `Tiket baru berhasil disimpan ke file Excel (baris ${data.row}).` });
      setForm({ ...emptyForm, tanggalLapor: new Date().toISOString().slice(0, 10) });
      await loadAll();
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setSubmitting(false);
    }
  }

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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memperbarui status.");
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
      pic: t.pic || "",
      tanggalSelesai: t.tanggalSelesai || "",
    });
  }

  async function saveEdit(row) {
    setMessage(null);
    try {
      const res = await fetch(`/api/tickets/${row}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editDraft),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan perubahan.");
      setEditingRow(null);
      await loadAll();
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    }
  }

  return (
    <>
      <header className="app-header">
        <h1>IT Support — Log Keluhan Client</h1>
        <p>Terhubung langsung ke file IT_Support_Log_Keluhan_Client.xlsx — setiap tiket yang disimpan di sini langsung masuk ke file Excel.</p>
      </header>

      <div className="container">
        {message && (
          <div className={`msg ${message.type}`}>
            {message.text}
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
                <button type="button" className="secondary" onClick={() => setForm(emptyForm)}>
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
          <div className="panel-header">Daftar Tiket ({tickets.length})</div>
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
                      <th></th>
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
                          {editingRow === t.row ? null : (
                            <button className="secondary" onClick={() => startEdit(t)}>Edit</button>
                          )}
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
    </>
  );
}
