const BASE =
  "https://z35lnmmzgi.execute-api.ap-east-1.amazonaws.com/prod/lambda_monthly_pnl";

export async function fetchMonthlyPnlFrom202303({ signal } = {}) {
  const url = `${BASE}?start_date=2023-03`;

  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API error ${res.status}: ${text || res.statusText}`);
  }

  const data = await res.json();

  if (!Array.isArray(data)) {
    throw new Error("API returned non-array JSON");
  }

  return data;
}