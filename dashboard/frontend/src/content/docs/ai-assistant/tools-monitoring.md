# AI Assistant — Monitoring & Logs Tools

Tools for observing health, performance, logs, alerts, schedules, and deployments.

---

## Metrics

### get_system_metrics

**Requires confirmation:** No

Returns system-wide metrics: total CPU usage, total memory usage, number of running/stopped instances, and overall health.

**Example prompt:**
```
What is the current system resource usage?
```

---

### get_instance_metrics

**Requires confirmation:** No

Returns per-instance resource metrics: CPU, memory, and network usage for each container.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | Instance name |

**Example prompt:**
```
Show me the resource usage of instance "my-project".
```

---

### get_instance_uptime

**Requires confirmation:** No

Returns uptime statistics for an instance over a time window (default: last 30 days).

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | Instance name |
| `days` | number | Number of days to look back (default: 30) |

**Example prompt:**
```
What is the uptime of "my-project" over the last 7 days?
```

---

## Logs

### get_instance_logs

**Requires confirmation:** No

Returns recent log output from all containers of an instance combined.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | Instance name |
| `tail` | number | Number of log lines (default: 50) |

---

### get_service_logs

**Requires confirmation:** No

Returns logs from a specific service container within an instance.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | Instance name |
| `service` | string | Service name: `postgres`, `auth`, `rest`, `realtime`, `storage`, `kong`, `studio`, `functions` |
| `tail` | number | Number of lines (default: 100) |

**Example prompts:**
```
Show the last 200 lines of the auth service logs for "my-project".
```
```
Are there any errors in the postgres logs of "my-project"?
```

---

## Alerts

### list_alerts

**Requires confirmation:** No

Lists all active alerts and alert rules, optionally filtered by instance.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `instanceId` | string | Filter by instance (optional) |

**Example prompt:**
```
Show me all current alerts.
```

---

## Audit Logs

### get_audit_logs

**Requires confirmation:** No

Returns audit log entries (dashboard actions such as instance create, backup, SQL execute, etc.).

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `action` | string | Filter by action type, e.g. `INSTANCE_CREATE`, `BACKUP_CREATE` (optional) |
| `limit` | number | Max entries (default: 50, max: 200) |
| `startDate` | string | ISO date string for range start |
| `endDate` | string | ISO date string for range end |

**Example prompts:**
```
Show me the last 100 audit log entries.
```
```
Show all BACKUP_CREATE events from the last week.
```

---

### get_audit_stats

**Requires confirmation:** No

Returns aggregate audit statistics: total events, events in last 24h, last 7 days, and failed events.

**Example prompt:**
```
Give me an overview of audit activity.
```

---

## Schedules & Deployments

| Tool | Confirmation | Description |
|------|-------------|-------------|
| `list_schedules` | No | List all scheduled backup tasks |
| `list_deployments` | No | List deployment history (filterable by instance or status) |
| `get_deployment_stats` | No | Aggregate stats: total, pending, running, success, failed deployments |

**Example prompts:**
```
Show me all scheduled tasks.
```
```
List the last 20 deployments for instance "my-project".
```
```
What is the deployment success rate overall?
```

---

## Settings

### get_settings

**Requires confirmation:** No

Returns current global system settings (SMTP config, etc.). Sensitive values such as passwords are masked.

**Example prompt:**
```
Show me the current SMTP settings.
```
