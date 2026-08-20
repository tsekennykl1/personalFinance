import React, { useState, useEffect, useCallback, Fragment } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { Plus, Pencil, Trash2, X, Loader2, TrendingUp, TrendingDown, ArrowLeft } from "lucide-react";

const ENDPOINTS = {
  CRUD: "https://z35lnmmzgi.execute-api.ap-east-1.amazonaws.com/prod/lambda_crud_handler",
};

const EMPTY_FORM = {
  symbol: "",
  type: "BUY",
  quantity: "",
  price: "",
  notes: "",
  transaction_date: "",
};

export default function Transactions() {
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

  const fetchTransactions = useCallback(
    async (signal) => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(ENDPOINTS.CRUD, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal,
          body: JSON.stringify({
            resource_name: "transaction",
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
    fetchTransactions(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchTransactions]);

  const openAddModal = () => {
    setModalMode("add");
    setForm({ ...EMPTY_FORM, transaction_date: `${yearMonth}-01` });
    setEditingId(null);
    setFormError("");
    setModalOpen(true);
  };

  const openEditModal = (row) => {
    setModalMode("edit");
    setForm({
      symbol: row.symbol || "",
      type: row.type || "BUY",
      quantity: String(row.quantity ?? ""),
      price: String(row.price ?? ""),
      notes: row.notes || "",
      transaction_date: row.transaction_date ? row.transaction_date.slice(0, 10) : "",
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
          type: form.type,
          quantity: parseFloat(form.quantity),
          price: parseFloat(form.price),
          notes: form.notes || undefined,
          transaction_date: form.transaction_date || undefined,
        };
      } else {
        action = "update";
        payload = {
          transaction_id: editingId,
          type: form.type || undefined,
          quantity: form.quantity ? parseFloat(form.quantity) : undefined,
          price: form.price ? parseFloat(form.price) : undefined,
          notes: form.notes || undefined,
          transaction_date: form.transaction_date || undefined,
        };
      }
      const res = await fetch(ENDPOINTS.CRUD, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resource_name: "transaction", action, payload }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}`);
      }
      setModalOpen(false);
      fetchTransactions();
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
          resource_name: "transaction",
          action: "delete",
          payload: { transaction_id: id },
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDeleteConfirm(null);
      fetchTransactions();
    } catch (err) {
      setFormError(err.message);
      setDeleteConfirm(null);
    }
  };

  const updateField = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const totalAmount = rows.reduce((sum, r) => sum + parseFloat(r.total_amount || 0), 0);
  const buyCount = rows.filter((r) => r.type === "BUY").length;
  const sellCount = rows.filter((r) => r.type === "SELL").length;

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
            <h1 style={{ margin: 0, fontSize: "26px", fontWeight: 800, color: "#111" }}>📈 Transactions</h1>
            <div style={{ marginTop: "6px", display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ display: "inline-flex", alignItems: "center", padding: "4px 10px", borderRadius: "999px", fontSize: "12px", fontWeight: 800, border: "1px solid #dfe3f0", background: "#fff", color: "#333" }}>
                {rows.length} records
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", padding: "4px 10px", borderRadius: "999px", fontSize: "12px", fontWeight: 800, border: "1px solid #b9f2c1", background: "#edfff0", color: "#136f2d" }}>
                {buyCount} buys
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", padding: "4px 10px", borderRadius: "999px", fontSize: "12px", fontWeight: 800, border: "1px solid #ffc9c9", background: "#fff0f0", color: "#8d1414" }}>
                {sellCount} sells
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
            <div style={{ color: "#667", fontSize: "12px", fontWeight: 700 }}>Total Amount</div>
            <div style={{ fontSize: "18px", fontWeight: 900, marginTop: "5px", color: "#111" }}>${totalAmount.toFixed(2)}</div>
          </div>
          <div style={{ border: "1px solid #eef0f6", borderRadius: "12px", padding: "12px", background: "#fff" }}>
            <div style={{ color: "#667", fontSize: "12px", fontWeight: 700 }}>Buy Orders</div>
            <div style={{ fontSize: "18px", fontWeight: 900, marginTop: "5px", color: "#146c2e" }}>{buyCount}</div>
          </div>
          <div style={{ border: "1px solid #eef0f6", borderRadius: "12px", padding: "12px", background: "#fff" }}>
            <div style={{ color: "#667", fontSize: "12px", fontWeight: 700 }}>Sell Orders</div>
            <div style={{ fontSize: "18px", fontWeight: 900, marginTop: "5px", color: "#b02020" }}>{sellCount}</div>
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
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800 }}>Transaction History</h3>
            <span style={{ color: "#667", fontSize: "12px", fontWeight: 700 }}>{yearMonth}</span>
          </div>
          <div style={{ overflow: "auto" }}>
            {loading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "48px 0" }}>
                <Loader2 size={28} style={{ animation: "spin 1s linear infinite", color: "#1f4fff" }} />
              </div>
            ) : rows.length === 0 ? (
              <div style={{ textAlign: "center", color: "#667", padding: "48px 0", fontSize: "14px" }}>No transactions for {yearMonth}</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "900px", background: "#fff" }}>
                <thead>
                  <tr>
                    <th style={{ padding: "10px", borderBottom: "1px solid #eef0f6", textAlign: "left", fontSize: "12px", color: "#445", background: "#fafbff", whiteSpace: "nowrap" }}>Symbol</th>
                    <th style={{ padding: "10px", borderBottom: "1px solid #eef0f6", textAlign: "center", fontSize: "12px", color: "#445", background: "#fafbff", whiteSpace: "nowrap" }}>Type</th>
                    <th style={{ padding: "10px", borderBottom: "1px solid #eef0f6", textAlign: "right", fontSize: "12px", color: "#445", background: "#fafbff", whiteSpace: "nowrap" }}>Quantity</th>
                    <th style={{ padding: "10px", borderBottom: "1px solid #eef0f6", textAlign: "right", fontSize: "12px", color: "#445", background: "#fafbff", whiteSpace: "nowrap" }}>Price</th>
                    <th style={{ padding: "10px", borderBottom: "1px solid #eef0f6", textAlign: "right", fontSize: "12px", color: "#445", background: "#fafbff", whiteSpace: "nowrap" }}>Total</th>
                    <th style={{ padding: "10px", borderBottom: "1px solid #eef0f6", textAlign: "left", fontSize: "12px", color: "#445", background: "#fafbff", whiteSpace: "nowrap" }}>Date</th>
                    <th style={{ padding: "10px", borderBottom: "1px solid #eef0f6", textAlign: "left", fontSize: "12px", color: "#445", background: "#fafbff", whiteSpace: "nowrap" }}>Month</th>
                    <th style={{ padding: "10px", borderBottom: "1px solid #eef0f6", textAlign: "left", fontSize: "12px", color: "#445", background: "#fafbff", whiteSpace: "nowrap" }}>Notes</th>
                    <th style={{ padding: "10px", borderBottom: "1px solid #eef0f6", textAlign: "center", fontSize: "12px", color: "#445", background: "#fafbff", whiteSpace: "nowrap" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td style={{ padding: "10px", borderBottom: "1px solid #eef0f6", fontSize: "13px", fontWeight: 700 }}>{row.symbol}</td>
                      <td style={{ padding: "10px", borderBottom: "1px solid #eef0f6", fontSize: "13px", textAlign: "center" }}>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px 8px", borderRadius: "999px", fontSize: "11px", fontWeight: 800,
                          border: row.type === "BUY" ? "1px solid #b9f2c1" : "1px solid #ffc9c9",
                          background: row.type === "BUY" ? "#edfff0" : "#fff0f0",
                          color: row.type === "BUY" ? "#136f2d" : "#8d1414",
                        }}>
                          {row.type === "BUY" ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                          {row.type}
                        </span>
                      </td>
                      <td style={{ padding: "10px", borderBottom: "1px solid #eef0f6", fontSize: "13px", textAlign: "right" }}>{parseFloat(row.quantity).toLocaleString()}</td>
                      <td style={{ padding: "10px", borderBottom: "1px solid #eef0f6", fontSize: "13px", textAlign: "right" }}>${parseFloat(row.price).toFixed(2)}</td>
                      <td style={{ padding: "10px", borderBottom: "1px solid #eef0f6", fontSize: "13px", textAlign: "right", fontWeight: 800 }}>${parseFloat(row.total_amount || 0).toFixed(2)}</td>
                      <td style={{ padding: "10px", borderBottom: "1px solid #eef0f6", fontSize: "13px" }}>{row.transaction_date ? row.transaction_date.slice(0, 10) : "-"}</td>
                      <td style={{ padding: "10px", borderBottom: "1px solid #eef0f6", fontSize: "13px", color: "#667" }}>{row.transaction_month_str}</td>
                      <td style={{ padding: "10px", borderBottom: "1px solid #eef0f6", fontSize: "13px", color: "#667", maxWidth: "150px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.notes || "-"}</td>
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
                    <td colSpan={4} style={{ padding: "10px", fontSize: "13px", fontWeight: 800, textAlign: "right" }}>Total:</td>
                    <td style={{ padding: "10px", fontSize: "13px", fontWeight: 900, textAlign: "right" }}>${totalAmount.toFixed(2)}</td>
                    <td colSpan={4}></td>
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
            <div
              style={{ width: "100%", maxWidth: "440px", background: "#fff", borderRadius: "12px", padding: "24px", boxShadow: "0 20px 60px rgba(0,0,0,0.15)", border: "1px solid #e6e8f0", pointerEvents: "auto", position: "relative", zIndex: 10 }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                <h2 style={{ fontSize: "16px", fontWeight: 800, margin: 0 }}>
                  {modalMode === "add" ? "Add Transaction" : "Edit Transaction"}
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
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#445", marginBottom: "4px" }}>Type *</label>
                    <select
                      value={form.type}
                      onChange={(e) => updateField("type", e.target.value)}
                      style={{ width: "100%", padding: "8px 10px", border: "1px solid #d2d7e6", borderRadius: "8px", fontSize: "13px", background: "#fff", boxSizing: "border-box" }}
                    >
                      <option value="BUY">BUY</option>
                      <option value="SELL">SELL</option>
                    </select>
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
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#445", marginBottom: "4px" }}>Price *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={form.price}
                      onChange={(e) => updateField("price", e.target.value)}
                      style={{ width: "100%", padding: "8px 10px", border: "1px solid #d2d7e6", borderRadius: "8px", fontSize: "13px", boxSizing: "border-box" }}
                    />
                  </div>
                </div>
                <div style={{ marginBottom: "12px" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#445", marginBottom: "4px" }}>Transaction Date</label>
                  <input
                    type="date"
                    value={form.transaction_date}
                    onChange={(e) => updateField("transaction_date", e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", border: "1px solid #d2d7e6", borderRadius: "8px", fontSize: "13px", boxSizing: "border-box" }}
                  />
                </div>
                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#445", marginBottom: "4px" }}>Notes</label>
                  <input
                    type="text"
                    value={form.notes}
                    onChange={(e) => updateField("notes", e.target.value)}
                    placeholder="Optional notes"
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
              <p style={{ fontSize: "16px", fontWeight: 700, marginBottom: "16px" }}>Delete this transaction?</p>
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