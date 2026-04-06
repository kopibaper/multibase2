// Passkey / WebAuthn Authentication Handler
// Supabase Edge Function: passkey-auth

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RP_ID = Deno.env.get("RP_ID") ?? "{{rpId}}";
const RP_NAME = Deno.env.get("RP_NAME") ?? "{{rpName}}";

function generateChallenge(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: { action: string; userId?: string; credential?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { action, userId, credential } = body;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  switch (action) {
    case "register-challenge": {
      if (!userId) {
        return new Response(JSON.stringify({ error: "userId is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const challenge = generateChallenge();

      const { error } = await supabase.from("passkey_challenges").insert({
        user_id: userId,
        challenge,
        type: "registration",
      });

      if (error) {
        return new Response(JSON.stringify({ error: "Failed to create challenge" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({
          rpId: RP_ID,
          rpName: RP_NAME,
          challenge,
          userId,
          timeout: 300000,
          attestation: "none",
          authenticatorSelection: {
            residentKey: "required",
            userVerification: "required",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    case "register-complete": {
      if (!userId || !credential) {
        return new Response(
          JSON.stringify({ error: "userId and credential are required" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const credentialId = credential.id as string;
      const publicKey = credential.response
        ? JSON.stringify((credential.response as Record<string, unknown>).attestationObject ?? credential.response)
        : JSON.stringify(credential);

      // Verify challenge
      const { data: challengeRecord } = await supabase
        .from("passkey_challenges")
        .select("*")
        .eq("user_id", userId)
        .eq("type", "registration")
        .is("used_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!challengeRecord) {
        return new Response(JSON.stringify({ error: "Invalid or expired challenge" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Mark challenge as used
      await supabase
        .from("passkey_challenges")
        .update({ used_at: new Date().toISOString() })
        .eq("id", challengeRecord.id);

      // Store credential
      const { error: insertError } = await supabase.from("passkey_credentials").insert({
        user_id: userId,
        credential_id: credentialId,
        public_key: publicKey,
        device_name: (credential.device_name as string) ?? "Passkey",
      });

      if (insertError) {
        return new Response(JSON.stringify({ error: "Failed to store credential" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({ success: true, credentialId }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    case "auth-challenge": {
      if (!userId) {
        return new Response(JSON.stringify({ error: "userId is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const { data: credentials } = await supabase
        .from("passkey_credentials")
        .select("credential_id")
        .eq("user_id", userId);

      if (!credentials || credentials.length === 0) {
        return new Response(JSON.stringify({ error: "No passkeys registered for user" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      const challenge = generateChallenge();

      await supabase.from("passkey_challenges").insert({
        user_id: userId,
        challenge,
        type: "authentication",
      });

      return new Response(
        JSON.stringify({
          challenge,
          rpId: RP_ID,
          timeout: 300000,
          userVerification: "required",
          allowCredentials: credentials.map((c) => ({
            id: c.credential_id,
            type: "public-key",
          })),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    case "auth-complete": {
      if (!userId || !credential) {
        return new Response(
          JSON.stringify({ error: "userId and credential are required" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const credentialId = credential.id as string;

      // Find stored credential
      const { data: storedCred } = await supabase
        .from("passkey_credentials")
        .select("*")
        .eq("user_id", userId)
        .eq("credential_id", credentialId)
        .single();

      if (!storedCred) {
        return new Response(JSON.stringify({ error: "Credential not found" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Verify challenge
      const { data: challengeRecord } = await supabase
        .from("passkey_challenges")
        .select("*")
        .eq("user_id", userId)
        .eq("type", "authentication")
        .is("used_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!challengeRecord) {
        return new Response(JSON.stringify({ error: "Invalid or expired challenge" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Mark challenge as used and update counter + last_used_at
      await Promise.all([
        supabase
          .from("passkey_challenges")
          .update({ used_at: new Date().toISOString() })
          .eq("id", challengeRecord.id),
        supabase
          .from("passkey_credentials")
          .update({
            counter: storedCred.counter + 1,
            last_used_at: new Date().toISOString(),
          })
          .eq("id", storedCred.id),
      ]);

      return new Response(
        JSON.stringify({ success: true, userId, verified: true }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    default:
      return new Response(
        JSON.stringify({ error: `Unknown action: ${action}` }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
  }
});
