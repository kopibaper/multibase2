// Slack Notifier
// Supabase Edge Function: slack-notify

const SLACK_WEBHOOK_URL = Deno.env.get("SLACK_WEBHOOK_URL") ?? "{{slackWebhookUrl}}";
const WATCH_TABLES = (Deno.env.get("WATCH_TABLES") ?? "{{watchTables}}")
  .split(",")
  .map((t) => t.trim())
  .filter(Boolean);

interface DatabaseWebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  record: Record<string, unknown> | null;
  old_record: Record<string, unknown> | null;
  schema: string;
}

function formatRecord(record: Record<string, unknown> | null): string {
  if (!record) return "_none_";
  const entries = Object.entries(record).slice(0, 10); // limit fields
  return entries.map(([k, v]) => `• *${k}*: \`${JSON.stringify(v)}\``).join("\n");
}

function buildSlackMessage(payload: DatabaseWebhookPayload): Record<string, unknown> {
  const { type, table, record, old_record, schema } = payload;

  const emoji = type === "INSERT" ? "🟢" : type === "UPDATE" ? "🟡" : "🔴";
  const color = type === "INSERT" ? "#36a64f" : type === "UPDATE" ? "#f5a623" : "#d00000";

  const blocks: unknown[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `${emoji} ${type} on ${schema}.${table}`,
        emoji: true,
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `*Schema:* \`${schema}\` | *Table:* \`${table}\` | *Operation:* \`${type}\``,
        },
      ],
    },
  ];

  if (type === "INSERT" && record) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*New Record:*\n${formatRecord(record)}`,
      },
    });
  } else if (type === "UPDATE") {
    if (old_record) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Before:*\n${formatRecord(old_record)}`,
        },
      });
    }
    if (record) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*After:*\n${formatRecord(record)}`,
        },
      });
    }
  } else if (type === "DELETE" && old_record) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Deleted Record:*\n${formatRecord(old_record)}`,
      },
    });
  }

  return {
    attachments: [
      {
        color,
        blocks,
      },
    ],
  };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  let payload: DatabaseWebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { table } = payload;

  // Only notify for configured tables
  if (WATCH_TABLES.length > 0 && !WATCH_TABLES.includes(table)) {
    return new Response(
      JSON.stringify({ skipped: true, reason: `Table '${table}' not in watchTables` }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  const slackMessage = buildSlackMessage(payload);

  const response = await fetch(SLACK_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(slackMessage),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("Slack API error:", text);
    return new Response(JSON.stringify({ error: "Slack API error", detail: text }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ success: true, table, type: payload.type }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
