// Currency Converter
// Supabase Edge Function: convert-currency

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BASE_CURRENCY = Deno.env.get("BASE_CURRENCY") ?? "{{baseCurrency}}";
const API_KEY = Deno.env.get("EXCHANGE_RATE_API_KEY") ?? "{{apiKey}}";
const CACHE_TTL_HOURS = 24;

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const from = (url.searchParams.get("from") ?? BASE_CURRENCY).toUpperCase();
  const to = (url.searchParams.get("to") ?? "USD").toUpperCase();
  const amountStr = url.searchParams.get("amount") ?? "1";
  const amount = parseFloat(amountStr);

  if (isNaN(amount) || amount < 0) {
    return new Response(JSON.stringify({ error: "Invalid amount" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (from === to) {
    return new Response(
      JSON.stringify({ from, to, amount, converted: amount, rate: 1, date: new Date().toISOString().split("T")[0] }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const cutoffDate = new Date(Date.now() - CACHE_TTL_HOURS * 3600 * 1000).toISOString();

  // Check cache
  const { data: cached } = await supabase
    .from("exchange_rates")
    .select("rate, fetched_at")
    .eq("base_currency", from)
    .eq("target_currency", to)
    .gt("fetched_at", cutoffDate)
    .single();

  let rate: number;
  let rateDate: string;

  if (cached) {
    rate = parseFloat(cached.rate);
    rateDate = cached.fetched_at.split("T")[0];
  } else {
    // Fetch fresh rates from Frankfurter API (free, no key needed)
    // Falls back to exchangerate-api with API key
    let fetchedRates: Record<string, number>;
    let fetchedDate: string;

    try {
      const frankfurterUrl = `https://api.frankfurter.app/latest?from=${from}`;
      const response = await fetch(frankfurterUrl);

      if (response.ok) {
        const data = await response.json();
        fetchedRates = data.rates ?? {};
        fetchedDate = data.date ?? new Date().toISOString().split("T")[0];
      } else {
        throw new Error("Frankfurter unavailable");
      }
    } catch {
      // Fallback to exchangerate-api
      if (!API_KEY || API_KEY === "{{apiKey}}") {
        return new Response(
          JSON.stringify({ error: "Exchange rate service unavailable and no API key configured" }),
          { status: 502, headers: { "Content-Type": "application/json" } }
        );
      }

      const response = await fetch(
        `https://v6.exchangerate-api.com/v6/${API_KEY}/latest/${from}`
      );
      const data = await response.json();
      if (data.result !== "success") {
        return new Response(JSON.stringify({ error: "Exchange rate API error" }), {
          status: 502,
          headers: { "Content-Type": "application/json" },
        });
      }
      fetchedRates = data.conversion_rates ?? {};
      fetchedDate = new Date().toISOString().split("T")[0];
    }

    if (!(to in fetchedRates)) {
      return new Response(JSON.stringify({ error: `Currency '${to}' not found` }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    rate = fetchedRates[to];
    rateDate = fetchedDate;

    // Cache all rates returned
    const upsertData = Object.entries(fetchedRates).map(([target, r]) => ({
      base_currency: from,
      target_currency: target,
      rate: r,
      fetched_at: new Date().toISOString(),
    }));

    await supabase.from("exchange_rates").upsert(upsertData, {
      onConflict: "base_currency,target_currency",
    });
  }

  const converted = Math.round(amount * rate * 1e8) / 1e8;

  return new Response(
    JSON.stringify({ from, to, amount, converted, rate, date: rateDate }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
