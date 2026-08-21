import React, { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, X, Loader2, TrendingUp, TrendingDown, ArrowLeft } from "lucide-react";

const ENDPOINTS = {
  CRUD: "https://z35lnmmzgi.execute-api.ap-east-1.amazonaws.com/prod/lambda_crud_handler",
};

const CACHE_KEY_PREFIX = "transactions_cache_";
const STOCK_INFO_CACHE_KEY = "stock_info_cache";
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

const EMPTY_FORM = {
  symbol: "",
  market: ".HK",
  type: "BUY",
  quantity: "",
  price: "",
  notes: "",
  transaction_date: "",
};

// ═══════════════════════════════════════════════════
//  SESSION STORAGE CACHE HELPERS
// ═══════════════════════════════════════════════════

function getSessionCache(key) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const { data, expiry } = JSON.parse(raw);
    if (Date.now() > expiry) {
      sessionStorage.removeItem(key);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function setSessionCache(key, data, ttl) {
  try {
    const entry = { data, expiry: Date.now() + ttl };
    sessionStorage.setItem(key, JSON.stringify(entry));
  } catch (e) {
    console.warn("sessionStorage write failed:", e);
  }
}

function clearSessionCache(key) {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}

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
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
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

export default function Transactions() {
  const [yearMonth, setYearMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [rows, setRows] = useState([]);
  const [stockInfo, setStockInfo] = useState({});
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

  // Fetch stock info (consolidated report) for short names
  const fetchStockInfo = useCallback(async (signal) => {
    // Check cache first
    const cached = getSessionCache(STOCK_INFO_CACHE_KEY);
    if (cached) {
      console.log("✅ Using cached stock info");
      setStockInfo(cached);
      return;
    }

    try {
      const res = await fetch(ENDPOINTS.CRUD, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({
          resource_name: "consolidated_report",
          action: "get",
          payload: {},
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const data = json.data || json;
      setStockInfo(data);
      setSessionCache(STOCK_INFO_CACHE_KEY, data, CACHE_TTL);
      console.log("✅ Fetched stock info from API & cached");
    } catch (err) {
      if (err.name === "AbortError") return;
      console.warn("Failed to fetch stock info:", err);
    }
  }, []);

  const fetchTransactions = useCallback(
    async (signal, forceRefresh = false) => {
      // Check cache first (unless forced refresh)
      if (!forceRefresh) {
        const cached = getSessionCache(cacheKey);
        if (cached) {
          console.log("✅ Using cached transactions for", yearMonth);
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
        console.log("✅ Fetched transactions from API & cached for", yearMonth);
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
    fetchStockInfo(ctrl.signal);
    fetchTransactions(ctrl.signal);
    return () => ctrl.abort();
  }, [fetchStockInfo, fetchTransactions]);

  // Helper: get shortName_en from stockInfo by symbol
  const getStockName = (symbol) => {
    if (!symbol || !stockInfo) return "-";
    // Direct match (e.g. "0700.HK")
    if (stockInfo[symbol]) return stockInfo[symbol].shortName_en || "-";
    // Try uppercase
    const upper = symbol.toUpperCase();
    if (stockInfo[upper]) return stockInfo[upper].shortName_en || "-";
    return "-";
  };

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
    if (!id) {
      setError("Cannot edit: row has no ID field.");
      return;
    }

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

      console.log("Submitting:", { resource_name: "transaction", action, payload });

      const res = await fetch(ENDPOINTS.CRUD, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resource_name: "transaction", action, payload }),
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
      // Clear cache and force refresh after mutation
      clearSessionCache(cacheKey);
      fetchTransactions(undefined, true);
    } catch (err) {
      console.error("Submit error:", err);
      setFormError(err.message);
    }
    setSubmitting(false);
  };

  const handleDelete = async (id) => {
    console.log("Deleting transaction ID:", id);
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

      const responseText = await res.text();
      console.log("Delete response:", res.status, responseText);

      if (!res.ok) {
        let json;
        try { json = JSON.parse(responseText); } catch (e) { json = {}; }
        throw new Error(json.error || json.message || `HTTP ${res.status}`);
      }

      setDeleteConfirm(null);
      // Clear cache and force refresh after deletion
      clearSessionCache(cacheKey);
      fetchTransactions(undefined, true);
    } catch (err) {
      console.error("Delete error:", err);
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

  // Sort rows by transaction_date ascending
  const sortedRows = [...rows].sort((a, b) => {
    const dateA = a.transaction_date || "";
    const dateB = b.transaction_date || "";
    return dateA.localeCompare(dateB);
  });

  return (
    <div style={{ background: "#f6f7fb", minHeight: "100vh", padding: "12px" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>

        {/* Top Bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px", gap: "10px", flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "clamp(20px, 5vw, 26px)", fontWeight: 800, color: "#111" }}>📈 Transactions</h1>
            <div style={{ marginTop: "6px", display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ display: "inline-flex", alignItems: "center", padding: "4px 10px", borderRadius: "999px", fontSize: "11px", fontWeight: 800, border: "1px solid #dfe3f0", background: "#fff", color: "#333" }}>
                {rows.length} records
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", padding: "4px 10px", borderRadius: "999px", fontSize: "11px", fontWeight: 800, border: "1px solid #b9f2c1", background: "#edfff0", color: "#136f2d" }}>
                {buyCount} buys
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", padding: "4px 10px", borderRadius: "999px", fontSize: "11px", fontWeight: 800, border: "1px solid #ffc9c9", background: "#fff0f0", color: "#8d1414" }}>
                {sellCount} sells
              </span>
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
            <input
              type="month"
              value={yearMonth}
              onChange={(e) => setYearMonth(e.target.value)}
              style={{ border: "1px solid #d2d7e6", background: "#fff", padding: "8px 10px", borderRadius: "10px", fontWeight: 700, fontSize: "13px", minWidth: "130px" }}
            />
            <button
              type="button"
              onClick={() => { window.location.href = "/"; }}
              title="Back to Home"
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "36px", height: "36px", border: "1px solid #d2d7e6", background: "#fff", borderRadius: "10px", cursor: "pointer", color: "#667" }}
            >
              <ArrowLeft size={16} />
            </button>
          </div>
        </div>

        {/* KPI Summary - Responsive Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px", marginBottom: "12px" }}>
          <div style={{ border: "1px solid #b9f2c1", borderRadius: "12px", padding: "12px", background: "#edfff0" }}>
            <div style={{ color: "#136f2d", fontSize: "11px", fontWeight: 700 }}>Total Buy Amount</div>
            <div style={{ fontSize: "16px", fontWeight: 900, marginTop: "5px", color: "#136f2d" }}>${totalBuyAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div style={{ fontSize: "11px", color: "#4a9960", marginTop: "2px" }}>{buyCount} order{buyCount !== 1 ? "s" : ""}</div>
          </div>
          <div style={{ border: "1px solid #ffc9c9", borderRadius: "12px", padding: "12px", background: "#fff0f0" }}>
            <div style={{ color: "#8d1414", fontSize: "11px", fontWeight: 700 }}>Total Sell Amount</div>
            <div style={{ fontSize: "16px", fontWeight: 900, marginTop: "5px", color: "#8d1414" }}>${totalSellAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div style={{ fontSize: "11px", color: "#b04040", marginTop: "2px" }}>{sellCount} order{sellCount !== 1 ? "s" : ""}</div>
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
            <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 800 }}>Transaction History</h3>
            <span style={{ color: "#667", fontSize: "12px", fontWeight: 700 }}>{yearMonth}</span>
            <button
              type="button"
              onClick={openAddModal}
              style={{ display: "inline-flex", alignItems: "center", gap: "4px", border: "none", background: "#1f4fff", color: "#fff", padding: "8px 14px", borderRadius: "10px", cursor: "pointer", fontWeight: 700, fontSize: "13px" }}
            >
              <Plus size={14} /> Add
            </button>
          </div>

          {/* Desktop Table */}
          <div className="txn-table-wrapper" style={{ overflow: "auto" }}>
            {loading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "48px 0" }}>
                <Loader2 size={28} className="txn-spinner" style={{ color: "#1f4fff" }} />
              </div>
            ) : rows.length === 0 ? (
              <div style={{ textAlign: "center", color: "#667", padding: "48px 0", fontSize: "14px" }}>No transactions for {yearMonth}</div>
            ) : (
              <>
                {/* Desktop/Landscape Table */}
                <table className="txn-desktop-table" style={{ width: "100%", borderCollapse: "collapse", background: "#fff" }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Stock</th>
                      <th style={thStyle}>Stock Name</th>
                      <th style={thStyle}>Transaction Date</th>
                      <th style={{ ...thStyle, textAlign: "center" }}>Type</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Quantity</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Price</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Total</th>
                      <th style={{ ...thStyle, minWidth: "180px" }}>Notes</th>
                      <th style={{ ...thStyle, textAlign: "center" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.map((row) => (
                      <tr key={row.id}>
                        <td style={{ ...tdStyle, fontWeight: 700 }}>{row.symbol}</td>
                        <td style={{ ...tdStyle, color: "#555", fontSize: "12px" }}>{getStockName(row.symbol)}</td>
                        <td style={tdStyle}>{row.transaction_date ? row.transaction_date.slice(0, 10) : "-"}</td>
                        <td style={{ ...tdStyle, textAlign: "center" }}>
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
                        <td style={{ ...tdStyle, textAlign: "right" }}>{parseFloat(row.quantity).toLocaleString()}</td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>${parseFloat(row.price).toFixed(2)}</td>
                        <td style={{ ...tdStyle, textAlign: "right", fontWeight: 800 }}>${parseFloat(row.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td style={{ ...tdStyle, minWidth: "180px", whiteSpace: "pre-wrap", wordBreak: "break-word", maxWidth: "280px" }}>{row.notes || "-"}</td>
                        <td style={{ ...tdStyle, textAlign: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                            <button type="button" onClick={() => openEditModal(row)} style={actionBtnStyle} title="Edit">
                              <Pencil size={14} />
                            </button>
                            <button type="button" onClick={() => setDeleteConfirm(row.id)} style={{ ...actionBtnStyle, color: "#b02020" }} title="Delete">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Mobile Card View */}
                <div className="txn-mobile-cards">
                  {sortedRows.map((row) => (
                    <div key={row.id} style={{ padding: "12px", borderBottom: "1px solid #eef0f6" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontWeight: 800, fontSize: "14px" }}>{row.symbol}</span>
                          <span style={{ fontSize: "11px", color: "#555" }}>{getStockName(row.symbol)}</span>
                          <span style={{
                            display: "inline-flex", alignItems: "center", gap: "3px", padding: "2px 7px", borderRadius: "999px", fontSize: "10px", fontWeight: 800,
                            border: row.type === "BUY" ? "1px solid #b9f2c1" : "1px solid #ffc9c9",
                            background: row.type === "BUY" ? "#edfff0" : "#fff0f0",
                            color: row.type === "BUY" ? "#136f2d" : "#8d1414",
                          }}>
                            {row.type === "BUY" ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                            {row.type}
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button type="button" onClick={() => openEditModal(row)} style={actionBtnStyle} title="Edit">
                            <Pencil size={14} />
                          </button>
                          <button type="button" onClick={() => setDeleteConfirm(row.id)} style={{ ...actionBtnStyle, color: "#b02020" }} title="Delete">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 12px", fontSize: "12px" }}>
                        <div><span style={{ color: "#667" }}>Date:</span> {row.transaction_date ? row.transaction_date.slice(0, 10) : "-"}</div>
                        <div><span style={{ color: "#667" }}>Qty:</span> {parseFloat(row.quantity).toLocaleString()}</div>
                        <div><span style={{ color: "#667" }}>Price:</span> ${parseFloat(row.price).toFixed(2)}</div>
                        <div><span style={{ color: "#667" }}>Total:</span> <strong>${parseFloat(row.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>
                      </div>
                      {row.notes && (
                        <div style={{ marginTop: "6px", fontSize: "12px", color: "#555", wordBreak: "break-word", whiteSpace: "pre-wrap" }}>
                          <span style={{ color: "#667" }}>Notes:</span> {row.notes}
                        </div>
                      )}
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
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }}>
          <div
            onClick={() => setModalOpen(false)}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.4)" }}
          />
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "12px", pointerEvents: "none", overflow: "auto" }}>
            <div
              style={{ width: "100%", maxWidth: "440px", background: "#fff", borderRadius: "12px", padding: "20px", boxShadow: "0 20px 60px rgba(0,0,0,0.15)", border: "1px solid #e6e8f0", pointerEvents: "auto", position: "relative", zIndex: 10, margin: "auto" }}
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
                {/* Symbol + Market Row */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
                  <div>
                    <label style={labelStyle}>Symbol *</label>
                    <input
                      type="text"
                      required={modalMode === "add"}
                      disabled={modalMode === "edit"}
                      value={form.symbol}
                      onChange={(e) => updateField("symbol", e.target.value)}
                      placeholder={form.market === ".HK" ? "e.g. 5, 700, 2628" : "e.g. AAPL"}
                      style={{ ...inputStyle, background: modalMode === "edit" ? "#f5f5f5" : "#fff", opacity: modalMode === "edit" ? 0.6 : 1 }}
                    />
                    {form.market === ".HK" && form.symbol.trim() && modalMode === "add" && (
                      <div style={{ fontSize: "11px", color: "#667", marginTop: "3px" }}>
                        Will submit as: <strong>{form.symbol.trim().padStart(4, "0")}.HK</strong>
                      </div>
                    )}
                  </div>
                  <div>
                    <label style={labelStyle}>Market *</label>
                    <select
                      value={form.market}
                      onChange={(e) => updateField("market", e.target.value)}
                      disabled={modalMode === "edit"}
                      style={{ ...inputStyle, background: modalMode === "edit" ? "#f5f5f5" : "#fff", opacity: modalMode === "edit" ? 0.6 : 1 }}
                    >
                      <option value=".HK">Hong Kong (.HK)</option>
                      <option value="">US / Other</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "12px" }}>
                  <div>
                    <label style={labelStyle}>Type *</label>
                    <select
                      value={form.type}
                      onChange={(e) => updateField("type", e.target.value)}
                      style={{ ...inputStyle, background: "#fff" }}
                    >
                      <option value="BUY">BUY</option>
                      <option value="SELL">SELL</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Quantity *</label>
                    <input
                      type="number"
                      step="1"
                      required
                      value={form.quantity}
                      onChange={(e) => updateField("quantity", e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Price *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={form.price}
                      onChange={(e) => updateField("price", e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                </div>
                <div style={{ marginBottom: "12px" }}>
                  <label style={labelStyle}>Transaction Date</label>
                  <input
                    type="date"
                    value={form.transaction_date}
                    onChange={(e) => updateField("transaction_date", e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div style={{ marginBottom: "16px" }}>
                  <label style={labelStyle}>Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => updateField("notes", e.target.value)}
                    placeholder="Optional notes"
                    rows={3}
                    style={{ ...inputStyle, resize: "vertical", minHeight: "60px", fontFamily: "inherit", lineHeight: "1.4" }}
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

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .txn-spinner { animation: spin 1s linear infinite; }

        /* Desktop: show table, hide cards */
        .txn-desktop-table { display: table; }
        .txn-mobile-cards { display: none; }

        /* Mobile portrait (<600px): show cards, hide table */
        @media (max-width: 599px) {
          .txn-desktop-table { display: none !important; }
          .txn-mobile-cards { display: block !important; }
        }

        /* Tablet / Mobile landscape (600-899px): show table but allow scroll */
        @media (min-width: 600px) and (max-width: 899px) {
          .txn-desktop-table { min-width: 700px; }
          .txn-table-wrapper { -webkit-overflow-scrolling: touch; }
        }
      `}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════
//  SHARED STYLES
// ═══════════════════════════════════════════════════

const thStyle = {
  padding: "10px",
  borderBottom: "1px solid #eef0f6",
  textAlign: "left",
  fontSize: "12px",
  color: "#445",
  background: "#fafbff",
  whiteSpace: "nowrap",
  fontWeight: 700,
};

const tdStyle = {
  padding: "10px",
  borderBottom: "1px solid #eef0f6",
  fontSize: "13px",
};

const actionBtnStyle = {
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "#1f4fff",
  padding: "4px",
};

const labelStyle = {
  display: "block",
  fontSize: "12px",
  fontWeight: 700,
  color: "#445",
  marginBottom: "4px",
};

const inputStyle = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid #d2d7e6",
  borderRadius: "8px",
  fontSize: "13px",
  boxSizing: "border-box",
};