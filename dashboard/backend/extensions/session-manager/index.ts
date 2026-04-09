// Session Manager
// Supabase Edge Function: session-manager

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MAX_CONCURRENT_SESSIONS = parseInt(
  Deno.env.get("MAX_CONCURRENT_SESSIONS") ?? "{{maxConcurrentSessions}}",
  10
) || 5;

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function extractIp(req: Request): string | null {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    null
  );
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: {
    action: "register" | "revoke" | "revoke-all-others" | "list";
    userId: string;
    sessionToken?: string;
    sessionId?: string;
    deviceName?: string;
    browser?: string;
    os?: string;
  };

  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { action, userId, sessionToken, sessionId, deviceName, browser, os } = body;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  if (!userId) {
    return new Response(JSON.stringify({ error: "userId is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (action === "register") {
    if (!sessionToken) {
      return new Response(JSON.stringify({ error: "sessionToken is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const tokenHash = await hashToken(sessionToken);
    const ip = extractIp(req);

    // Enforce concurrent session limit: revoke oldest if over limit
    const { data: activeSessions } = await supabase
      .from("user_sessions")
      .select("id, created_at")
      .eq("user_id", userId)
      .is("revoked_at", null)
      .order("created_at", { ascending: true });

    if (activeSessions && activeSessions.length >= MAX_CONCURRENT_SESSIONS) {
      const toRevoke = activeSessions.slice(0, activeSessions.length - MAX_CONCURRENT_SESSIONS + 1);
      await supabase
        .from("user_sessions")
        .update({ revoked_at: new Date().toISOString() })
        .in("id", toRevoke.map((s) => s.id));
    }

    const { data, error } = await supabase
      .from("user_sessions")
      .insert({
        user_id: userId,
        session_token_hash: tokenHash,
        device_name: deviceName ?? null,
        browser: browser ?? null,
        os: os ?? null,
        ip_address: ip,
      })
      .select()
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: "Failed to register session" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, session: data }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (action === "revoke") {
    if (!sessionId) {
      return new Response(JSON.stringify({ error: "sessionId is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { error } = await supabase
      .from("user_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", sessionId)
      .eq("user_id", userId);

    if (error) {
      return new Response(JSON.stringify({ error: "Failed to revoke session" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (action === "revoke-all-others") {
    if (!sessionId) {
      return new Response(JSON.stringify({ error: "sessionId (current session) is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { error } = await supabase
      .from("user_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("user_id", userId)
      .neq("id", sessionId)
      .is("revoked_at", null);

    if (error) {
      return new Response(JSON.stringify({ error: "Failed to revoke sessions" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (action === "list") {
    const { data, error } = await supabase
      .from("user_sessions")
      .select("id, device_name, browser, os, ip_address, country, city, last_active_at, created_at")
      .eq("user_id", userId)
      .is("revoked_at", null)
      .order("last_active_at", { ascending: false });

    if (error) {
      return new Response(JSON.stringify({ error: "Failed to list sessions" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ sessions: data }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({ error: `Unknown action: ${action}` }),
    { status: 400, headers: { "Content-Type": "application/json" } }
  );
});
