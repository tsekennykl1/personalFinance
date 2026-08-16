import { useEffect, useMemo, useState } from "react";
import { fetchMonthlyReport } from "./reportApi";

export function useMonthlyReport() {
  const [raw, setRaw] = useState(null);
  const [status, setStatus] = useState("idle"); // idle|loading|success|error
  const [error, setError] = useState(null);

  const load = async ({ signal } = {}) => {
    setStatus("loading");
    setError(null);
    try {
      const result = await fetchMonthlyReport({ signal });
      setRaw(result);
      setStatus("success");
    } catch (e) {
      if (e?.name === "AbortError") return;
      setError(e);
      setStatus("error");
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    load({ signal: controller.signal });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const model = useMemo(() => {
    const first = Array.isArray(raw) ? raw[0] : raw;

    return {
      yearMonth: first?.year_month,
      previousMonth: first?.previous_month,

      holdings: first?.portfolio_performance?.holdings ?? [],
      holdingsSummary: first?.portfolio_performance?.summary ?? null,

      monthlyPerformance: first?.monthly_performance?.performance ?? [],
      monthlyPerformanceTotals: first?.monthly_performance?.totals ?? null,

      currentMonthlyPnl: first?.current_monthly_pnl ?? null,
      allMonthlyPnl: first?.all_monthly_pnl ?? [],

      raw: first ?? raw,
    };
  }, [raw]);

  return {
    status,
    error,
    data: model,
    reload: () => load(),
  };
}