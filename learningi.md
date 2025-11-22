# Learnings & Troubleshooting

## Docker Environment Variable Conflict (Localhost vs Internal Networking)

### Problem
When running the application locally with Docker Compose, the backend container failed to connect to the database with the error:
`Can't reach database server at localhost:5432`

### Root Cause
1.  **Local .env Priority**: The project had a local `.env` file where `DATABASE_URL` pointed to `localhost:5432` (for running the app without Docker or for Prisma Studio).
2.  **Docker Compose Inheritance**: When running `docker-compose up`, Docker inherited this `DATABASE_URL` from the host's environment.
3.  **Network Context**: Inside the Docker container, `localhost` refers to the container itself, not the host machine. Since the database runs in a separate container named `postgres`, the backend couldn't find it at `localhost`.

### Solution
We modified `docker-compose.yml` to use a specific environment variable for the server, with a fallback to the internal Docker network address.

**Before:**
```yaml
DATABASE_URL=${DATABASE_URL:-postgresql://izzy:izzy@postgres:5432/izzy}
```
*This caused the issue because `DATABASE_URL` exists in the local `.env`, so it took precedence.*

**After:**
```yaml
DATABASE_URL=${SERVER_DATABASE_URL:-postgresql://izzy:izzy@postgres:5432/izzy}
```

### How it works
1.  **Locally**: `SERVER_DATABASE_URL` is not defined in the local `.env`. Docker falls back to the default value `postgresql://izzy:izzy@postgres:5432/izzy`, which correctly points to the `postgres` service within the Docker network.
2.  **Production (Coolify/VPS)**: We can set `SERVER_DATABASE_URL` (or just rely on the default if using the same container structure) to point to the production database, overriding the default if necessary.

### Key Takeaway
Avoid using the same environment variable names for local host configuration and internal Docker configuration if they need to point to different network addresses (e.g., `localhost` vs `service_name`). Use specific prefixes (e.g., `SERVER_...`, `DOCKER_...`) or hardcoded defaults for internal services.
