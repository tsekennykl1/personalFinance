// src/api/api.js
// ─── Central API configuration with optional Cognito auth ───

import { fetchAuthSession } from "aws-amplify/auth";

// ─── Auth Toggle ───
export const AUTH_ENABLED = import.meta.env.VITE_AUTH_ENABLED === "true";

// ─── Base URLs ───
export const API_BASE = "https://z35lnmmzgi.execute-api.ap-east-1.amazonaws.com/prod";
export const API_BASE_JAVA = "https://7298nhfyc0.execute-api.ap-east-1.amazonaws.com/Prod";

// ─── Endpoints ───
export const ENDPOINTS = {
  // Reports (Java API — protected by Cognito when security is ON)
  REPORT: (yearMonth) => `${API_BASE_JAVA}/api/v1/reports/${yearMonth}`,
  REPORT_CURRENT: `${API_BASE_JAVA}/api/v1/reports`,
  REPORT_HOLDINGS: (yearMonth) => `${API_BASE_JAVA}/api/v1/reports/${yearMonth}/holdings`,
  REPORT_PERFORMANCE: (yearMonth) => `${API_BASE_JAVA}/api/v1/reports/${yearMonth}/performance`,
  REPORT_DIVIDENDS: (yearMonth) => `${API_BASE_JAVA}/api/v1/reports/${yearMonth}/dividends`,
  REPORT_PNL: (yearMonth) => `${API_BASE_JAVA}/api/v1/reports/${yearMonth}/pnl`,

  // Legacy Python Lambda endpoints
  STOCK: `${API_BASE}/getStockData`,
  CRUD: `${API_BASE}/lambda_crud_handler`,
};

// ─── Get Cognito Access Token ───
async function getAccessToken() {
  if (!AUTH_ENABLED) return null;
  try {
    const session = await fetchAuthSession();
    return session.tokens?.accessToken?.toString() ?? null;
  } catch {
    return null;
  }
}

// ─── Auth-Aware Fetch ───
// Drop-in replacement for fetch().
// When auth is ON: attaches Authorization header.
// When auth is OFF: plain fetch (works exactly as before).
export async function authFetch(url, options = {}) {
  const token = await getAccessToken();
  const headers = { ...options.headers };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Only set Content-Type if not already set and body exists
  if (options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  return fetch(url, { ...options, headers });
}

// ─── Cache Helpers (unchanged) ───
export const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

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