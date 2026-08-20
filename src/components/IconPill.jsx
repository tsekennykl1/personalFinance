import React from "react";
import { Link } from "react-router-dom";

export default function IconPill({ to, label, color, icon }) {
  return (
    <Link
      to={to}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 14px",
        borderRadius: 999,
        border: `2px solid ${color}`,
        background: "#fff",
        color: color,
        fontWeight: 800,
        fontSize: 13,
        textDecoration: "none",
        transition: "background 0.15s, transform 0.1s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = `${color}10`;
        e.currentTarget.style.transform = "scale(1.03)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "#fff";
        e.currentTarget.style.transform = "scale(1)";
      }}
    >
      {icon}
      {label}
    </Link>
  );
}