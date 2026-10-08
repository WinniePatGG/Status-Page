# Status Page

A self-hosted, production-ready status page built with TypeScript, Fastify, PostgreSQL, Prisma, React, Vite, pnpm workspaces, Docker, Oxlint and Prettier.

## Features

- Services with HTTP/HTTPS monitoring
- Response-time tracking and uptime calculation (24h, 7d, 30d, 90d)
- Automatic outage detection and recovery with configurable thresholds
- Incidents and incident updates
- Admin authentication with secure HTTP-only cookies
- REST API (public + admin)
- Background monitoring worker
- Discord webhook notifications (optional)
- Dark minimalistic UI (React + Vite) with admin section
- PostgreSQL persistence via Prisma
- Docker Compose deployment

## Project structure

```
status-page/
├── apps/
│   ├── api/      # Fastify REST API
│   ├── worker/   # Monitoring worker
│   └── web/      # React + Vite frontend
├── packages/
│   ├── database/ # Prisma schema + client + migrations
│   └── shared/   # Shared TypeScript types and utilities
├── docker-compose.yml
├── .env.example
├── package.json
└── pnpm-workspace.yaml
```

## Getting started

### Prerequisites

- Node.js >= 22
- pnpm >= 10
- PostgreSQL >= 14 (or use Docker)

### Local development

1. Copy environment variables
```bash
cp .env.example .env
```
Update `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD` as needed.

2. Install dependencies
```bash
pnpm install
```

3. Generate Prisma client
```bash
pnpm db:generate
```

4. Run database migrations (if PostgreSQL is running locally)
```bash
pnpm db:migrate
```

5. Start all apps in development (API, worker, web)
```bash
pnpm dev
```

Apps:
- Web: http://localhost:5173 (admin at http://localhost:5173/admin)
- API: http://localhost:3000

### Docker

```bash
cp .env.example .env
# update secrets
docker compose up -d --build
```

Web: http://localhost:8080
API proxied through nginx at /api

Database persists in `postgres_data` volume.

## Environment variables

See `.env.example` for all configuration including:
- `DATABASE_URL`
- `SESSION_SECRET`, `SESSION_TTL_DAYS`, `COOKIE_SECURE`
- `ADMIN_USERNAME`, `ADMIN_PASSWORD`
- `MONITOR_FAILURE_THRESHOLD`, `MONITOR_RECOVERY_THRESHOLD`, `MONITOR_DEGRADED_RESPONSE_TIME_MS`
- `MONITOR_DEFAULT_CHECK_INTERVAL`, `MONITOR_DEFAULT_TIMEOUT`, `MONITOR_RETENTION_DAYS`, `WORKER_TICK_MS`
- `DISCORD_WEBHOOK_URL`
- `CORS_ORIGIN`

## Scripts

- `pnpm dev` - run API, worker, web in parallel
- `pnpm build` - build all packages/apps
- `pnpm typecheck` - typecheck all projects
- `pnpm lint` - run Oxlint
- `pnpm format` / `pnpm format:check` - Prettier
- `pnpm db:generate` - generate Prisma client
- `pnpm db:migrate` - run Prisma migrations (dev)
- `pnpm db:deploy` - deploy migrations (prod)
- `pnpm db:studio` - open Prisma Studio

## Notes

- Passwords hashed with scrypt
- Sessions stored in database as SHA-256 token hashes, sent via HTTP-only cookies
- Discord notifications optional
- No secrets committed; use `.env`
- Linting with Oxlint, formatting with Prettier, TypeScript strict mode
