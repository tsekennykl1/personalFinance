import React, { useMemo, useState, useEffect } from "react";
import "./Home.css";

function formatNumber(n, { decimals = 2 } = {}) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  return Number(n).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatInt(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  return Number(n).toLocaleString();
}

function formatPct(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  return `${formatNumber(n, { decimals: 2 })}%`;
}

function money(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  const sign = Number(n) < 0 ? "-" : "";
  const abs = Math.abs(Number(n));
  return `${sign}${abs.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function Badge({ children, tone = "neutral" }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

function Section({ title, open, onToggle, right, children }) {
  return (
    <section className="card">
      <header className="cardHeader">
        <div className="cardHeaderLeft">
          <button className="btn" type="button" onClick={onToggle}>
            {open ? "Hide" : "Show"}
          </button>
          <h2 className="cardTitle">{title}</h2>
        </div>
        {right ? <div className="cardHeaderRight">{right}</div> : null}
      </header>
      {open ? <div className="cardBody">{children}</div> : null}
    </section>
  );
}

function Table({ columns, rows, keyFn }) {
  return (
    <div className="tableWrap">
      <table className="table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="muted" colSpan={columns.length}>
                No data
              </td>
            </tr>
          ) : (
            rows.map((r, idx) => (
              <tr key={keyFn ? keyFn(r) : idx}>
                {columns.map((c) => (
                  <td key={c.key}>{c.cell(r)}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
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

  const fetchReport = async () => {
    setStatus("loading");
    try {
      const res = await fetch("https://z35lnmmzgi.execute-api.ap-east-1.amazonaws.com/prod/lambda_consolidated_monthly_report");
      const json = await res.json();
      
      // Handle the array format response
      const payload = Array.isArray(json) ? json[0] : json;
      
      setData({
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
      });
      setStatus("success");
    } catch (err) {
      setError(err);
      setStatus("error");
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

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

  return (
    <div className="page">
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
            onClick={fetchReport}
            disabled={status === "loading"}
          >
            {status === "loading" ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {status === "error" ? (
        <div className="alert alert-error">
          <div className="alertTitle">API error</div>
          <div className="alertBody">{error?.message || String(error)}</div>
        </div>
      ) : null}

      <Section
        title="Portfolio Holdings"
        open={open.holdings}
        onToggle={() => setOpen((s) => ({ ...s, holdings: !s.holdings }))}

        right={
          data.holdingsSummary && Object.keys(data.holdingsSummary).length > 0 ? (
            <div 
              className={`badge badge-${(data.holdingsSummary.total_gain_loss_amount || 0) >= 0 ? "good" : "bad"}`}
              style={{ fontSize: "1.15rem", padding: "6px 16px", borderWidth: "2px", boxShadow: "0 4px 6px rgba(0,0,0,0.08)", letterSpacing: "0.5px" }}
            >
              Net diff: {money(data.holdingsSummary.total_gain_loss_amount)}
            </div>
          ) : null
        }
      >
        {data.holdingsSummary && Object.keys(data.holdingsSummary).length > 0 ? (
          <div className="summaryRow">
            <div>
              <div className="muted">Total Invested</div>
              <div className="big">{money(data.holdingsSummary.total_invested)}</div>
            </div>
            <div>
              <div className="muted">Current Value</div>
              <div className="big">{money(data.holdingsSummary.total_current_value)}</div>
            </div>
            <div>
              <div className="muted">Gain/Loss</div>
              <div className={`big ${(data.holdingsSummary.total_gain_loss_amount || 0) >= 0 ? "pos" : "neg"}`}>
                {money(data.holdingsSummary.total_gain_loss_amount)} ({formatPct(data.holdingsSummary.total_gain_loss_percentage)})
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
            { key: "avg", header: "Avg Price", cell: (r) => formatNumber(r.avg_price, { decimals: 2 }) },
            { key: "cur", header: "Current Price", cell: (r) => formatNumber(r.current_price, { decimals: 2 }) },
            { key: "invested", header: "Invested", cell: (r) => money(r.total_invested) },
            { key: "value", header: "Current Value", cell: (r) => money(r.current_value) },
            { key: "gl", header: "G/L", cell: (r) => (
                <span className={(r.gain_loss_amount || 0) >= 0 ? "pos" : "neg"}>
                  {money(r.gain_loss_amount)} ({formatPct(r.gain_loss_percentage)})
                </span>
              ),
            },
          ]}
          rows={holdingsRows}
        />
      </Section>

      <Section
        title="Current Month Stock Performance"
        open={open.performance}
        onToggle={() => setOpen((s) => ({ ...s, performance: !s.performance }))}
        right={
          data.monthlyPerformanceTotals && Object.keys(data.monthlyPerformanceTotals).length > 0 ? (
            <div 
              className={`badge badge-${(data.monthlyPerformanceTotals.total_net_diff || 0) >= 0 ? "good" : "bad"}`}
              style={{ fontSize: "1.15rem", padding: "6px 16px", borderWidth: "2px", boxShadow: "0 4px 6px rgba(0,0,0,0.08)", letterSpacing: "0.5px" }}
            >
              Net diff: {money(data.monthlyPerformanceTotals.total_net_diff)}
            </div>
          ) : null
        }
      >
        {data.monthlyPerformanceTotals && Object.keys(data.monthlyPerformanceTotals).length > 0 ? (
          <div className="summaryRow">
            <div><div className="muted">Start Value</div><div className="big">{money(data.monthlyPerformanceTotals.total_start_value)}</div></div>
            <div><div className="muted">Current Value</div><div className="big">{money(data.monthlyPerformanceTotals.total_current_value)}</div></div>
            <div><div className="muted">Realized G/L</div>
              <div className={`big ${(data.monthlyPerformanceTotals.total_realized_gl || 0) >= 0 ? "pos" : "neg"}`}>
                {money(data.monthlyPerformanceTotals.total_realized_gl)}
              </div>
            </div>
          </div>
        ) : null}

        <Table
          keyFn={(r) => r.symbol}
          columns={[
            { key: "symbol", header: "Symbol", cell: (r) => r.symbol || "—" },
            { key: "sq", header: "Start Qty", cell: (r) => formatInt(r.start_qty) },
            { key: "sv", header: "Start Value", cell: (r) => money(r.start_value) },
            { key: "sp", header: "Start Price", cell: (r) => formatNumber(r.start_price, { decimals: 2 }) },
            { key: "aq", header: "Adjusted Qty", cell: (r) => formatInt(r.adjusted_qty) },
            { key: "cp", header: "Current Price", cell: (r) => formatNumber(r.current_price, { decimals: 2 }) },
            { key: "cv", header: "Current Value", cell: (r) => money(r.current_value) },
            { key: "rg", header: "Realized G/L", cell: (r) => <span className={(r.realized_gl || 0) >= 0 ? "pos" : "neg"}>{money(r.realized_gl)}</span> },
            { key: "diff", header: "Month Net Diff", cell: (r) => <span className={(r.month_net_diff || 0) >= 0 ? "pos" : "neg"}>{money(r.month_net_diff)}</span> },
          ]}
          rows={data.monthlyPerformance || []}
        />
      </Section>

      <Section
        title="Current Month Dividends"
        open={open.dividends}
        onToggle={() => setOpen((s) => ({ ...s, dividends: !s.dividends }))}

        right={
          data.totalDividends? (
            <div 
              className={`badge badge-${(data.totalDividends || 0) >= 0 ? "good" : "bad"}`}
              style={{ fontSize: "1.15rem", padding: "6px 16px", borderWidth: "2px", boxShadow: "0 4px 6px rgba(0,0,0,0.08)", letterSpacing: "0.5px" }}
            >
              Total Dividends: {money(data.totalDividends)}
            </div>
          ) : null
        }
      >
        <Table
          keyFn={(r, idx) => r.symbol || idx}
          columns={[
            { key: "symbol", header: "Symbol", cell: (r) => r.symbol || "—" },
            { key: "quantity", header: "Quantity", cell: (r) => formatInt(r.quantity) },
            { key: "aps", header: "Amount / Share", cell: (r) => formatNumber(r.amount_per_share, { decimals: 4 }) },
            { key: "date", header: "Payment Date", cell: (r) => r.payment_date || "—" },
            { key: "amount", header: "Dividend Amount", cell: (r) => <span className="pos">{money(r.divident_amount)}</span> },
          ]}
          rows={data.dividendsList || []}
        />
      </Section>

      <Section
        title="Current Month Profit & Loss"
        open={open.pnlCurrent}
        onToggle={() => setOpen((s) => ({ ...s, pnlCurrent: !s.pnlCurrent }))}
        right={
          pnlAllFirstRow ? (
            <div
              className={`badge badge-${(pnlAllFirstRow.monthly_gl || 0) >= 0 ? "good" : "bad"}`}
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
          ) : null
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
              <div className={`big ${(pnlAllFirstRow.stock_pnl || 0) >= 0 ? "pos" : "neg"}`}>
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

      <Section
        title="All Months Profit & Loss"
        open={open.pnlAll}
        onToggle={() => setOpen((s) => ({ ...s, pnlAll: !s.pnlAll }))}
        right={<Badge tone="neutral">Rows: {formatInt(pnlAllRows.length)}</Badge>}
      >
        <Table
          keyFn={(r) => r.year_month}
          columns={[
            { key: "ym", header: "Month", cell: (r) => r.year_month || "—" },
            { key: "open", header: "Open", cell: (r) => money(r.open_bal) },
            { key: "income", header: "Income", cell: (r) => money(r.income) },
            { key: "exp", header: "Expenses", cell: (r) => money(r.expenses) },
            { key: "stock", header: "Stock P&L", cell: (r) => money(r.stock_pnl) },
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