import React from "react";
import { Link } from "react-router-dom";

export default function Home() {
  const sections = [
    {
      title: "Personal Finance Management",
      description: "Track income, expenses, categories, and monthly overview.",
      to: "/myFinance",
    },
    {
      title: "Stock Retrieval",
      description: "Look up stock info by symbol (placeholder UI for now).",
      to: "/stock-retrieval",
    },
    {
      title: "Budget Planner",
      description: "Create budgets and monitor progress.",
      to: "/budget-planner",
    },
    {
      title: "Debt Tracker",
      description: "Track loans, interest, payoff plans.",
      to: "/debt-tracker",
    },
    {
      title: "Savings Goals",
      description: "Set goals and track contributions.",
      to: "/savings-goals",
    },
    {
      title: "Reports & Insights",
      description: "Charts, trends, and summaries.",
      to: "/reports",
    },
  ];

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={{ margin: 0 }}>Home</h1>
        <p style={{ marginTop: 8, color: "#475569" }}>
          Select a tool to open its page.
        </p>
      </header>

      <main style={styles.grid}>
        {sections.map((s) => (
          <Link key={s.title} to={s.to} style={styles.card}>
            <h2 style={styles.cardTitle}>{s.title}</h2>
            <p style={styles.cardDesc}>{s.description}</p>
            <div style={styles.cardLink}>Open →</div>
          </Link>
        ))}
      </main>
    </div>
  );
}

const styles = {
  page: {
    fontFamily: "Arial, sans-serif",
    padding: 24,
    background: "#f8fafc",
    minHeight: "100vh",
  },
  header: {
    maxWidth: 1100,
    margin: "0 auto 18px auto",
  },
  grid: {
    maxWidth: 1100,
    margin: "0 auto",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 18,
  },
  card: {
    display: "block",
    textDecoration: "none",
    background: "white",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: 22,
    minHeight: 170, // big sections/cards
    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
    color: "#0f172a",
  },
  cardTitle: { margin: "0 0 10px 0", fontSize: 20 },
  cardDesc: { margin: "0 0 16px 0", color: "#475569", lineHeight: 1.4 },
  cardLink: { fontWeight: 700, color: "#2563eb" },
};