# AI Assistant — Database & RLS Tools

These tools allow the assistant to inspect and modify the PostgreSQL database of any Supabase instance, including Row-Level Security (RLS) policies.

---

## execute_sql

**Requires confirmation:** YES (always)

Executes any SQL statement on the PostgreSQL database of an instance. This is the most powerful database tool — use it for custom queries, migrations, or data changes.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `instanceName` | string | Instance name |
| `sql` | string | SQL statement to execute |

**Example prompts:**
```
Run this SQL on "my-project": SELECT count(*) FROM public.orders;
```
```
Insert a test row into the users table of instance "my-project".
```

> **Tip:** For read-only queries (SELECT), the assistant still asks for confirmation since it cannot auto-detect intent. You can simply confirm immediately.

---

## list_tables

**Requires confirmation:** No

Lists all tables in a schema (default: `public`).

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `instanceName` | string | Instance name |
| `schema` | string | Schema name (default: `public`) |

**Example prompt:**
```
What tables exist in instance "my-project"?
```

---

## describe_table

**Requires confirmation:** No

Shows all columns of a table: name, data type, nullable, and default value.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `instanceName` | string | Instance name |
| `schema` | string | Schema name (default: `public`) |
| `table` | string | Table name |

**Example prompt:**
```
Describe the "orders" table in instance "my-project".
```

---

## list_rls_policies

**Requires confirmation:** No

Lists all RLS policies for a table or all tables in a schema.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `instanceName` | string | Instance name |
| `schema` | string | Schema name (default: `public`) |
| `table` | string | Filter to a specific table (optional) |

**Example prompt:**
```
Show all RLS policies on the "orders" table in "my-project".
```

**Example response:**
```
| Table  | Policy Name         | Command | Roles           | Using Expression              |
|--------|---------------------|---------|-----------------|-------------------------------|
| orders | orders_own_rows     | SELECT  | authenticated   | auth.uid() = user_id          |
| orders | orders_insert_own   | INSERT  | authenticated   | —                             |
```

---

## enable_rls

**Requires confirmation:** YES

Enables Row-Level Security on a table. Once enabled, all rows are hidden by default until policies are added.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `instanceName` | string | Instance name |
| `schema` | string | Schema name (default: `public`) |
| `table` | string | Table name |

**Example prompt:**
```
Enable RLS on the "profiles" table in instance "my-project".
```

---

## disable_rls

**Requires confirmation:** YES

Disables Row-Level Security on a table (all rows become visible to all roles).

---

## create_rls_policy

**Requires confirmation:** YES

Creates a new RLS policy on a table.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `instanceName` | string | Yes | Instance name |
| `schema` | string | No | Schema (default: `public`) |
| `table` | string | Yes | Table name |
| `policyName` | string | Yes | Name for the new policy |
| `command` | `ALL` / `SELECT` / `INSERT` / `UPDATE` / `DELETE` | Yes | Which SQL command the policy applies to |
| `roles` | string | No | Comma-separated roles, e.g. `"authenticated, anon"` or `"PUBLIC"` |
| `usingExpression` | string | No | USING expression for SELECT/UPDATE/DELETE |
| `withCheckExpression` | string | No | WITH CHECK expression for INSERT/UPDATE |

**Common expressions:**
```sql
-- User can only see their own rows
auth.uid() = user_id

-- Only admins
auth.jwt() ->> 'role' = 'admin'

-- Allow all authenticated users
true
```

**Example prompt:**
```
Create an RLS policy on "orders" in "my-project" that lets authenticated users
only see their own orders (where user_id = auth.uid()).
```

---

## drop_rls_policy

**Requires confirmation:** YES

Deletes an RLS policy from a table.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `instanceName` | string | Instance name |
| `schema` | string | Schema (default: `public`) |
| `table` | string | Table name |
| `policyName` | string | Exact policy name to drop |

**Example prompt:**
```
Drop the policy "orders_own_rows" from the "orders" table in "my-project".
```

---

## Common RLS Patterns

### Users see their own rows
```sql
-- Policy: SELECT, authenticated
-- USING:
auth.uid() = user_id
```

### Public read, authenticated write
```sql
-- Policy 1: SELECT, PUBLIC
-- USING: true

-- Policy 2: INSERT, authenticated
-- WITH CHECK: true
```

### Admin-only access
```sql
-- Policy: ALL, authenticated
-- USING:
auth.jwt() ->> 'role' = 'admin'
```
