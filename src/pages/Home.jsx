import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchMonthlyPnlFrom202303 } from "../lib/pnlApi";
import { currentYearMonth } from "../lib/months";

function fmtCurrencyRoundUp(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  const n = Number(value);

  // round UP to nearest dollar:
  // +123.1 -> 124, -123.1 -> -123 (i.e., toward +infinity)
  const roundedUp = Math.ceil(n);

  const abs = Math.abs(roundedUp).toLocaleString("en-US", {
    maximumFractionDigits: 0,
  });

  const sign = roundedUp < 0 ? "-" : "";
  return `${sign}$${abs}`;
}

function sortDescByYearMonth(rows) {
  return [...rows].sort((a, b) =>
    String(b.year_month).localeCompare(String(a.year_month))
  );
}

function yearFromYm(ym) {
  return Number(String(ym).slice(0, 4));
}

export default function Home() {
  // today is 2026-08 (per your environment), but compute dynamically
  const todayYm = useMemo(() => currentYearMonth(), []);
  const currentYear = useMemo(() => yearFromYm(todayYm), [todayYm]);

  // Dropdown should show: 2026, 2025, 2024, 2023
  // (derived from current year down to 2023)
  const yearOptions = useMemo(() => {
    const minYear = 2023;
    const years = [];
    for (let y = currentYear; y >= minYear; y -= 1) years.push(y);
    return years;
  }, [currentYear]);

  // Default to show 2025
  const [selectedYear, setSelectedYear] = useState(2025);

  // Responsive smaller font state
  const [baseFontSize, setBaseFontSize] = useState(13); // Start with smaller text

  // History state
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [allRows, setAllRows] = useState([]);

  // Portfolio state
  const [portfolioHoldings, setPortfolioHoldings] = useState([]);
  const [portfolioSummary, setPortfolioSummary] = useState(null);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [portfolioErr, setPortfolioErr] = useState("");

  // Fetch History data
  useEffect(() => {
    let isMounted = true;
    async function fetchHistory() {
      setLoading(true);
      setErr("");
      try {
        const rows = await fetchMonthlyPnlFrom202303();
        if (isMounted) setAllRows(rows || []);
      } catch (error) {
        if (isMounted) setErr(error?.message || "Failed to load history");
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    fetchHistory();
    return () => { isMounted = false; };
  }, []);

  // Fetch portfolio data
  useEffect(() => {
    const controller = new AbortController();

    async function fetchPortfolio() {
      setPortfolioLoading(true);
      setPortfolioErr("");
      try {
        const res = await fetch("https://z35lnmmzgi.execute-api.ap-east-1.amazonaws.com/prod/portfolio-performance", {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("Failed to load portfolio");
        const data = await res.json();
        
        let parsedHoldings = [];
        let parsedSummary = null;
        let parsedStockInfo = {};

        // Handle various API Gateway response formats
        if (Array.isArray(data) && data.length > 0) {
          if (data[0].holdings) {
            parsedHoldings = data[0].holdings;
            parsedSummary = data[0].summary || null;
            parsedStockInfo = data[0].stock_info || data[0].stock_data || {};
          } else {
            parsedHoldings = data;
          }
        } else if (data.body) {
          const bodyData = typeof data.body === 'string' ? JSON.parse(data.body) : data.body;
          parsedHoldings = Array.isArray(bodyData) ? bodyData : (bodyData.holdings || bodyData.portfolio || []);
          parsedSummary = bodyData.summary || null;
          parsedStockInfo = bodyData.stock_info || bodyData.stock_data || {};
        } else if (data.holdings) {
          parsedHoldings = data.holdings;
          parsedSummary = data.summary || null;
          parsedStockInfo = data.stock_info || data.stock_data || {};
        }

        // Merge extra stock info dictionary (like shortName_en) into holdings if it exists
        if (Object.keys(parsedStockInfo).length > 0) {
          parsedHoldings = parsedHoldings.map((h) => {
            const sym = h.symbol || h.ticker;
            return { ...h, ...(parsedStockInfo[sym] || {}) };
          });
        }

        setPortfolioHoldings(Array.isArray(parsedHoldings) ? parsedHoldings : []);
        setPortfolioSummary(parsedSummary);
      } catch (e) {
        if (e?.name === "AbortError") return;
        setPortfolioErr(e?.message || "Failed to load portfolio");
      } finally {
        setPortfolioLoading(false);
      }
    }

    fetchPortfolio();
    return () => controller.abort();
  }, []); 

  // Filter from selected year up to today's month
  const filteredRows = useMemo(() => {
    return allRows.filter((row) => {
      const rowYear = yearFromYm(row.year_month);
      const isAfterOrEqualSelectedYear = rowYear >= selectedYear;
      const isBeforeOrEqualToday = String(row.year_month).localeCompare(String(todayYm)) <= 0;
      return isAfterOrEqualSelectedYear && isBeforeOrEqualToday;
    });
  }, [allRows, selectedYear, todayYm]);

  return (
    <div className="pageContainer" style={{ transition: "all 0.2s" }}>
      <style>{`
        /* Overriding App.css to actually scale font up and down properly */
        .pageContainer,
        .pageContainer .table th, 
        .pageContainer .table td, 
        .pageContainer .inlineLabel,
        .pageContainer .emptyCell,
        .pageContainer select { 
          font-size: ${baseFontSize}px !important; 
        }
        .pageContainer .sectionTitle { font-size: ${baseFontSize + 3}px !important; }
        .pageContainer .cardTitle { font-size: ${baseFontSize + 5}px !important; }
      `}</style>
      
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "10px", gap: "8px" }}>
        <button 
          onClick={() => setBaseFontSize((s) => Math.max(9, s - 2))} 
          style={{ padding: "4px 12px", cursor: "pointer", borderRadius: "4px", border: "1px solid #ccc", fontSize: "14px" }}
        >
          A-
        </button>
        <button 
          onClick={() => setBaseFontSize((s) => Math.min(24, s + 2))} 
          style={{ padding: "4px 12px", cursor: "pointer", borderRadius: "4px", border: "1px solid #ccc", fontSize: "14px" }}
        >
          A+
        </button>
      </div>
      <main>
        {/* Portfolio section */}
        <section className="card">
          <h3 className="sectionTitle">Holdings</h3>
          {portfolioLoading ? (
            <div className="note">Loading portfolio…</div>
          ) : portfolioErr ? (
            <div className="errorBox">
              <div className="errorTitle">Couldn’t load portfolio</div>
              <div className="errorMsg">{portfolioErr}</div>
            </div>
          ) : (
            <div className="tableWrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Ticker</th>
                    <th>Name</th>
                    <th className="num">Shares</th>
                    <th className="num">Avg Cost</th>
                    <th className="num">Last Price</th>
                    <th className="num">Market Value</th>
                    <th className="num">Unrealized P/L</th>
                  </tr>
                </thead>
                <tbody>
                {portfolioHoldings.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="emptyCell">
                          No holdings yet. Use{" "}
                          <Link to="/stock-retrieval">Stock Retrieval</Link> to fetch prices.
                        </td>
                      </tr>
                    ) : (
                      <>
                        {portfolioHoldings.map((h, i) => {
                          const unrealizedPnl = Number(h.gain_loss_amount || h.unrealized_pnl || h.unrealizedPnl || 0);
                          const shares = Number(h.quantity || h.shares || 0);
                          const avgCost = Number(h.avg_price || h.avg_cost || h.avgCost || 0);
                          const lastPrice = Number(h.current_price || h.last_price || h.lastPrice || h.price || 0);
                          const marketValue = Number(h.current_value || h.market_value || h.marketValue || 0);
                          
                          // Correctly pull shortName_en if provided, else fallback
                          const name = h.shortName_en || h.longName_en || h.name || "—";
                          return (
                            <tr key={h.symbol || h.ticker || i}>
                              <td>{h.symbol || h.ticker || "—"}</td>
                              <td>{name}</td>
                              <td className="num">{shares > 0 ? shares : "—"}</td>
                              <td className="num">{fmtCurrencyRoundUp(avgCost)}</td>
                              <td className="num">{fmtCurrencyRoundUp(lastPrice)}</td>
                              <td className="num">{fmtCurrencyRoundUp(marketValue)}</td>
                              <td className="num">
                                <span className={unrealizedPnl >= 0 ? "pos" : "neg"}>
                                  {fmtCurrencyRoundUp(unrealizedPnl)}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                        
                        {/* Summary totals in the last row */}
                        {portfolioSummary && (
                          <tr style={{ background: "#e2e8f0", fontWeight: "800" }}>
                            <td colSpan="3" style={{ textAlign: "right" }}>Portfolio Totals:</td>
                            
                            {/* Total Invested roughly aligns under Avg Cost */}
                            <td className="num">{fmtCurrencyRoundUp(portfolioSummary.total_invested)}</td>
                            
                            {/* Empty space under Last Price */}
                            <td className="num"></td>
                            
                            {/* Total Current Value aligns under Market Value */}
                            <td className="num">{fmtCurrencyRoundUp(portfolioSummary.total_current_value)}</td>
                            
                            {/* Total Gain/Loss aligns under Unrealized P/L */}
                            <td className="num">
                              <span className={Number(portfolioSummary.total_gain_loss_amount) >= 0 ? "pos" : "neg"}>
                                {fmtCurrencyRoundUp(portfolioSummary.total_gain_loss_amount)}
                              </span>
                            </td>
                          </tr>
                        )}
                      </>
                    )}
                  </tbody>
                </table>
            </div>
          )}
        </section>

        {/* History section */}
        <section className="card">
          <div className="cardHeader">
            <h2 className="cardTitle">History (Monthly P&amp;L)</h2>
            <div className="spacer" />

            <label className="inlineControl">
              <span className="inlineLabel">From Year</span>
              <select
                className="select"
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {loading ? (
            <div className="note">Loading…</div>
          ) : err ? (
            <div className="errorBox">
              <div className="errorTitle">Couldn’t load history</div>
              <div className="errorMsg">{err}</div>
            </div>
          ) : (
            <div className="tableWrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Year-Month</th>
                    <th className="num">Open</th>
                    <th className="num">Income</th>
                    <th className="num">Expenses</th>
                    <th className="num">Stock P/L</th>
                    <th className="num">Dividend</th>
                    <th className="num">Monthly G/L</th>
                    <th className="num">Close</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="emptyCell">
                        No rows found from {selectedYear} to {todayYm}.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((r) => {
                      const gl = Number(r.monthly_gl);
                      return (
                        <tr key={`${r.year_month}`}>
                          <td>{r.year_month}</td>
                          <td className="num">{fmtCurrencyRoundUp(r.open_bal)}</td>
                          <td className="num">{fmtCurrencyRoundUp(r.income)}</td>
                          <td className="num">{fmtCurrencyRoundUp(r.expenses)}</td>
                          <td className="num">{fmtCurrencyRoundUp(r.stock_pnl)}</td>
                          <td className="num">{fmtCurrencyRoundUp(r.dividend)}</td>
                          <td className="num">
                            <span className={gl >= 0 ? "pos" : "neg"}>
                              {fmtCurrencyRoundUp(gl)}
                            </span>
                          </td>
                          <td className="num">{fmtCurrencyRoundUp(r.close_bal)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}