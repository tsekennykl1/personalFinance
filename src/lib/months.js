export function pad2(n) {
    return String(n).padStart(2, "0");
  }
  
  export function ymToLabel(ym) {
    // "2026-08" -> "Aug 2026"
    const [y, m] = ym.split("-").map((x) => Number(x));
    const d = new Date(y, m - 1, 1);
    return d.toLocaleString(undefined, { month: "short", year: "numeric" });
  }
  
  export function monthRangeInclusive(startYm, endYm) {
    const [sy, sm] = startYm.split("-").map(Number);
    const [ey, em] = endYm.split("-").map(Number);
  
    const out = [];
    let y = sy;
    let m = sm;
  
    while (y < ey || (y === ey && m <= em)) {
      out.push(`${y}-${pad2(m)}`);
      m += 1;
      if (m === 13) {
        m = 1;
        y += 1;
      }
    }
    return out;
  }
  
  export function currentYearMonth() {
    const d = new Date();
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    return `${y}-${pad2(m)}`;
  }