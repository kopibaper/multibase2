import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALERT_WEBHOOK = "{{alertWebhook}}";

serve(async (_req: Request) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: slos } = await supabase.from("slo_definitions").select("*");

  for (const slo of slos ?? []) {
    const { data: recent } = await supabase
      .from("slo_measurements")
      .select("good_events, total_events")
      .eq("slo_id", slo.id)
      .gte("measured_at", new Date(Date.now() - slo.window_days * 86400000).toISOString());

    const totalGood  = recent?.reduce((s, r) => s + r.good_events,  0) ?? 0;
    const totalAll   = recent?.reduce((s, r) => s + r.total_events, 0) ?? 0;
    const availability = totalAll > 0 ? (totalGood / totalAll) * 100 : 100;
    const errorBudgetRemaining = Math.max(0,
      ((availability - (100 - slo.target_availability)) / (100 - slo.target_availability)) * 100
    );

    await supabase.from("slo_measurements").insert({
      slo_id: slo.id, good_events: totalGood, total_events: totalAll,
      availability, error_budget_remaining: errorBudgetRemaining
    });

    if (errorBudgetRemaining < 10 && ALERT_WEBHOOK?.startsWith("http")) {
      const msg = `🚨 SLO "${slo.name}": Error budget at ${errorBudgetRemaining.toFixed(1)}% (avail: ${availability.toFixed(3)}%)`;
      await supabase.from("slo_alerts").insert({ slo_id: slo.id, burn_rate: 0, alert_type: "budget_exhausted" });
      await fetch(ALERT_WEBHOOK, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: msg })
      });
    }
  }

  return Response.json({ success: true, slos_checked: slos?.length ?? 0 });
});
