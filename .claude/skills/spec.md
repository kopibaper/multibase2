# /spec — Scaffold a new feature spec

Scaffold a spec-first feature for the Multibase2 project.

## Steps

1. Ask the user for the following (all required):
   - **Feature name** (e.g. "Instance Pause", "Org Invitations")
   - **User story** ("As a [role], I want to [action] so that [benefit]")
   - **HTTP method + path** (e.g. `POST /api/instances/:name/pause`)
   - **Request body fields** (name, type, required/optional)
   - **Response shape** (what fields does the success response contain?)
   - **Auth requirement** (which role/scope is needed?)

2. Create the file `docs/specs/<kebab-case-feature-name>.md` with this content:

````markdown
# Feature: <name>

## User story

As a **<role>**, I want to **<action>** so that **<benefit>**.

## Acceptance criteria

- [ ] AC1:
- [ ] AC2:
- [ ] AC3:

## API changes

### New endpoint

```yaml
# Paste this into dashboard/backend/openapi.yaml under paths:
<path>:
  <method>:
    tags: [<tag>]
    summary: <summary>
    operationId: <camelCaseName>
    security:
      - bearerAuth: []
      - apiKeyAuth: []
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required: [<required fields>]
            properties:
              <field>:
                type: <type>
    responses:
      '200':
        description: <success description>
        content:
          application/json:
            schema:
              type: object
              properties:
                <field>:
                  type: <type>
      '400':
        $ref: '#/components/responses/BadRequest'
      '401':
        $ref: '#/components/responses/Unauthorized'
      '403':
        $ref: '#/components/responses/Forbidden'
```
````

## Data model changes

<!-- Describe any Prisma schema additions here -->

## Middleware chain

<!-- requireAuth → requireScope(SCOPES.X.Y) → validate(XSchema) → handler -->

## Test cases

### Unit tests

- [ ]

### Integration tests

- [ ] <METHOD> <path> — success
- [ ] <METHOD> <path> — validation failure (400)
- [ ] <METHOD> <path> — unauthenticated (401)

### E2E tests

- [ ]

## Security considerations

<!-- Rate limiting, audit logging action name, sensitive fields -->

## Open questions

- [ ]

```

3. Tell the user:
   - The spec file was created at `docs/specs/<kebab-case>.md`
   - Next step: run the **`spec-writer`** agent (`use agent spec-writer`) to expand the spec with full detail
   - Then update `dashboard/backend/openapi.yaml` with the endpoint stub from the spec
   - Commit the spec before writing any implementation code

## Notes
- File name: lowercase, hyphens, no spaces — `docs/specs/instance-pause.md`
- Do not write implementation code during this skill
- The spec is committed first, then implementation follows
```
