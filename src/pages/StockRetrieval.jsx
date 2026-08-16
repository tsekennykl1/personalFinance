import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";

export default function StockRetrieval() {
  const [stockCode, setStockCode] = useState("AAPL");
  const [rows, setRows] = useState([]);

  const columns = useMemo(
    () => [
      "Stock Code",
      "Short Name",
      "DataTime",
      "Price",
      "High",
      "Low",
      "Open",
      "Previous Close",
      "Volume",
    ],
    []
  );

  const handleGetStockData = () => {
    // TODO: Replace with real API call
    const now = new Date();
    const mockRow = {
      stockCode: stockCode.trim().toUpperCase(),
      shortName: "Mock Name",
      dateTime: now.toISOString(),
      price: 123.45,
      high: 125.0,
      low: 121.2,
      open: 122.0,
      previousClose: 120.8,
      volume: 9876543,
    };
    setRows([mockRow, ...rows]);
  };

  return (
    <div className="page">
      <header className="topbar">
        <h1 className="title">Stock (yfinance)</h1>
        <p className="subtitle">Stock Data retrieval</p>
      </header>

      <main className="container">
        <section className="card">
          <div className="cardHeader">
            <h2 className="cardTitle">Stock Data retrieval</h2>
            <div className="spacer" />
            <Link className="linkBtn" to="/">
              ← Portfolio
            </Link>
          </div>

          <div className="bigPlusRow" aria-label="Decorative plus row">
            <div className="plusBox">+</div>
            <div className="plusBox">+</div>
            <div className="plusBox">+</div>
            <div className="plusBox">+</div>
          </div>

          <div className="formRow">
            <label className="label">
              Stock Code
              <input
                className="input"
                value={stockCode}
                onChange={(e) => setStockCode(e.target.value)}
                placeholder="e.g., AAPL"
              />
            </label>

            <button className="primaryBtn" type="button" onClick={handleGetStockData}>
              Get Stock Data
            </button>
          </div>

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
                      No data yet. Go back to <Link to="/">Portfolio</Link>.
                    </td>
                  </tr>
                ) : (
                  rows.map((r, idx) => (
                    <tr key={`${r.stockCode}-${r.dateTime}-${idx}`}>
                      <td>{r.stockCode}</td>
                      <td>{r.shortName}</td>
                      <td>{r.dateTime}</td>
                      <td>{r.price}</td>
                      <td>{r.high}</td>
                      <td>{r.low}</td>
                      <td>{r.open}</td>
                      <td>{r.previousClose}</td>
                      <td>{r.volume}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}