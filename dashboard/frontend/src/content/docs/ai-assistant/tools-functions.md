# AI Assistant — Edge Functions Tools

Manage Deno-based Edge Functions deployed alongside each Supabase instance.

---

## list_functions

**Requires confirmation:** No

Lists all Edge Functions deployed for an instance.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `instanceName` | string | Instance name |

**Example prompt:**
```
Show all edge functions in instance "my-project".
```

---

## get_function

**Requires confirmation:** No

Retrieves the full source code of an existing Edge Function.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `instanceName` | string | Instance name |
| `functionName` | string | Function name |

**Example prompt:**
```
Show me the code of the "send-email" function in "my-project".
```

---

## create_function

**Requires confirmation:** YES

Creates a new Edge Function file. If no code is provided, a minimal hello-world template is used.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `instanceName` | string | Yes | Instance name |
| `functionName` | string | Yes | Function name (alphanumeric + hyphens) |
| `code` | string | No | Deno TypeScript code. If omitted, a starter template is created. |

**Starter template (auto-generated if no code given):**
```typescript
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

serve(async (_req) => {
  return new Response(JSON.stringify({ message: "Hello from my-function!" }), {
    headers: { "Content-Type": "application/json" },
  });
});
```

**Example prompts:**
```
Create a new edge function called "hello-world" in instance "my-project".
```
```
Create an edge function "send-welcome-email" in "my-project" that sends
a welcome email via Resend when called with a POST request containing { email }.
```

---

## update_function

**Requires confirmation:** YES

Overwrites the source code of an existing Edge Function.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `instanceName` | string | Instance name |
| `functionName` | string | Function name |
| `code` | string | New Deno TypeScript source code |

**Example prompt:**
```
Update the "hello-world" function in "my-project" to return the current
timestamp in the response.
```

> **Tip:** Ask the assistant to `get_function` first, then describe the changes you want — it will write the updated code and confirm before saving.

---

## delete_function

**Requires confirmation:** YES

Permanently deletes an Edge Function.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `instanceName` | string | Instance name |
| `functionName` | string | Function name to delete |

---

## deploy_function

**Requires confirmation:** YES

Deploys (activates/restarts) an Edge Function so that code changes take effect in the running container.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `instanceName` | string | Instance name |
| `functionName` | string | Function name to deploy |

**Example prompt:**
```
Deploy the "send-email" function in "my-project".
```

---

## invoke_function

**Requires confirmation:** No

Calls an Edge Function and returns its HTTP response. Useful for testing without leaving the chat.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `instanceName` | string | Instance name |
| `functionName` | string | Function name |
| `payload` | object | JSON body to send (optional) |
| `method` | `GET` / `POST` / `PUT` / `DELETE` | HTTP method (default: `POST`) |

**Example prompts:**
```
Test the "hello-world" function in "my-project".
```
```
Invoke "process-order" in "my-project" with payload { "orderId": "123" }.
```

---

## get_function_logs

**Requires confirmation:** No

Retrieves recent logs from the edge functions runtime container.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `instanceName` | string | Instance name |
| `functionName` | string | Function name (optional) |

**Example prompt:**
```
Show me the logs for the "send-email" function in "my-project".
```

---

## Typical Workflow

1. **List** existing functions:
   ```
   What edge functions does "my-project" have?
   ```
2. **Read** a function's code before editing:
   ```
   Show me the code of "process-payment" in "my-project".
   ```
3. **Update** the function:
   ```
   Add error handling to "process-payment" in "my-project" — if the Stripe call
   fails, return a 500 with { error: "payment_failed" }.
   ```
4. **Deploy** to apply:
   ```
   Deploy "process-payment" in "my-project".
   ```
5. **Test** it:
   ```
   Invoke "process-payment" in "my-project" with { "amount": 100, "currency": "usd" }.
   ```
