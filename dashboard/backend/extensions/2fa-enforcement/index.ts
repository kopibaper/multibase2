import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as OTPAuth from "https://esm.sh/otpauth@9";

serve(async (req: Request) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { action, userId, token, secret } = await req.json();

  try {
    if (action === "setup") {
      const totp = new OTPAuth.TOTP({ issuer: "Multibase", label: userId, digits: 6, period: 30 });
      const { error } = await supabase.from("totp_registrations").upsert({
        user_id: userId, secret: totp.secret.base32, verified: false
      });
      if (error) throw error;
      return Response.json({ otpauth_url: totp.toString(), secret: totp.secret.base32 });
    }

    if (action === "verify") {
      const { data: reg } = await supabase.from("totp_registrations")
        .select("secret").eq("user_id", userId).single();
      if (!reg) return Response.json({ error: "Not registered" }, { status: 400 });

      const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(reg.secret), digits: 6, period: 30 });
      const delta = totp.validate({ token, window: 1 });
      if (delta === null) return Response.json({ error: "Invalid token" }, { status: 401 });

      await supabase.from("totp_registrations").update({ verified: true }).eq("user_id", userId);
      return Response.json({ success: true });
    }

    if (action === "check") {
      const { data: reg } = await supabase.from("totp_registrations")
        .select("verified").eq("user_id", userId).single();
      const { data: grace } = await supabase.from("mfa_grace_periods")
        .select("expires_at").eq("user_id", userId).single();
      const inGrace = grace && new Date(grace.expires_at) > new Date();
      return Response.json({ requires_2fa: !reg?.verified && !inGrace });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
});
