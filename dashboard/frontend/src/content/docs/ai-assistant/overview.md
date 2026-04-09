# AI Assistant — Overview & Setup

**Status:** ✅ Available  
**Access:** Floating chat button (bottom-right) in the Dashboard  
**Supported Providers:** OpenAI, Anthropic, Google Gemini, OpenRouter

---

## What is the AI Assistant?

The Multibase AI Assistant is a fully integrated AI helper with direct access to all dashboard features. It can manage Supabase instances, query databases, create Edge Functions, configure RLS policies, manage storage, and much more — all via natural language.

The assistant uses **Tool Calls**: when it needs to perform an action it selects the appropriate tool automatically. For destructive actions (delete, create, SQL writes, RLS changes) it always asks for **user confirmation** before executing.

---

## Setup (Configure API Key)

1. Open the Dashboard → click **Profile** (top-right)
2. Scroll to the **AI Assistant** section
3. Choose an **AI Provider** (OpenAI, Anthropic, Google Gemini, OpenRouter)
4. Enter your **API Key** and save
5. Click the chat button in the bottom-right corner — you're ready!

> **Security:** API keys are stored AES-256 encrypted in the database and never transmitted in plain text.

---

## Supported Models

| Provider | Recommended Model | Notes |
|----------|------------------|-------|
| **OpenAI** | `gpt-4o` / `gpt-4o-mini` | Best tool-call integration |
| **Anthropic** | `claude-3-5-sonnet-20241022` | Highly accurate responses |
| **Google Gemini** | `gemini-1.5-pro` | Cost-efficient |
| **OpenRouter** | Any model | Access many models via one API |

---

## Basic Usage

### Start a Chat
Click the **bot button** in the bottom-right corner of the dashboard. A chat panel slides open.

### New Conversation
Use the **+** icon at the top of the panel to start a new session. Previous sessions are saved and can be resumed at any time.

### Tool Confirmation
When the assistant wants to perform a **destructive action** (e.g. delete an instance, run SQL, create an RLS policy), a confirmation prompt appears:

```
The assistant wants to execute:
   delete_instance { name: "my-project" }

[Confirm]  [Cancel]
```

The action is only executed after you confirm.

### Attach Images
You can upload screenshots or diagrams into the chat. The assistant can analyse images (OpenAI and Anthropic providers).

---

## Example Prompts

```
Show me all running instances.
```
```
Create a new Supabase instance called "test-project" on localhost port 5500.
```
```
What tables does the instance "my-project" have?
```
```
Enable RLS on the "orders" table in instance "my-project" and create a policy
that only lets authenticated users see their own rows.
```
```
Create an Edge Function called "hello-world" in instance "my-project".
```
```
Show me the last 50 auth users of instance "my-project".
```

---

## Rate Limiting

- **50 messages per hour** per user
- Applies to all AI providers equally
- If exceeded, an error message appears; the limit resets after one hour

---

## Tool Documentation (by Category)

| Category | Link |
|----------|------|
| Instance Management | [Instance Tools](./tools-instances) |
| Database & RLS | [Database Tools](./tools-database) |
| Storage & Auth | [Storage Tools](./tools-storage) |
| Edge Functions | [Functions Tools](./tools-functions) |
| Monitoring & Logs | [Monitoring Tools](./tools-monitoring) |
