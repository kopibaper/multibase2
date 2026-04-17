---
name: security-scan
description: Run a security audit – npm audit, secret detection, .env checks, recent failed logins
---

Run a comprehensive security scan of the Multibase codebase and infrastructure.

## Steps

### 1. Dependency vulnerabilities

```bash
cd dashboard/backend && npm audit --audit-level=moderate 2>&1
echo "---"
cd dashboard/frontend && npm audit --audit-level=moderate 2>&1
```

### 2. Check for hardcoded secrets in source code

```bash
grep -rn \
  -e "password\s*=\s*['\"][^'\"]\+['\"]" \
  -e "secret\s*=\s*['\"][^'\"]\+['\"]" \
  -e "api_key\s*=\s*['\"][^'\"]\+['\"]" \
  -e "mb_[a-f0-9]\{40\}" \
  --include="*.ts" --include="*.tsx" --include="*.js" \
  --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git \
  dashboard/ 2>/dev/null | grep -v "test\|spec\|example\|\.env" | head -30
```

### 3. Verify .env files are not committed

```bash
git ls-files dashboard/backend/.env dashboard/frontend/.env shared/.env 2>/dev/null
git log --all --full-history -- "**/.env" "**/.env.local" 2>/dev/null | head -10
```

### 4. Check .gitignore covers sensitive files

```bash
grep -E "\.env$|\.env\." .gitignore dashboard/backend/.gitignore dashboard/frontend/.gitignore 2>/dev/null
```

### 5. Recent failed login attempts (local DB)

```bash
sqlite3 dashboard/backend/prisma/data/multibase.db \
  "SELECT datetime(createdAt/1000, 'unixepoch') as time, action, ipAddress, details FROM AuditLog WHERE action='USER_LOGIN' AND success=0 ORDER BY createdAt DESC LIMIT 10;" 2>/dev/null
```

### 6. Check for outdated packages with known CVEs

```bash
cd dashboard/backend && npx npm-check-updates --doctor 2>/dev/null | head -30
```

### 7. Check TypeScript for type safety issues

```bash
cd dashboard/backend && npx tsc --noEmit 2>&1 | head -40
```

## Report

After running all checks, provide:

- **CRITICAL**: Issues requiring immediate action (exposed secrets, critical CVEs)
- **HIGH**: Serious vulnerabilities (high-severity npm audit findings)
- **MEDIUM**: Moderate issues (medium CVEs, suspicious patterns)
- **INFO**: Informational findings

Prioritize and suggest remediation for each finding.
