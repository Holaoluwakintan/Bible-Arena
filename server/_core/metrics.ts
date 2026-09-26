type Histogram = { count: number; totalMs: number; values: number[] };

const MAX_SAMPLES = 2_000;
const requestHistogram: Histogram = { count: 0, totalMs: 0, values: [] };
const counters = new Map<string, number>();
const startedAt = Date.now();

function increment(name: string, amount = 1) {
  counters.set(name, (counters.get(name) ?? 0) + amount);
}

function observe(histogram: Histogram, value: number) {
  histogram.count += 1;
  histogram.totalMs += value;
  histogram.values.push(value);
  if (histogram.values.length > MAX_SAMPLES) histogram.values.shift();
}

function percentile(values: number[], percentileValue: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * percentileValue) - 1)] ?? 0;
}

export function recordHttpRequest(status: number, durationMs: number) {
  increment("http_requests_total");
  increment(`http_responses_${Math.floor(status / 100)}xx_total`);
  if (status >= 500) increment("http_errors_total");
  observe(requestHistogram, durationMs);
}

export function recordDatabaseHealth(ok: boolean) {
  increment(ok ? "database_healthcheck_ok_total" : "database_healthcheck_failed_total");
}

export function recordBackup(success: boolean) {
  increment(success ? "backup_success_total" : "backup_failure_total");
}

export function recordRealtime(event: "connected" | "disconnected" | "rejected" | "message_error") {
  increment(`realtime_${event}_total`);
}

export function getOperationalMetrics() {
  return {
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    counters: Object.fromEntries(counters),
    http: {
      count: requestHistogram.count,
      averageMs: requestHistogram.count ? Math.round(requestHistogram.totalMs / requestHistogram.count) : 0,
      p50Ms: percentile(requestHistogram.values, 0.5),
      p95Ms: percentile(requestHistogram.values, 0.95),
      p99Ms: percentile(requestHistogram.values, 0.99),
      sampleSize: requestHistogram.values.length,
    },
  };
}

export function resetOperationalMetricsForTest() {
  counters.clear();
  requestHistogram.count = 0;
  requestHistogram.totalMs = 0;
  requestHistogram.values.length = 0;
}
