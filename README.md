# SILELO

SILELO is a single-room AI workspace with chat, account-scoped history, task events, model and skill catalogs, image generation, translation, summarization, and guarded GitHub integration.

## Repository

The source of truth is:

`appleid7899067-netizen/silelo`

The application currently exposes one room with the key `silelo` and the display name `สลี่`.

## Local setup

Requirements:

- Node.js 18 or newer
- pnpm 10
- MySQL-compatible database for persistent history

```sh
cp .env.example .env
pnpm install --frozen-lockfile
pnpm dev
```

The development server listens on `http://localhost:3000` unless `PORT` is changed.

## Required runtime configuration

Set the database and authentication values before enabling account history:

- `DATABASE_URL`
- `OAUTH_SERVER_URL`
- `JWT_SECRET`
- `OWNER_OPEN_ID`

For GitHub integration, set:

- `GITHUB_TOKEN`
- `GITHUB_ALLOWED_REPOS=appleid7899067-netizen/silelo`

Keep tokens and other secrets in the runtime environment. Do not commit `.env`.

## Commands

```sh
pnpm dev       # development server
pnpm check     # TypeScript check
pnpm test      # Vitest suite
pnpm build     # production bundle
pnpm start     # run the production bundle
pnpm db:push   # generate and apply Drizzle migrations
```

## Current capability boundaries

The application supports chat, history for authenticated users, task event logging, image generation after confirmation, translation, summarization, and GitHub metadata/file operations when the required runtime credentials are available.

Plugins, arbitrary external services, file attachments, TTS, and cancellable background jobs remain disabled. The full status and remaining implementation work are documented in [docs/feature-audit.md](docs/feature-audit.md) and [todo.md](todo.md).

## Deployment

Render uses [render.yaml](render.yaml). Vercel uses [vercel.json](vercel.json) as the frontend routing configuration. Verify the active Render service and production URL before changing those deployment identifiers.
