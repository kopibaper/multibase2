// Phone OTP Authentication
// Supabase Edge Function: phone-otp

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID") ?? "{{twilioAccountSid}}";
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "{{twilioAuthToken}}";
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") ?? "{{twilioPhoneNumber}}";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const OTP_EXPIRY_MINUTES = 10;
const MAX_ATTEMPTS = 3;

async function hashOtp(otp: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(otp);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateOtp(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return String(array[0] % 1000000).padStart(6, "0");
}

async function sendSms(to: string, body: string): Promise<void> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const credentials = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

  const params = new URLSearchParams({
    To: to,
    From: TWILIO_PHONE_NUMBER,
    Body: body,
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Twilio error: ${error.message}`);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: { action: "send" | "verify"; phone_number: string; otp?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { action, phone_number, otp } = body;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  if (action === "send") {
    if (!phone_number) {
      return new Response(JSON.stringify({ error: "phone_number is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const generatedOtp = generateOtp();
    const otpHash = await hashOtp(generatedOtp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

    // Invalidate any existing OTPs for this number
    await supabase
      .from("phone_otps")
      .delete()
      .eq("phone_number", phone_number)
      .is("verified_at", null);

    const { error: insertError } = await supabase.from("phone_otps").insert({
      phone_number,
      otp_hash: otpHash,
      expires_at: expiresAt,
    });

    if (insertError) {
      return new Response(JSON.stringify({ error: "Failed to create OTP" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      await sendSms(phone_number, `Your verification code is: ${generatedOtp}. Valid for ${OTP_EXPIRY_MINUTES} minutes.`);
    } catch (smsError) {
      console.error("SMS send error:", smsError);
      return new Response(
        JSON.stringify({ success: false, message: "Failed to send SMS" }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "OTP sent successfully" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  if (action === "verify") {
    if (!phone_number || !otp) {
      return new Response(
        JSON.stringify({ error: "phone_number and otp are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { data: otpRecord } = await supabase
      .from("phone_otps")
      .select("*")
      .eq("phone_number", phone_number)
      .is("verified_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!otpRecord) {
      return new Response(
        JSON.stringify({ success: false, message: "No valid OTP found" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (otpRecord.attempts >= MAX_ATTEMPTS) {
      return new Response(
        JSON.stringify({ success: false, message: "Too many attempts. Request a new OTP." }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }

    const inputHash = await hashOtp(otp);

    if (inputHash !== otpRecord.otp_hash) {
      await supabase
        .from("phone_otps")
        .update({ attempts: otpRecord.attempts + 1 })
        .eq("id", otpRecord.id);

      return new Response(
        JSON.stringify({ success: false, message: "Invalid OTP" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    await supabase
      .from("phone_otps")
      .update({ verified_at: new Date().toISOString() })
      .eq("id", otpRecord.id);

    return new Response(
      JSON.stringify({ success: true, message: "Phone number verified successfully" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ error: 'Invalid action. Use "send" or "verify".' }),
    { status: 400, headers: { "Content-Type": "application/json" } }
  );
});
