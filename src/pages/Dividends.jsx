import React, { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Pencil, Trash2, X, Loader2, ArrowLeft } from "lucide-react";
import {
  ENDPOINTS,
  parseDateToISO, validateAndNormalizeHKSymbol, fmtMoney,
} from "../styles/sharedStyles";
import "../styles/shared.css";

const CACHE_TTL_MS = 5 * 60 * 1000;

const EMPTY_FORM = {
  symbol: "",
  market: ".HK",
  amount_per_share: "",
  quantity: "",
  payment_date: "",
  ex_dividend_date: "",
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

  const cacheRef = useRef({});

  const fetchDividends = useCallback(
    async (signal, forceRefresh = false) => {
      const cached = cacheRef.current[yearMonth];
      if (!forceRefresh && cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        setRows(cached.data);
        return;
      }
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
        const data = json.data || [];
        setRows(data);
        cacheRef.current[yearMonth] = { data, timestamp: Date.now() };
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
    const id = row.id || row.dividend_id || row._id;
    if (!id) { setError("Cannot edit: row has no ID field."); return; }
    const parsedDate = parseDateToISO(row.payment_date || row.date || "") || new Date().toISOString().slice(0, 10);
    const parsedExDate = parseDateToISO(row.ex_dividend_date || "");
    const symbol = row.symbol || "";
    const isHK = symbol.toUpperCase().endsWith(".HK");
    const baseSymbol = isHK ? symbol.slice(0, -3) : symbol;

    setModalMode("edit");
    setForm({
      symbol: baseSymbol,
      market: isHK ? ".HK" : "",
      amount_per_share: String(row.amount_per_share ?? ""),
      quantity: String(row.quantity ?? ""),
      payment_date: parsedDate,
      ex_dividend_date: parsedExDate,
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
          amount_per_share: parseFloat(form.amount_per_share),
          quantity: parseFloat(form.quantity),
          payment_date: form.payment_date || undefined,
          ex_dividend_date: form.ex_dividend_date || undefined,
        };
      } else {
        action = "update";
        payload = {
          dividend_id: editingId,
          amount_per_share: form.amount_per_share ? parseFloat(form.amount_per_share) : undefined,
          quantity: form.quantity ? parseFloat(form.quantity) : undefined,
          payment_date: form.payment_date || undefined,
          ex_dividend_date: form.ex_dividend_date || undefined,
        };
      }

      const res = await fetch(ENDPOINTS.CRUD, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resource_name: "dividend", action, payload }),
      });
      const responseText = await res.text();
      let json; try { json = JSON.parse(responseText); } catch { json = {}; }
      if (!res.ok) throw new Error(json.error || json.message || `HTTP ${res.status}: ${responseText}`);
      if (json.error) throw new Error(json.error);

      delete cacheRef.current[yearMonth];
      setModalOpen(false);
      fetchDividends(undefined, true);
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
        body: JSON.stringify({ resource_name: "dividend", action: "delete", payload: { dividend_id: id } }),
      });
      const responseText = await res.text();
      if (!res.ok) {
        let json; try { json = JSON.parse(responseText); } catch { json = {}; }
        throw new Error(json.error || json.message || `HTTP ${res.status}`);
      }
      delete cacheRef.current[yearMonth];
      setDeleteConfirm(null);
      fetchDividends(undefined, true);
    } catch (err) {
      setError(`Delete failed: ${err.message}`);
      setDeleteConfirm(null);
    }
  };

  const updateField = (field, value) => setForm((f) => ({ ...f, [field]: value }));
  const totalDividends = rows.reduce((sum, r) => sum + parseFloat(r.total_dividend || 0), 0);

  return (
    <div className="page-shell">
      <div className="page-container">

        {/* Top Bar */}
        <div className="top-bar">
          <div>
            <h1 className="top-bar-title">💰 Dividends</h1>
            <div className="top-bar-badges">
              <span className="badge-pill badge-neutral">{rows.length} records</span>
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
        <div className="kpi-grid" style={{ gridTemplateColumns: "minmax(0, 220px)" }}>
          <div className="kpi-card">
            <div className="kpi-label">Total Dividends</div>
            <div className="kpi-value kpi-value--green">${totalDividends.toFixed(2)}</div>
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
              <h3 className="table-card__title">Dividend Records</h3>
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
            ) : rows.length === 0 ? (
              <div className="empty-state">No dividend records for {yearMonth}</div>
            ) : (
              <>
                {/* Desktop Table */}
                <table className="data-table view-desktop">
                  <thead>
                    <tr>
                      <th>Symbol</th>
                      <th>Stock Name</th>
                      <th>Payment Date</th>
                      <th>Ex-Div Date</th>
                      <th className="text-right">Dividend/Share</th>
                      <th className="text-right">Quantity</th>
                      <th className="text-right">Total</th>
                      <th className="text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id}>
                        <td className="font-bold">{row.symbol}</td>
                        <td className="color-muted">{row.stock_name || "-"}</td>
                        <td>{row.payment_date ? row.payment_date.slice(0, 10) : "-"}</td>
                        <td>{row.ex_dividend_date ? row.ex_dividend_date.slice(0, 10) : "-"}</td>
                        <td className="text-right">{parseFloat(row.amount_per_share).toFixed(4)}</td>
                        <td className="text-right">{parseFloat(row.quantity).toLocaleString()}</td>
                        <td className="text-right font-heavy color-green">${parseFloat(row.total_dividend).toFixed(2)}</td>
                        <td className="text-center">
                          <div className="action-group">
                            <button type="button" onClick={() => openEditModal(row)} className="action-btn" title="Edit"><Pencil size={14} /></button>
                            <button type="button" onClick={() => setDeleteConfirm(row.id)} className="action-btn action-btn--danger" title="Delete"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={6} className="text-right" style={{ fontWeight: 800 }}>Total:</td>
                      <td className="text-right" style={{ fontWeight: 900, color: "#146c2e" }}>${totalDividends.toFixed(2)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>

                {/* Mobile Cards */}
                <div className="view-mobile">
                  {rows.map((row) => (
                    <div key={row.id} className="mobile-card">
                      <div className="mobile-card__header">
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span className="mobile-card__symbol">{row.symbol}</span>
                          <span className="mobile-card__name">{row.stock_name || "-"}</span>
                        </div>
                        <div className="action-group">
                          <button type="button" onClick={() => openEditModal(row)} className="action-btn"><Pencil size={14} /></button>
                          <button type="button" onClick={() => setDeleteConfirm(row.id)} className="action-btn action-btn--danger"><Trash2 size={14} /></button>
                        </div>
                      </div>
                      <div className="mobile-card__grid">
                        <div><span className="color-muted">Payment:</span> {row.payment_date ? row.payment_date.slice(0, 10) : "-"}</div>
                        <div><span className="color-muted">Ex-Div:</span> {row.ex_dividend_date ? row.ex_dividend_date.slice(0, 10) : "-"}</div>
                        <div><span className="color-muted">Amt/Share:</span> {parseFloat(row.amount_per_share).toFixed(4)}</div>
                        <div><span className="color-muted">Qty:</span> {parseFloat(row.quantity).toLocaleString()}</div>
                      </div>
                      <div style={{ marginTop: "6px", fontWeight: 800, color: "#146c2e", fontSize: "14px" }}>
                        ${parseFloat(row.total_dividend).toFixed(2)}
                      </div>
                    </div>
                  ))}
                  <div style={{ padding: "12px", background: "#fafbff", fontWeight: 900, color: "#146c2e", fontSize: "14px", textAlign: "right" }}>
                    Total: ${totalDividends.toFixed(2)}
                  </div>
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
                <h2 className="modal-title">{modalMode === "add" ? "Add Dividend" : "Edit Dividend"}</h2>
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
                <div className="form-row form-row--2col">
                  <div>
                    <label className="form-label">Amount/Share *</label>
                    <input type="number" step="0.0001" required value={form.amount_per_share} onChange={(e) => updateField("amount_per_share", e.target.value)} className="form-input" />
                  </div>
                  <div>
                    <label className="form-label">Quantity *</label>
                    <input type="number" step="1" required value={form.quantity} onChange={(e) => updateField("quantity", e.target.value)} className="form-input" />
                  </div>
                </div>
                <div className="form-row form-row--2col" style={{ marginBottom: "16px" }}>
                  <div>
                    <label className="form-label">Payment Date</label>
                    <input type="date" value={form.payment_date} onChange={(e) => updateField("payment_date", e.target.value)} className="form-input" />
                  </div>
                  <div>
                    <label className="form-label">Ex-Dividend Date</label>
                    <input type="date" value={form.ex_dividend_date} onChange={(e) => updateField("ex_dividend_date", e.target.value)} className="form-input" />
                  </div>
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
              <p>Delete this dividend entry?</p>
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