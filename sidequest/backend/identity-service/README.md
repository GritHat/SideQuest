# Identity Service

## Local Setup

```bash
docker compose up -d postgres
cp .env.example .env
npm ci
npm run keys:generate
npx prisma migrate deploy && npx prisma db seed
npm run start:dev
```

In development, Swagger UI is available at `http://localhost:3000/api/identity/docs` and the OpenAPI spec is generated at `openapi.json`.

## Endpoints (`/api/identity`)

| Method & Path | Access | Description |
| --- | --- | --- |
| `POST /api/identity/register` | Public | Register a new user |
| `POST /api/identity/login` | Public | Sign in and set `sq_access` / `sq_refresh` cookies |
| `POST /api/identity/refresh` | Public | Rotate refresh token using `sq_refresh` cookie |
| `POST /api/identity/logout` | Public | Revoke refresh token and clear auth cookies |
| `GET /api/identity/me` | Authenticated | Get current user profile |
| `DELETE /api/identity/me` | Authenticated | Delete own account and revoke all sessions |
| `DELETE /api/identity/admin/users/:id` | Admin | Delete a user by ID and revoke all sessions |
| `GET /api/identity/health` | Public | Service health check |

## Demo Accounts

All seeded demo accounts use password `Password123!`:

| Username | Email | Role |
| --- | --- | --- |
| `admin` | `admin@sidequest.local` | `ADMIN` |
| `moderator` | `moderator@sidequest.local` | `MODERATOR` |
| `author` | `author@sidequest.local` | `AUTHOR` |
| `explorer` | `explorer@sidequest.local` | `USER` |

## Tests & Typecheck

```bash
npx tsc --noEmit
npm test
```
