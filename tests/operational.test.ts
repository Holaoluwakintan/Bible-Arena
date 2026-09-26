import { afterEach, describe, expect, it } from "vitest";
import { getOperationalMetrics, recordHttpRequest, recordRealtime, resetOperationalMetricsForTest } from "../server/_core/metrics";

describe("operational metrics", () => {
  afterEach(() => resetOperationalMetricsForTest());

  it("tracks bounded HTTP latency percentiles and status counters", () => {
    recordHttpRequest(200, 10);
    recordHttpRequest(201, 20);
    recordHttpRequest(503, 100);
    const metrics = getOperationalMetrics();
    expect(metrics.counters.http_requests_total).toBe(3);
    expect(metrics.counters.http_responses_5xx_total).toBe(1);
    expect(metrics.counters.http_errors_total).toBe(1);
    expect(metrics.http.p50Ms).toBe(20);
    expect(metrics.http.p95Ms).toBe(100);
    expect(metrics.http.p99Ms).toBe(100);
  });

  it("tracks realtime lifecycle counters and can reset between tests", () => {
    recordRealtime("connected");
    recordRealtime("disconnected");
    recordRealtime("rejected");
    expect(getOperationalMetrics().counters.realtime_connected_total).toBe(1);
    expect(getOperationalMetrics().counters.realtime_disconnected_total).toBe(1);
    resetOperationalMetricsForTest();
    expect(getOperationalMetrics().counters).toEqual({});
  });
});
