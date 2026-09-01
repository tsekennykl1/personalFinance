import React, { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, X, Loader2, ArrowLeft } from "lucide-react";
import "../styles/shared.css";

import { ENDPOINTS, CACHE_TTL, getSessionCache, setSessionCache, clearSessionCache, authFetch } from "../api/api";
import { parseDateToISO, fmtMoney } from "../styles/sharedStyles";


const CACHE_KEY_PREFIX = "ledger_cache_";

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

  const cacheKey = CACHE_KEY_PREFIX + yearMonth;

  const fetchLedger = useCallback(
    async (signal, forceRefresh = false) => {
      if (!forceRefresh) {
        const cached = getSessionCache(cacheKey);
        if (cached) {
          setRows(cached);
          return;
        }
      }
      setLoading(true);
      setError("");
      try {
        const res = await authFetch(ENDPOINTS.CRUD, {
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
        const data = json.data || [];
        setRows(data);
        setSessionCache(cacheKey, data, CACHE_TTL);
      } catch (err) {
        if (err.name === "AbortError") return;
        setError(err.message);
        setRows([]);
      }
      setLoading(false);
    },
    [yearMonth, cacheKey]
  );

  useEffect(() => {
    const ctrl = new AbortController();
    fetchLedger(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchLedger]);

  const openAddModal = () => {
    setModalMode("add");
    const today = new Date().toISOString().slice(0, 10);
    setForm({ ...EMPTY_FORM, ledger_datetime: today });
    setEditingId(null);
    setFormError("");
    setModalOpen(true);
  };

  const openEditModal = (row) => {
    const id = row.id || row.entry_id || row.ledger_id || row._id;
    if (!id) { setError("Cannot edit: row has no ID field."); return; }
    const rawDate = row.ledger_datetime || row.datetime || row.date || "";
    const parsedDate = parseDateToISO(rawDate) || new Date().toISOString().slice(0, 10);

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

      const res = await authFetch(ENDPOINTS.CRUD, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resource_name: "ledger", action, payload }),
      });
      const responseText = await res.text();
      let json; try { json = JSON.parse(responseText); } catch { json = {}; }
      if (!res.ok) throw new Error(json.error || json.message || `HTTP ${res.status}: ${responseText}`);
      if (json.error) throw new Error(json.error);

      setModalOpen(false);
      clearSessionCache(cacheKey);
      fetchLedger(undefined, true);
    } catch (err) {
      setFormError(err.message);
    }
    setSubmitting(false);
  };

  const handleDelete = async (id) => {
    try {
      const res = await authFetch(ENDPOINTS.CRUD, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resource_name: "ledger", action: "delete", payload: { entry_id: id } }),
      });
      const responseText = await res.text();
      if (!res.ok) {
        let json; try { json = JSON.parse(responseText); } catch { json = {}; }
        throw new Error(json.error || json.message || `HTTP ${res.status}`);
      }
      setDeleteConfirm(null);
      clearSessionCache(cacheKey);
      fetchLedger(undefined, true);
    } catch (err) {
      setError(`Delete failed: ${err.message}`);
      setDeleteConfirm(null);
    }
  };

  const updateField = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const incomeTotal = rows.filter((r) => r.type === "I").reduce((s, r) => s + parseFloat(r.amount || 0), 0);
  const expenseTotal = rows.filter((r) => r.type === "E").reduce((s, r) => s + parseFloat(r.amount || 0), 0);
  const net = incomeTotal + expenseTotal;

  const sortedRows = [...rows].sort((a, b) => {
    const dateA = a.datetime || a.ledger_datetime || "";
    const dateB = b.datetime || b.ledger_datetime || "";
    return dateA.localeCompare(dateB);
  });

  return (
    <div className="page-shell">
      <div className="page-container">

        {/* Top Bar */}
        <div className="top-bar">
          <div>
            <h1 className="top-bar-title">📒 Ledger</h1>
            <div className="top-bar-badges">
              <span className="badge-pill badge-neutral">{rows.length} entries</span>
            </div>
          </div>
          <div className="top-bar-actions">
            <input type="month" value={yearMonth} onChange={(e) => setYearMonth(e.target.value)} className="month-input" />
            <button type="button" onClick={() => { window.location.href = "/"; }} title="Back to Home" className="btn-back">
              <ArrowLeft size={16} />
            </button>
          </div>
        </div>

        {/* KPI Summary */}
        <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
          <div className="kpi-card">
            <div className="kpi-label">Income</div>
            <div className="kpi-value kpi-value--green">${incomeTotal.toFixed(2)}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Expenses</div>
            <div className="kpi-value kpi-value--red">${expenseTotal.toFixed(2)}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Net Amount</div>
            <div className="kpi-value" style={{ color: net >= 0 ? "#146c2e" : "#b02020" }}>${net.toFixed(2)}</div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="error-alert">
            <div className="error-alert__title">Error</div>
            <div className="error-alert__body">{error}</div>
          </div>
        )}

        {/* Table Card */}
        <div className="table-card">
          <div className="table-card__header">
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <h3 className="table-card__title">Ledger Entries</h3>
              <span className="table-card__subtitle">{yearMonth}</span>
            </div>
            <button type="button" onClick={openAddModal} className="btn-add">
              <Plus size={14} /> Add
            </button>
          </div>

          <div className="table-card__body">
            {loading ? (
              <div className="loading-state">
                <Loader2 size={28} className="spinner" style={{ color: "#1f4fff" }} />
              </div>
            ) : sortedRows.length === 0 ? (
              <div className="empty-state">No ledger entries for {yearMonth}</div>
            ) : (
              <>
                {/* Desktop Table */}
                <table className="data-table view-desktop">
                  <thead>
                    <tr>
                      <th className="text-center">Type</th>
                      <th>Date</th>
                      <th>Category</th>
                      <th className="text-right">Amount</th>
                      <th>Comment</th>
                      <th className="text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.map((row) => (
                      <tr key={row.id}>
                        <td className="text-center">
                          <span className={`type-pill ${row.type === "I" ? "type-pill--income" : "type-pill--expense"}`}>
                            {row.type === "I" ? "Income" : "Expense"}
                          </span>
                        </td>
                        <td className="nowrap">{row.datetime ? row.datetime.slice(0, 10) : "-"}</td>
                        <td className="font-bold">{row.category}</td>
                        <td className="text-right font-heavy nowrap" style={{ color: row.type === "I" ? "#146c2e" : "#b02020" }}>
                          ${parseFloat(row.amount).toFixed(2)}
                        </td>
                        <td className="comment-cell">{row.comment || "-"}</td>
                        <td className="text-center">
                          <div className="action-group">
                            <button type="button" onClick={() => openEditModal(row)} className="action-btn" title="Edit"><Pencil size={14} /></button>
                            <button type="button" onClick={() => setDeleteConfirm(row.id)} className="action-btn action-btn--danger" title="Delete"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Mobile Cards */}
                <div className="view-mobile">
                  {sortedRows.map((row) => (
                    <div key={row.id} className="mobile-card">
                      <div className="mobile-card__header">
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                          <span className={`type-pill ${row.type === "I" ? "type-pill--income" : "type-pill--expense"}`}>
                            {row.type === "I" ? "Income" : "Expense"}
                          </span>
                          <span className="mobile-card__symbol">{row.category}</span>
                        </div>
                        <div className="action-group">
                          <button type="button" onClick={() => openEditModal(row)} className="action-btn" title="Edit"><Pencil size={14} /></button>
                          <button type="button" onClick={() => setDeleteConfirm(row.id)} className="action-btn action-btn--danger" title="Delete"><Trash2 size={14} /></button>
                        </div>
                      </div>
                      <div className="mobile-card__grid">
                        <div><span className="color-muted">Date:</span> {row.datetime ? row.datetime.slice(0, 10) : "-"}</div>
                        <div style={{ fontWeight: 800, color: row.type === "I" ? "#146c2e" : "#b02020" }}>
                          ${parseFloat(row.amount).toFixed(2)}
                        </div>
                      </div>
                      {row.comment && <div className="mobile-card__notes"><span className="color-muted">Note:</span> {row.comment}</div>}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={() => setModalOpen(false)} />
          <div className="modal-positioner">
            <div className="modal-box">
              <div className="modal-header">
                <h2 className="modal-title">{modalMode === "add" ? "Add Ledger Entry" : "Edit Ledger Entry"}</h2>
                <button type="button" onClick={() => setModalOpen(false)} className="modal-close"><X size={18} /></button>
              </div>
              {formError && <div className="form-error">{formError}</div>}
              <form onSubmit={handleSubmit}>
                <div className="form-row form-row--2col">
                  <div>
                    <label className="form-label">Type *</label>
                    <select value={form.type} onChange={(e) => updateField("type", e.target.value)} className="form-input">
                      {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Category *</label>
                    <input type="text" required value={form.category} onChange={(e) => updateField("category", e.target.value)} placeholder="e.g. Groceries" className="form-input" />
                  </div>
                </div>
                <div className="form-row form-row--2col">
                  <div>
                    <label className="form-label">Amount *</label>
                    <input type="number" step="0.01" required value={form.amount} onChange={(e) => updateField("amount", e.target.value)} className="form-input" />
                  </div>
                  <div>
                    <label className="form-label">Date</label>
                    <input type="date" value={form.ledger_datetime} onChange={(e) => updateField("ledger_datetime", e.target.value)} className="form-input" />
                  </div>
                </div>
                <div style={{ marginBottom: "16px" }}>
                  <label className="form-label">Comment</label>
                  <textarea value={form.comment} onChange={(e) => updateField("comment", e.target.value)} placeholder="Optional comment" rows={3} className="form-textarea" />
                </div>
                <button type="submit" disabled={submitting} className="form-submit">
                  {submitting ? "Submitting..." : modalMode === "add" ? "Insert" : "Update"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm !== null && (
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={() => setDeleteConfirm(null)} />
          <div className="modal-positioner">
            <div className="modal-box modal-box--sm">
              <p>Delete this ledger entry?</p>
              <div className="confirm-actions">
                <button type="button" onClick={() => setDeleteConfirm(null)} className="btn-cancel">Cancel</button>
                <button type="button" onClick={() => handleDelete(deleteConfirm)} className="btn-delete">Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}