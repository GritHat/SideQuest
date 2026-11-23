# Identity Service

Accounts, credentials, sessions and access tokens for SideQuest (see `docs/MANIFESTO.md` §5).

- **Access tokens:** RS256 JWTs valid for 10 minutes, sent in the `sq_access` cookie.
- **Sessions:** rotating refresh tokens stored in PostgreSQL, sent in the `sq_refresh` cookie.
- **Errors:** RFC 9457 `application/problem+json`.

## Requirements

- Node.js 24 LTS (or ≥ 22.22.3) and npm
- Docker, for PostgreSQL in development and for Testcontainers in integration tests

## Local setup

```bash
# from the repository root: start PostgreSQL (port 5433, see compose.yaml)
docker compose up -d postgres

cd sidequest/backend/identity-service
cp .env.example .env
npm ci
npm run keys:generate                 # keys/private.pem (0600) and keys/public.pem, git-ignored
npx prisma migrate deploy             # creates the schema
npx prisma db seed                    # demo accounts, safe to run again
npm run start:dev
```

The API listens on `http://localhost:3000/api/identity`. In development, Swagger UI is at `http://localhost:3000/api/identity/docs`.

## Endpoints (`/api/identity`)

| Method & path | Access | Description |
| --- | --- | --- |
| `POST /register` | Public · 10/min | Register a new user |
| `POST /login` | Public · 5/min | Sign in; sets `sq_access` (path `/api`) and `sq_refresh` (path `/api/identity`) |
| `POST /refresh` | Public · 10/min | Rotate the refresh token; reusing an old one revokes the whole session |
| `POST /logout` | Public | Revoke the session, if any, and clear both cookies |
| `GET /me` | Authenticated | Current user's profile |
| `DELETE /me` | Authenticated | Delete your own account and revoke all its sessions |
| `DELETE /admin/users/:id` | Admin | Delete a user and revoke all their sessions |
| `GET /health` | Public | Health check |

## Demo accounts

All seeded accounts use the password `Password123!`, for local demos only.

| Username | Email | Role |
| --- | --- | --- |
| `admin` | `admin@sidequest.local` | `ADMIN` |
| `moderator` | `moderator@sidequest.local` | `MODERATOR` |
| `author` | `author@sidequest.local` | `USER` |
| `explorer` | `explorer@sidequest.local` | `USER` |

## Quality checks

```bash
npx tsc --noEmit                      # typecheck
npm run lint                          # oxlint (type-aware)
npm test                              # unit tests, no database
npm run test:integration              # API and store contract tests on a real PostgreSQL
npm run openapi:generate              # regenerate openapi.json (commit it with API changes)
```

`test:integration` starts a disposable PostgreSQL with Testcontainers. To use an existing empty database instead, set `TEST_DATABASE_URL`; migrations are applied with `migrate deploy`.
