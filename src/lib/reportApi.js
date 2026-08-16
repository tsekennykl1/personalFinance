const API_URL =
  "https://z35lnmmzgi.execute-api.ap-east-1.amazonaws.com/prod/lambda_consolidated_monthly_report";

export async function fetchMonthlyReport({ signal } = {}) {
  const res = await fetch(API_URL, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `API failed: ${res.status} ${res.statusText}${text ? ` — ${text}` : ""}`
    );
  }

  return res.json();
}