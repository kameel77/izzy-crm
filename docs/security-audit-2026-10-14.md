# Security Audit & Remediation Report — Izzy CRM (`crm.carsalon.pl`)

**Date:** 2026-10-14  
**Scope:** Full-stack repository (`apps/backend`, `apps/frontend`, `prisma/schema.prisma`, `docker-compose.yml`)  
**Status:** All 14 findings remediated in source code.

---

## Executive Summary

A source-first security audit was performed across the Izzy CRM codebase following the `/security-audit` workflow (Reconnaissance → Trust Boundary Mapping → Vulnerability Hunting → Validation & Remediation).

We identified **14 security findings** (4 Critical, 5 High, 3 Medium, 2 Low) across authentication, authorization/BOLA, public form access control, file upload/download handling, webhook verification, and HTML/XSS sanitization. All 14 findings have been fixed directly in the codebase.

---

## Findings & Remediations Summary

| ID | Severity | Category | Location | Status |
|---|---|---|---|---|
| **CRITICAL-01** | Critical | Unauthenticated Account Lockout, Takeover & Inactive Account Reactivation via Password Reset | `apps/backend/src/services/auth.service.ts`, `apps/backend/src/routes/auth.routes.ts` | **FIXED** |
| **CRITICAL-02** | Critical | Unauthenticated PII Read/Overwrite & PIN Hash Leak on Public Financing Application Forms | `apps/backend/src/routes/application-form.routes.ts`, `apps/backend/src/services/application-form.service.ts` | **FIXED** |
| **CRITICAL-03** | Critical | Unauthenticated Email Webhook Spoofing & Stored XSS in Email/Consent Viewers | `apps/backend/src/controllers/email.controller.ts`, `apps/frontend/src/components/LeadDetailCard.tsx` | **FIXED** |
| **CRITICAL-04** | Critical | Unauthenticated Public Access to Uploaded Documents (`/uploads`) & Unrestricted File Types | `apps/backend/src/app.ts`, `apps/backend/src/utils/upload.ts` | **FIXED** |
| **HIGH-05** | High | Broken Object Level Authorization (BOLA / IDOR) on Lead Notes, Documents, Emails, Drafts & Onboarding | `apps/backend/src/routes/lead.routes.ts`, `apps/backend/src/controllers/email.controller.ts`, `apps/backend/src/routes/insurance-onboarding.routes.ts` | **FIXED** |
| **HIGH-06** | High | Cross-Lead / Cross-Partner Consent Record Enumeration by Operators | `apps/backend/src/services/consent.service.ts`, `apps/backend/src/routes/consent.routes.ts` | **FIXED** |
| **HIGH-07** | High | Unverified `accessCodeHash` on Public Consent Submission (`POST /api/consents/records`) | `apps/backend/src/services/consent.service.ts` | **FIXED** |
| **HIGH-08** | High | Privilege Escalation: `SUPERVISOR` Can Modify or Reset `ADMIN` Accounts | `apps/backend/src/routes/user.routes.ts` | **FIXED** |
| **HIGH-09** | High | Missing Brute-Force / Rate Limiting on Auth, PIN Verification & Public Endpoints | `apps/backend/src/middlewares/rateLimit.ts`, `auth.routes.ts`, `application-form.routes.ts`, `consent.routes.ts`, `insurance-onboarding.routes.ts`, `webhook.routes.ts` | **FIXED** |
| **MEDIUM-10** | Medium | Permissive CORS Wildcard with `credentials: true` & Disabled Helmet CSP | `apps/backend/src/app.ts` | **FIXED** |
| **MEDIUM-11** | Medium | Weak Default Secrets & Publicly Bound Database/Backend Ports in `docker-compose.yml` | `docker-compose.yml` | **FIXED** |
| **MEDIUM-12** | Medium | JWT Bearer Token Leaked to Browser Console on Every API Request | `apps/frontend/src/api/client.ts` | **FIXED** |
| **LOW-13** | Low | Non-Cryptographic PRNG (`Math.random()`) Used in Password Generation | `apps/backend/src/utils/password.ts` | **FIXED** |
| **LOW-14** | Low | Hardcoded Default Credentials in `LoginPage.tsx` & Unescaped HTML in Outbound Emails | `apps/frontend/src/pages/LoginPage.tsx`, `apps/backend/src/services/mail.service.ts`, `insurance-onboarding.service.ts` | **FIXED** |

---

## Detailed Findings & Applied Fixes

### CRITICAL-01: Unauthenticated Account Lockout, Takeover & Inactive Account Reactivation via Password Reset
- **Vulnerability:** `POST /api/auth/reset-password` (`requestPasswordReset` in `apps/backend/src/services/auth.service.ts`) immediately overwrote the target user's password hash in PostgreSQL before any email verification took place, allowing any unauthenticated attacker to lock out any user (including `ADMIN`) at will. Furthermore, it unconditionally set `status: UserStatus.ACTIVE`, allowing deactivated (`INACTIVE`) accounts to self-reactivate.
- **Fix:**
  - Replaced immediate password overwrite with a 2-step stateless signed JWT reset token (`purpose: "password_reset"`, 15-minute expiry, bound to `pwdFingerprint` of the current `passwordHash` so tokens are strictly single-use).
  - Blocked `INACTIVE` accounts from requesting or confirming password resets.
  - Added `POST /api/auth/reset-password/confirm` and updated `ResetPasswordPage.tsx` to support `?token=...` confirmation.

### CRITICAL-02: Unauthenticated PII Read/Overwrite & PIN Hash Leak on Public Financing Application Forms
- **Vulnerability:**
  1. `generateApplicationFormLink` appended `&hash=${accessCodeHash}` directly to the client URL, exposing the SHA-256 hash of the 4-digit PIN in the URL and allowing offline brute-forcing in <1 ms or direct replay.
  2. `GET /api/application-forms/:id`, `PATCH /api/application-forms/:id`, `POST /api/application-forms/:id/submit`, and `POST /api/application-forms/:id/heartbeat` had no authentication or PIN verification middleware.
- **Fix:**
  - Removed `&hash=` from generated client URLs in `application-form.service.ts`.
  - Updated `verifyApplicationFormAccess` to use constant-time `timingSafeEqual` comparison and return `accessCodeHash` only after valid PIN verification.
  - Added `authorizeApplicationFormAccess` middleware on `GET /:id`, `PATCH /:id`, `POST /:id/submit`, and `POST /:id/heartbeat` requiring either a valid CRM user JWT with `canAccessLead` permissions or a valid `X-Form-Access-Hash` header verified via `timingSafeEqual`.
  - Updated `ClientConsentsPage.tsx` and `MultiStepForm.tsx` to verify the PIN via the backend and pass `X-Form-Access-Hash`.

### CRITICAL-03: Unauthenticated Email Webhook Spoofing & Stored XSS in Email/Consent Viewers
- **Vulnerability:**
  1. `POST /api/webhooks/email/incoming` had no authentication, allowing anyone to inject fake emails and create leads/notes with arbitrary HTML payloads.
  2. `LeadDetailCard.tsx`, `SendEmailModal.tsx`, and `InsuranceOnboardingPage.tsx` rendered `note.metadata.html`, `quotedHtml`, and consent HTML via `dangerouslySetInnerHTML` without sanitization, enabling Stored XSS inside the authenticated CRM session.
- **Fix:**
  - Added `CRM_WEBHOOK_TOKEN` authentication (`Authorization: Bearer` or `X-Webhook-Token` verified with `timingSafeEqual`) and rate limiting to `/api/webhooks/email/incoming`.
  - Created `apps/backend/src/utils/html.ts` (`escapeHtml`, `sanitizeEmailHtml`) and sanitized incoming/outgoing email HTML on the backend.
  - Created `apps/frontend/src/utils/sanitizeHtml.ts` (DOMParser-based sanitizer) and wrapped all `dangerouslySetInnerHTML` usages in `LeadDetailCard.tsx`, `SendEmailModal.tsx`, and `InsuranceOnboardingPage.tsx`.

### CRITICAL-04: Unauthenticated Public Access to Uploaded Documents (`/uploads`) & Unrestricted File Types
- **Vulnerability:** `app.use("/uploads", express.static(...))` served all uploaded customer documents without authentication, and `upload.ts` accepted any file extension/MIME type (including `.html`, `.svg`).
- **Fix:**
  - Restricted `multer` in `apps/backend/src/utils/upload.ts` to an explicit allowlist of extensions and MIME types (`.pdf`, `.jpg`, `.jpeg`, `.png`, `.webp`, `.doc`, `.docx`, `.xls`, `.xlsx`, `.csv`, `.txt`, `.odt`, `.ods`) and sanitized `leadId` with `path.basename`.
  - Replaced unauthenticated `express.static` with an authenticated `GET /uploads/:leadId/:filename` route in `apps/backend/src/app.ts` that verifies the user's JWT (`Authorization` header or `?token=` query param), checks `canAccessLead`, prevents path traversal, and sets `Content-Security-Policy: default-src 'none'; sandbox` and `X-Content-Type-Options: nosniff`.

### HIGH-05 through LOW-14
- **HIGH-05 (BOLA/IDOR on Lead Sub-Resources):** Created shared `apps/backend/src/utils/leadAccess.ts` (`canAccessLead`) and enforced it across `POST /api/leads/:id/notes`, `POST /api/leads/:id/documents`, `POST /api/leads/:id/application-form`, `POST /api/leads/:id/email`, `POST/GET /api/leads/:id/email/draft`, `POST /api/leads/:id/insurance-onboarding/start`, and `GET /api/leads/:id/insurance-onboarding`.
- **HIGH-06 & HIGH-07 (Consent Security):** Enforced `canAccessLead` in `withdrawConsent`, scoped `listConsentRecords` for `OPERATOR` users to their assigned/partner leads, and verified `accessCodeHash` against `applicationForm.accessCodeHash` via `timingSafeEqual` in `recordConsentBatch`.
- **HIGH-08 (Privilege Escalation in User Admin):** Blocked `SUPERVISOR` from updating or resetting passwords of `ADMIN` users in `apps/backend/src/routes/user.routes.ts`.
- **HIGH-09 (Rate Limiting):** Added `createRateLimiter` middleware across auth, PIN verification, public form, consent recording, insurance onboarding, and webhook routes.
- **MEDIUM-10, MEDIUM-11, MEDIUM-12, LOW-13, LOW-14:** Enabled Helmet CSP and disallowed wildcard CORS in production (`app.ts`), removed weak fallback secrets and bound ports to `127.0.0.1` (`docker-compose.yml`), removed JWT `console.log` (`client.ts`), replaced `Math.random()` with `crypto.randomInt` (`password.ts`), removed default login credentials (`LoginPage.tsx`), and escaped HTML interpolations in all email templates (`mail.service.ts`, `insurance-onboarding.service.ts`).
