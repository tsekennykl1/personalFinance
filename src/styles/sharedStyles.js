/**
 * Shared inline style objects for page components.
 */

// ─── Color Palette ───
export const COLORS = {
  green: "#146c2e",
  greenLight: "#4a9960",
  red: "#b02020",
  redDark: "#8d1414",
  blue: "#1f4fff",
  muted: "#667",
  text: "#111",
  border: "#d2d7e6",
  tableBorder: "#eef0f6",
};

// ─── Dynamic value color ───
export function valueColor(val) {
  if (val == null || val === 0) return COLORS.text;
  return val >= 0 ? COLORS.green : COLORS.red;
}

// ─── Format helpers ───
export function fmtMoney(val) {
  if (val == null) return "$0";
  return `$${Math.round(parseFloat(val)).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

export function fmtInt(val) {
  if (val == null) return "0";
  return parseFloat(val).toLocaleString();
}

export function fmtPrice(val, decimals = 2) {
  if (val == null) return "-";
  return `$${parseFloat(val).toFixed(decimals)}`;
}

// ─── Strip .HK suffix ───
export function stripHKSuffix(symbol) {
  if (!symbol) return "";
  const s = String(symbol).trim();
  return s.toUpperCase().endsWith(".HK") ? s.slice(0, -3) : s;
}

// ─── Date Helpers ───
export function parseDateToISO(dateStr) {
  if (!dateStr) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr.slice(0, 10);
  const slashParts = dateStr.split("/");
  if (slashParts.length === 3) {
    const [day, month, year] = slashParts;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return "";
}

// ─── HK Symbol Validator ───
export function validateAndNormalizeHKSymbol(raw) {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    return { error: "Hong Kong symbol must contain only digits (e.g. 5, 700, 2628, 9988)" };
  }
  if (trimmed.length > 4) {
    return { error: "Hong Kong symbol must be at most 4 digits" };
  }
  const padded = trimmed.padStart(4, "0");
  return { symbol: padded };
}