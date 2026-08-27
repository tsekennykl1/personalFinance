export const API_BASE = "https://z35lnmmzgi.execute-api.ap-east-1.amazonaws.com/prod";
export const API_BASE_JAVA = "https://s3s78soeq5.execute-api.ap-east-1.amazonaws.com/Prod";

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