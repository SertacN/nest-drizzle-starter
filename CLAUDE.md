# CLAUDE.md

> 🇹🇷 Türkçesi: [CLAUDE.TR.md](CLAUDE.TR.md) — insan okuru için çeviri. Tools read THIS file;
> when the rules change, update both.

Guidance for Claude Code when working in this repo. Setup and commands live in README.md;
this file holds the RULES only.

## Project

A NestJS + TypeScript + Drizzle (PostgreSQL) API skeleton, in a pnpm monorepo. `apps/api` is
ready to run; `apps/web` is empty (the framework is chosen when a project starts) and
`packages/shared` holds the constants, types and API client shared by both ends.

## Stack

| Layer   | Choice                                                                                                                                                 |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Backend | NestJS 11 + Express 5 + `ws`, REST under `/api/v1/*`, TypeScript, **CommonJS**                                                                         |
| DB      | PostgreSQL 16 + Drizzle ORM (no Prisma anywhere)                                                                                                       |
| Auth    | JWT, access 15 min + refresh 30 days tracked in the DB. Web: **httpOnly cookies**; mobile: **Bearer** under `/auth/mobile/*`. Roles: `admin` \| `user` |
| Docs    | Swagger from class-validator DTOs, at `/api/docs`, development only                                                                                    |
| Deploy  | Docker Compose; Traefik is NOT in the compose file, it is the shared VPS instance                                                                      |

## How the API is organised (module-first)

`apps/api/src` is split by MODULE, not by layer — one task, one folder to open.

```
src/
├─ main.ts        bootstrap
├─ app.module.ts  EVERY module, grouped: infrastructure (core) then features (modules)
├─ core/          NOTHING module-specific: config, db, health, http, realtime, security,
│                 storage, utils
└─ modules/       auth/ example/ uploads/
```

Inside a module: `<name>.service.ts` (the only layer that talks to the DB) +
`<name>.controller.ts` + `dto/` + `<name>.module.ts` + `index.ts`. When a module serves more
than one audience, the HTTP surface is split by file (`public-<name>.controller.ts`,
`mobile-<name>.controller.ts`) while the service and the schema stay single copies — `auth/`
ships a cookie controller and a Bearer controller over one `AuthService`.

**Two rules (never break them):**

1. **Modules reach each other only through `index.ts`.** From `modules/x/` you never import
   `modules/y/y.service`.
2. **`core` depends on no module.** If a core file needs one, the design is wrong (signing a
   token belongs in core, the login endpoint belongs in a module).

Controllers handle the HTTP surface: a DTO in, a `ServiceResponse` out. They never build
queries and never build the response envelope — `ResponseTransformInterceptor` adds
`success`/`timestamp`. Services throw Nest's HTTP exceptions with a stable CODE as the message
(`throw new NotFoundException('example_not_found')`).

## Contracts and validation

- Request validation is **class-validator DTOs** with `@ApiProperty` — Swagger is generated
  from them, so a documented endpoint and a validated endpoint cannot drift apart.
- `packages/shared` holds what BOTH ends need: role/status lists, upload limits, response types
  and the typed API client. Enum lists are declared there and consumed by `pgEnum`, so the
  database type and the client-side type cannot drift.
- Shared has no runtime dependency on Nest, and the API compiles against shared's `dist` —
  `pnpm --filter shared build` before the first `api` build.
- Reusable normalisations (`trim`, `trimLowercase`) live in `core/http/transforms.ts`, not
  inline in each DTO.
- Route params reach a WHERE clause, so `:id` is always validated: `@Param('id', ParseUuid)`
  from `core/http/pipes` (the built-in `ParseUUIDPipe` throws prose, not a code).

## Response shape

Success (built by the interceptor, never by hand):

```json
{ "success": true, "message": "…", "data": {}, "meta": {}, "timestamp": "…" }
```

Error (built by `AllExceptionsFilter`): `error` is a stable CODE clients switch on, `details`
carries per-field validation messages. **A 500 never leaks its message** — the reason goes to
the log only.

## Database

- Tables live in `core/db/schema/<table-name>.ts`, one table per file, all re-exported from
  `schema/index.ts` (drizzle-kit's entry point).
- **SQL is never written by hand:** edit the schema → `pnpm --filter api db:generate` → read
  the generated SQL → `db:migrate`. Migrations are sequential, never skipped, never rolled
  back; you go back with a new migration.
- Services inject `@Inject(DRIZZLE) private readonly db: Database`.
- Soft delete (`is_deleted`) instead of removing the row. `is_active` is a DIFFERENT thing —
  a user-facing on/off switch (a disabled account, a row its owner paused). A table that needs
  both carries both columns; one flag can never mean both.

## Non-negotiables

- Every public (unauthenticated) endpoint must carry its own `@Throttle`, be strictly
  validated, and return no more fields than it needs.
- Ownership is part of every query — a row must never be reachable by id alone. Someone else's
  row returns 404, not 403 (do not leak that it exists).
- The refresh token pattern stays intact: rotation + reuse detection + family revoke. No cache
  and no auto-retry on the refresh endpoint.
- Auth cookies stay `httpOnly` + `sameSite: 'lax'` + `secure` in production, and the refresh
  cookie stays scoped to `/api/v1/auth`. On the web surface tokens never appear in a response
  body.
- `/api/v1/auth/mobile/*` is the ONE exception: a device has no cookie jar, so it gets the pair
  in the body and stores it itself. Those handlers set no cookie, and nothing else changes —
  same service, same rotation, same reuse detection. Never widen the exception to `/auth/*`.
- The WebSocket handshake accepts the ACCESS token as `?token=` (a device can set neither a
  cookie nor a header). The refresh token never goes in a URL, and anything logging upgrade
  URLs redacts that parameter.
- `ValidationPipe` runs with `whitelist: true` — never turn it off; it is what stops a client
  from smuggling `role: "admin"` into a body.
- Money and other critical arithmetic happens only on the server, inside a transaction; a value
  computed by the client is never trusted.
- `core/storage/storage.service.ts` is the only class that touches the disk. The
  `/api/uploads/*` path stays outside the `/api/v1` prefix — those URLs are in the database.
- A single API instance is assumed (WS state is in memory) — scaling out means Redis pub/sub
  first.
- Swagger stays off when `NODE_ENV=production`.

## Commits

Conventional Commits — `<type>(<scope>): <subject>`. Lowercase, imperative, no trailing period,
under ~72 characters. Types: `feat` `fix` `docs` `refactor` `chore` `build` `test` `style`
`perf`. Scope is `api`, `web`, `shared`, `db`, or the module name when that is narrower.

```
feat(notes): add the notes module with CRUD endpoints
fix(auth): clear the refresh cookie on the path it was set on
chore(deps): bump drizzle-orm to 0.45.2
```

Suggesting these is welcome (see the working agreement). Describe what the diff actually does —
read it first rather than restating the file names. A new app arrives as several commits (shared
contract, table + migration, module, frontend route), so propose the split when the staged
change covers more than one of those.

## Development

Claude Code does not start dev servers on its own — the user runs `pnpm dev` in their own
terminal. If verifying something genuinely needs a running server, check the port first
(`lsof -nP -iTCP:3000 -sTCP:LISTEN`) and ask the user if nothing is listening.

Postgres for development comes from `docker compose -f docker-compose.dev.yml up -d`; nothing
else runs in Docker locally.
