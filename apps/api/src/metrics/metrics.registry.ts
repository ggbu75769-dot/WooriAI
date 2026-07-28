type RequestMetric = { count: number; durationMs: number; serverErrors: number };

const requests = new Map<string, RequestMetric>();
const operations = new Map<string, number>();

function routeLabel(path: string): string {
  return path.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ":id").replace(/\/\d+(?=\/|$)/g, "/:id");
}

export function observeRequest(method: string, path: string, status: number, durationMs: number) {
  const key = `${method.toUpperCase()} ${routeLabel(path)}`;
  const current = requests.get(key) ?? { count: 0, durationMs: 0, serverErrors: 0 };
  current.count += 1;
  current.durationMs += durationMs;
  if (status >= 500) current.serverErrors += 1;
  requests.set(key, current);
  if (/\/auth\//.test(path)) incrementOperationalMetric(status < 400 ? "auth_success" : "auth_failure");
  if (/\/sync\//.test(path)) {
    incrementOperationalMetric(status === 409 ? "expense_sync_conflict" : status < 400 ? "expense_sync_success" : "expense_sync_failure");
  }
}

export function incrementOperationalMetric(name: string) {
  operations.set(name, (operations.get(name) ?? 0) + 1);
}

function escapeLabel(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

export function renderRequestMetrics(): string[] {
  const lines = [
    "# HELP wooriai_http_requests_total HTTP requests by normalized route.",
    "# TYPE wooriai_http_requests_total counter",
    "# HELP wooriai_http_request_duration_ms_sum Accumulated HTTP request duration.",
    "# TYPE wooriai_http_request_duration_ms_sum counter",
    "# HELP wooriai_http_5xx_total HTTP 5xx responses.",
    "# TYPE wooriai_http_5xx_total counter"
  ];
  for (const [route, metric] of requests) {
    const label = escapeLabel(route);
    lines.push(`wooriai_http_requests_total{route="${label}"} ${metric.count}`);
    lines.push(`wooriai_http_request_duration_ms_sum{route="${label}"} ${metric.durationMs}`);
    lines.push(`wooriai_http_5xx_total{route="${label}"} ${metric.serverErrors}`);
  }
  lines.push("# HELP wooriai_operational_events_total Security and domain event counters.");
  lines.push("# TYPE wooriai_operational_events_total counter");
  for (const [event, count] of operations) {
    lines.push(`wooriai_operational_events_total{event="${escapeLabel(event)}"} ${count}`);
  }
  return lines;
}
