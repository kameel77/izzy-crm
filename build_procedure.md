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

## 4. Deploying with Coolify

Coolify is a self-hosted deployment platform that automates the build and deployment process from your Git repository. This section provides an alternative to the manual Docker Compose deployment in section 2.

### Prerequisites
- Hetzner Cloud account
- GitHub repository access (https://github.com/kameel77/izzy-crm)
- Domain name configured
- SMTP credentials for production email delivery

### 4.1 VPS Provisioning
- Create a Hetzner VPS (CX21 or higher recommended, Ubuntu 22.04 LTS)
- Upload your SSH key during creation
- Configure DNS A record pointing to the VPS IP
- Note: Coolify requires sufficient resources (2GB RAM minimum)

### 4.2 Coolify Installation
```bash
# SSH to your VPS as root
ssh root@your-vps-ip

# Run Coolify installation script
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

After installation completes:
- Access Coolify at `https://your-vps-ip:8000` (or configure a domain)
- Complete the initial setup wizard
- Create an admin account

### 4.3 Project Setup
1. **Connect Git Repository**
   - In Coolify dashboard, go to "Sources" → "Git"
   - Add your GitHub repository: `https://github.com/kameel77/izzy-crm`
   - Authorize Coolify to access the repository

2. **Create Project**
   - Create a new project (e.g., "Izzy CRM")
   - Add a service: "Docker Compose"
   - Configure:
     - Repository: izzy-crm
     - Branch: main
     - Compose file path: `docker-compose.yml` (root level)

3. **Environment Configuration**
   - Set environment variables in Coolify:
     ```
     DATABASE_URL=postgresql://izzy:izzy@postgres:5432/izzy
     JWT_SECRET=<strong-random-secret>
     API_BASE_URL=https://your-domain/api
     NODE_ENV=production
     SMTP_HOST=<your-smtp-host>
     SMTP_PORT=587
     SMTP_USER=<smtp-username>
     SMTP_PASSWORD=<smtp-password>
     SMTP_SECURE=true
     EMAIL_FROM=noreply@your-domain
     ```
   - Configure domains for the application

4. **Database Setup**
   - Use Coolify's built-in PostgreSQL service or configure external database
   - Ensure DATABASE_URL points to the correct instance

### 4.4 Deployment
- Coolify will automatically build and deploy on pushes to the main branch
- Initial deployment: Click "Deploy" in Coolify dashboard
- Monitor build logs in real-time
- Access your application at the configured domain

### 4.5 Updates and Rollbacks
- Push changes to `main` branch → Coolify auto-deploys
- View deployment history in Coolify
- Rollback to previous versions if needed
- Run database migrations post-deployment using Coolify's command execution

### 4.6 Backup and Monitoring
- Configure automated database backups in Coolify
- Set up monitoring and alerts for deployment failures
- View application logs through Coolify dashboard
- Configure health checks for uptime monitoring

### 4.7 Troubleshooting
- **Build failures**: Check Coolify build logs for Docker/compose errors
- **Environment issues**: Verify all required environment variables are set
- **Database connection**: Ensure DATABASE_URL is correct and database is accessible
- **Domain issues**: Confirm DNS configuration and Coolify domain settings

For detailed Coolify documentation, visit https://coolify.io/docs.

---

## 5. Quick Reference

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
- **Single VPS option**: It is technically possible to run both staging and production on one VPS, but separate servers are strongly recommended for production workloads.
- Run staging on a distinct VPS (or Compose overlay) mirroring production configuration.
- Maintain separate `.env` files, secrets, and database instances per environment.
- Apply migrations and Docker updates to staging first; run smoke tests before promoting to prod.
- Use anonymised production snapshots when seeding staging (never expose raw PII).
- Restrict access to staging (VPN/IP allowlist) to avoid customer contact or data leakage.

#### Running Staging & Production on One VPS
**Technical feasibility**: Yes, you can run both environments on one VPS using:
- Different Docker Compose files or project names
- Separate database instances (different ports/containers)
- Different domains/subdomains
- Isolated environment variables

**Example setup**:
```bash
# Production compose
docker compose -p izzy-prod up -d

# Staging compose
docker compose -f docker-compose.staging.yml -p izzy-staging up -d
```

**Pros**:
- Cost savings (one server instead of two)
- Simplified infrastructure management
- Easier resource sharing

**Cons**:
- **Resource contention**: Staging load can affect production performance
- **Single point of failure**: Issues with the VPS affect both environments
- **Security risks**: Staging data exposure could compromise production
- **Complexity**: Harder to isolate environments and troubleshoot issues
- **Scaling limitations**: Cannot scale environments independently

**Recommendations**:
- Use separate VPS instances for production workloads
- If cost is a constraint, start with single VPS but plan to separate when possible
- Use different ports/domains to clearly separate environments
- Implement strict access controls and monitoring
- Consider Hetzner CX11 (cheapest) for staging, CX21+ for production

### 5.2 Suggested Release Flow
1. Merge feature → CI builds → Deploy to staging (`./ops/scripts/deploy.sh user@staging-host`).
2. QA/Regression testing on staging: API health, UI flows, migrations.
3. Promote to production: deploy to prod host, run `prisma migrate deploy`, smoke-test.
4. Maintain rollback assets (previous Docker image tag & latest DB backup) in case of regression.

### 5.2.1 Data Integrity During Deployments
To ensure data integrity when deploying new functionalities:

#### Migration Best Practices
- **Test migrations on staging first**: Always run and validate migrations in staging before production.
- **Transactional migrations**: Prisma automatically wraps migrations in transactions for atomicity (confirmed: `prisma migrate deploy` executes migrations within transactions).
- **Validate data post-migration**: Run data integrity checks after migrations:
  ```bash
  # Example: Check for orphaned records or invalid constraints
  docker compose exec backend npx prisma db execute --file ./scripts/data-integrity-check.sql
  ```
- **Backup before migration**: Create database backup before running migrations in production.

#### Deployment Safety Measures
- **Zero-downtime deployments**: Use Coolify's rolling deployment or blue-green strategy.
- **Feature flags**: Deploy code with features disabled, enable gradually after validation.
- **Monitoring**: Set up alerts for:
  - Migration failures
  - Data inconsistencies
  - Performance degradation
  - Error rate spikes

#### Rollback Procedures
- **Database rollback**: Keep migration rollback scripts ready:
  ```bash
  npx prisma migrate reset  # For development/testing only
  # For production, use specific rollback migrations
  npx prisma migrate resolve --rolled-back <migration-name>
  ```
- **Application rollback**: Use Coolify's deployment history to revert to previous version.
- **Data restoration**: Restore from backup if rollback isn't possible.

#### Validation Checks
- **Pre-deployment**: Run data integrity queries before deployment.
- **Post-deployment**: Validate core business logic and data relationships.
- **Automated tests**: Include data integrity tests in CI/CD pipeline.

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

## 7. Git Workflow & Local Development

This section describes best practices for managing Git branches, local development, and ensuring changes are properly tested before deployment.

### 7.1 Git Branching Strategy

#### Main Branches
- **`main`** (formerly `master`): Production-ready code, automatically deploys to production
- **`staging`**: Integration branch for testing, deploys to staging environment

#### Feature Branches
- **Naming convention**: `feature/description-of-change` or `bugfix/issue-description`
- **Purpose**: Isolate development work from main branches
- **Lifetime**: Create when starting work, delete after merging

#### Hotfix Branches
- **Naming convention**: `hotfix/critical-issue-description`
- **Purpose**: Emergency fixes for production issues
- **Base branch**: `main`
- **Merge target**: Both `main` and `staging`

### 7.2 Local Development Workflow

#### Setting Up Local Environment
```bash
# Clone repository
git clone https://github.com/kameel77/izzy-crm.git
cd izzy-crm

# Install dependencies
npm install

# Set up local environment
cp .env.example .env
cp apps/backend/.env.example apps/backend/.env

# Initialize local database
npx prisma migrate dev
npx prisma generate
npm run --workspace @izzy-crm/backend prisma:seed
```

#### Daily Development Cycle
1. **Start new feature**:
   ```bash
   git checkout main
   git pull origin main
   git checkout -b feature/new-functionality
   ```

2. **Make changes** with frequent commits:
   ```bash
   # Make code changes
   git add .
   git commit -m "feat: add new functionality

   - Implement feature X
   - Add tests for feature X
   - Update documentation"
   ```

3. **Test locally**:
   ```bash
   # Run tests
   npm run test

   # Start development servers
   npm run --workspace @izzy-crm/backend dev &
   npm run --workspace @izzy-crm/frontend dev &

   # Test functionality manually
   # Verify database changes
   npx prisma migrate dev
   ```

4. **Push feature branch**:
   ```bash
   git push origin feature/new-functionality
   ```

### 7.3 Testing Changes on Staging

#### Preparing for Staging Deployment
1. **Merge feature to staging**:
   ```bash
   # From local machine or GitHub
   git checkout staging
   git pull origin staging
   git merge feature/new-functionality

   # Or create pull request: feature/new-functionality → staging
   ```

2. **Deploy to staging**:
   ```bash
   # Manual deployment
   ./ops/scripts/deploy.sh user@staging-host

   # Or push to staging branch if using Coolify
   git push origin staging
   ```

3. **Test on staging**:
   - Access staging environment: `https://staging.your-domain`
   - Run end-to-end tests against staging
   - Verify database migrations applied correctly
   - Test with production-like data
   - Check performance and error logs

#### Staging Validation Checklist
- [ ] Application starts without errors
- [ ] Database migrations successful
- [ ] API endpoints respond correctly
- [ ] Frontend loads and functions properly
- [ ] User authentication works
- [ ] New features work as expected
- [ ] Existing functionality not broken
- [ ] Performance acceptable
- [ ] No console errors or warnings

### 7.4 Promoting to Production

#### Production Deployment Process
1. **Merge staging to main**:
   ```bash
   # After staging approval
   git checkout main
   git pull origin main
   git merge staging
   git push origin main
   ```

2. **Automatic deployment**:
   - CI/CD pipeline triggers on `main` branch push
   - Deploys to production environment
   - Runs database migrations
   - Executes smoke tests

3. **Post-deployment verification**:
   - Monitor application health
   - Check user feedback
   - Verify business metrics
   - Prepare rollback plan if needed

### 7.5 Git Best Practices

#### Commit Messages
- **Format**: `type: description` (e.g., `feat: add user authentication`)
- **Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`
- **Body**: Detailed explanation for complex changes
- **References**: Include issue/PR numbers when applicable

#### Pull Requests
- **Title**: Clear, descriptive summary
- **Description**: What, why, and how changes work
- **Checklist**: Testing done, documentation updated
- **Reviewers**: Assign appropriate team members
- **Labels**: `feature`, `bugfix`, `hotfix`, `breaking-change`

#### Code Reviews
- **Review criteria**:
  - Code quality and style
  - Test coverage
  - Documentation updates
  - Security considerations
  - Performance impact
- **Approval requirements**: At least one reviewer for features, two for critical changes

#### Conflict Resolution
- **Rebase vs Merge**: Prefer rebase for clean history
- **Resolve conflicts locally**: Test after resolving
- **Avoid force push**: Use `--force-with-lease` if necessary

### 7.6 Local Development Tips

#### Environment Management
- **Use `.env` files**: Keep secrets out of code
- **Database isolation**: Use separate databases for different features
- **Port management**: Avoid conflicts between services

#### Debugging Techniques
- **Logs**: Check application and database logs
- **Database inspection**: Use Prisma Studio for data inspection
- **API testing**: Use tools like Postman or curl
- **Browser dev tools**: Debug frontend issues

#### Performance Testing
- **Load testing**: Test with realistic user loads
- **Database queries**: Monitor slow queries
- **Memory usage**: Check for memory leaks
- **Bundle size**: Monitor frontend bundle size

---

## 8. Deployment Pipeline: Local to Production

This section outlines the complete deployment pipeline from local development to production, ensuring consistent and safe releases across all environments.

### 8.1 Local Development Phase

#### Code Development
1. **Create feature branch**:
   ```bash
   git checkout -b feature/new-functionality
   ```
2. **Implement changes** with proper testing:
   - Write unit tests for new functionality
   - Update integration tests if needed
   - Test database migrations locally
3. **Run local tests**:
   ```bash
   npm run test                    # Run all tests
   npm run --workspace @izzy-crm/backend test
   npm run --workspace @izzy-crm/frontend test
   ```
4. **Validate locally**:
   - Start services: `docker compose up --build`
   - Test API endpoints and UI flows
   - Verify database migrations: `npx prisma migrate dev`
   - Check data integrity

#### Pre-commit Checks
- Run linter: `npm run lint`
- Format code: `npm run format`
- Ensure all tests pass
- Update documentation if needed

### 8.2 Staging Deployment Phase

#### Preparation
1. **Merge to main** (or create PR for review):
   ```bash
   git checkout main
   git merge feature/new-functionality
   git push origin main
   ```
2. **CI/CD validation**: Ensure automated builds pass

#### Staging Deployment
1. **Deploy to staging environment**:
   - **Manual deployment**: `./ops/scripts/deploy.sh user@staging-host`
   - **Coolify deployment**: Push to main triggers automatic deployment
2. **Run database migrations**:
   ```bash
   docker compose exec backend npx prisma migrate deploy
   docker compose exec backend npx prisma generate
   ```
3. **Seed test data** (if needed):
   ```bash
   docker compose exec backend npm run prisma:seed
   ```

#### Staging Validation
1. **Automated testing**:
   - Run integration tests against staging
   - API health checks: `curl https://staging.your-domain/api/health`
   - Database integrity checks
2. **Manual QA**:
   - Test new functionality end-to-end
   - Verify existing features still work
   - Check performance and error logs
3. **Data validation**:
   - Confirm migrations applied correctly
   - Validate business logic with test data
   - Check for data inconsistencies

#### Approval Gate
- **QA sign-off**: Functional and regression testing complete
- **Security review**: If sensitive changes
- **Performance validation**: No degradation detected

### 8.3 Production Deployment Phase

#### Pre-deployment Preparation
1. **Final backup**: Create production database backup
2. **Communication**: Notify stakeholders of deployment window
3. **Monitoring setup**: Enable enhanced monitoring during deployment

#### Production Deployment
1. **Deploy application**:
   - **Manual**: `./ops/scripts/deploy.sh user@prod-host`
   - **Coolify**: Push to main or trigger manual deployment
2. **Database migration**:
   ```bash
   docker compose exec backend npx prisma migrate deploy
   docker compose exec backend npx prisma generate
   ```
3. **Post-deployment validation**:
   - Health checks: `curl https://your-domain/api/health`
   - Smoke tests: Core functionality verification
   - Error monitoring: Check logs for issues

#### Production Validation
1. **Immediate monitoring** (first 30 minutes):
   - Application logs: `docker compose logs -f backend`
   - Error rates and performance metrics
   - User-facing functionality
2. **Extended validation** (first 24 hours):
   - Business metrics monitoring
   - User feedback collection
   - Automated health checks every 5 minutes

### 8.4 Rollback Procedures

#### When to Rollback
- Critical functionality broken
- Data corruption detected
- Performance degradation >20%
- Security vulnerability discovered

#### Rollback Steps
1. **Application rollback**:
   - **Manual**: Deploy previous version
   - **Coolify**: Use deployment history to revert
2. **Database rollback** (if needed):
   ```bash
   # Restore from backup
   docker compose exec -T postgres psql -U izzy izzy < ~/backups/postgres/backup.sql
   # Or use migration rollback
   npx prisma migrate resolve --rolled-back <migration-name>
   ```
3. **Validation after rollback**:
   - Confirm system stability
   - Verify data integrity
   - Test critical functionality

### 8.5 Post-deployment Activities

#### Documentation Updates
- Update change log
- Document any configuration changes
- Update runbooks if procedures changed

#### Monitoring and Alerts
- Set up monitoring for new features
- Configure alerts for error conditions
- Update dashboards with new metrics

#### Team Communication
- Deployment completion notification
- Known issues and workarounds
- Next deployment window planning

### 8.6 Deployment Checklist

#### Pre-deployment
- [ ] Feature branch merged to main
- [ ] CI/CD pipeline passes
- [ ] Database migrations tested locally
- [ ] Documentation updated
- [ ] Stakeholders notified

#### During Deployment
- [ ] Backup created
- [ ] Deployment executed successfully
- [ ] Health checks pass
- [ ] Smoke tests successful

#### Post-deployment
- [ ] Monitoring active
- [ ] Logs reviewed
- [ ] Stakeholders informed
- [ ] Rollback plan documented

---

## 9. Security Maintenance Checklist
- Patch OS monthly (`sudo apt update && sudo apt upgrade`).
- Refresh Docker images before deployments (`docker compose pull`).
- Review firewall rules (`ufw status`) and SSH accounts quarterly.
- Ensure TLS certificate auto-renewal (Caddy) is functioning.
- Consider centralised logging and monitoring as traffic grows.
