export const API_BASE = "https://z35lnmmzgi.execute-api.ap-east-1.amazonaws.com/prod";
export const API_BASE_JAVA ="https://s3s78soeq5.execute-api.ap-east-1.amazonaws.com/Prod";

export const ENDPOINTS = {
  CONSOLIDATED_MONTHLY_REPORT: `${API_BASE_JAVA}/report`,
  STOCK: `${API_BASE}/getStockData`,
  CRUD: `${API_BASE}/lambda_crud_handler`,  // ← Fixed!
};