import React, { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, X, Loader2, ArrowLeft } from "lucide-react";

const ENDPOINTS = {
  CRUD: "https://z35lnmmzgi.execute-api.ap-east-1.amazonaws.com/prod/lambda_crud_handler",
};

const EMPTY_FORM = {
  type: "E",
  category: "",
  amount: "",
  ledger_datetime: "",
  comment: "",
};

const TYPE_OPTIONS = [
  { value: "E", label: "Expense" },
  { value: "I", label: "Income" },
];

// Helper: convert various date formats to YYYY-MM-DD for <input type="date">
const parseDateToISO = (dateStr) => {
  if (!dateStr) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr.slice(0, 10);
  const slashParts = dateStr.split("/");
  if (slashParts.length === 3) {
    const [day, month, year] = slashParts;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }
  return "";
};

export default function Ledger() {
  const [yearMonth, setYearMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add");
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [formError, setFormError] = useState("");

  const fetchLedger = useCallback(
    async (signal) => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(ENDPOINTS.CRUD, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal,
          body: JSON.stringify({
            resource_name: "ledger",
            action: "get",
            payload: { month_str: yearMonth },
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setRows(json.data || []);
      } catch (err) {
        if (err.name === "AbortError") return;
        setError(err.message);
        setRows([]);
      }
      setLoading(false);
    },
    [yearMonth]
  );

  useEffect(() => {
    const ctrl = new AbortController();
    fetchLedger(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchLedger]);

  const openAddModal = () => {
    setModalMode("add");
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    setForm({ ...EMPTY_FORM, transaction_date: today });
    setEditingId(null);
    setFormError("");
    setModalOpen(true);
  };

  const openEditModal = (row) => {
    const id = row.id || row.entry_id || row.ledger_id || row._id;
    if (!id) {
      setError("Cannot edit: row has no ID field.");
      return;
    }

    const rawDate = row.ledger_datetime || row.datetime || row.date || "";
    const parsedDate = parseDateToISO(rawDate);

    setModalMode("edit");
    setForm({
      type: row.type || "E",
      category: row.category || "",
      amount: String(row.amount ?? ""),
      ledger_datetime: parsedDate,
      comment: row.comment || "",
    });
    setEditingId(id);
    setFormError("");
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setSubmitting(true);
    setFormError("");
    try {
      let payload, action;
      if (modalMode === "add") {
        action = "insert";
        payload = {
          type: form.type,
          category: form.category,
          amount: parseFloat(form.amount),
          ledger_datetime: form.ledger_datetime || undefined,
          comment: form.comment || undefined,
        };
      } else {
        action = "update";
        payload = {
          entry_id: editingId,
          type: form.type || undefined,
          category: form.category || undefined,
          amount: form.amount ? parseFloat(form.amount) : undefined,
          ledger_datetime: form.ledger_datetime || undefined,
          comment: form.comment || undefined,
        };
      }

      console.log("Submitting:", { resource_name: "ledger", action, payload });

      const res = await fetch(ENDPOINTS.CRUD, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resource_name: "ledger", action, payload }),
      });

      const responseText = await res.text();
      console.log("Response status:", res.status, "Body:", responseText);

      let json;
      try { json = JSON.parse(responseText); } catch (e) { json = {}; }

      if (!res.ok) {
        throw new Error(json.error || json.message || `HTTP ${res.status}: ${responseText}`);
      }

      if (json.error) {
        throw new Error(json.error);
      }

      setModalOpen(false);
      fetchLedger();
    } catch (err) {
      console.error("Submit error:", err);
      setFormError(err.message);
    }
    setSubmitting(false);
  };

  const handleDelete = async (id) => {
    console.log("Deleting ledger ID:", id);
    try {
      const body = JSON.stringify({
        resource_name: "ledger",
        action: "delete",
        payload: { entry_id: id },
      });
      console.log("Delete payload:", body);

      const res = await fetch(ENDPOINTS.CRUD, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      const responseText = await res.text();
      console.log("Delete response:", res.status, responseText);

      if (!res.ok) {
        let json;
        try { json = JSON.parse(responseText); } catch (e) { json = {}; }
        throw new Error(json.error || json.message || `HTTP ${res.status}`);
      }

      setDeleteConfirm(null);
      fetchLedger();
    } catch (err) {
      console.error("Delete error:", err);
      setError(`Delete failed: ${err.message}`);
      setDeleteConfirm(null);
    }
  };

  const updateField = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const incomeTotal = rows.filter((r) => r.type === "I").reduce((s, r) => s + parseFloat(r.amount || 0), 0);
  const expenseTotal = rows.filter((r) => r.type === "E").reduce((s, r) => s + parseFloat(r.amount || 0), 0);
  const net = incomeTotal - expenseTotal;

  return (
    <div style={{ background: "#f6f7fb", minHeight: "100vh", padding: "18px" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        {/* Top Bar with Back Arrow on the right */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px", gap: "12px", flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "26px", fontWeight: 800, color: "#111" }}>📒 Ledger</h1>
            <div style={{ marginTop: "6px", display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ display: "inline-flex", alignItems: "center", padding: "4px 10px", borderRadius: "999px", fontSize: "12px", fontWeight: 800, border: "1px solid #dfe3f0", background: "#fff", color: "#333" }}>
                {rows.length} entries
              </span>
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <input
              type="month"
              value={yearMonth}
              onChange={(e) => setYearMonth(e.target.value)}
              style={{ border: "1px solid #d2d7e6", background: "#fff", padding: "8px 10px", borderRadius: "10px", fontWeight: 700, fontSize: "13px" }}
            />
            <button
              type="button"
              onClick={openAddModal}
              style={{ display: "inline-flex", alignItems: "center", gap: "4px", border: "none", background: "#1f4fff", color: "#fff", padding: "8px 14px", borderRadius: "10px", cursor: "pointer", fontWeight: 700, fontSize: "13px" }}
            >
              <Plus size={14} /> Add
            </button>
            <button
              type="button"
              onClick={() => { window.location.href = "/"; }}
              title="Back to Home"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "36px",
                height: "36px",
                border: "1px solid #d2d7e6",
                background: "#fff",
                borderRadius: "10px",
                cursor: "pointer",
                color: "#445",
              }}
            >
              <ArrowLeft size={18} />
            </button>
          </div>
        </div>

        {/* KPI Summary */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "10px", marginBottom: "12px" }}>
          <div style={{ border: "1px solid #eef0f6", borderRadius: "12px", padding: "12px", background: "#fff" }}>
            <div style={{ color: "#667", fontSize: "12px", fontWeight: 700 }}>Income</div>
            <div style={{ fontSize: "18px", fontWeight: 900, marginTop: "5px", color: "#146c2e" }}>${incomeTotal.toFixed(2)}</div>
          </div>
          <div style={{ border: "1px solid #eef0f6", borderRadius: "12px", padding: "12px", background: "#fff" }}>
            <div style={{ color: "#667", fontSize: "12px", fontWeight: 700 }}>Expenses</div>
            <div style={{ fontSize: "18px", fontWeight: 900, marginTop: "5px", color: "#b02020" }}>${expenseTotal.toFixed(2)}</div>
          </div>
          <div style={{ border: "1px solid #eef0f6", borderRadius: "12px", padding: "12px", background: "#fff" }}>
            <div style={{ color: "#667", fontSize: "12px", fontWeight: 700 }}>Net</div>
            <div style={{ fontSize: "18px", fontWeight: 900, marginTop: "5px", color: net >= 0 ? "#146c2e" : "#b02020" }}>${net.toFixed(2)}</div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ borderRadius: "12px", padding: "12px", marginBottom: "12px", border: "1px solid #ffc9c9", background: "#fff0f0" }}>
            <div style={{ fontWeight: 900, marginBottom: "6px", color: "#8d1414" }}>Error</div>
            <div style={{ fontSize: "13px" }}>{error}</div>
          </div>
        )}

        {/* Table Card */}
        <div style={{ background: "#fff", border: "1px solid #e6e8f0", borderRadius: "12px", overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", borderBottom: "1px solid #eef0f6" }}>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800 }}>Ledger Entries</h3>
            <span style={{ color: "#667", fontSize: "12px", fontWeight: 700 }}>{yearMonth}</span>
          </div>
          <div style={{ overflow: "auto" }}>
            {loading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "48px 0" }}>
                <Loader2 size={28} style={{ animation: "spin 1s linear infinite", color: "#1f4fff" }} />
              </div>
            ) : rows.length === 0 ? (
              <div style={{ textAlign: "center", color: "#667", padding: "48px 0", fontSize: "14px" }}>No ledger entries for {yearMonth}</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "700px", background: "#fff" }}>
                <thead>
                  <tr>
                    <th style={{ padding: "10px", borderBottom: "1px solid #eef0f6", textAlign: "center", fontSize: "12px", color: "#445", background: "#fafbff", whiteSpace: "nowrap" }}>Type</th>
                    <th style={{ padding: "10px", borderBottom: "1px solid #eef0f6", textAlign: "left", fontSize: "12px", color: "#445", background: "#fafbff", whiteSpace: "nowrap" }}>Category</th>
                    <th style={{ padding: "10px", borderBottom: "1px solid #eef0f6", textAlign: "right", fontSize: "12px", color: "#445", background: "#fafbff", whiteSpace: "nowrap" }}>Amount</th>
                    <th style={{ padding: "10px", borderBottom: "1px solid #eef0f6", textAlign: "left", fontSize: "12px", color: "#445", background: "#fafbff", whiteSpace: "nowrap" }}>Date</th>
                    <th style={{ padding: "10px", borderBottom: "1px solid #eef0f6", textAlign: "left", fontSize: "12px", color: "#445", background: "#fafbff", whiteSpace: "nowrap" }}>Month</th>
                    <th style={{ padding: "10px", borderBottom: "1px solid #eef0f6", textAlign: "left", fontSize: "12px", color: "#445", background: "#fafbff", whiteSpace: "nowrap" }}>Comment</th>
                    <th style={{ padding: "10px", borderBottom: "1px solid #eef0f6", textAlign: "center", fontSize: "12px", color: "#445", background: "#fafbff", whiteSpace: "nowrap" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td style={{ padding: "10px", borderBottom: "1px solid #eef0f6", fontSize: "13px", textAlign: "center" }}>
                        <span style={{
                          display: "inline-flex", alignItems: "center", padding: "3px 8px", borderRadius: "999px", fontSize: "11px", fontWeight: 800,
                          border: row.type === "I" ? "1px solid #b9f2c1" : "1px solid #ffc9c9",
                          background: row.type === "I" ? "#edfff0" : "#fff0f0",
                          color: row.type === "I" ? "#136f2d" : "#8d1414",
                        }}>
                          {row.type === "I" ? "Income" : "Expense"}
                        </span>
                      </td>
                      <td style={{ padding: "10px", borderBottom: "1px solid #eef0f6", fontSize: "13px", fontWeight: 700 }}>{row.category}</td>
                      <td style={{ padding: "10px", borderBottom: "1px solid #eef0f6", fontSize: "13px", textAlign: "right", fontWeight: 800, color: row.type === "I" ? "#146c2e" : "#b02020" }}>
                        ${parseFloat(row.amount).toFixed(2)}
                      </td>
                      <td style={{ padding: "10px", borderBottom: "1px solid #eef0f6", fontSize: "13px" }}>{row.datetime ? row.datetime.slice(0, 10) : "-"}</td>
                      <td style={{ padding: "10px", borderBottom: "1px solid #eef0f6", fontSize: "13px", color: "#667" }}>{row.month_str}</td>
                      <td style={{ padding: "10px", borderBottom: "1px solid #eef0f6", fontSize: "13px", color: "#667", maxWidth: "150px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.comment || "-"}</td>
                      <td style={{ padding: "10px", borderBottom: "1px solid #eef0f6", fontSize: "13px", textAlign: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                          <button type="button" onClick={() => openEditModal(row)} style={{ background: "none", border: "none", cursor: "pointer", color: "#1f4fff", padding: "4px" }} title="Edit">
                            <Pencil size={14} />
                          </button>
                          <button type="button" onClick={() => setDeleteConfirm(row.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#b02020", padding: "4px" }} title="Delete">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }}>
          <div
            onClick={() => setModalOpen(false)}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.4)" }}
          />
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", pointerEvents: "none" }}>
            <div style={{ width: "100%", maxWidth: "440px", background: "#fff", borderRadius: "12px", padding: "24px", boxShadow: "0 20px 60px rgba(0,0,0,0.15)", border: "1px solid #e6e8f0", pointerEvents: "auto", position: "relative", zIndex: 10 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                <h2 style={{ fontSize: "16px", fontWeight: 800, margin: 0 }}>
                  {modalMode === "add" ? "Add Ledger Entry" : "Edit Ledger Entry"}
                </h2>
                <button type="button" onClick={() => setModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#667", padding: "4px" }}>
                  <X size={18} />
                </button>
              </div>

              {formError && (
                <div style={{ padding: "8px 12px", marginBottom: "12px", borderRadius: "8px", background: "#fff0f0", border: "1px solid #ffc9c9", color: "#8d1414", fontSize: "12px", fontWeight: 600 }}>
                  {formError}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#445", marginBottom: "4px" }}>Type *</label>
                    <select
                      value={form.type}
                      onChange={(e) => updateField("type", e.target.value)}
                      style={{ width: "100%", padding: "8px 10px", border: "1px solid #d2d7e6", borderRadius: "8px", fontSize: "13px", background: "#fff", boxSizing: "border-box" }}
                    >
                      {TYPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#445", marginBottom: "4px" }}>Category *</label>
                    <input
                      type="text"
                      required
                      value={form.category}
                      onChange={(e) => updateField("category", e.target.value)}
                      placeholder="e.g. Groceries"
                      style={{ width: "100%", padding: "8px 10px", border: "1px solid #d2d7e6", borderRadius: "8px", fontSize: "13px", boxSizing: "border-box" }}
                    />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#445", marginBottom: "4px" }}>Amount *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={form.amount}
                      onChange={(e) => updateField("amount", e.target.value)}
                      style={{ width: "100%", padding: "8px 10px", border: "1px solid #d2d7e6", borderRadius: "8px", fontSize: "13px", boxSizing: "border-box" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#445", marginBottom: "4px" }}>Date</label>
                    <input
                      type="date"
                      value={form.ledger_datetime}
                      onChange={(e) => updateField("ledger_datetime", e.target.value)}
                      style={{ width: "100%", padding: "8px 10px", border: "1px solid #d2d7e6", borderRadius: "8px", fontSize: "13px", boxSizing: "border-box" }}
                    />
                  </div>
                </div>
                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#445", marginBottom: "4px" }}>Comment</label>
                  <input
                    type="text"
                    value={form.comment}
                    onChange={(e) => updateField("comment", e.target.value)}
                    placeholder="Optional comment"
                    style={{ width: "100%", padding: "8px 10px", border: "1px solid #d2d7e6", borderRadius: "8px", fontSize: "13px", boxSizing: "border-box" }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "10px",
                    border: "none",
                    background: "#1f4fff",
                    color: "#fff",
                    borderRadius: "10px",
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: submitting ? "not-allowed" : "pointer",
                    opacity: submitting ? 0.6 : 1,
                    textAlign: "center",
                  }}
                >
                  {submitting ? "Submitting..." : modalMode === "add" ? "Insert" : "Update"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm !== null && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }}>
          <div
            onClick={() => setDeleteConfirm(null)}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.4)" }}
          />
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", pointerEvents: "none" }}>
            <div style={{ width: "100%", maxWidth: "360px", background: "#fff", borderRadius: "12px", padding: "24px", boxShadow: "0 20px 60px rgba(0,0,0,0.15)", border: "1px solid #e6e8f0", textAlign: "center", pointerEvents: "auto", position: "relative", zIndex: 10 }}>
              <p style={{ fontSize: "16px", fontWeight: 700, marginBottom: "16px" }}>Delete this ledger entry?</p>
              <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
                <button type="button" onClick={() => setDeleteConfirm(null)} style={{ padding: "8px 16px", border: "1px solid #d2d7e6", background: "#fff", borderRadius: "10px", cursor: "pointer", fontWeight: 700, fontSize: "13px" }}>Cancel</button>
                <button type="button" onClick={() => handleDelete(deleteConfirm)} style={{ padding: "8px 16px", border: "none", background: "#b02020", color: "#fff", borderRadius: "10px", cursor: "pointer", fontWeight: 700, fontSize: "13px" }}>Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}