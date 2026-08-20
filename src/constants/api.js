export const API_BASE = "https://z35lnmmzgi.execute-api.ap-east-1.amazonaws.com/prod";

export const ENDPOINTS = {
  CONSOLIDATED_MONTHLY_REPORT: `${API_BASE}/lambda_consolidated_monthly_report`,
  STOCK: `${API_BASE}/stock`,
  CRUD: `${API_BASE}/lambda_crud_handler`,  // ← Fixed!
};