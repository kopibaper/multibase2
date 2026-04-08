# AI Assistant — Instance Management Tools

These tools let the assistant manage Supabase instances on your behalf.

---

## list_instances

**Requires confirmation:** No

Lists all Supabase instances with their current status, ports, and health information.

**Example prompt:**
```
Show me all my instances.
```

**Example response:**
```
| Name         | Status  | Port  | Health |
|--------------|---------|-------|--------|
| my-project   | running | 6837  | healthy |
| stage2       | stopped | 6838  | —      |
```

---

## get_instance

**Requires confirmation:** No

Returns detailed information about a specific instance: ports, credentials, service status, API keys, JWT secret, etc.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | Instance name |

**Example prompt:**
```
Show me the details for instance "my-project".
```

---

## get_instance_status

**Requires confirmation:** No

Returns the real-time status and health of each service (postgres, auth, rest, realtime, storage, etc.) for a specific instance.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | Instance name |

---

## create_instance

**Requires confirmation:** YES

Creates a new Supabase instance with Docker containers. The assistant will ask for all required details before proposing the action.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | Instance name (alphanumeric + hyphens) |
| `deploymentType` | `localhost` / `cloud` | Yes | Deployment type |
| `domain` | string | Cloud only | Custom domain |
| `protocol` | `http` / `https` | No | Default: `http` for localhost, `https` for cloud |
| `basePort` | number | No | Auto-assigned if omitted |
| `resourceLimits` | object | No | `preset: small/medium/large` or custom `cpus`/`memory` |

**Presets:**
- `small` — 0.5 CPU, 512 MB RAM
- `medium` — 1 CPU, 1 GB RAM
- `large` — 2 CPU, 2 GB RAM

**Example prompt:**
```
Create a new instance called "production" with 1 CPU and 1 GB RAM on localhost.
```

---

## start_instance

**Requires confirmation:** No

Starts a stopped instance.

**Example prompt:**
```
Start instance "stage2".
```

---

## stop_instance

**Requires confirmation:** YES

Stops a running instance (containers are paused, data is preserved).

---

## restart_instance

**Requires confirmation:** No

Restarts all containers of an instance.

---

## delete_instance

**Requires confirmation:** YES

Permanently deletes an instance. Optionally also removes volumes (all data).

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | Instance name |
| `removeVolumes` | boolean | If `true`, all persistent data is also deleted (irreversible) |

---

## Templates

| Tool | Confirmation | Description |
|------|-------------|-------------|
| `list_templates` | No | List all saved instance templates |
| `get_template` | No | View a template's configuration |
| `create_template` | Yes | Save the current config as a reusable template |
| `delete_template` | Yes | Delete a template |
| `use_template` | Yes | Create a new instance from a template |
