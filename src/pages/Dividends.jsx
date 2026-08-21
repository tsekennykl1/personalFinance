import React, { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Pencil, Trash2, X, Loader2, ArrowLeft } from "lucide-react";

const ENDPOINTS = {
  CRUD: "https://z35lnmmzgi.execute-api.ap-east-1.amazonaws.com/prod/lambda_crud_handler",
};

const EMPTY_FORM = {
  symbol: "",
  market: ".HK",
  amount_per_share: "",
  quantity: "",
  payment_date: "",
  ex_dividend_date: "",
};

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

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

// Helper: validate and normalize HK symbol (must be 1-4 digits, padded to 4)
const validateAndNormalizeHKSymbol = (raw) => {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    return { error: "Hong Kong symbol must contain only digits (e.g. 5, 700, 2628, 9988)" };
  }
  if (trimmed.length > 4) {
    return { error: "Hong Kong symbol must be at most 4 digits" };
  }
  const padded = trimmed.padStart(4, "0");
  return { symbol: padded };
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

  // Cache: keyed by yearMonth
  const cacheRef = useRef({});

  const fetchDividends = useCallback(
    async (signal, forceRefresh = false) => {
      // Check cache first
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
        // Store in cache
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
    if (!id) {
      setError("Cannot edit: row has no ID field.");
      return;
    }

    const rawDate = row.payment_date || row.date || "";
    const parsedDate = parseDateToISO(rawDate) || new Date().toISOString().slice(0, 10);
    const rawExDate = row.ex_dividend_date || "";
    const parsedExDate = parseDateToISO(rawExDate);

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

      if (modalMode === "add") {
        if (form.market === ".HK") {
          const result = validateAndNormalizeHKSymbol(finalSymbol);
          if (result.error) {
            setFormError(result.error);
            setSubmitting(false);
            return;
          }
          finalSymbol = result.symbol + ".HK";
        }
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
      let json;
      try { json = JSON.parse(responseText); } catch (e) { json = {}; }

      if (!res.ok) {
        throw new Error(json.error || json.message || `HTTP ${res.status}: ${responseText}`);
      }
      if (json.error) {
        throw new Error(json.error);
      }

      // Invalidate cache for this month
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
      const body = JSON.stringify({
        resource_name: "dividend",
        action: "delete",
        payload: { dividend_id: id },
      });

      const res = await fetch(ENDPOINTS.CRUD, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      const responseText = await res.text();
      if (!res.ok) {
        let json;
        try { json = JSON.parse(responseText); } catch (e) { json = {}; }
        throw new Error(json.error || json.message || `HTTP ${res.status}`);
      }

      // Invalidate cache
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
    <div style={{ background: "#f6f7fb", minHeight: "100vh", padding: "12px" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        {/* Top Bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px", gap: "10px", flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 800, color: "#111" }}>💰 Dividends</h1>
            <div style={{ marginTop: "6px", display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ display: "inline-flex", alignItems: "center", padding: "4px 10px", borderRadius: "999px", fontSize: "12px", fontWeight: 800, border: "1px solid #dfe3f0", background: "#fff", color: "#333" }}>
                {rows.length} records
              </span>
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
            <input
              type="month"
              value={yearMonth}
              onChange={(e) => setYearMonth(e.target.value)}
              style={{ border: "1px solid #d2d7e6", background: "#fff", padding: "8px 10px", borderRadius: "10px", fontWeight: 700, fontSize: "13px" }}
            />
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

        {/* KPI Summary - Only Total Dividends */}
        <div style={{ marginBottom: "12px" }}>
          <div style={{ border: "1px solid #eef0f6", borderRadius: "12px", padding: "12px", background: "#fff", maxWidth: "220px" }}>
            <div style={{ color: "#667", fontSize: "12px", fontWeight: 700 }}>Total Dividends</div>
            <div style={{ fontSize: "18px", fontWeight: 900, marginTop: "5px", color: "#146c2e" }}>${totalDividends.toFixed(2)}</div>
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
          {/* Header row with Add button */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", borderBottom: "1px solid #eef0f6", flexWrap: "wrap", gap: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800 }}>Dividend Records</h3>
              <span style={{ color: "#667", fontSize: "12px", fontWeight: 700 }}>{yearMonth}</span>
            </div>
            <button
              type="button"
              onClick={openAddModal}
              style={{ display: "inline-flex", alignItems: "center", gap: "4px", border: "none", background: "#1f4fff", color: "#fff", padding: "8px 14px", borderRadius: "10px", cursor: "pointer", fontWeight: 700, fontSize: "13px" }}
            >
              <Plus size={14} /> Add
            </button>
          </div>

          <div style={{ overflow: "auto", WebkitOverflowScrolling: "touch" }}>
            {loading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "48px 0" }}>
                <Loader2 size={28} style={{ animation: "spin 1s linear infinite", color: "#1f4fff" }} />
              </div>
            ) : rows.length === 0 ? (
              <div style={{ textAlign: "center", color: "#667", padding: "48px 0", fontSize: "14px" }}>No dividend records for {yearMonth}</div>
            ) : (
              <>
                {/* Desktop Table */}
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "600px", background: "#fff" }} className="dividend-table-desktop">
                  <thead>
                    <tr>
                      <th style={{ padding: "10px", borderBottom: "1px solid #eef0f6", textAlign: "left", fontSize: "12px", color: "#445", background: "#fafbff", whiteSpace: "nowrap" }}>Symbol</th>
                      <th style={{ padding: "10px", borderBottom: "1px solid #eef0f6", textAlign: "left", fontSize: "12px", color: "#445", background: "#fafbff", whiteSpace: "nowrap" }}>Payment Date</th>
                      <th style={{ padding: "10px", borderBottom: "1px solid #eef0f6", textAlign: "left", fontSize: "12px", color: "#445", background: "#fafbff", whiteSpace: "nowrap" }}>Ex-Div Date</th>
                      <th style={{ padding: "10px", borderBottom: "1px solid #eef0f6", textAlign: "right", fontSize: "12px", color: "#445", background: "#fafbff", whiteSpace: "nowrap" }}>Dividend per Share</th>
                      <th style={{ padding: "10px", borderBottom: "1px solid #eef0f6", textAlign: "right", fontSize: "12px", color: "#445", background: "#fafbff", whiteSpace: "nowrap" }}>Quantity</th>
                      <th style={{ padding: "10px", borderBottom: "1px solid #eef0f6", textAlign: "right", fontSize: "12px", color: "#445", background: "#fafbff", whiteSpace: "nowrap" }}>Total</th>
                      <th style={{ padding: "10px", borderBottom: "1px solid #eef0f6", textAlign: "center", fontSize: "12px", color: "#445", background: "#fafbff", whiteSpace: "nowrap" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id}>
                        <td style={{ padding: "10px", borderBottom: "1px solid #eef0f6", fontSize: "13px", fontWeight: 700 }}>{row.symbol}</td>
                        <td style={{ padding: "10px", borderBottom: "1px solid #eef0f6", fontSize: "13px" }}>{row.payment_date ? row.payment_date.slice(0, 10) : "-"}</td>
                        <td style={{ padding: "10px", borderBottom: "1px solid #eef0f6", fontSize: "13px" }}>{row.ex_dividend_date ? row.ex_dividend_date.slice(0, 10) : "-"}</td>
                        <td style={{ padding: "10px", borderBottom: "1px solid #eef0f6", fontSize: "13px", textAlign: "right" }}>{parseFloat(row.amount_per_share).toFixed(4)}</td>
                        <td style={{ padding: "10px", borderBottom: "1px solid #eef0f6", fontSize: "13px", textAlign: "right" }}>{parseFloat(row.quantity).toLocaleString()}</td>
                        <td style={{ padding: "10px", borderBottom: "1px solid #eef0f6", fontSize: "13px", textAlign: "right", fontWeight: 800, color: "#146c2e" }}>
                          ${parseFloat(row.total_dividend).toFixed(2)}
                        </td>
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
                      <td colSpan={5} style={{ padding: "10px", fontSize: "13px", fontWeight: 800, textAlign: "right" }}>Total:</td>
                      <td style={{ padding: "10px", fontSize: "13px", fontWeight: 900, textAlign: "right", color: "#146c2e" }}>${totalDividends.toFixed(2)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>

                {/* Mobile Card View */}
                <div className="dividend-cards-mobile" style={{ display: "none" }}>
                  {rows.map((row) => (
                    <div key={row.id} style={{ padding: "12px", borderBottom: "1px solid #eef0f6" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                        <span style={{ fontWeight: 800, fontSize: "14px" }}>{row.symbol}</span>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button type="button" onClick={() => openEditModal(row)} style={{ background: "none", border: "none", cursor: "pointer", color: "#1f4fff", padding: "4px" }}>
                            <Pencil size={14} />
                          </button>
                          <button type="button" onClick={() => setDeleteConfirm(row.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#b02020", padding: "4px" }}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 12px", fontSize: "12px" }}>
                        <div><span style={{ color: "#667" }}>Payment:</span> {row.payment_date ? row.payment_date.slice(0, 10) : "-"}</div>
                        <div><span style={{ color: "#667" }}>Ex-Div:</span> {row.ex_dividend_date ? row.ex_dividend_date.slice(0, 10) : "-"}</div>
                        <div><span style={{ color: "#667" }}>Amt/Share:</span> {parseFloat(row.amount_per_share).toFixed(4)}</div>
                        <div><span style={{ color: "#667" }}>Qty:</span> {parseFloat(row.quantity).toLocaleString()}</div>
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
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }}>
          <div
            onClick={() => setModalOpen(false)}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.4)" }}
          />
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", pointerEvents: "none" }}>
            <div style={{ width: "100%", maxWidth: "440px", background: "#fff", borderRadius: "12px", padding: "20px", boxShadow: "0 20px 60px rgba(0,0,0,0.15)", border: "1px solid #e6e8f0", pointerEvents: "auto", position: "relative", zIndex: 10, maxHeight: "90vh", overflowY: "auto" }}>
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
                {/* Symbol + Market Row */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#445", marginBottom: "4px" }}>Symbol *</label>
                    <input
                      type="text"
                      required={modalMode === "add"}
                      disabled={modalMode === "edit"}
                      value={form.symbol}
                      onChange={(e) => updateField("symbol", e.target.value)}
                      placeholder={form.market === ".HK" ? "e.g. 5, 700, 2628" : "e.g. AAPL"}
                      style={{ width: "100%", padding: "8px 10px", border: "1px solid #d2d7e6", borderRadius: "8px", fontSize: "13px", boxSizing: "border-box", background: modalMode === "edit" ? "#f5f5f5" : "#fff", opacity: modalMode === "edit" ? 0.6 : 1 }}
                    />
                    {form.market === ".HK" && form.symbol.trim() && modalMode === "add" && (
                      <div style={{ fontSize: "11px", color: "#667", marginTop: "3px" }}>
                        Will submit as: <strong>{form.symbol.trim().padStart(4, "0")}.HK</strong>
                      </div>
                    )}
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#445", marginBottom: "4px" }}>Market *</label>
                    <select
                      value={form.market}
                      onChange={(e) => updateField("market", e.target.value)}
                      disabled={modalMode === "edit"}
                      style={{ width: "100%", padding: "8px 10px", border: "1px solid #d2d7e6", borderRadius: "8px", fontSize: "13px", boxSizing: "border-box", background: modalMode === "edit" ? "#f5f5f5" : "#fff", opacity: modalMode === "edit" ? 0.6 : 1 }}
                    >
                      <option value=".HK">Hong Kong (.HK)</option>
                      <option value="">US / Other</option>
                    </select>
                  </div>
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

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#445", marginBottom: "4px" }}>Payment Date</label>
                    <input
                      type="date"
                      value={form.payment_date}
                      onChange={(e) => updateField("payment_date", e.target.value)}
                      style={{ width: "100%", padding: "8px 10px", border: "1px solid #d2d7e6", borderRadius: "8px", fontSize: "13px", boxSizing: "border-box" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#445", marginBottom: "4px" }}>Ex-Dividend Date</label>
                    <input
                      type="date"
                      value={form.ex_dividend_date}
                      onChange={(e) => updateField("ex_dividend_date", e.target.value)}
                      style={{ width: "100%", padding: "8px 10px", border: "1px solid #d2d7e6", borderRadius: "8px", fontSize: "13px", boxSizing: "border-box" }}
                    />
                  </div>
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

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        
        @media (max-width: 640px) {
          .dividend-table-desktop { display: none !important; }
          .dividend-cards-mobile { display: block !important; }
        }
        @media (min-width: 641px) {
          .dividend-table-desktop { display: table !important; }
          .dividend-cards-mobile { display: none !important; }
        }
      `}</style>
    </div>
  );
}