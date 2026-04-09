// Geo-IP Lookup
// Supabase Edge Function: geo-lookup

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PROVIDER = Deno.env.get("PROVIDER") ?? "{{provider}}"; // "ip-api" or "ipinfo"
const API_KEY = Deno.env.get("GEO_API_KEY") ?? "{{apiKey}}";
const CACHE_TTL_HOURS = 24;

interface GeoData {
  country_code: string | null;
  country_name: string | null;
  region: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  isp: string | null;
}

async function fetchFromIpApi(ip: string): Promise<GeoData> {
  const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,countryCode,region,regionName,city,lat,lon,timezone,isp`);
  const data = await response.json();

  if (data.status !== "success") {
    throw new Error(`ip-api failed: ${data.message}`);
  }

  return {
    country_code: data.countryCode ?? null,
    country_name: data.country ?? null,
    region: data.regionName ?? null,
    city: data.city ?? null,
    latitude: data.lat ?? null,
    longitude: data.lon ?? null,
    timezone: data.timezone ?? null,
    isp: data.isp ?? null,
  };
}

async function fetchFromIpInfo(ip: string, apiKey: string): Promise<GeoData> {
  const url = apiKey
    ? `https://ipinfo.io/${ip}/json?token=${apiKey}`
    : `https://ipinfo.io/${ip}/json`;
  const response = await fetch(url);
  const data = await response.json();

  if (data.error) {
    throw new Error(`ipinfo error: ${data.error.message}`);
  }

  const [lat, lon] = (data.loc ?? "0,0").split(",").map(Number);

  return {
    country_code: data.country ?? null,
    country_name: data.country ?? null,
    region: data.region ?? null,
    city: data.city ?? null,
    latitude: lat || null,
    longitude: lon || null,
    timezone: data.timezone ?? null,
    isp: data.org ?? null,
  };
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const ip = url.searchParams.get("ip");

  if (!ip) {
    return new Response(JSON.stringify({ error: "ip query parameter is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Validate IP format loosely
  if (!/^[\d.:a-fA-F]+$/.test(ip)) {
    return new Response(JSON.stringify({ error: "Invalid IP format" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Check cache first
  const { data: cached } = await supabase
    .from("geo_cache")
    .select("*")
    .eq("ip_address", ip)
    .gt("cached_at", new Date(Date.now() - CACHE_TTL_HOURS * 3600 * 1000).toISOString())
    .single();

  if (cached) {
    return new Response(
      JSON.stringify({ ...cached, fromCache: true }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  // Fetch from provider
  let geoData: GeoData;
  try {
    if (PROVIDER === "ipinfo") {
      geoData = await fetchFromIpInfo(ip, API_KEY);
    } else {
      geoData = await fetchFromIpApi(ip);
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Upsert into cache
  const { error: upsertError } = await supabase.from("geo_cache").upsert(
    { ip_address: ip, ...geoData, cached_at: new Date().toISOString() },
    { onConflict: "ip_address" }
  );

  if (upsertError) {
    console.error("Cache write error:", upsertError);
  }

  return new Response(
    JSON.stringify({ ip_address: ip, ...geoData, fromCache: false }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
