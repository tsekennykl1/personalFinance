import React, { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, X, Loader2, TrendingUp, TrendingDown, ArrowLeft } from "lucide-react";
import { ENDPOINTS, CACHE_TTL, getSessionCache, setSessionCache, clearSessionCache } from "../api/api";
import { parseDateToISO, validateAndNormalizeHKSymbol, fmtMoney, fmtPrice } from "../styles/sharedStyles";
import "../styles/shared.css";

const CACHE_KEY_PREFIX = "transactions_cache_";

const EMPTY_FORM = {
  symbol: "",
  market: ".HK",
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

  const cacheKey = CACHE_KEY_PREFIX + yearMonth;

  const fetchTransactions = useCallback(
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
    fetchTransactions(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchTransactions]);

  const openAddModal = () => {
    setModalMode("add");
    const today = new Date().toISOString().slice(0, 10);
    setForm({ ...EMPTY_FORM, transaction_date: today });
    setEditingId(null);
    setFormError("");
    setModalOpen(true);
  };

  const openEditModal = (row) => {
    const id = row.id || row.transaction_id || row._id;
    if (!id) { setError("Cannot edit: row has no ID field."); return; }
    const rawDate = row.transaction_date || row.date || "";
    const parsedDate = parseDateToISO(rawDate) || new Date().toISOString().slice(0, 10);
    const symbol = row.symbol || "";
    const isHK = symbol.toUpperCase().endsWith(".HK");
    const baseSymbol = isHK ? symbol.slice(0, -3) : symbol;

    setModalMode("edit");
    setForm({
      symbol: baseSymbol,
      market: isHK ? ".HK" : "",
      type: row.type || "BUY",
      quantity: String(row.quantity ?? ""),
      price: String(row.price ?? ""),
      notes: row.notes || "",
      transaction_date: parsedDate,
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
      let finalSymbol = form.symbol.toUpperCase().trim();
      if (modalMode === "add" && form.market === ".HK") {
        const result = validateAndNormalizeHKSymbol(finalSymbol);
        if (result.error) { setFormError(result.error); setSubmitting(false); return; }
        finalSymbol = result.symbol + ".HK";
      }

      let payload, action;
      if (modalMode === "add") {
        action = "insert";
        payload = {
          symbol: finalSymbol,
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
      const responseText = await res.text();
      let json;
      try { json = JSON.parse(responseText); } catch { json = {}; }
      if (!res.ok) throw new Error(json.error || json.message || `HTTP ${res.status}: ${responseText}`);
      if (json.error) throw new Error(json.error);

      setModalOpen(false);
      clearSessionCache(cacheKey);
      fetchTransactions(undefined, true);
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
        body: JSON.stringify({ resource_name: "transaction", action: "delete", payload: { transaction_id: id } }),
      });
      const responseText = await res.text();
      if (!res.ok) {
        let json; try { json = JSON.parse(responseText); } catch { json = {}; }
        throw new Error(json.error || json.message || `HTTP ${res.status}`);
      }
      setDeleteConfirm(null);
      clearSessionCache(cacheKey);
      fetchTransactions(undefined, true);
    } catch (err) {
      setError(`Delete failed: ${err.message}`);
      setDeleteConfirm(null);
    }
  };

  const updateField = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const buyRows = rows.filter((r) => r.type === "BUY");
  const sellRows = rows.filter((r) => r.type === "SELL");
  const totalBuyAmount = buyRows.reduce((sum, r) => sum + parseFloat(r.total_amount || 0), 0);
  const totalSellAmount = sellRows.reduce((sum, r) => sum + parseFloat(r.total_amount || 0), 0);
  const buyCount = buyRows.length;
  const sellCount = sellRows.length;

  const sortedRows = [...rows].sort((a, b) => {
    const dateA = a.transaction_date || "";
    const dateB = b.transaction_date || "";
    return dateA.localeCompare(dateB);
  });

  return (
    <div className="page-shell">
      <div className="page-container">

        {/* Top Bar */}
        <div className="top-bar">
          <div>
            <h1 className="top-bar-title">📈 Transactions</h1>
            <div className="top-bar-badges">
              <span className="badge-pill badge-neutral">{rows.length} records</span>
              <span className="badge-pill badge-green">{buyCount} buys</span>
              <span className="badge-pill badge-red">{sellCount} sells</span>
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
        <div className="kpi-grid">
          <div className="kpi-card kpi-card--green">
            <div className="kpi-label kpi-label--green">Total Buy Amount</div>
            <div className="kpi-value kpi-value--green">{fmtMoney(totalBuyAmount)}</div>
            <div className="kpi-sub kpi-sub--green">{buyCount} order{buyCount !== 1 ? "s" : ""}</div>
          </div>
          <div className="kpi-card kpi-card--red">
            <div className="kpi-label kpi-label--red">Total Sell Amount</div>
            <div className="kpi-value kpi-value--red">{fmtMoney(totalSellAmount)}</div>
            <div className="kpi-sub kpi-sub--red">{sellCount} order{sellCount !== 1 ? "s" : ""}</div>
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
            <h3 className="table-card__title">Transaction History</h3>
            <span className="table-card__subtitle">{yearMonth}</span>
            <button type="button" onClick={openAddModal} className="btn-add">
              <Plus size={14} /> Add
            </button>
          </div>

          <div className="table-card__body">
            {loading ? (
              <div className="loading-state">
                <Loader2 size={28} className="spinner" style={{ color: "#1f4fff" }} />
              </div>
            ) : rows.length === 0 ? (
              <div className="empty-state">No transactions for {yearMonth}</div>
            ) : (
              <>
                {/* Desktop Table */}
                <table className="data-table view-desktop">
                  <thead>
                    <tr>
                      <th>Stock</th>
                      <th>Stock Name</th>
                      <th>Transaction Date</th>
                      <th className="text-center">Type</th>
                      <th className="text-right">Quantity</th>
                      <th className="text-right">Price</th>
                      <th className="text-right">Total</th>
                      <th>Notes</th>
                      <th className="text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.map((row) => (
                      <tr key={row.id}>
                        <td className="font-bold">{row.symbol}</td>
                        <td className="color-muted">{row.stock_name || "-"}</td>
                        <td>{row.transaction_date ? row.transaction_date.slice(0, 10) : "-"}</td>
                        <td className="text-center">
                          <span className={`type-pill ${row.type === "BUY" ? "type-pill--buy" : "type-pill--sell"}`}>
                            {row.type === "BUY" ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                            {row.type}
                          </span>
                        </td>
                        <td className="text-right">{parseFloat(row.quantity).toLocaleString()}</td>
                        <td className="text-right">{fmtPrice(row.price)}</td>
                        <td className="text-right font-heavy">{fmtMoney(row.total_amount)}</td>
                        <td className="comment-cell">{row.notes || "-"}</td>
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
                          <span className="mobile-card__symbol">{row.symbol}</span>
                          <span className="mobile-card__name">{row.stock_name || "-"}</span>
                          <span className={`type-pill ${row.type === "BUY" ? "type-pill--buy" : "type-pill--sell"}`} style={{ fontSize: "10px", padding: "2px 7px" }}>
                            {row.type === "BUY" ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                            {row.type}
                          </span>
                        </div>
                        <div className="action-group">
                          <button type="button" onClick={() => openEditModal(row)} className="action-btn" title="Edit"><Pencil size={14} /></button>
                          <button type="button" onClick={() => setDeleteConfirm(row.id)} className="action-btn action-btn--danger" title="Delete"><Trash2 size={14} /></button>
                        </div>
                      </div>
                      <div className="mobile-card__grid">
                        <div><span className="color-muted">Date:</span> {row.transaction_date ? row.transaction_date.slice(0, 10) : "-"}</div>
                        <div><span className="color-muted">Qty:</span> {parseFloat(row.quantity).toLocaleString()}</div>
                        <div><span className="color-muted">Price:</span> {fmtPrice(row.price)}</div>
                        <div><span className="color-muted">Total:</span> <strong>{fmtMoney(row.total_amount)}</strong></div>
                      </div>
                      {row.notes && <div className="mobile-card__notes"><span className="color-muted">Notes:</span> {row.notes}</div>}
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
                <h2 className="modal-title">{modalMode === "add" ? "Add Transaction" : "Edit Transaction"}</h2>
                <button type="button" onClick={() => setModalOpen(false)} className="modal-close"><X size={18} /></button>
              </div>
              {formError && <div className="form-error">{formError}</div>}
              <form onSubmit={handleSubmit}>
                <div className="form-row form-row--2col">
                  <div>
                    <label className="form-label">Symbol *</label>
                    <input type="text" required={modalMode === "add"} disabled={modalMode === "edit"} value={form.symbol} onChange={(e) => updateField("symbol", e.target.value)} placeholder={form.market === ".HK" ? "e.g. 5, 700, 2628" : "e.g. AAPL"} className={`form-input ${modalMode === "edit" ? "form-input--disabled" : ""}`} />
                    {form.market === ".HK" && form.symbol.trim() && modalMode === "add" && (
                      <div className="form-hint">Will submit as: <strong>{form.symbol.trim().padStart(4, "0")}.HK</strong></div>
                    )}
                  </div>
                  <div>
                    <label className="form-label">Market *</label>
                    <select value={form.market} onChange={(e) => updateField("market", e.target.value)} disabled={modalMode === "edit"} className={`form-input ${modalMode === "edit" ? "form-input--disabled" : ""}`}>
                      <option value=".HK">Hong Kong (.HK)</option>
                      <option value="">US / Other</option>
                    </select>
                  </div>
                </div>
                <div className="form-row form-row--3col">
                  <div>
                    <label className="form-label">Type *</label>
                    <select value={form.type} onChange={(e) => updateField("type", e.target.value)} className="form-input">
                      <option value="BUY">BUY</option>
                      <option value="SELL">SELL</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Quantity *</label>
                    <input type="number" step="1" required value={form.quantity} onChange={(e) => updateField("quantity", e.target.value)} className="form-input" />
                  </div>
                  <div>
                    <label className="form-label">Price *</label>
                    <input type="number" step="0.01" required value={form.price} onChange={(e) => updateField("price", e.target.value)} className="form-input" />
                  </div>
                </div>
                <div className="form-row">
                  <div>
                    <label className="form-label">Transaction Date</label>
                    <input type="date" value={form.transaction_date} onChange={(e) => updateField("transaction_date", e.target.value)} className="form-input" />
                  </div>
                </div>
                <div style={{ marginBottom: "16px" }}>
                  <label className="form-label">Notes</label>
                  <textarea value={form.notes} onChange={(e) => updateField("notes", e.target.value)} placeholder="Optional notes" rows={3} className="form-textarea" />
                </div>
                <button type="submit" disabled={submitting} className="form-submit">
                  {submitting ? "Submitting..." : modalMode === "add" ? "Insert" : "Update"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm !== null && (
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={() => setDeleteConfirm(null)} />
          <div className="modal-positioner">
            <div className="modal-box modal-box--sm">
              <p>Delete this transaction?</p>
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