import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Loader2 } from "lucide-react";
import "../styles/shared.css";

import { ENDPOINTS, authFetch, clearSessionCache } from "../api/api";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

function isISODate(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

// amount = "" should be treated as "not provided" (do not process)
function safeNumOrNull(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function emptyRow() {
  return { category: "", amount: "", notes: "" };
}

const DEFAULT_ROWS = [
  { category: "Breakfast", amount: "", notes: "" },
  { category: "Lunch", amount: "", notes: "" },
  { category: "Dinner", amount: "", notes: "" },
  { category: "Travel", amount: "", notes: "" },
];

/**
 * Comment format (NEW):
 * Line 1: parseable list (category+amount only)
 *   ["Breakfast"=41, "Dinner"=150]
 * Line 2 (optional): concatenated Notes ONLY, separated by "/"
 *   coffee/uber/dessert
 *
 * If there are no notes at all -> return only line 1.
 */
function buildDailyCommentWithListAndNotes(rows) {
  const meaningful = rows
    .map((r) => ({
      category: String(r.category || "").trim(),
      amount: safeNumOrNull(r.amount),
      notes: String(r.notes || "").trim(),
    }))
    .filter((r) => r.category.length > 0 && r.amount !== null);

  const listPart =
    "[" +
    meaningful
      .map((r) => `"${r.category.replaceAll('"', '\\"')}"=${r.amount}`)
      .join(", ") +
    "]";

  const notes = meaningful
    .map((r) => r.notes)
    .filter((s) => s && s.length > 0);

  if (!notes.length) return listPart;

  // Join notes with "/" (avoid accidental newlines)
  const notesLine = notes.join("/").replaceAll("\n", " ").trim();

  return `${listPart}\n${notesLine}`;
}

/**
 * Parse the FIRST [...] list in comment:
 * ["Breakfast"=41, "Lunch"=100]
 * Returns [{category, amount}] or null
 */
function parseDailyListFromComment(comment) {
  if (!comment) return null;
  const text = String(comment);

  const start = text.indexOf("[");
  const end = text.indexOf("]");
  if (start === -1 || end === -1 || end <= start) return null;

  const inside = text.slice(start + 1, end).trim();
  if (!inside) return [];

  const re = /"([^"]+)"\s*=\s*(-?\d+(?:\.\d+)?)/g;
  const out = [];
  let m;
  while ((m = re.exec(inside)) !== null) {
    out.push({ category: m[1], amount: Number(m[2]) });
  }
  return out.length ? out : null;
}

/**
 * Fetch existing Daily ledger entry for the selected date (fallback).
 * Match:
 * - category === "Daily"
 * - date portion of datetime equals YYYY-MM-DD
 * Returns row including "id".
 */
async function fetchDailyEntryForDate(dateISO) {
  const monthStr = dateISO.slice(0, 7);

  const res = await authFetch(ENDPOINTS.CRUD, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      resource_name: "ledger",
      action: "get",
      payload: { month_str: monthStr },
    }),
  });

  const responseText = await res.text();
  let json;
  try {
    json = JSON.parse(responseText);
  } catch {
    json = {};
  }
  if (!res.ok) throw new Error(json.error || json.message || `HTTP ${res.status}: ${responseText}`);
  if (json.error) throw new Error(json.error);

  const rows = json.data || [];

  const match = rows.find((r) => {
    const cat = String(r.category || "");
    const dt = String(r.datetime || "").slice(0, 10);
    return cat === "Daily" && dt === dateISO;
  });

  return match || null;
}

/**
 * Fetch ledger row by ID (preferred when Ledger passes ?ledger_id=...).
 */
async function fetchLedgerById(id) {
  const res = await authFetch(ENDPOINTS.CRUD, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      resource_name: "ledger",
      action: "get_by_id",
      payload: { id },
    }),
  });

  const responseText = await res.text();
  let json;
  try {
    json = JSON.parse(responseText);
  } catch {
    json = {};
  }
  if (!res.ok) throw new Error(json.error || json.message || `HTTP ${res.status}: ${responseText}`);
  if (json.error) throw new Error(json.error);

  return json.data || null;
}

export default function DailyExpense() {
  const navigate = useNavigate();
  const query = useQuery();

  const initialDate = query.get("date");
  const initialLedgerId = query.get("ledger_id");

  const [date, setDate] = useState(() => (isISODate(initialDate) ? initialDate : todayISO()));
  const [rows, setRows] = useState(() => DEFAULT_ROWS);

  // Carry forward ledger.id for selected date's Daily row
  const [dailyLedgerId, setDailyLedgerId] = useState(() => {
    const n = initialLedgerId ? Number(initialLedgerId) : NaN;
    return Number.isFinite(n) ? n : null;
  });

  const [submitting, setSubmitting] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [error, setError] = useState("");

  const total = useMemo(() => {
    return rows.reduce((s, r) => {
      const n = safeNumOrNull(r.amount);
      return n === null ? s : s + n;
    }, 0);
  }, [rows]);

  const updateRow = (idx, patch) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const addRow = () => setRows((prev) => [...prev, emptyRow()]);
  const removeRow = (idx) => setRows((prev) => prev.filter((_, i) => i !== idx));

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!isISODate(date)) return;

      setError("");
      setLoadingExisting(true);

      try {
        let existing = null;

        // Prefer exact row if ledger_id passed
        if (dailyLedgerId) {
          existing = await fetchLedgerById(dailyLedgerId);
        }

        // Fallback: scan by date for category=Daily
        if (!existing) {
          existing = await fetchDailyEntryForDate(date);
        }

        if (cancelled) return;

        if (!existing) {
          setRows(DEFAULT_ROWS);
          setDailyLedgerId(null);
          setLoadingExisting(false);
          return;
        }

        setDailyLedgerId(typeof existing.id === "number" ? existing.id : dailyLedgerId);

        const parsed = parseDailyListFromComment(existing.comment);

        if (!parsed) {
          setRows(DEFAULT_ROWS);
          setLoadingExisting(false);
          return;
        }

        // Fill defaults + apply parsed values
        const map = new Map(parsed.map((x) => [x.category, x.amount]));
        const rebuilt = DEFAULT_ROWS.map((r) => ({
          category: r.category,
          amount: map.has(r.category) ? String(map.get(r.category)) : "",
          notes: "",
        }));

        // Add non-default categories
        for (const it of parsed) {
          if (!rebuilt.some((r) => r.category === it.category)) {
            rebuilt.push({ category: it.category, amount: String(it.amount), notes: "" });
          }
        }

        setRows(rebuilt);
        setLoadingExisting(false);
      } catch (e) {
        if (cancelled) return;
        setError(e?.message || "Failed to load existing Daily entry.");
        setRows(DEFAULT_ROWS);
        setLoadingExisting(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [date, dailyLedgerId]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");

    const cleaned = rows
      .map((r) => ({
        category: String(r.category || "").trim(),
        amount: safeNumOrNull(r.amount),
        notes: String(r.notes || "").trim(),
      }))
      .filter((r) => r.category.length > 0 && r.amount !== null);

    if (cleaned.length === 0) {
      setError('Enter at least one row with Category and Amount (Amount cannot be blank "").');
      return;
    }

    const totalExpense = cleaned.reduce((s, r) => s + (r.amount ?? 0), 0);
    if (!(totalExpense > 0)) {
      setError("Total expense must be greater than 0 to submit.");
      return;
    }

    setSubmitting(true);
    try {
      const comment = buildDailyCommentWithListAndNotes(cleaned);
      const action = dailyLedgerId ? "update" : "insert";

      const payload =
        action === "update"
          ? {
              id: dailyLedgerId,
              entry_id: dailyLedgerId, // backward compatible
              type: "E",
              category: "Daily",
              amount: -Math.abs(totalExpense),
              ledger_datetime: date || undefined,
              comment,
            }
          : {
              type: "E",
              category: "Daily",
              amount: -Math.abs(totalExpense),
              ledger_datetime: date || undefined,
              comment,
            };

      const res = await authFetch(ENDPOINTS.CRUD, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resource_name: "ledger", action, payload }),
      });

      const responseText = await res.text();
      let json;
      try {
        json = JSON.parse(responseText);
      } catch {
        json = {};
      }
      if (!res.ok) throw new Error(json.error || json.message || `HTTP ${res.status}: ${responseText}`);
      if (json.error) throw new Error(json.error);

      clearSessionCache(`ledger_cache_${date.slice(0, 7)}`);
      navigate("/ledger");
    } catch (err) {
      setError(err?.message || "Submit failed");
    } finally {
      setSubmitting(false);
    }
  };

  const preview = useMemo(() => {
    const cleaned = rows
      .map((r) => ({
        category: String(r.category || "").trim(),
        amount: safeNumOrNull(r.amount),
        notes: String(r.notes || "").trim(),
      }))
      .filter((r) => r.category.length > 0 && r.amount !== null);

    return cleaned.length ? buildDailyCommentWithListAndNotes(cleaned) : "[]";
  }, [rows]);

  return (
    <div className="page-shell">
      <div className="page-container">
        <div className="top-bar">
          <div>
            <h1 className="top-bar-title">🧾 Daily Expenses</h1>
            <div className="top-bar-badges">
              <span className="badge-pill badge-neutral">Total: ${total.toFixed(2)}</span>
              {loadingExisting && <span className="badge-pill badge-neutral">Loading existing…</span>}
              {dailyLedgerId ? (
                <span className="badge-pill badge-neutral">Editing Daily ID: {dailyLedgerId}</span>
              ) : (
                <span className="badge-pill badge-neutral">New Daily entry</span>
              )}
            </div>
          </div>

          <div className="top-bar-actions">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="month-input" />
            <button type="button" onClick={() => navigate("/ledger")} title="Back to Ledger" className="btn-back">
              <ArrowLeft size={16} />
            </button>
          </div>
        </div>

        {error && (
          <div className="error-alert">
            <div className="error-alert__title">Error</div>
            <div className="error-alert__body">{error}</div>
          </div>
        )}

        <div className="table-card">
          <div className="table-card__header">
            <div>
              <h3 className="table-card__title">Items</h3>
              <div className="table-card__subtitle">
                Comment line 1 stores category+amount list. Comment line 2 (optional) stores Notes joined by "/".
                Amount blank ("") is ignored.
              </div>
            </div>

            <button type="button" onClick={addRow} className="btn-add">
              <Plus size={14} /> Add row
            </button>
          </div>

          <div className="table-card__body">
            <form onSubmit={submit}>
              <table className="data-table view-desktop">
                <thead>
                  <tr>
                    <th>Expense category</th>
                    <th className="text-right">Amount</th>
                    <th>Notes</th>
                    <th className="text-center">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((r, idx) => (
                    <tr key={idx}>
                      <td>
                        <input
                          className="form-input"
                          value={r.category}
                          onChange={(e) => updateRow(idx, { category: e.target.value })}
                          placeholder="e.g. Breakfast"
                        />
                      </td>

                      <td className="text-right">
                        <input
                          className="form-input"
                          type="number"
                          step="0.01"
                          value={r.amount}
                          onChange={(e) => updateRow(idx, { amount: e.target.value })}
                          placeholder=""
                          style={{ textAlign: "right" }}
                        />
                      </td>

                      <td>
                        <input
                          className="form-input"
                          value={r.notes}
                          onChange={(e) => updateRow(idx, { notes: e.target.value })}
                          placeholder='Optional (saved as Notes-only line joined by "/")'
                        />
                      </td>

                      <td className="text-center">
                        <button
                          type="button"
                          className="action-btn action-btn--danger"
                          title="Remove row"
                          onClick={() => removeRow(idx)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>

                <tfoot>
                  <tr>
                    <td className="font-heavy">Total (ignores blank Amount)</td>
                    <td className="text-right font-heavy nowrap">${total.toFixed(2)}</td>
                    <td />
                    <td />
                  </tr>
                </tfoot>
              </table>

              <div className="view-mobile">
                {rows.map((r, idx) => (
                  <div key={idx} className="mobile-card">
                    <div className="mobile-card__header">
                      <div className="mobile-card__symbol">Item #{idx + 1}</div>
                      <button
                        type="button"
                        className="action-btn action-btn--danger"
                        title="Remove row"
                        onClick={() => removeRow(idx)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <div className="form-row">
                      <div>
                        <label className="form-label">Expense category</label>
                        <input
                          className="form-input"
                          value={r.category}
                          onChange={(e) => updateRow(idx, { category: e.target.value })}
                          placeholder="e.g. Breakfast"
                        />
                      </div>

                      <div>
                        <label className="form-label">Amount</label>
                        <input
                          className="form-input"
                          type="number"
                          step="0.01"
                          value={r.amount}
                          onChange={(e) => updateRow(idx, { amount: e.target.value })}
                          placeholder=""
                        />
                      </div>

                      <div>
                        <label className="form-label">Notes</label>
                        <input
                          className="form-input"
                          value={r.notes}
                          onChange={(e) => updateRow(idx, { notes: e.target.value })}
                          placeholder="Optional"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <div style={{ padding: 12, fontWeight: 900 }}>Total: ${total.toFixed(2)} (blank ignored)</div>
              </div>

              <div style={{ padding: 12 }}>
                <button type="submit" className="form-submit" disabled={submitting}>
                  {submitting ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <Loader2 size={16} className="spinner" />
                      Submitting...
                    </span>
                  ) : dailyLedgerId ? (
                    "Update daily expense"
                  ) : (
                    "Submit daily expense"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="alert" style={{ marginTop: 12 }}>
          <div className="alertTitle">Preview (stored in Ledger comment)</div>
          <pre className="code" style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>
            {preview}
          </pre>
        </div>
      </div>
    </div>
  );
}