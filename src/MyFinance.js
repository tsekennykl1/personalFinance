import React from "react";
import { Link } from "react-router-dom";

export default function MyFinance() {
  return (
    <div style={styles.page}>
      <h1>My Finance</h1>
      <p>
        Personal Finance Management page (starter). Tell me what features you want
        and I’ll build them (income/expense form, categories, totals, charts, etc.).
      </p>

      <ul>
        <li>Add income and expense entries</li>
        <li>Monthly totals</li>
        <li>Category breakdown</li>
      </ul>

      <Link to="/" style={styles.back}>← Back to Home</Link>
    </div>
  );
}

const styles = {
  page: { fontFamily: "Arial, sans-serif", padding: 24 },
  back: { color: "#2563eb", fontWeight: 700, textDecoration: "none" },
};