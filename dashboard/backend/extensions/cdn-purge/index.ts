import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CDN_PROVIDER = "{{cdnProvider}}";
const API_TOKEN    = Deno.env.get("CDN_API_TOKEN") || "{{apiToken}}";
const ZONE_ID      = "{{zoneId}}";

serve(async (req: Request) => {
  const payload = await req.json();
  const storagePath: string = payload?.record?.name ?? payload.storagePath;
  const publicUrl: string   = payload?.record?.metadata?.publicUrl ?? payload.publicUrl ?? storagePath;

  if (!storagePath) return Response.json({ error: "Missing storagePath" }, { status: 400 });

  try {
    let result: unknown;

    if (CDN_PROVIDER === "cloudflare") {
      const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/purge_cache`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${API_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ files: [publicUrl] })
      });
      result = await res.json();
    } else if (CDN_PROVIDER === "fastly") {
      const res = await fetch(`https://api.fastly.com/purge/${encodeURIComponent(publicUrl)}`, {
        method: "POST",
        headers: { "Fastly-Key": API_TOKEN }
      });
      result = await res.json();
    } else if (CDN_PROVIDER === "keycdn") {
      const res = await fetch("https://api.keycdn.com/zones/purgeurl.json", {
        method: "DELETE",
        headers: { "Authorization": `Basic ${btoa(API_TOKEN + ":")}`, "Content-Type": "application/json" },
        body: JSON.stringify({ urls: [publicUrl] })
      });
      result = await res.json();
    } else {
      return Response.json({ error: `Unknown CDN provider: ${CDN_PROVIDER}` }, { status: 400 });
    }

    return Response.json({ success: true, provider: CDN_PROVIDER, result });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
});
