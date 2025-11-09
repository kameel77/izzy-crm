# Build & Deployment Procedure

This document describes how to run Izzy CRM locally, deploy updates to the VPS, and provision a fresh environment on a Hetzner cloud server.

---

## 1. Local Development

### Prerequisites
- macOS/Linux/WSL2 terminal
- Node.js 20.x (`node -v`)
- npm 10.x (ships with Node 20)
- Docker Desktop (or Docker Engine + Docker Compose plugin)

### Install & Seed
```bash
git clone https://github.com/kameel77/izzy-crm.git
cd izzy-crm

npm install
# For dashboard analytics, the frontend uses the recharts library.
# You can add it by running: npm install --workspace @izzy-crm/frontend recharts
cp .env.example .env
cp .env.example apps/backend/.env

npx prisma migrate dev
npx prisma generate
npm run --workspace @izzy-crm/backend prisma:seed
```

Default seeded logins:
- `admin@example.com` / `Admin123!`
- `operator@example.com` / `Operator123!`

### Run Services

**Option A: Node dev servers**
```bash
# terminal 1
npm run --workspace @izzy-crm/backend dev

# terminal 2
npm run --workspace @izzy-crm/frontend dev
```
Backend listens on `http://localhost:4000`, frontend on `http://localhost:5173`.
Uploaded documents store under `storage/uploads` and are exposed via `http://localhost:4000/uploads/...`.

**Option B: Docker Compose**
```bash
docker compose up --build
```
This starts Caddy reverse proxy on port 80/443 (adjust DNS/hosts accordingly).

### System Email Delivery

System notifications (consent links, reminders) rely on the backend `MailService`. Configure them early so the Sprint 2/3 flows stay testable end-to-end.

#### 1. Local setup (Mailhog)
1. Install Mailhog (macOS: `brew install mailhog`; Linux: download from https://github.com/mailhog/MailHog/MailHog/releases and place it on `$PATH`).
2. Run it in a dedicated terminal:
   ```bash
   mailhog
   # SMTP socket :1025, Web UI :8025
   ```
3. Export SMTP variables before `npm run dev` (or add them to `.env`):
   ```bash
   export SMTP_HOST=127.0.0.1
   export SMTP_PORT=1025
   export SMTP_USER=demo          # Mailhog ignores auth – values are arbitrary
   export SMTP_PASSWORD=demo
   export SMTP_SECURE=false
   export EMAIL_FROM=test@example.com
   ```
4. Start backend/frontend as usual. Each email sent by the app shows up in `http://localhost:8025`.

#### 2. Production / staging SMTP
- For Coolify/Hetzner deploys, provide the same variables in `.env` / `apps/backend/.env` (or platform secrets) with the real SMTP host, port, credentials, and `EMAIL_FROM`.
- Backend logs include `[mail] Transport not configured` or `[mail] Failed to send message …` – use `docker compose logs -f backend | grep mail` to diagnose connectivity/auth issues after rollouts.
- Maintain separate credentials per environment; never commit real data to Git.

---

## 2. Deploying to the VPS

Prerequisites:
- SSH access to the VPS (non-root user with sudo)
- Docker & Docker Compose installed on the host
- `.env` files prepared with production secrets (JWT secret, database URL, domains)

### Steps
1. **Push changes to `main`** (CI ensures build passes).
2. **SSH to the VPS** and pull the latest code:
   ```bash
   ssh user@your-vps
   cd ~/apps/izzy-crm
   git pull origin main
   ```
   or use the provided script from your workstation:
   ```bash
   ./ops/scripts/deploy.sh user@your-vps
   ```
3. **Update environment variables** if necessary:
   ```bash
   nano .env        # API env vars
   nano apps/backend/.env
   ```
4. **Build & restart services**:
   ```bash
   docker compose build
   docker compose up -d
   ```
5. **Run database migrations** (inside running containers):
   ```bash
   docker compose exec backend npx prisma migrate deploy
   docker compose exec backend npx prisma generate
   ```
6. **Seed optional data** (only on fresh environments):
   ```bash
   docker compose exec backend npm run prisma:seed
   ```
7. **Verify**:
   - API health: `curl http://your-domain/api/health`
   - Frontend: open `https://your-domain`

---

## 3. Provisioning Hetzner VPS Environment

### 3.1 Create Server
- Hetzner Cloud → create a new server (e.g., CX21, Ubuntu 22.04 LTS).
- Upload your SSH key and disable password login if desired.
- Point DNS `A` record to the server IP (for TLS).

### 3.2 Initial Hardening
```bash
ssh root@your-vps
apt update && apt upgrade -y

# create user
adduser deploy
usermod -aG sudo deploy

# basic firewall
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable

exit
ssh deploy@your-vps
```

### 3.3 Install Docker & Compose
```bash
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

sudo usermod -aG docker $USER
newgrp docker
```

### 3.4 Clone Project
```bash
mkdir -p ~/apps
cd ~/apps
git clone https://github.com/kameel77/izzy-crm.git
cd izzy-crm
```

### 3.5 Environment Files
Create `.env` with production secrets:
```bash
cp .env.example .env
nano .env
```
Key values:
- `JWT_SECRET` – strong random string
- `DATABASE_URL` – `postgresql://user:password@postgres:5432/izzy`
- `DOMAIN`/`EMAIL` for Caddy TLS certificate issuance
- `UPLOAD_DIR` (default `storage/uploads`) and `UPLOAD_MAX_BYTES` (~50 MB by default) for document storage limits
- To use S3/MinIO storage, set `UPLOAD_DRIVER=s3` and provide `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`; optionally set `S3_ENDPOINT`/`S3_FORCE_PATH_STYLE` (for MinIO) and `S3_PUBLIC_URL` for direct links.

### 3.6 Start Stack
```bash
docker compose build
docker compose up -d
docker compose exec backend npx prisma migrate deploy
docker compose exec backend npm run prisma:seed   # optional first-time seed
```

### 3.7 Postgres Backups (optional recommended)
Create a cron job to dump the DB:
```bash
crontab -e
# nightly at 01:00
0 1 * * * docker compose exec -T postgres pg_dump -U izzy izzy > ~/backups/izzy-$(date +\%F).sql
```

### 3.8 Monitoring & Logs
- Backend logs: `docker compose logs -f backend`
- Frontend (Nginx) logs: `docker compose logs -f frontend`
- Reverse proxy (Caddy) logs: `docker compose logs -f reverse-proxy`

### 3.9 Updating
```bash
cd ~/apps/izzy-crm
git pull origin main
docker compose build
docker compose up -d
docker compose exec backend npx prisma migrate deploy
```

---

## 4. Quick Reference

| Task                         | Command (from repo root)                             |
|-----------------------------|------------------------------------------------------|
| Run backend dev server      | `npm run --workspace @izzy-crm/backend dev`          |
| Run frontend dev server     | `npm run --workspace @izzy-crm/frontend dev`         |
| Compose up (prod simulation)| `docker compose up --build`                          |
| Prisma migrate (prod)       | `docker compose exec backend npx prisma migrate deploy` |
| Prisma seed (prod)          | `docker compose exec backend npm run prisma:seed`    |

Keep this file updated as the deployment pipeline evolves (e.g., when CI/CD replaces manual steps or new services are introduced).

---

## 5. Environment Strategy & Best Practices

### 5.1 Separate Staging & Production
- **Purpose**: keep a safe buffer between new code and customers.
- Run staging on a distinct VPS (or Compose overlay) mirroring production configuration.
- Maintain separate `.env` files, secrets, and database instances per environment.
- Apply migrations and Docker updates to staging first; run smoke tests before promoting to prod.
- Use anonymised production snapshots when seeding staging (never expose raw PII).
- Restrict access to staging (VPN/IP allowlist) to avoid customer contact or data leakage.

### 5.2 Suggested Release Flow
1. Merge feature → CI builds → Deploy to staging (`./ops/scripts/deploy.sh user@staging-host`).
2. QA/Regression testing on staging: API health, UI flows, migrations.
3. Promote to production: deploy to prod host, run `prisma migrate deploy`, smoke-test.
4. Maintain rollback assets (previous Docker image tag & latest DB backup) in case of regression.

### 5.3 Operational Security
- Use unique, strong `JWT_SECRET`, DB passwords, and TLS certs per environment.
- SSH hardening: key-based auth, disable root login, audit `authorized_keys`.
- Ensure Postgres listens only inside Docker network (default) and block external 5432 in `ufw`.
- Rotate secrets periodically; store them in a password manager or secret manager.
- Monitor logs and consider alerting (UptimeRobot, healthchecks.io, Loki/Grafana).

---

## 6. Backup & Restore Procedures

### 6.1 Logical Database Backups
Automate nightly dumps on each VPS:
```bash
mkdir -p ~/backups/postgres
crontab -e
# 01:00 daily
0 1 * * * docker compose exec -T postgres pg_dump -U izzy izzy > ~/backups/postgres/izzy-$(date +\%F).sql
```
- Compress (`gzip`) and sync offsite (Hetzner Storage Box, S3) via `rclone`/`rsync`.
- Retain a rotation (e.g., 7 daily + 4 weekly + 6 monthly snapshots).

### 6.2 Application Assets
If documents live on local volume (e.g., `./storage/uploads`), archive regularly:
```bash
tar czf ~/backups/app-docs-$(date +%F).tar.gz storage/uploads
```
For S3 or object storage, enable versioning and lifecycle rules.

### 6.3 Database Restore
1. Stop backend: `docker compose stop backend`.
2. Restore dump:
   ```bash
   docker compose exec -T postgres psql -U izzy izzy < ~/backups/postgres/izzy-2025-10-24.sql
   ```
3. Restart backend & run migrations: `docker compose start backend` then `docker compose exec backend npx prisma migrate deploy`.
4. Verify logins and core flows.

### 6.4 Document Restore
```bash
tar xzf ~/backups/app-docs-2025-10-24.tar.gz -C storage/
chown -R deploy:deploy storage/uploads
```

### 6.5 Backup Testing
- Quarterly restore drill on staging to validate dumps.
- Monitor cron logs/alerts for failures.
- Document restore steps in your ops runbook and keep sample data sets handy.

---

## 7. Security Maintenance Checklist
- Patch OS monthly (`sudo apt update && sudo apt upgrade`).
- Refresh Docker images before deployments (`docker compose pull`).
- Review firewall rules (`ufw status`) and SSH accounts quarterly.
- Ensure TLS certificate auto-renewal (Caddy) is functioning.
- Consider centralised logging and monitoring as traffic grows.
