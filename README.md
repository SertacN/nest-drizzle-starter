# nest-drizzle-starter

> 🇹🇷 Bu dosyanın Türkçesi: [README-TR.md](README-TR.md)

A NestJS + TypeScript + Drizzle (PostgreSQL) API skeleton. A pnpm monorepo: `apps/api` is
ready to run, `apps/web` is empty — you pick the frontend framework when the project starts.

What comes with it: cookie-based JWT auth (access + refresh, with rotation and reuse
detection), role guards, Swagger docs, image uploads (re-encoded to WebP by sharp), a
cookie-authenticated WebSocket gateway, rotating file logs, a Postgres-only compose file for
development and a Traefik-labelled one for production.

## Quick start

```bash
cp .env.example .env                              # change the JWT secrets
pnpm install
docker compose -f docker-compose.dev.yml up -d    # postgres only
pnpm --filter shared build                        # api compiles against shared's dist
pnpm --filter api db:migrate
pnpm dev                                          # api on :3000
```

Create the first user:

```bash
pnpm --filter api user:create admin@example.com secret123 "Admin" admin
```

Check it:

```bash
curl localhost:3000/api/v1/health
curl -c cookies.txt -X POST localhost:3000/api/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"admin@example.com","password":"secret123"}'
curl -b cookies.txt localhost:3000/api/v1/auth/me
```

Interactive API docs: <http://localhost:3000/api/docs> (development only).

## Commands

| Command                                                          | Where | What it does                                            |
| ---------------------------------------------------------------- | ----- | ------------------------------------------------------- |
| `pnpm dev`                                                       | root  | runs every package that has a `dev` script, in parallel |
| `pnpm build` / `pnpm check` / `pnpm lint`                        | root  | builds / typechecks / lints every package               |
| `pnpm --filter api db:generate`                                  | api   | generates a migration from the schema                   |
| `pnpm --filter api db:migrate`                                   | api   | applies pending migrations                              |
| `pnpm --filter api db:studio`                                    | api   | opens Drizzle Studio                                    |
| `pnpm --filter api user:create <email> <password> <name> [role]` | api   | creates a user                                          |

## Layout

```
apps/api/src/
├─ main.ts           bootstrap: pipes, filter, interceptor, cors, cookies, swagger, ws adapter
├─ app.module.ts     EVERY module in one file — the NestJS counterpart of a router
├─ core/             NOTHING module-specific lives here
│  ├─ config/        env.validation.ts (Joi — a bad deploy fails at boot), winston.config.ts
│  ├─ db/            drizzle.module.ts (the DRIZZLE token), schema/ (tables), migrations/, migrate.ts
│  ├─ health/        health check that actually hits the database
│  ├─ http/          decorators, dto, filters, guards, interceptors, middleware, pipes, types
│  ├─ realtime/      WebSocket gateway
│  ├─ security/      token.service.ts — signing/verifying JWTs
│  ├─ storage/       the ONLY class that touches the disk
│  └─ utils/         password, duration
└─ modules/          product code: auth/ example/ uploads/
packages/shared/src/ constants + types + api-client — the contract shared with the frontend
```

### Two rules (do not break them)

1. **Modules reach each other only through `index.ts`.** From `modules/x/` you never import
   `modules/y/y.service`, you import `modules/y`.
2. **`core` depends on no module.** If a file in core needs one, the design is wrong (signing a
   token belongs in core, the login endpoint belongs in a module).

### Module skeleton

```
modules/<name>/
├─ <name>.service.ts             the ONLY layer that talks to the DB
├─ <name>.controller.ts          HTTP surface: DTO in, ServiceResponse out
├─ public-<name>.controller.ts   (optional) the same module's anonymous surface
├─ dto/                          class-validator + @ApiProperty — Swagger is generated from these
├─ <name>.module.ts              wiring
└─ index.ts                      the module's public API
```

A new module = copy `modules/example/`, add one import and one line to `app.module.ts`.

## Response shape

Every successful response leaves in the same envelope, added by `ResponseTransformInterceptor`
— controllers only return `{ message, data?, meta? }`:

```json
{ "success": true, "message": "Signed in", "data": { }, "timestamp": "2026-08-07T07:48:29.362Z" }
```

Errors go through `AllExceptionsFilter` instead. `error` is a stable CODE clients switch on and
translate; free-form text belongs in `details`:

```json
{ "success": false, "error": "invalid_credentials", "statusCode": 401, "timestamp": "…" }
{ "success": false, "error": "validation_error", "statusCode": 400,
  "details": ["email must be an email"], "timestamp": "…" }
```

A 500 never leaks its message — the real reason goes to the log, keyed by the same timestamp.

## Database

Tables live under `apps/api/src/core/db/schema/`, one file per table; `index.ts` re-exports them
all and is the entry point of `drizzle.config.ts` — a table missing from that barrel does not
exist as far as `db:generate` is concerned.

SQL is never written by hand:

```bash
# 1. write or edit schema/<table>.ts, add it to index.ts
pnpm --filter api db:generate    # 2. SQL + meta snapshot are generated
pnpm --filter api db:migrate     # 3. applied
```

Migrations are sequential, never skipped and never rolled back — you go back with a new
migration. Read the generated `.sql` before applying it: Drizzle sometimes resolves a column
rename as "drop + add", and that is data loss.

Services inject the client with `@Inject(DRIZZLE) private readonly db: Database`.

Prefer deactivating (`is_active`) over deleting, so history and the rows referencing it survive.

## Auth

A single user universe (the `users` table) with authority split by `role`. **Tokens are never
in a response body** — they are httpOnly cookies the browser cannot read, so an XSS bug cannot
walk off with the session. Access tokens last 15 minutes, refresh tokens 30 days and are
**tracked in the database**:

- Every refresh rotates: the old row is burned with `used_at` and a new row is opened.
- A token that comes back after it was spent counts as stolen and every token in its
  `family_id` is revoked. A 10-second grace window keeps races (a dropped connection, a second
  tab) from being mistaken for theft.
- Logout revokes the whole family; a password change revokes ALL of the user's tokens but hands
  a fresh pair back to the tab that made the request.

Do not break this pattern: caching or auto-retrying the refresh endpoint sets off reuse
detection for the wrong reason.

Endpoints: `POST /api/v1/auth/{register,login,refresh,logout}`, `GET|PATCH /api/v1/auth/me`.
If you do not want open sign-ups, delete the `register` handler from `auth.controller.ts` and
add users with `user:create`.

Guarding a route:

```ts
@UseGuards(JwtGuard)                    // requires a session
@UseGuards(JwtGuard, RolesGuard)        // …and a role
@Roles('admin')
```

`@GetUser('id')` gives the caller's id; `@GetUser()` the whole `AuthContext`.

## Uploads

`POST /api/v1/uploads/image` (session required, multipart field name `file`) converts the image
to WebP with sharp, writes it under `<UPLOAD_DIR>/<userId>/` and returns a public URL.
Re-encoding strips EXIF (location data!) and guarantees the bytes really are an image.

The only class that touches the disk is `core/storage/storage.service.ts` — switching to S3
should mean changing that file and nothing else. The served URL (`/api/uploads/...`) sits
OUTSIDE the `/api/v1` prefix on purpose: those URLs are stored in the database and must not
move when the API version does.

**In production, backing up the `uploads` volume matters as much as `pgdata`: those files are
not in the database dump.**

## Realtime

`ws://…/ws` — raw `ws`, no client library needed. The browser sends the auth cookie on the
handshake by itself, so there is no join message and no token in a query string. An
unauthenticated socket is closed with code 1008.

Push to a user from any service: inject `EventsGateway` and call
`sendToUser(userId, type, data)`. State is in memory, which assumes ONE API instance — scaling
out means Redis pub/sub behind that method first.

## Logs

Winston with daily rotation into `apps/api/logs/`: `app-%DATE%.log` (info and up) and
`error-%DATE%.log`, 15 days, gzipped. In development a pretty console transport is added; in
production stdout stays JSON so `docker logs` and any collector can parse it.

`HttpLoggerMiddleware` logs successful requests (and flags anything over 3s as `SLOW`);
`AllExceptionsFilter` logs the failures with full context, so nothing is written twice.

## Adding a frontend

`apps/web` is empty. Install a framework inside it, give its `package.json` a `"name": "web"`
and a `dev` script — the root `pnpm dev` (`pnpm --parallel -r dev`) will pick it up on its own.

Example (React + Vite):

```bash
cd apps/web && pnpm create vite@latest . -- --template react-ts
pnpm add shared@workspace:*
```

Add a proxy to `vite.config.ts` so the browser sees ONE origin — then the auth cookies are sent
with no CORS configuration at all:

```ts
server: {
  proxy: {
    "/api": "http://localhost:3000",
    "/ws": { target: "ws://localhost:3000", ws: true }
  }
}
```

Then use the client from `shared`:

```ts
import { createApiClient } from "shared";

const api = createApiClient({ baseUrl: "", onSessionExpired: () => navigate("/login") });
await api.auth.login({ email, password });     // cookies are set by the server
const { items, meta } = await api.examples.list({ page: 1 });
```

The client sends `credentials: "include"` on every call and refreshes once, single-flight, when
a request comes back 401 — you do not write that logic again.

If the frontend runs on a different origin than the API, put that origin in `CORS_ORIGIN`;
credentialed requests are rejected by browsers against a wildcard, so an empty value means
same-origin only.

If you need more than one frontend (say `apps/admin`), copy the same pattern: a new folder, a
different port, a new service plus a Traefik router in `docker-compose.yml`.

## Production deploy

`docker-compose.yml` assumes a Traefik instance already running on the VPS and owning the
external `traefik-net` network — it does not start Traefik itself. Entrypoint `https`, cert
resolver `letsencrypt`; change the labels if yours are named differently.

```bash
cp .env.example .env      # DOMAIN, DB_*, JWT_* → real values
docker compose up -d --build
docker compose exec api node dist/core/db/migrate.js
```

Postgres sits on the `internal` network only; neither the outside world nor Traefik can reach
it. Uploaded files persist in the `uploads` volume. Swagger is disabled when
`NODE_ENV=production` — the schema is a map of every endpoint and every field name.

## Working with AI tools (CLAUDE.md)

[CLAUDE.md](CLAUDE.md) in the repo root holds this skeleton's rules — module boundaries, the
response envelope, the migration flow, the refresh token pattern — in a form meant to be read
by a machine. [CLAUDE.TR.md](CLAUDE.TR.md) is a Turkish translation for human readers; tools
read `CLAUDE.md`, so keep both in sync when the rules change.

- **Using Claude Code?** Nothing to do: the file is loaded automatically in every session.
- **Using something else?** (Cursor, Copilot, Codex, Gemini…) The file is not picked up on its
  own. Copy its contents into that tool's own rules file — `.cursor/rules/`,
  `.github/copilot-instructions.md`, `AGENTS.md`, `GEMINI.md`, or whatever it expects. Copy the
  text rather than referring to `CLAUDE.md`; most tools will not open a file you merely mention.
- **Not using AI at all?** Read it anyway: it is the shortest explanation of why the skeleton is
  built this way.

## Make it yours

- [ ] Change the project name in `package.json` and `docker-compose.yml` (`name: app`,
      `container_name: app_*`, `traefik.http.routers.app-*`)
- [ ] Put a real `DOMAIN` and random JWT secrets in `.env` (`openssl rand -hex 32`)
- [ ] `modules/example/`, `schema/examples.ts`, `constants/example.ts`, `types/example.ts`,
      `api-client/example.service.ts` → delete them or grow them into your first real module
- [ ] Delete `core/realtime/` (WebSocket) or `core/storage/` + `modules/uploads/` if you do not
      need them
- [ ] Install a framework in `apps/web`, uncomment the `web` service in the compose file
- [ ] Set the Swagger title and description in `main.ts`
- [ ] If you use an AI tool other than Claude Code, copy `CLAUDE.md` into its rules file
