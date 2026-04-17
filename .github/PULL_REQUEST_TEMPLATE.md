## Summary

<!-- One paragraph: what does this PR do and why? -->

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Refactor / tech debt
- [ ] Docs / config only

## Spec-driven checklist

- [ ] Feature spec exists in `docs/specs/` (or N/A for bug fixes)
- [ ] `dashboard/backend/openapi.yaml` updated if API contract changed
- [ ] `api-contract-checker` agent run — no frontend/backend drift reported

## Quality checklist

- [ ] Tests added or updated (`npm test -w dashboard/backend`)
- [ ] TypeScript passes (`npx tsc --noEmit`)
- [ ] `security-scanner` agent run — no new vulnerabilities
- [ ] No `.env` or secrets committed

## Breaking changes

<!-- If this is a breaking change, describe the migration path -->

## Screenshots / recordings

<!-- Optional: attach if this touches UI -->
