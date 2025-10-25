# Izzy CRM

Bootstrapped repository for the automotive financing CRM. The project uses a monorepo layout targeting a single VPS deployment with Docker Compose.

## Repository Layout
- `apps/frontend` – React/Vite frontend application.
- `apps/backend` – Express/TypeScript backend API.
- `packages` – Shared libraries (UI components, types, utilities).
- `ops` – Automation, infrastructure definitions, deployment scripts.
- `prisma` – Database schema and migrations (symlinked/consumed by backend).

## Getting Started
1. Install Node.js (18+) and Docker.
2. Install dependencies once `package.json` files are populated (`npm install` or `pnpm install`).
3. Copy `.env.example` to `.env` variants for local/staging environments.
4. Run Prisma commands from the repo root:
   ```bash
   npx prisma migrate dev
   npx prisma generate
   npm run --workspace @izzy-crm/backend prisma:seed
   ```
5. Use `docker compose up` to run the stack locally (placeholder services defined).

## Backend API
- Start the API locally with `npm run --workspace @izzy-crm/backend dev`.
- Health probe: `GET http://localhost:4000/api/health`.
- Authenticate: `POST http://localhost:4000/api/auth/login`
  ```jsonc
  {
    "email": "admin@example.com",
    "password": "Admin123!"
  }
  ```
  > Use the `token` from the response as a Bearer token (`Authorization: Bearer <token>`).
- Lead intake (MVP, protected): `POST http://localhost:4000/api/leads`
  ```jsonc
  {
    "partnerId": "PARTNER_ID",
    "customer": {
      "firstName": "Jane",
      "lastName": "Doe",
      "email": "jane@example.com"
    },
    "desiredVehicle": {
      "make": "Toyota",
      "model": "RAV4",
      "year": 2024,
      "budget": 120000
    }
  }
  ```
  > Partner users can omit `partnerId`; it will default to the partner associated with the token.
- Lead listing: `GET http://localhost:4000/api/leads?page=1&perPage=20&status=NEW_LEAD,GET_INFO`
  - Optional filters: `partnerId`, `assignedUserId`, `assigned=unassigned`, `search` (customer name/email/phone).
- Lead detail: `GET http://localhost:4000/api/leads/{leadId}` returns full customer/vehicle/financing context and recent audit trail.
- Lead status update: `POST http://localhost:4000/api/leads/{leadId}/status`
  ```jsonc
  {
    "status": "LEAD_TAKEN",
    "notes": "Called customer",
    "lastContactAt": "2025-10-24T17:00:00.000Z"
  }
  ```
- Financing data: `POST http://localhost:4000/api/leads/{leadId}/financing`
  ```jsonc
  {
    "bank": "ABC Bank",
    "loanAmount": 120000,
    "downPayment": 10000,
    "termMonths": 48,
    "income": 7500,
    "expenses": 3200,
    "decision": "pending"
  }
  ```
- Attach document metadata: `POST http://localhost:4000/api/leads/{leadId}/documents`
  ```jsonc
  {
    "type": "agreement",
    "filePath": "https://files.example.com/agreements/123.pdf"
  }
  ```
- User admin (requires supervisor/admin token):
  - `GET http://localhost:4000/api/users?page=1&perPage=20`
  - `POST http://localhost:4000/api/users` to invite/create users
  - `PATCH http://localhost:4000/api/users/{userId}` to update role/status/contact
  - `POST http://localhost:4000/api/users/{userId}/reset-password`

## Frontend Routes
- Login: `http://localhost:5173/login`
- Operator dashboard: `http://localhost:5173/leads`
- User administration (admins & supervisors): `http://localhost:5173/admin/users`

## Status
Foundation documentation lives in `appFoundationRequirements.md` (excluded from VCS history). Planning milestones tracked in `planning.md`.
