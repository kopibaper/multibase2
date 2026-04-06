// Datadog Metrics Reporter
// Supabase Edge Function: datadog-metrics

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DATADOG_API_KEY = Deno.env.get("DATADOG_API_KEY") ?? "{{datadogApiKey}}";
const DATADOG_SITE = Deno.env.get("DATADOG_SITE") ?? "{{datadogSite}}";
const METRICS_PREFIX = Deno.env.get("METRICS_PREFIX") ?? "{{metricsPrefix}}";

interface DatadogMetric {
  metric: string;
  type: number; // 0=gauge, 1=count, 2=rate
  points: [number, number][];
  tags?: string[];
  host?: string;
}

function toDatadogType(type: string): number {
  switch (type) {
    case "count": return 1;
    case "rate": return 2;
    default: return 0; // gauge
  }
}

async function collectPostgresMetrics(
  supabase: ReturnType<typeof createClient>
): Promise<DatadogMetric[]> {
  const metrics: DatadogMetric[] = [];
  const now = Math.floor(Date.now() / 1000);

  // Database stats
  try {
    const { data: dbStats } = await supabase.rpc("get_db_stats").single();
    if (dbStats) {
      metrics.push({
        metric: `${METRICS_PREFIX}.db.size_bytes`,
        type: 0,
        points: [[now, dbStats.db_size ?? 0]],
      });
    }
  } catch {
    // pg_stat_database query as fallback
  }

  // Active connections
  try {
    const { data: connData } = await supabase
      .from("pg_stat_activity")
      .select("count:count()", { count: "exact" })
      .neq("state", "idle");

    metrics.push({
      metric: `${METRICS_PREFIX}.connections.active`,
      type: 0,
      points: [[now, connData?.length ?? 0]],
    });
  } catch {
    // Ignore if pg_stat_activity not accessible
  }

  // Buffer metrics from dd_metrics_buffer
  const { data: buffered } = await supabase
    .from("dd_metrics_buffer")
    .select("*")
    .is("sent_at", null)
    .limit(100);

  for (const row of buffered ?? []) {
    metrics.push({
      metric: row.metric_name,
      type: toDatadogType(row.metric_type),
      points: [[row.timestamp ?? now, row.value]],
      tags: row.tags ? Object.entries(row.tags).map(([k, v]) => `${k}:${v}`) : [],
    });
  }

  return metrics;
}

Deno.serve(async (_req: Request) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const metrics = await collectPostgresMetrics(supabase);

  if (metrics.length === 0) {
    return new Response(JSON.stringify({ sent: 0, message: "No metrics to send" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const datadogUrl = `https://api.${DATADOG_SITE}/api/v1/series`;

  const response = await fetch(datadogUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "DD-API-KEY": DATADOG_API_KEY,
    },
    body: JSON.stringify({ series: metrics }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Datadog API error:", errorText);
    return new Response(
      JSON.stringify({ error: "Datadog API error", detail: errorText }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  // Mark buffered metrics as sent
  const bufferedIds = (
    await supabase
      .from("dd_metrics_buffer")
      .select("id")
      .is("sent_at", null)
      .limit(100)
  ).data?.map((r) => r.id) ?? [];

  if (bufferedIds.length > 0) {
    await supabase
      .from("dd_metrics_buffer")
      .update({ sent_at: new Date().toISOString() })
      .in("id", bufferedIds);
  }

  return new Response(
    JSON.stringify({ sent: metrics.length, success: true }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
