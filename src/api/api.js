export const API_BASE = "https://z35lnmmzgi.execute-api.ap-east-1.amazonaws.com/prod";
export const API_BASE_JAVA = "https://7298nhfyc0.execute-api.ap-east-1.amazonaws.com/Prod";


// RESTful endpoints
export const ENDPOINTS = {
  // Reports (RESTful)
  REPORT: (yearMonth) => `${API_BASE_JAVA}/api/v1/reports/${yearMonth}`,
  REPORT_CURRENT: `${API_BASE_JAVA}/api/v1/reports`,
  REPORT_HOLDINGS: (yearMonth) => `${API_BASE_JAVA}/api/v1/reports/${yearMonth}/holdings`,
  REPORT_PERFORMANCE: (yearMonth) => `${API_BASE_JAVA}/api/v1/reports/${yearMonth}/performance`,
  REPORT_DIVIDENDS: (yearMonth) => `${API_BASE_JAVA}/api/v1/reports/${yearMonth}/dividends`,
  REPORT_PNL: (yearMonth) => `${API_BASE_JAVA}/api/v1/reports/${yearMonth}/pnl`,

  // Legacy / Other
  STOCK: `${API_BASE}/getStockData`,
  CRUD: `${API_BASE}/lambda_crud_handler`,
};

 // ─── Cache Helpers ───
 export function getSessionCache(key) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const { data, expiry } = JSON.parse(raw);
    if (Date.now() > expiry) {
      sessionStorage.removeItem(key);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function setSessionCache(key, data, ttl) {
  try {
    const entry = { data, expiry: Date.now() + ttl };
    sessionStorage.setItem(key, JSON.stringify(entry));
  } catch (e) {
    console.warn("sessionStorage write failed:", e);
  }
}

export function clearSessionCache(key) {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}


export const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

