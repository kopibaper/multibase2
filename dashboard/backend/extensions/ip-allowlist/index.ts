// IP Allowlist Checker
// Supabase Edge Function: ip-check

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BLOCK_ACTION = Deno.env.get("BLOCK_ACTION") ?? "{{blockAction}}"; // "deny" or "log-only"

function extractIp(req: Request): string | null {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    null
  );
}

Deno.serve(async (req: Request) => {
  const ip = extractIp(req);

  if (!ip) {
    return new Response(JSON.stringify({ error: "Could not determine IP address" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Check if IP is within any active CIDR in the allowlist
  const { data, error } = await supabase.rpc("check_ip_in_allowlist", { ip_to_check: ip });

  let isAllowed = false;

  if (error) {
    // Fallback: query directly
    const { data: cidrData } = await supabase
      .from("ip_allowlist")
      .select("id")
      .eq("is_active", true)
      .filter("cidr", "ov", ip);

    isAllowed = (cidrData?.length ?? 0) > 0;
  } else {
    isAllowed = data === true;
  }

  // Extract user ID from auth header if present
  let userId: string | null = null;
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const { data: userData } = await supabase.auth.getUser(authHeader.split(" ")[1]);
    userId = userData?.user?.id ?? null;
  }

  if (!isAllowed) {
    // Log the blocked attempt
    await supabase.from("ip_block_log").insert({
      ip_address: ip,
      user_id: userId,
      reason: BLOCK_ACTION === "deny" ? "IP not in allowlist" : "IP not in allowlist (log-only)",
    });

    if (BLOCK_ACTION === "deny") {
      return new Response(
        JSON.stringify({ error: "Access denied", ip }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  return new Response(
    JSON.stringify({ allowed: isAllowed, ip, action: BLOCK_ACTION }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
