FROM node:24-alpine AS build
RUN corepack enable
ENV CI=true
WORKDIR /repo
# Manifests first: this layer is cached until a dependency actually changes.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter api...
COPY packages/shared packages/shared
COPY apps/api apps/api
# shared first: the API compiles against its dist/, not its source.
RUN pnpm --filter shared build && pnpm --filter api build
# A self-contained copy of the api with ONLY its production dependencies. Pruning the
# workspace in place is not enough: `pnpm install --prod` unlinks devDeps but leaves their
# files in node_modules/.pnpm, so the compiler and linters would ride along into the image.
# --legacy: the non-legacy deploy needs injectWorkspacePackages, which would make `shared` a
# copy instead of a symlink during development as well.
RUN pnpm --filter api deploy --prod --legacy /prod/api

# The same /app/apps/api layout as the repo, so every __dirname-relative path (logs, the
# migrations folder, the .env lookup) resolves exactly as it does in development.
FROM node:24-alpine
WORKDIR /app/apps/api
COPY --from=build /prod/api/node_modules ./node_modules
COPY --from=build /prod/api/package.json ./package.json
COPY --from=build /repo/apps/api/dist ./dist
# SQL files are not compiled by tsc, so they are copied next to the built migrator.
COPY apps/api/src/core/db/migrations ./dist/core/db/migrations
EXPOSE 3000
CMD ["node", "dist/main.js"]
