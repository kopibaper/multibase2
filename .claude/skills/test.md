---
name: test
description: Run the full Multibase test suite (backend unit, frontend component, E2E)
---

Run automated tests for Multibase and report results.

## Steps

1. **Backend unit tests** (Vitest):

```bash
cd dashboard/backend && npm test 2>&1
```

2. **Frontend component tests** (Vitest + Testing Library):

```bash
cd dashboard/frontend && npm test 2>&1
```

3. **E2E tests** (Playwright) – requires dev servers running:

```bash
cd e2e && npx playwright test 2>&1
```

4. **Coverage report** (backend):

```bash
cd dashboard/backend && npm run test:coverage 2>&1
```

## Run specific test file

```bash
cd dashboard/backend && npx vitest run src/__tests__/middleware/validate.test.ts
cd dashboard/frontend && npx vitest run src/__tests__/contexts/AuthContext.test.tsx
cd e2e && npx playwright test auth.spec.ts
```

## Watch mode (interactive)

```bash
cd dashboard/backend && npm run test:watch
cd dashboard/frontend && npm run test:watch
```

## Analyze results

After running tests:

- Report total passed/failed/skipped counts
- Show full error output for any failures
- Identify which test file and test case failed
- Suggest a fix for the failing test

## TypeScript check (no tests needed)

```bash
cd dashboard/backend && npx tsc --noEmit 2>&1
cd dashboard/frontend && npx tsc --noEmit 2>&1
```
