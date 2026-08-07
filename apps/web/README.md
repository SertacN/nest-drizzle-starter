# apps/web

This folder is deliberately empty. The frontend framework is chosen per project; the skeleton
only ships the API.

For the setup steps see the root [README.md](../../README.md) → "Adding a frontend"
(Turkish: [README-TR.md](../../README-TR.md) → "Frontend eklemek"). In short:

1. Install the framework INSIDE this folder (React/Vite, Next, SvelteKit — all work).
2. Give its `package.json` a `"name": "web"` and `dev` / `build` / `check` scripts — the root
   `pnpm dev` runs every workspace package that has a `dev` script, in parallel.
3. Add the shared package as a dependency: `"shared": "workspace:*"`.
4. Proxy `/api` and `/ws` to `http://localhost:3000` in the dev server, so the browser sees one
   origin and the auth cookies are sent without any CORS configuration.
5. Every request must carry `credentials: "include"` — the api-client in `shared` already does.
6. Before going to production, uncomment the `web` service in `docker-compose.yml` and write a
   `Dockerfile` in this folder.
