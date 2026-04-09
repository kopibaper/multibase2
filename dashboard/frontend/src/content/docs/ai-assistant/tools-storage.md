# AI Assistant — Storage & Auth Tools

---

## Storage Tools

### list_buckets

**Requires confirmation:** No

Lists all storage buckets for an instance.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `instanceName` | string | Instance name |

**Example prompt:**
```
List all storage buckets in instance "my-project".
```

---

### list_files

**Requires confirmation:** No

Lists files inside a storage bucket, optionally within a subfolder path.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `instanceName` | string | Instance name |
| `bucketId` | string | Bucket ID/name |
| `path` | string | Folder path (optional, default: root) |

**Example prompt:**
```
Show me all files in the "avatars" bucket in "my-project".
```

---

### create_bucket

**Requires confirmation:** YES

Creates a new storage bucket.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `instanceName` | string | Instance name |
| `bucketName` | string | Name for the new bucket |
| `isPublic` | boolean | If `true`, files are publicly accessible without auth (default: `false`) |

**Example prompt:**
```
Create a public bucket called "uploads" in instance "my-project".
```

---

### delete_bucket

**Requires confirmation:** YES

Deletes an entire storage bucket and all its contents.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `instanceName` | string | Instance name |
| `bucketId` | string | Bucket ID to delete |

---

### delete_file

**Requires confirmation:** YES

Deletes a specific file from a bucket.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `instanceName` | string | Instance name |
| `bucketId` | string | Bucket ID |
| `filePath` | string | Full path to the file within the bucket |

**Example prompt:**
```
Delete the file "photos/profile.jpg" from the "avatars" bucket in "my-project".
```

---

### get_file_url

**Requires confirmation:** No

Gets a public or signed (temporary) download URL for a file.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `instanceName` | string | Instance name |
| `bucketId` | string | Bucket ID |
| `filePath` | string | Path to the file |
| `signed` | boolean | If `true`, generates a temporary signed URL (default: `false`) |
| `expiresIn` | number | Expiry for signed URL in seconds (default: 3600) |

**Example prompts:**
```
Get the public URL for "documents/report.pdf" in bucket "files" of "my-project".
```
```
Generate a signed URL that expires in 10 minutes for "private/invoice.pdf"
in bucket "secure-docs" of "my-project".
```

---

## Auth Tools

### list_auth_users

**Requires confirmation:** No

Lists Auth users of a Supabase instance with pagination. Returns: user ID, email, phone, email confirmation status, creation date, last sign-in, and role.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `instanceName` | string | Instance name |
| `page` | number | Page number (default: 1) |
| `perPage` | number | Users per page (default: 50, max: 200) |

**Example prompts:**
```
Show me all auth users of instance "my-project".
```
```
Show page 2 of users in "my-project" (50 per page).
```

**Example response:**
```
| Email              | Created          | Last Sign-in     | Confirmed |
|--------------------|------------------|------------------|-----------|
| alice@example.com  | 2025-01-15       | 2026-04-07       | Yes       |
| bob@example.com    | 2025-03-22       | 2026-03-30       | Yes       |
| carol@example.com  | 2026-04-01       | —                | No        |
```

---

## Backups

| Tool | Confirmation | Description |
|------|-------------|-------------|
| `list_backups` | No | List all backups (optionally filtered by type) |
| `create_backup` | Yes | Create a new backup (instance, full, or database type) |
| `restore_backup` | Yes | Restore a backup to an instance |
| `delete_backup` | Yes | Delete a backup permanently |

**Example prompts:**
```
List all backups for instance "my-project".
```
```
Create a database backup for instance "my-project".
```
```
Restore backup "bkp_20260401" to instance "my-project".
```
