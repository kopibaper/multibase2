// PDF Generator using Browserless
// Supabase Edge Function: generate-pdf

const BROWSERLESS_API_KEY = Deno.env.get("BROWSERLESS_API_KEY") ?? "{{browserlessApiKey}}";
const BROWSERLESS_URL = `https://chrome.browserless.io/pdf?token=${BROWSERLESS_API_KEY}`;

interface PdfOptions {
  format?: "A4" | "A3" | "Letter" | "Legal";
  margin?: {
    top?: string;
    bottom?: string;
    left?: string;
    right?: string;
  };
  landscape?: boolean;
  printBackground?: boolean;
  scale?: number;
}

interface PdfRequest {
  html: string;
  options?: PdfOptions;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: PdfRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { html, options = {} } = body;

  if (!html || typeof html !== "string") {
    return new Response(JSON.stringify({ error: "html field is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const pdfOptions = {
    format: options.format ?? "A4",
    margin: options.margin ?? {
      top: "20mm",
      bottom: "20mm",
      left: "15mm",
      right: "15mm",
    },
    landscape: options.landscape ?? false,
    printBackground: options.printBackground ?? true,
    scale: options.scale ?? 1,
  };

  const browserlessPayload = {
    html,
    options: pdfOptions,
  };

  const response = await fetch(BROWSERLESS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
    },
    body: JSON.stringify(browserlessPayload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Browserless error:", errorText);
    return new Response(
      JSON.stringify({ error: "PDF generation failed", detail: errorText }),
      {
        status: response.status,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const pdfBuffer = await response.arrayBuffer();

  return new Response(pdfBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="document.pdf"',
      "Content-Length": pdfBuffer.byteLength.toString(),
    },
  });
});
