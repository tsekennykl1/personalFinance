import React, { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ENDPOINTS } from "../constants/api";
import { getCache, setCache, clearCache } from "../lib/cache";
import { formatNumber, formatInt, formatPct, money } from "../utils/formatters";
import Badge from "../components/Badge";
import Section from "../components/Section";
import Table from "../components/Table";
import IconPill from "../components/IconPill";
import "./Home.css";

const CACHE_KEY = "consolidated_monthly_report";
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

function parsePayload(json) {
  const payload = Array.isArray(json) ? json[0] : json;
  return {
    yearMonth: payload?.year_month,
    previousMonth: payload?.previous_month,
    holdings: payload?.portfolio_performance?.holdings || [],
    holdingsSummary: payload?.portfolio_performance?.summary || {},
    monthlyPerformance: payload?.monthly_performance?.performance || [],
    monthlyPerformanceTotals: payload?.monthly_performance?.totals || {},
    currentMonthlyPnl: payload?.monthly_ledger || null,
    dividendsList: payload?.dividends?.dividends || [],
    totalDividends: payload?.dividends?.total_dividends || 0,
    allMonthlyPnl: payload?.all_monthly_pnl || [],
    raw: payload,
  };
}

export default function Home() {
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);
  const [data, setData] = useState({});

  const [open, setOpen] = useState({
    holdings: true,
    performance: true,
    dividends: true,
    pnlCurrent: true,
    pnlAll: false,
    raw: false,
  });

  const StockPriceIcon = ({ size = 18, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></svg>
  );
  const TransactionIcon = ({ size = 18, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3" /><line x1="7" y1="8" x2="17" y2="8" /><line x1="7" y1="12" x2="17" y2="12" /><line x1="7" y1="16" x2="12" y2="16" /></svg>
  );
  const DividendIcon = ({ size = 18, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6" /><path d="M2.5 22v-6h6" /><path d="M2.5 11.5A9.96 9.96 0 0 1 6.68 5.64a10 10 0 0 1 11.64-1.05L21.5 8" /><path d="M21.5 12.5a9.96 9.96 0 0 1-4.18 5.86 10 10 0 0 1-11.64 1.05L2.5 16" /></svg>
  );
  const LedgerIcon = ({ size = 18, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /><line x1="8" y1="7" x2="16" y2="7" /><line x1="8" y1="11" x2="14" y2="11" /></svg>
  );

  const fetchReport = async (signal) => {
    // ─── Check cache first ───
    const cached = getCache(CACHE_KEY);
    if (cached) {
      console.log("✅ Using cached data (expires in <2 min)");
      setData(cached);
      setStatus("success");
      return;
    }

    // ─── Fetch from API ───
    setStatus("loading");
    try {
      const res = await fetch(ENDPOINTS.CONSOLIDATED_MONTHLY_REPORT, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const parsed = parsePayload(json);

      // ─── Store in cache for 2 minutes ───
      setCache(CACHE_KEY, parsed, CACHE_TTL);
      console.log("✅ Fetched from API & cached for 2 minutes");

      setData(parsed);
      setStatus("success");
    } catch (err) {
      if (err.name === "AbortError") return;
      setError(err);
      setStatus("error");
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchReport(controller.signal);
    return () => controller.abort();
  }, []);

  // Manual refresh — bust the cache
  const handleRefresh = () => {
    clearCache(CACHE_KEY);
    fetchReport();
  };

  // ─── Derived data ───
  const holdingsRows = useMemo(() => {
    return [...(data.holdings || [])].sort(
      (a, b) => (b.total_invested || 0) - (a.total_invested || 0)
    );
  }, [data.holdings]);

  const pnlAllRows = useMemo(() => {
    return [...(data.allMonthlyPnl || [])].sort((a, b) =>
      String(b.year_month || "").localeCompare(String(a.year_month || ""))
    );
  }, [data.allMonthlyPnl]);

  const pnlAllFirstRow = pnlAllRows?.[0] || null;

  // ─── Icon colors ───
  const COLORS = {
    stockPrice: "#2563eb",
    transactions: "#7c3aed",
    dividends: "#d97706",
    ledger: "#16a34a",
  };

  return (
    <div className="page">
      {/* TOP BAR */}
      <div className="topBar">
        <div>
          <h1 className="title">Personal Finance</h1>
          <div className="subTitle">
            {data.yearMonth ? (
              <>
                <Badge tone="neutral">Month: {data.yearMonth}</Badge>{" "}
                {data.previousMonth ? (
                  <span className="muted">Prev: {data.previousMonth}</span>
                ) : null}
              </>
            ) : (
              <span className="muted">Monthly report</span>
            )}
          </div>
        </div>

        <div className="actions">
          <button
            className="btn btn-primary"
            type="button"
            onClick={handleRefresh}
            disabled={status === "loading"}
          >
            {status === "loading" ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* ERROR */}
      {status === "error" ? (
        <div className="alert alert-error">
          <div className="alertTitle">API error</div>
          <div className="alertBody">{error?.message || String(error)}</div>
        </div>
      ) : null}

      {/* ════════════════════════════════════════════════════
          PORTFOLIO HOLDINGS  +  Stock Prices icon
         ════════════════════════════════════════════════════ */}
      <Section
        title="Portfolio Holdings"
        open={open.holdings}
        onToggle={() => setOpen((s) => ({ ...s, holdings: !s.holdings }))}
        right={
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {data.holdingsSummary &&
              Object.keys(data.holdingsSummary).length > 0 && (
                <div
                  className={`badge badge-${
                    (data.holdingsSummary.total_gain_loss_amount || 0) >= 0
                      ? "good"
                      : "bad"
                  }`}
                  style={{
                    fontSize: "1.15rem",
                    padding: "6px 16px",
                    borderWidth: "2px",
                    boxShadow: "0 4px 6px rgba(0,0,0,0.08)",
                    letterSpacing: "0.5px",
                  }}
                >
                  Net diff: {money(data.holdingsSummary.total_gain_loss_amount)}
                </div>
              )}
            <IconPill
              to="/stock-retrieval"
              label="Stock Prices"
              color={COLORS.stockPrice}
              icon={<StockPriceIcon color={COLORS.stockPrice} />}
            />
          </div>
        }
      >
        {data.holdingsSummary &&
        Object.keys(data.holdingsSummary).length > 0 ? (
          <div className="summaryRow">
            <div>
              <div className="muted">Total Invested</div>
              <div className="big">
                {money(data.holdingsSummary.total_invested)}
              </div>
            </div>
            <div>
              <div className="muted">Current Value</div>
              <div className="big">
                {money(data.holdingsSummary.total_current_value)}
              </div>
            </div>
            <div>
              <div className="muted">Gain/Loss</div>
              <div
                className={`big ${
                  (data.holdingsSummary.total_gain_loss_amount || 0) >= 0
                    ? "pos"
                    : "neg"
                }`}
              >
                {money(data.holdingsSummary.total_gain_loss_amount)} (
                {formatPct(data.holdingsSummary.total_gain_loss_percentage)})
              </div>
            </div>
          </div>
        ) : null}

        <Table
          keyFn={(r) => r.symbol}
          columns={[
            { key: "symbol", header: "Symbol", cell: (r) => r.symbol || "—" },
            { key: "name", header: "Name", cell: (r) => r.shortName_en || "—" },
            { key: "qty", header: "Qty", cell: (r) => formatInt(r.quantity) },
            {
              key: "avg",
              header: "Avg Price",
              cell: (r) => formatNumber(r.avg_price, { decimals: 2 }),
            },
            {
              key: "cur",
              header: "Current Price",
              cell: (r) => formatNumber(r.current_price, { decimals: 2 }),
            },
            {
              key: "invested",
              header: "Invested",
              cell: (r) => money(r.total_invested),
            },
            {
              key: "value",
              header: "Current Value",
              cell: (r) => money(r.current_value),
            },
            {
              key: "gl",
              header: "G/L",
              cell: (r) => (
                <span
                  className={
                    (r.gain_loss_amount || 0) >= 0 ? "pos" : "neg"
                  }
                >
                  {money(r.gain_loss_amount)} (
                  {formatPct(r.gain_loss_percentage)})
                </span>
              ),
            },
          ]}
          rows={holdingsRows}
        />
      </Section>

      {/* ════════════════════════════════════════════════════
          CURRENT MONTH STOCK PERFORMANCE  +  Transactions icon
         ════════════════════════════════════════════════════ */}
      <Section
        title="Current Month Stock Performance"
        open={open.performance}
        onToggle={() =>
          setOpen((s) => ({ ...s, performance: !s.performance }))
        }
        right={
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {data.monthlyPerformanceTotals &&
              Object.keys(data.monthlyPerformanceTotals).length > 0 && (
                <div
                  className={`badge badge-${
                    (data.monthlyPerformanceTotals.total_net_diff || 0) >= 0
                      ? "good"
                      : "bad"
                  }`}
                  style={{
                    fontSize: "1.15rem",
                    padding: "6px 16px",
                    borderWidth: "2px",
                    boxShadow: "0 4px 6px rgba(0,0,0,0.08)",
                    letterSpacing: "0.5px",
                  }}
                >
                  Net diff:{" "}
                  {money(data.monthlyPerformanceTotals.total_net_diff)}
                </div>
              )}
            <IconPill
              to="/transactions"
              label="Transactions"
              color={COLORS.transactions}
              icon={<TransactionIcon color={COLORS.transactions} />}
            />
          </div>
        }
      >
        {data.monthlyPerformanceTotals &&
        Object.keys(data.monthlyPerformanceTotals).length > 0 ? (
          <div className="summaryRow">
            <div>
              <div className="muted">Start Value</div>
              <div className="big">
                {money(data.monthlyPerformanceTotals.total_start_value)}
              </div>
            </div>
            <div>
              <div className="muted">Current Value</div>
              <div className="big">
                {money(data.monthlyPerformanceTotals.total_current_value)}
              </div>
            </div>
            <div>
              <div className="muted">Realized G/L</div>
              <div
                className={`big ${
                  (data.monthlyPerformanceTotals.total_realized_gl || 0) >= 0
                    ? "pos"
                    : "neg"
                }`}
              >
                {money(data.monthlyPerformanceTotals.total_realized_gl)}
              </div>
            </div>
          </div>
        ) : null}

        <Table
          keyFn={(r) => r.symbol}
          columns={[
            { key: "symbol", header: "Symbol", cell: (r) => r.symbol || "—" },
            {
              key: "sq",
              header: "Start Qty",
              cell: (r) => formatInt(r.start_qty),
            },
            {
              key: "sv",
              header: "Start Value",
              cell: (r) => money(r.start_value),
            },
            {
              key: "sp",
              header: "Start Price",
              cell: (r) => formatNumber(r.start_price, { decimals: 2 }),
            },
            {
              key: "aq",
              header: "Adjusted Qty",
              cell: (r) => formatInt(r.adjusted_qty),
            },
            {
              key: "cp",
              header: "Current Price",
              cell: (r) => formatNumber(r.current_price, { decimals: 2 }),
            },
            {
              key: "cv",
              header: "Current Value",
              cell: (r) => money(r.current_value),
            },
            {
              key: "rg",
              header: "Realized G/L",
              cell: (r) => (
                <span className={(r.realized_gl || 0) >= 0 ? "pos" : "neg"}>
                  {money(r.realized_gl)}
                </span>
              ),
            },
            {
              key: "diff",
              header: "Month Net Diff",
              cell: (r) => (
                <span
                  className={(r.month_net_diff || 0) >= 0 ? "pos" : "neg"}
                >
                  {money(r.month_net_diff)}
                </span>
              ),
            },
          ]}
          rows={data.monthlyPerformance || []}
        />
      </Section>

      {/* ════════════════════════════════════════════════════
          CURRENT MONTH DIVIDENDS  +  Dividends icon
         ════════════════════════════════════════════════════ */}
      <Section
        title="Current Month Dividends"
        open={open.dividends}
        onToggle={() => setOpen((s) => ({ ...s, dividends: !s.dividends }))}
        right={
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {data.totalDividends ? (
              <div
                className={`badge badge-${
                  (data.totalDividends || 0) >= 0 ? "good" : "bad"
                }`}
                style={{
                  fontSize: "1.15rem",
                  padding: "6px 16px",
                  borderWidth: "2px",
                  boxShadow: "0 4px 6px rgba(0,0,0,0.08)",
                  letterSpacing: "0.5px",
                }}
              >
                Total Dividends: {money(data.totalDividends)}
              </div>
            ) : null}
            <IconPill
              to="/dividends"
              label="Dividends"
              color={COLORS.dividends}
              icon={<DividendIcon color={COLORS.dividends} />}
            />
          </div>
        }
      >
        <Table
          keyFn={(r, idx) => r.symbol || idx}
          columns={[
            { key: "symbol", header: "Symbol", cell: (r) => r.symbol || "—" },
            {
              key: "quantity",
              header: "Quantity",
              cell: (r) => formatInt(r.quantity),
            },
            {
              key: "aps",
              header: "Amount / Share",
              cell: (r) => formatNumber(r.amount_per_share, { decimals: 4 }),
            },
            {
              key: "date",
              header: "Payment Date",
              cell: (r) => r.payment_date || "—",
            },
            {
              key: "amount",
              header: "Dividend Amount",
              cell: (r) => (
                <span className="pos">{money(r.divident_amount)}</span>
              ),
            },
          ]}
          rows={data.dividendsList || []}
        />
      </Section>

      {/* ════════════════════════════════════════════════════
          CURRENT MONTH P&L  +  Ledger icon
         ════════════════════════════════════════════════════ */}
      <Section
        title="Current Month Profit & Loss"
        open={open.pnlCurrent}
        onToggle={() =>
          setOpen((s) => ({ ...s, pnlCurrent: !s.pnlCurrent }))
        }
        right={
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {pnlAllFirstRow && (
              <div
                className={`badge badge-${
                  (pnlAllFirstRow.monthly_gl || 0) >= 0 ? "good" : "bad"
                }`}
                style={{
                  fontSize: "1.15rem",
                  padding: "6px 16px",
                  borderWidth: "2px",
                  boxShadow: "0 4px 6px rgba(0,0,0,0.08)",
                  letterSpacing: "0.5px",
                }}
              >
                Monthly G/L: {money(pnlAllFirstRow.monthly_gl)}
              </div>
            )}
            <IconPill
              to="/ledger"
              label="Ledger"
              color={COLORS.ledger}
              icon={<LedgerIcon color={COLORS.ledger} />}
            />
          </div>
        }
      >
        {pnlAllFirstRow ? (
          <div className="kpiGrid">
            <div className="kpi">
              <div className="muted">Open</div>
              <div className="big">{money(pnlAllFirstRow.open_bal)}</div>
            </div>
            <div className="kpi">
              <div className="muted">Income</div>
              <div className="big pos">{money(pnlAllFirstRow.income)}</div>
            </div>
            <div className="kpi">
              <div className="muted">Expenses</div>
              <div className="big neg">{money(pnlAllFirstRow.expenses)}</div>
            </div>
            <div className="kpi">
              <div className="muted">Stock P&amp;L</div>
              <div
                className={`big ${
                  (pnlAllFirstRow.stock_pnl || 0) >= 0 ? "pos" : "neg"
                }`}
              >
                {money(pnlAllFirstRow.stock_pnl)}
              </div>
            </div>
            <div className="kpi">
              <div className="muted">Dividend</div>
              <div className="big pos">{money(pnlAllFirstRow.dividend)}</div>
            </div>
            <div className="kpi">
              <div className="muted">Close</div>
              <div className="big">{money(pnlAllFirstRow.close_bal)}</div>
            </div>
          </div>
        ) : (
          <div className="muted">No pnl rows returned.</div>
        )}
      </Section>

      {/* ALL MONTHS P&L */}
      <Section
        title="All Months Profit & Loss"
        open={open.pnlAll}
        onToggle={() => setOpen((s) => ({ ...s, pnlAll: !s.pnlAll }))}
        right={
          <Badge tone="neutral">Rows: {formatInt(pnlAllRows.length)}</Badge>
        }
      >
        <Table
          keyFn={(r) => r.year_month}
          columns={[
            { key: "ym", header: "Month", cell: (r) => r.year_month || "—" },
            { key: "open", header: "Open", cell: (r) => money(r.open_bal) },
            { key: "income", header: "Income", cell: (r) => money(r.income) },
            {
              key: "exp",
              header: "Expenses",
              cell: (r) => money(r.expenses),
            },
            {
              key: "stock",
              header: "Stock P&L",
              cell: (r) => money(r.stock_pnl),
            },
            { key: "div", header: "Dividend", cell: (r) => money(r.dividend) },
            {
              key: "gl",
              header: "Monthly G/L",
              cell: (r) => (
                <span className={(r.monthly_gl || 0) >= 0 ? "pos" : "neg"}>
                  {money(r.monthly_gl)}
                </span>
              ),
            },
            { key: "close", header: "Close", cell: (r) => money(r.close_bal) },
          ]}
          rows={pnlAllRows}
        />
      </Section>

      {/* RAW DEBUG */}
      <Section
        title="Raw API Response (debug)"
        open={open.raw}
        onToggle={() => setOpen((s) => ({ ...s, raw: !s.raw }))}
      >
        <pre className="code">{JSON.stringify(data.raw, null, 2)}</pre>
      </Section>
    </div>
  );
}