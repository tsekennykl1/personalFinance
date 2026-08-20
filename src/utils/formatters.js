/**
 * Shared number/currency/percentage formatting utilities.
 */

export function formatNumber(n, { decimals = 2 } = {}) {
    if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
    return Number(n).toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }
  
  export function formatInt(n) {
    if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
    return Number(n).toLocaleString();
  }
  
  export function formatPct(n) {
    if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
    return `${formatNumber(n, { decimals: 2 })}%`;
  }
  
  export function money(n) {
    if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
    const sign = Number(n) < 0 ? "-" : "";
    const abs = Math.abs(Number(n));
    return `${sign}${abs.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }