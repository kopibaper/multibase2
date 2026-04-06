// Short URL Service
// Supabase Edge Function: short-url

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BASE_URL = (Deno.env.get("BASE_URL") ?? "{{baseUrl}}").replace(/\/$/, "");
const SLUG_LENGTH = 6;

function generateSlug(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const array = new Uint8Array(SLUG_LENGTH);
  crypto.getRandomValues(array);
  return Array.from(array).map((b) => chars[b % chars.length]).join("");
}

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  // Extract slug from path: /short-url/:slug
  const pathParts = url.pathname.split("/").filter(Boolean);
  const slug = pathParts[pathParts.length - 1];

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // GET /:slug -> redirect
  if (req.method === "GET" && slug && slug !== "short-url") {
    const { data, error } = await supabase
      .from("short_urls")
      .select("original_url, is_active, expires_at")
      .eq("slug", slug)
      .single();

    if (error || !data) {
      return new Response(JSON.stringify({ error: "Short URL not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!data.is_active) {
      return new Response(JSON.stringify({ error: "Short URL is inactive" }), {
        status: 410,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Short URL has expired" }), {
        status: 410,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Record the click (fire and forget)
    supabase.from("url_clicks").insert({
      slug,
      referrer: req.headers.get("referer") ?? null,
      user_agent: req.headers.get("user-agent") ?? null,
    }).then(() =>
      supabase.from("short_urls").update({ click_count: data.click_count ?? 0 }).eq("slug", slug)
    );

    // Update click count
    await supabase.rpc("increment_click_count", { p_slug: slug })
      .catch(() => null); // RPC may not exist, ignore

    return new Response(null, {
      status: 301,
      headers: {
        Location: data.original_url,
        "Cache-Control": "no-cache",
      },
    });
  }

  // POST /create -> create short URL
  if (req.method === "POST") {
    let body: { url: string; custom_slug?: string; expires_at?: string };
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { url: originalUrl, custom_slug, expires_at } = body;

    if (!originalUrl) {
      return new Response(JSON.stringify({ error: "url is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!isValidUrl(originalUrl)) {
      return new Response(JSON.stringify({ error: "Invalid URL format" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    let finalSlug: string;

    if (custom_slug) {
      if (!/^[a-zA-Z0-9_-]{3,50}$/.test(custom_slug)) {
        return new Response(
          JSON.stringify({ error: "Custom slug must be 3-50 alphanumeric characters, dashes, or underscores" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      finalSlug = custom_slug;
    } else {
      // Generate unique slug
      let attempts = 0;
      do {
        finalSlug = generateSlug();
        const { data: existing } = await supabase
          .from("short_urls")
          .select("id")
          .eq("slug", finalSlug)
          .single();
        if (!existing) break;
        attempts++;
      } while (attempts < 5);
    }

    const { data, error } = await supabase
      .from("short_urls")
      .insert({
        slug: finalSlug,
        original_url: originalUrl,
        expires_at: expires_at ?? null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return new Response(JSON.stringify({ error: "Slug already taken" }), {
          status: 409,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Failed to create short URL" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        id: data.id,
        slug: finalSlug,
        shortUrl: `${BASE_URL}/${finalSlug}`,
        originalUrl,
        expiresAt: expires_at ?? null,
      }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(JSON.stringify({ error: "Not found" }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
});
