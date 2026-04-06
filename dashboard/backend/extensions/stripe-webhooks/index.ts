// Stripe Webhook Handler
// Supabase Edge Function: stripe-webhook

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "{{stripeWebhookSecret}}";
const PAYMENTS_TABLE = "{{paymentsTable}}";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function verifyStripeSignature(
  body: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    const parts = signature.split(",").reduce<Record<string, string>>(
      (acc, part) => {
        const [key, val] = part.split("=");
        acc[key] = val;
        return acc;
      },
      {}
    );

    const timestamp = parts["t"];
    const v1 = parts["v1"];

    if (!timestamp || !v1) return false;

    const signedPayload = `${timestamp}.${body}`;
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(signedPayload);

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signature_bytes = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
    const computed = Array.from(new Uint8Array(signature_bytes))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Constant-time comparison
    if (computed.length !== v1.length) return false;
    let diff = 0;
    for (let i = 0; i < computed.length; i++) {
      diff |= computed.charCodeAt(i) ^ v1.charCodeAt(i);
    }
    return diff === 0;
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response(JSON.stringify({ error: "Missing Stripe-Signature header" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rawBody = await req.text();
  const isValid = await verifyStripeSignature(rawBody, signature, STRIPE_WEBHOOK_SECRET);

  if (!isValid) {
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const eventType = event.type as string;
  const eventId = event.id as string;
  const data = event.data as { object: Record<string, unknown> };
  const obj = data?.object ?? {};

  let amount: number | null = null;
  let currency: string | null = null;
  let customerId: string | null = null;
  let subscriptionId: string | null = null;
  let status: string | null = null;

  if (eventType === "checkout.session.completed") {
    amount = ((obj.amount_total as number) ?? 0) / 100;
    currency = (obj.currency as string) ?? null;
    customerId = (obj.customer as string) ?? null;
    subscriptionId = (obj.subscription as string) ?? null;
    status = "completed";
  } else if (eventType === "payment_intent.succeeded") {
    amount = ((obj.amount as number) ?? 0) / 100;
    currency = (obj.currency as string) ?? null;
    customerId = (obj.customer as string) ?? null;
    status = "succeeded";
  } else if (eventType === "customer.subscription.updated") {
    subscriptionId = (obj.id as string) ?? null;
    customerId = (obj.customer as string) ?? null;
    status = (obj.status as string) ?? null;
  }

  const { error } = await supabase.from(PAYMENTS_TABLE).insert({
    stripe_event_id: eventId,
    event_type: eventType,
    amount,
    currency,
    customer_id: customerId,
    subscription_id: subscriptionId,
    status,
    payload: event,
  });

  if (error) {
    // Idempotency: ignore duplicate event errors
    if (error.code === "23505") {
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    console.error("DB insert error:", error);
    return new Response(JSON.stringify({ error: "Database error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
