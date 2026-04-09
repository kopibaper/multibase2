// Webhook Dispatcher
// Supabase Edge Function: webhook-dispatch

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MAX_DELIVERIES_PER_RUN = 50;

async function signPayload(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(payload);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
  return "sha256=" + Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function calculateNextRetry(attempts: number): Date {
  // Exponential backoff: 30s, 2m, 8m, 32m, 2h, ...
  const delaySeconds = 30 * Math.pow(4, attempts);
  const cappedDelay = Math.min(delaySeconds, 7200); // cap at 2 hours
  return new Date(Date.now() + cappedDelay * 1000);
}

Deno.serve(async (req: Request) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Fetch pending/failed deliveries that are due for retry
  const { data: deliveries, error: fetchError } = await supabase
    .from("webhook_deliveries")
    .select("*, webhook_endpoints(url, signing_secret, is_active)")
    .in("status", ["pending", "failed"])
    .lte("next_retry_at", new Date().toISOString())
    .order("next_retry_at", { ascending: true })
    .limit(MAX_DELIVERIES_PER_RUN);

  if (fetchError) {
    return new Response(JSON.stringify({ error: fetchError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const results: { id: string; status: "delivered" | "failed"; error?: string }[] = [];

  for (const delivery of deliveries ?? []) {
    const endpoint = delivery.webhook_endpoints as {
      url: string;
      signing_secret: string;
      is_active: boolean;
    } | null;

    if (!endpoint || !endpoint.is_active) {
      await supabase
        .from("webhook_deliveries")
        .update({ status: "failed", last_error: "Endpoint not found or inactive" })
        .eq("id", delivery.id);
      results.push({ id: delivery.id, status: "failed", error: "Endpoint inactive" });
      continue;
    }

    const payloadString = JSON.stringify(delivery.payload);
    const signature = await signPayload(payloadString, endpoint.signing_secret);
    const newAttempts = delivery.attempts + 1;

    try {
      const response = await fetch(endpoint.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Signature": signature,
          "X-Webhook-Event": delivery.event_type,
          "X-Webhook-Delivery": delivery.id,
          "X-Webhook-Attempt": String(newAttempts),
        },
        body: payloadString,
        signal: AbortSignal.timeout(30000), // 30s timeout
      });

      if (response.ok) {
        await supabase
          .from("webhook_deliveries")
          .update({
            status: "delivered",
            attempts: newAttempts,
            delivered_at: new Date().toISOString(),
            last_error: null,
          })
          .eq("id", delivery.id);
        results.push({ id: delivery.id, status: "delivered" });
      } else {
        const errorText = await response.text().catch(() => "No response body");
        const isFinalAttempt = newAttempts >= delivery.max_attempts;
        await supabase
          .from("webhook_deliveries")
          .update({
            status: isFinalAttempt ? "failed" : "pending",
            attempts: newAttempts,
            last_error: `HTTP ${response.status}: ${errorText.slice(0, 500)}`,
            next_retry_at: isFinalAttempt ? null : calculateNextRetry(newAttempts).toISOString(),
          })
          .eq("id", delivery.id);
        results.push({ id: delivery.id, status: "failed", error: `HTTP ${response.status}` });
      }
    } catch (err) {
      const isFinalAttempt = newAttempts >= delivery.max_attempts;
      await supabase
        .from("webhook_deliveries")
        .update({
          status: isFinalAttempt ? "failed" : "pending",
          attempts: newAttempts,
          last_error: String(err).slice(0, 500),
          next_retry_at: isFinalAttempt ? null : calculateNextRetry(newAttempts).toISOString(),
        })
        .eq("id", delivery.id);
      results.push({ id: delivery.id, status: "failed", error: String(err) });
    }
  }

  const delivered = results.filter((r) => r.status === "delivered").length;
  const failed = results.filter((r) => r.status === "failed").length;

  return new Response(
    JSON.stringify({ processed: results.length, delivered, failed, results }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
