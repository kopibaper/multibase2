// Resend Transactional Email Handler
// Supabase Edge Function: send-email

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "{{resendApiKey}}";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "{{fromEmail}}";

interface EmailRequest {
  to: string | string[];
  subject: string;
  template: "welcome" | "password-reset" | "order-confirmation" | "custom";
  data: Record<string, unknown>;
}

function renderTemplate(template: string, data: Record<string, unknown>): string {
  switch (template) {
    case "welcome":
      return `
        <h1>Welcome, ${data.name ?? "there"}!</h1>
        <p>Thanks for signing up${data.appName ? ` to <strong>${data.appName}</strong>` : ""}.</p>
        <p>We're excited to have you on board.</p>
        ${data.loginUrl ? `<p><a href="${data.loginUrl}" style="background:#0070f3;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;">Get Started</a></p>` : ""}
      `;
    case "password-reset":
      return `
        <h1>Reset your password</h1>
        <p>We received a request to reset the password for your account.</p>
        ${data.resetUrl ? `<p><a href="${data.resetUrl}" style="background:#0070f3;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;">Reset Password</a></p>` : ""}
        <p>This link expires in ${data.expiresIn ?? "1 hour"}.</p>
        <p>If you didn't request this, you can safely ignore this email.</p>
      `;
    case "order-confirmation":
      return `
        <h1>Order Confirmed!</h1>
        <p>Thank you for your order${data.orderNumber ? ` <strong>#${data.orderNumber}</strong>` : ""}.</p>
        ${data.total ? `<p>Total: <strong>${data.total}</strong></p>` : ""}
        ${data.items && Array.isArray(data.items)
          ? `<ul>${(data.items as Record<string, unknown>[]).map((item) => `<li>${item.name} × ${item.qty} — ${item.price}</li>`).join("")}</ul>`
          : ""
        }
        ${data.trackingUrl ? `<p><a href="${data.trackingUrl}">Track your order</a></p>` : ""}
      `;
    default:
      // custom: data.html should be provided
      return (data.html as string) ?? "<p>No content provided.</p>";
  }
}

function wrapInLayout(content: string, subject: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${subject}</title></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333;">
  ${content}
  <hr style="border:none;border-top:1px solid #eee;margin-top:32px;">
  <p style="color:#999;font-size:12px;">You're receiving this email because you interacted with our service.</p>
</body>
</html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: EmailRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { to, subject, template, data } = body;

  if (!to || !subject || !template) {
    return new Response(
      JSON.stringify({ error: "to, subject, and template are required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const htmlContent = renderTemplate(template, data ?? {});
  const html = wrapInLayout(htmlContent, subject);

  const resendPayload = {
    from: FROM_EMAIL,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
  };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(resendPayload),
  });

  const result = await response.json();

  if (!response.ok) {
    console.error("Resend API error:", result);
    return new Response(JSON.stringify({ error: result.message ?? "Resend API error" }), {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ id: result.id, success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
