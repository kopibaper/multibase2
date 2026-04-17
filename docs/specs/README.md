# Spec-Driven Development

This directory contains feature specs that are written **before** implementation begins.
Each spec is the source of truth for one feature or API endpoint group.

## Workflow

```
/spec              →  scaffold docs/specs/<feature>.md + OpenAPI stub
spec-writer agent  →  expand into full spec with acceptance criteria + test cases
implement          →  code against the spec
api-contract-checker agent  →  verify no frontend/backend drift
PR with template   →  checklist confirms spec is updated
```

### Step-by-step

1. **Scaffold** — run `/spec` in Claude Code. Fill in feature name, user story, HTTP method + path.
2. **Expand** — run the `spec-writer` agent. It reads `openapi.yaml` + `prisma/schema.prisma` and produces:
   - User story
   - Acceptance criteria (numbered, testable)
   - OpenAPI endpoint stub (ready to paste into `openapi.yaml`)
   - Prisma model changes (if any)
   - Test cases to write (unit + E2E)
3. **Review** — edit the spec until it reflects exactly what should be built. Commit it.
4. **Implement** — write code to satisfy the acceptance criteria. Reference the spec in commit messages.
5. **Verify** — run the `api-contract-checker` agent to confirm the implementation matches `openapi.yaml` and no frontend calls are undocumented.
6. **PR** — the PR template checklist confirms the spec is up to date before merge.

## Spec File Format

```markdown
# Feature: <name>

## User Story

As a <role>, I want to <action> so that <benefit>.

## Acceptance Criteria

- [ ] AC1: ...
- [ ] AC2: ...

## API Changes

<!-- Paste the OpenAPI endpoint stub here -->

## Data Model Changes

<!-- Prisma schema additions/modifications -->

## Test Cases

### Unit

- [ ] ...

### E2E

- [ ] ...

## Notes

<!-- Edge cases, security considerations, open questions -->
```

## File Naming

`docs/specs/<kebab-case-feature-name>.md`

Examples:

- `docs/specs/instance-pause.md`
- `docs/specs/org-invitations.md`
- `docs/specs/webhook-retry.md`
