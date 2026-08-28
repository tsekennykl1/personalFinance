import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ENDPOINTS } from "../api/api";
import { formatNumber } from "../utils/formatters";
import MOCK_STOCKS from "../data/mockStocks";

export default function StockRetrieval() {
  const [stockCode, setStockCode] = useState("0700.HK,0005.HK,1888.HK,2318.HK,0941.HK");
  const [stockData, setStockData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const columns = useMemo(
    () => [
      "Stock Code",
      "Short Name",
      "Price",
      "High",
      "Low",
      "Open",
      "Previous Close",
      "Volume",
      "Sector",
      "P/E Ratio",
    ],
    []
  );

  const handleGetStockData = async () => {
    setLoading(true);
    setError("");
    try {
      const url = `${ENDPOINTS.STOCK}?stocks=${encodeURIComponent(stockCode.trim())}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setStockData(json);
    } catch (err) {
      console.warn("Stock API failed, using mock data:", err.message);
      setStockData(MOCK_STOCKS);
      setError("Using cached data (API unreachable). Error: " + err.message);
    }
    setLoading(false);
  };

  const rows = stockData ? Object.entries(stockData) : [];

  return (
    <div className="page">
      <header className="topbar">
        <h1 className="title">Stock Retrieval (yfinance)</h1>
        <p className="subtitle">
          Fetch real-time stock data from the API
        </p>
      </header>

      <main className="container">
        <section className="card">
          <div className="cardHeader">
            <h2 className="cardTitle">Stock Data Retrieval</h2>
            <div className="spacer" />
            <Link className="linkBtn" to="/">
              ← Home
            </Link>
          </div>

          <div style={{ padding: 18 }}>
            <div className="formRow">
              <label className="label">
                Stock Codes (comma-separated)
                <input
                  className="input"
                  value={stockCode}
                  onChange={(e) => setStockCode(e.target.value)}
                  placeholder="e.g., 0700.HK,0005.HK"
                  style={{ width: "100%", maxWidth: 400 }}
                />
              </label>

              <button
                className="primaryBtn"
                type="button"
                onClick={handleGetStockData}
                disabled={loading}
              >
                {loading ? "Loading..." : "Get Stock Data"}
              </button>
            </div>

            {error && (
              <div className="errorBox" style={{ marginBottom: 14 }}>
                <div className="errorMsg">⚠️ {error}</div>
              </div>
            )}

            <h3 className="sectionTitle">Stock Data</h3>

            <div className="tableWrap">
              <table className="table">
                <thead>
                  <tr>
                    {columns.map((c) => (
                      <th key={c}>{c}</th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={columns.length} className="emptyCell">
                        No data yet. Enter stock codes and click "Get Stock
                        Data".
                      </td>
                    </tr>
                  ) : (
                    rows.map(([symbol, d]) => (
                      <tr key={symbol}>
                        <td style={{ fontWeight: 700, fontFamily: "monospace" }}>
                          {symbol}
                        </td>
                        <td>{d.shortName_en || "—"}</td>
                        <td className="num">{formatNumber(d.price)}</td>
                        <td className="num">{formatNumber(d.high)}</td>
                        <td className="num">{formatNumber(d.low)}</td>
                        <td className="num">{formatNumber(d.open)}</td>
                        <td className="num">{formatNumber(d.previousClose)}</td>
                        <td className="num">
                          {d.volume ? d.volume.toLocaleString() : "—"}
                        </td>
                        <td>{d.sector || "—"}</td>
                        <td className="num">{formatNumber(d.peRatio)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}