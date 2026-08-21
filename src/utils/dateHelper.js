// utils/dateHelper.js (or add at top of each component file)
const parseDateToISO = (dateStr) => {
    if (!dateStr) return "";
    // Already ISO format: 2026-08-31 or 2026-08-31T...
    if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr.slice(0, 10);
    // D/M/YYYY or DD/MM/YYYY format (e.g. 31/8/2026)
    const slashParts = dateStr.split("/");
    if (slashParts.length === 3) {
      const [day, month, year] = slashParts;
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }
    // Try native Date parse as fallback
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }
    return "";
  };