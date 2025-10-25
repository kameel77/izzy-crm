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

**Option B: Docker Compose**
```bash
docker compose up --build
```
This starts Caddy reverse proxy on port 80/443 (adjust DNS/hosts accordingly).

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
