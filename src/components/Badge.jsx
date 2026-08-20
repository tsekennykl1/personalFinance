import React from "react";

/**
 * Small pill badge for status/value indicators.
 * @param {string} tone - "neutral" | "good" | "bad"
 */
export default function Badge({ children, tone = "neutral" }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}