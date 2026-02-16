# AI Chat Agent - Feature Documentation

**Version:** 1.3  
**Status:** ✅ Implemented  
**Added:** February 2026

---

## 📋 Overview

The AI Chat Agent is an integrated assistant that provides natural-language infrastructure management for all Supabase instances managed by Multibase. Users can interact via a slide-out chat panel to query, monitor, and operate their entire stack without navigating the UI manually.

The agent supports **tool calling** — it translates user requests into concrete API actions (e.g. "create a new instance called staging") and executes them after user confirmation.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Frontend                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ AiChatPanel  │  │ AiKeySection │  │ useAiAgent.ts │  │
│  │  (Chat UI)   │  │ (Key Config) │  │  (React Hook) │  │
│  └──────┬───────┘  └──────────────┘  └───────┬───────┘  │
│         │            SSE Stream              │          │
│         └────────────────────────────────────┘          │
└─────────────────────────┬───────────────────────────────┘
                          │ HTTPS / REST
┌─────────────────────────▼───────────────────────────────┐
│  Backend                                                │
│  ┌──────────────────┐  ┌─────────────────────────────┐  │
│  │ ai-agent.ts      │  │ AiAgentService.ts           │  │
│  │ (Router/Routes)  │──│ - Provider Adapters         │  │
│  │                  │  │ - Tool Definitions (30+)    │  │
│  │ Rate Limiting    │  │ - Tool Execution Engine     │  │
│  │ Auth Middleware   │  │ - System Prompt Generation  │  │
│  └──────────────────┘  └──────────┬──────────────────┘  │
│                                   │                     │
│  ┌────────────────┐  ┌────────────▼──────────────────┐  │
│  │ AiEncryption   │  │ Existing Services             │  │
│  │ (AES-256-GCM)  │  │ DockerManager, BackupService, │  │
│  └────────────────┘  │ InstanceManager, etc.         │  │
│                      └───────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## 🤖 Supported Providers & Models

Each user configures their own API key. Keys are encrypted at rest with AES-256-GCM.

| Provider         | Models                                                                   |
| :--------------- | :----------------------------------------------------------------------- |
| **OpenAI**       | GPT-4o, GPT-4o Mini, GPT-4 Turbo, GPT-3.5 Turbo                         |
| **Anthropic**    | Claude Sonnet 4, Claude 3.5 Sonnet, Claude 3.5 Haiku, Claude 3 Opus     |
| **Google Gemini** | Gemini 2.0 Flash, Gemini 1.5 Pro, Gemini 1.5 Flash                     |
| **OpenRouter**   | Any model via proxy (Claude, GPT, Llama 3.1, Mistral, DeepSeek, etc.)   |

---

## 🔧 Available Tools (30+)

The agent has access to all major Multibase operations via tool calling. Destructive actions require explicit user confirmation in the chat UI.

### Instance Management
| Tool                  | Description                                | Confirmation |
| :-------------------- | :----------------------------------------- | :----------- |
| `list_instances`      | List all instances with status & ports     | No           |
| `get_instance`        | Get detailed instance info & credentials   | No           |
| `create_instance`     | Create a new Supabase instance             | **Yes**      |
| `start_instance`      | Start a stopped instance                   | No           |
| `stop_instance`       | Stop a running instance                    | **Yes**      |
| `restart_instance`    | Restart an instance                        | No           |
| `delete_instance`     | Delete instance (optionally with volumes)  | **Yes**      |
| `get_instance_status` | Health & container states of an instance   | No           |

### Templates
| Tool               | Description                              | Confirmation |
| :----------------- | :--------------------------------------- | :----------- |
| `list_templates`   | List all available instance templates    | No           |
| `get_template`     | Get template details by ID               | No           |
| `create_template`  | Create a new instance template           | **Yes**      |
| `delete_template`  | Delete a template by ID                  | **Yes**      |
| `use_template`     | Create instance from template            | **Yes**      |

### Monitoring & Metrics
| Tool                   | Description                                    | Confirmation |
| :--------------------- | :--------------------------------------------- | :----------- |
| `get_system_metrics`   | System-wide CPU, memory, instance counts       | No           |
| `get_instance_metrics` | Per-service CPU & memory for an instance       | No           |
| `get_instance_uptime`  | Uptime statistics over N days                  | No           |

### Logs
| Tool                | Description                             | Confirmation |
| :------------------ | :-------------------------------------- | :----------- |
| `get_instance_logs` | All service logs for an instance        | No           |
| `get_service_logs`  | Logs for a specific service (e.g. kong) | No           |

### Backups
| Tool             | Description                              | Confirmation |
| :--------------- | :--------------------------------------- | :----------- |
| `list_backups`   | List all backups, filter by type         | No           |
| `create_backup`  | Create instance/full/database backup     | **Yes**      |
| `restore_backup` | Restore from a backup                    | **Yes**      |
| `delete_backup`  | Delete a backup                          | **Yes**      |

### Storage
| Tool            | Description                          | Confirmation |
| :-------------- | :----------------------------------- | :----------- |
| `list_buckets`  | List storage buckets for an instance | No           |
| `list_files`    | List files in a bucket               | No           |
| `create_bucket` | Create a new storage bucket          | **Yes**      |
| `delete_bucket` | Delete a storage bucket              | **Yes**      |
| `delete_file`   | Delete a file from a bucket          | **Yes**      |

### Database / SQL
| Tool          | Description                                   | Confirmation |
| :------------ | :-------------------------------------------- | :----------- |
| `execute_sql` | Execute SQL on an instance's PostgreSQL        | **Yes**      |

### Edge Functions
| Tool               | Description                      | Confirmation |
| :----------------- | :------------------------------- | :----------- |
| `list_functions`   | List edge functions              | No           |
| `get_function_logs`| Get logs for a specific function | No           |

### System / Audit
| Tool               | Description                              | Confirmation |
| :----------------- | :--------------------------------------- | :----------- |
| `get_audit_logs`   | Filtered audit log listing               | No           |
| `get_audit_stats`  | Audit statistics (totals, top actions)   | No           |
| `list_alerts`      | Active alerts and rules                  | No           |
| `list_schedules`   | Scheduled tasks overview                 | No           |
| `list_deployments` | Deployment history                       | No           |
| `get_deployment_stats` | Deployment statistics              | No           |
| `get_settings`     | System settings (passwords masked)       | No           |

---

## 🗄️ Database Schema

```prisma
model User {
  // ... existing fields ...
  aiProvider          String?   // 'openai', 'gemini', 'anthropic', 'openrouter'
  aiApiKeyEncrypted   String?   // AES-256-GCM encrypted API key
  aiModel             String?   // Selected model ID (e.g. 'gpt-4o-mini')
  aiChatSessions      AiChatSession[]
}

model AiChatSession {
  id        String          @id @default(uuid())
  userId    String
  title     String          @default("New Chat")
  createdAt DateTime        @default(now())
  updatedAt DateTime        @updatedAt
  user      User            @relation(...)
  messages  AiChatMessage[]
}

model AiChatMessage {
  id          Int            @id @default(autoincrement())
  sessionId   String
  role        String         // 'system' | 'user' | 'assistant' | 'tool'
  content     String
  toolCalls   String?        // JSON-serialized ToolCall[]
  toolResults String?        // JSON-serialized ToolResult[]
  createdAt   DateTime       @default(now())
  session     AiChatSession  @relation(...)
}
```

**Migration:** `20260215200000_add_ai_agent`

---

## 🔌 REST API Endpoints

All endpoints are prefixed with `/api/ai-agent` and require Bearer token authentication.

| Method   | Endpoint                | Description                              |
| :------- | :---------------------- | :--------------------------------------- |
| `GET`    | `/api-key/status`       | Check if user has an API key configured  |
| `PUT`    | `/api-key`              | Save/update API key, provider, and model |
| `DELETE` | `/api-key`              | Remove stored API key                    |
| `GET`    | `/sessions`             | List all chat sessions for current user  |
| `POST`   | `/sessions`             | Create a new chat session                |
| `GET`    | `/sessions/:id`         | Get session with all messages            |
| `DELETE` | `/sessions/:id`         | Delete a chat session                    |
| `GET`    | `/models`               | List available models for user's provider|
| `POST`   | `/chat`                 | Send a message (SSE streaming response)  |
| `POST`   | `/confirm-tool`         | Confirm a single destructive tool call   |
| `POST`   | `/confirm-tools`        | Confirm a batch of destructive tool calls|

### Rate Limiting

- **50 messages per hour** per user (in-memory tracking).

### Streaming (`POST /chat`)

The `/chat` endpoint uses **Server-Sent Events (SSE)** to stream responses. Chunk types:

```typescript
interface StreamChunk {
  type: 'text' | 'tool_call' | 'tool_result' | 'done' | 'error';
  content?: string;       // For text chunks
  toolCall?: ToolCall;    // For tool_call chunks (requires confirmation if destructive)
  toolResult?: ToolResult; // For tool_result chunks
  error?: string;         // For error chunks
}
```

---

## 🔐 Security

| Concern              | Implementation                                                       |
| :------------------- | :------------------------------------------------------------------- |
| **API Key Storage**  | AES-256-GCM encryption at rest (`AiEncryption.ts`)                   |
| **Encryption Key**   | Configurable via `AI_ENCRYPTION_KEY` env var, or derived via scrypt  |
| **Auth**             | All endpoints require valid Bearer session token                     |
| **Rate Limiting**    | 50 msgs/hr per user, in-memory tracking                              |
| **Destructive Ops**  | Require explicit user confirmation in UI before execution            |
| **Key Isolation**    | Each user manages their own key — no shared API key on the server    |

---

## 🖥️ Frontend Components

| Component        | File                          | Purpose                                        |
| :--------------- | :---------------------------- | :--------------------------------------------- |
| `AiChatPanel`    | `components/AiChatPanel.tsx`  | Slide-out chat panel with message rendering, tool result cards, batch confirmation UI |
| `AiKeySection`   | `components/AiKeySection.tsx` | Provider/model selection dropdown and API key input (in User Profile) |
| `useAiAgent`     | `hooks/useAiAgent.ts`         | React hooks: `useAiKeyStatus`, `useSaveAiKey`, `useDeleteAiKey`, `useAiSessions`, `useCreateAiSession`, `useDeleteAiSession`, `useAiSessionMessages`, `useSendAiMessage` |

---

## 💡 Usage Examples

```
User: "How many instances are running?"
Agent: → calls list_instances → "You have 3 instances: 
       auto-test-13 (running), autp-test-14 (running), supabase-2e50 (running)"

User: "Create a new instance called staging"
Agent: → calls create_instance (requires confirmation)
       → User clicks "Confirm" → instance is created

User: "Show me the postgres logs for auto-test-13"
Agent: → calls get_service_logs(name: "auto-test-13", service: "postgres")
       → displays formatted log output

User: "Run SELECT count(*) FROM auth.users on staging"
Agent: → calls execute_sql (requires confirmation)
       → User confirms → returns query result
```

---

## 📂 File Overview

```
dashboard/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma              # AiChatSession, AiChatMessage models + User AI fields
│   │   └── migrations/
│   │       └── 20260215200000_add_ai_agent/
│   │           └── migration.sql      # ALTER TABLE + CREATE TABLE statements
│   ├── src/
│   │   ├── routes/ai-agent.ts         # 11 REST endpoints, rate limiting, SSE streaming
│   │   ├── services/AiAgentService.ts # Provider adapters, 30+ tool definitions, tool executor
│   │   ├── services/MigrationService.ts # DB migration helper used by AI agent
│   │   └── utils/AiEncryption.ts      # AES-256-GCM encrypt/decrypt for API keys
│   └── server.ts                      # Mounts /api/ai-agent routes
│
└── frontend/
    └── src/
        ├── components/AiChatPanel.tsx  # Chat UI with markdown, tool cards, batch confirm
        ├── components/AiKeySection.tsx # Provider/model picker + key input
        ├── hooks/useAiAgent.ts        # 8 React Query hooks for all AI operations
        └── layouts/DashboardLayout.tsx # Integrates AiChatPanel toggle
```
