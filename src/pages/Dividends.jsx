import React, { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, X, Loader2, ArrowLeft } from "lucide-react";

const ENDPOINTS = {
  CRUD: "https://z35lnmmzgi.execute-api.ap-east-1.amazonaws.com/prod/lambda_crud_handler",
};

const EMPTY_FORM = {
  symbol: "",
  amount_per_share: "",
  quantity: "",
  payment_date: "",
};

export default function Dividends() {
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

  const fetchDividends = useCallback(
    async (signal) => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(ENDPOINTS.CRUD, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal,
          body: JSON.stringify({
            resource_name: "dividend",
            action: "get",
            payload: { year_month: yearMonth },
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
    fetchDividends(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchDividends]);

  const openAddModal = () => {
    setModalMode("add");
    setForm({ ...EMPTY_FORM, payment_date: `${yearMonth}-01` });
    setEditingId(null);
    setFormError("");
    setModalOpen(true);
  };

  const openEditModal = (row) => {
    setModalMode("edit");
    setForm({
      symbol: row.symbol || "",
      amount_per_share: String(row.amount_per_share ?? ""),
      quantity: String(row.quantity ?? ""),
      payment_date: row.payment_date ? row.payment_date.slice(0, 10) : "",
    });
    setEditingId(row.id);
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
          symbol: form.symbol.toUpperCase(),
          amount_per_share: parseFloat(form.amount_per_share),
          quantity: parseFloat(form.quantity),
          payment_date: form.payment_date || undefined,
        };
      } else {
        action = "update";
        payload = {
          dividend_id: editingId,
          amount_per_share: form.amount_per_share ? parseFloat(form.amount_per_share) : undefined,
          quantity: form.quantity ? parseFloat(form.quantity) : undefined,
          payment_date: form.payment_date || undefined,
        };
      }
      const res = await fetch(ENDPOINTS.CRUD, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resource_name: "dividend", action, payload }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}`);
      }
      setModalOpen(false);
      fetchDividends();
    } catch (err) {
      setFormError(err.message);
    }
    setSubmitting(false);
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(ENDPOINTS.CRUD, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resource_name: "dividend",
          action: "delete",
          payload: { dividend_id: id },
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDeleteConfirm(null);
      fetchDividends();
    } catch (err) {
      setFormError(err.message);
      setDeleteConfirm(null);
    }
  };

  const updateField = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const totalDividends = rows.reduce((sum, r) => sum + parseFloat(r.total_dividend || 0), 0);
  const uniqueSymbols = [...new Set(rows.map((r) => r.symbol))].length;

  return (
    <div style={{ background: "#f6f7fb", minHeight: "100vh", padding: "18px" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        {/* Back to Home */}
        <a
          href="/"
          onClick={(e) => { e.preventDefault(); window.location.href = "/"; }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "13px",
            fontWeight: 700,
            color: "#667",
            textDecoration: "none",
            marginBottom: "14px",
            cursor: "pointer",
          }}
        >
          <ArrowLeft size={14} /> Back to Home
        </a>

        {/* Top Bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px", gap: "12px", flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "26px", fontWeight: 800, color: "#111" }}>💰 Dividends</h1>
            <div style={{ marginTop: "6px", display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ display: "inline-flex", alignItems: "center", padding: "4px 10px", borderRadius: "999px", fontSize: "12px", fontWeight: 800, border: "1px solid #dfe3f0", background: "#fff", color: "#333" }}>
                {rows.length} records
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", padding: "4px 10px", borderRadius: "999px", fontSize: "12px", fontWeight: 800, border: "1px solid #b9f2c1", background: "#edfff0", color: "#136f2d" }}>
                {uniqueSymbols} stocks
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
          </div>
        </div>

        {/* KPI Summary */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "10px", marginBottom: "12px" }}>
          <div style={{ border: "1px solid #eef0f6", borderRadius: "12px", padding: "12px", background: "#fff" }}>
            <div style={{ color: "#667", fontSize: "12px", fontWeight: 700 }}>Total Dividends</div>
            <div style={{ fontSize: "18px", fontWeight: 900, marginTop: "5px", color: "#146c2e" }}>${totalDividends.toFixed(2)}</div>
          </div>
          <div style={{ border: "1px solid #eef0f6", borderRadius: "12px", padding: "12px", background: "#fff" }}>
            <div style={{ color: "#667", fontSize: "12px", fontWeight: 700 }}>Unique Stocks</div>
            <div style={{ fontSize: "18px", fontWeight: 900, marginTop: "5px", color: "#111" }}>{uniqueSymbols}</div>
          </div>
          <div style={{ border: "1px solid #eef0f6", borderRadius: "12px", padding: "12px", background: "#fff" }}>
            <div style={{ color: "#667", fontSize: "12px", fontWeight: 700 }}>Avg per Record</div>
            <div style={{ fontSize: "18px", fontWeight: 900, marginTop: "5px", color: "#111" }}>${rows.length > 0 ? (totalDividends / rows.length).toFixed(2) : "0.00"}</div>
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
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800 }}>Dividend Records</h3>
            <span style={{ color: "#667", fontSize: "12px", fontWeight: 700 }}>{yearMonth}</span>
          </div>
          <div style={{ overflow: "auto" }}>
            {loading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "48px 0" }}>
                <Loader2 size={28} style={{ animation: "spin 1s linear infinite", color: "#1f4fff" }} />
              </div>
            ) : rows.length === 0 ? (
              <div style={{ textAlign: "center", color: "#667", padding: "48px 0", fontSize: "14px" }}>No dividend records for {yearMonth}</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "700px", background: "#fff" }}>
                <thead>
                  <tr>
                    <th style={{ padding: "10px", borderBottom: "1px solid #eef0f6", textAlign: "left", fontSize: "12px", color: "#445", background: "#fafbff", whiteSpace: "nowrap" }}>Symbol</th>
                    <th style={{ padding: "10px", borderBottom: "1px solid #eef0f6", textAlign: "right", fontSize: "12px", color: "#445", background: "#fafbff", whiteSpace: "nowrap" }}>Amt/Share</th>
                    <th style={{ padding: "10px", borderBottom: "1px solid #eef0f6", textAlign: "right", fontSize: "12px", color: "#445", background: "#fafbff", whiteSpace: "nowrap" }}>Quantity</th>
                    <th style={{ padding: "10px", borderBottom: "1px solid #eef0f6", textAlign: "right", fontSize: "12px", color: "#445", background: "#fafbff", whiteSpace: "nowrap" }}>Total Dividend</th>
                    <th style={{ padding: "10px", borderBottom: "1px solid #eef0f6", textAlign: "left", fontSize: "12px", color: "#445", background: "#fafbff", whiteSpace: "nowrap" }}>Payment Date</th>
                    <th style={{ padding: "10px", borderBottom: "1px solid #eef0f6", textAlign: "left", fontSize: "12px", color: "#445", background: "#fafbff", whiteSpace: "nowrap" }}>Month</th>
                    <th style={{ padding: "10px", borderBottom: "1px solid #eef0f6", textAlign: "center", fontSize: "12px", color: "#445", background: "#fafbff", whiteSpace: "nowrap" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td style={{ padding: "10px", borderBottom: "1px solid #eef0f6", fontSize: "13px", fontWeight: 700 }}>{row.symbol}</td>
                      <td style={{ padding: "10px", borderBottom: "1px solid #eef0f6", fontSize: "13px", textAlign: "right" }}>{parseFloat(row.amount_per_share).toFixed(4)}</td>
                      <td style={{ padding: "10px", borderBottom: "1px solid #eef0f6", fontSize: "13px", textAlign: "right" }}>{parseFloat(row.quantity).toLocaleString()}</td>
                      <td style={{ padding: "10px", borderBottom: "1px solid #eef0f6", fontSize: "13px", textAlign: "right", fontWeight: 800, color: "#146c2e" }}>
                        ${parseFloat(row.total_dividend).toFixed(2)}
                      </td>
                      <td style={{ padding: "10px", borderBottom: "1px solid #eef0f6", fontSize: "13px" }}>{row.payment_date ? row.payment_date.slice(0, 10) : "-"}</td>
                      <td style={{ padding: "10px", borderBottom: "1px solid #eef0f6", fontSize: "13px", color: "#667" }}>{row.payment_month_str}</td>
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
                <tfoot>
                  <tr style={{ background: "#fafbff" }}>
                    <td colSpan={3} style={{ padding: "10px", fontSize: "13px", fontWeight: 800, textAlign: "right" }}>Total:</td>
                    <td style={{ padding: "10px", fontSize: "13px", fontWeight: 900, textAlign: "right", color: "#146c2e" }}>${totalDividends.toFixed(2)}</td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
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
                  {modalMode === "add" ? "Add Dividend" : "Edit Dividend"}
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
                <div style={{ marginBottom: "12px" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#445", marginBottom: "4px" }}>Symbol *</label>
                  <input
                    type="text"
                    required={modalMode === "add"}
                    disabled={modalMode === "edit"}
                    value={form.symbol}
                    onChange={(e) => updateField("symbol", e.target.value)}
                    placeholder="e.g. 0005.HK"
                    style={{ width: "100%", padding: "8px 10px", border: "1px solid #d2d7e6", borderRadius: "8px", fontSize: "13px", boxSizing: "border-box", opacity: modalMode === "edit" ? 0.5 : 1 }}
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#445", marginBottom: "4px" }}>Amount/Share *</label>
                    <input
                      type="number"
                      step="0.0001"
                      required
                      value={form.amount_per_share}
                      onChange={(e) => updateField("amount_per_share", e.target.value)}
                      style={{ width: "100%", padding: "8px 10px", border: "1px solid #d2d7e6", borderRadius: "8px", fontSize: "13px", boxSizing: "border-box" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#445", marginBottom: "4px" }}>Quantity *</label>
                    <input
                      type="number"
                      step="1"
                      required
                      value={form.quantity}
                      onChange={(e) => updateField("quantity", e.target.value)}
                      style={{ width: "100%", padding: "8px 10px", border: "1px solid #d2d7e6", borderRadius: "8px", fontSize: "13px", boxSizing: "border-box" }}
                    />
                  </div>
                </div>
                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#445", marginBottom: "4px" }}>Payment Date</label>
                  <input
                    type="date"
                    value={form.payment_date}
                    onChange={(e) => updateField("payment_date", e.target.value)}
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

      {/* Delete Confirm Modal */}
      {deleteConfirm !== null && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }}>
          <div
            onClick={() => setDeleteConfirm(null)}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.4)" }}
          />
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", pointerEvents: "none" }}>
            <div style={{ width: "100%", maxWidth: "360px", background: "#fff", borderRadius: "12px", padding: "24px", boxShadow: "0 20px 60px rgba(0,0,0,0.15)", border: "1px solid #e6e8f0", textAlign: "center", pointerEvents: "auto", position: "relative", zIndex: 10 }}>
              <p style={{ fontSize: "16px", fontWeight: 700, marginBottom: "16px" }}>Delete this dividend entry?</p>
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