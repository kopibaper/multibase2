// Sentry Error Handler
// Supabase Edge Function: sentry-error-handler

const SENTRY_DSN = Deno.env.get("SENTRY_DSN") ?? "{{sentryDsn}}";
const ENVIRONMENT = Deno.env.get("ENVIRONMENT") ?? "{{environment}}";

function parseDsn(dsn: string): { projectId: string; key: string; host: string } | null {
  try {
    const url = new URL(dsn);
    const key = url.username;
    const host = url.host;
    const projectId = url.pathname.replace("/", "");
    return { projectId, key, host };
  } catch {
    return null;
  }
}

interface ErrorContext {
  user_id?: string;
  request_url?: string;
  environment?: string;
  [key: string]: unknown;
}

interface ErrorPayload {
  error: string | { message: string; stack?: string; type?: string };
  context?: ErrorContext;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: ErrorPayload;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { error, context = {} } = body;

  const parsedDsn = parseDsn(SENTRY_DSN);
  if (!parsedDsn) {
    return new Response(JSON.stringify({ error: "Invalid Sentry DSN" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { projectId, key, host } = parsedDsn;

  const errorMessage = typeof error === "string" ? error : error.message;
  const errorStack = typeof error === "object" ? error.stack : undefined;
  const errorType = typeof error === "object" ? (error.type ?? "Error") : "Error";
  const env = context.environment ?? ENVIRONMENT;

  const sentryPayload = {
    event_id: crypto.randomUUID().replace(/-/g, ""),
    timestamp: new Date().toISOString(),
    platform: "javascript",
    level: "error",
    environment: env,
    exception: {
      values: [
        {
          type: errorType,
          value: errorMessage,
          stacktrace: errorStack
            ? {
                frames: errorStack.split("\n").slice(1).map((line: string) => ({
                  filename: line.trim().replace(/^at /, ""),
                })),
              }
            : undefined,
        },
      ],
    },
    user: context.user_id ? { id: context.user_id } : undefined,
    request: context.request_url
      ? { url: context.request_url }
      : undefined,
    tags: {
      source: "edge-function",
    },
    extra: context,
  };

  const sentryUrl = `https://${host}/api/${projectId}/store/`;

  const response = await fetch(sentryUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Sentry-Auth": `Sentry sentry_key=${key}, sentry_version=7`,
    },
    body: JSON.stringify(sentryPayload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Sentry API error:", errorText);
    return new Response(JSON.stringify({ error: "Sentry API error", detail: errorText }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  const result = await response.json().catch(() => ({}));

  return new Response(
    JSON.stringify({ success: true, eventId: result.id ?? sentryPayload.event_id }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
