# Backlog: Multi-step Financing Form & RODO Module

## Sprint 0 – Alignment & Contracts
[ ] Przeglądnąć i zatwierdzić wspólny model `ConsentTemplate` oraz `ConsentRecord` (PO + Tech Lead)
[ ] Przygotować migracje DB synchronizujące nowe pola (`form_type`, `help_text`, `withdrawn_at`, `application_form_id`)
[ ] Zaimplementować kontrakt API (`GET /api/consent-templates`, `POST /api/consent-records`) z testami kontraktowymi
[ ] Uzgodnić scenariusze błędów (`TEMPLATE_OUTDATED`, `LINK_EXPIRED`, `REQUIRED_CONSENT_MISSING`) i opisać je w OpenAPI

## Sprint 1 – Backend Readiness
[ ] Dodać cache 5-minutowy dla listy consent templates i metryki zużycia
[ ] Wprowadzić blokadę operatora podczas `isClientActive = true` wraz z audytem
[ ] Zapewnić idempotencję zapisów zgód po kluczach `(applicationFormId, consentTemplateId, version)`
[ ] Rozszerzyć webhook/notification do CRM o event `application.ready_for_review`

## Sprint 2 – Frontend Client Portal
[ ] Zaimplementować pobieranie zgód przez nowy endpoint z obsługą odświeżania po 409
[ ] Wdrożyć pełny fallback błędów (modal) dla kodów 401/409/422 opisanych w PRD
[ ] Zapisać wersję zgody i `consent_template_id` w store formularza dla przesłania wniosku
[ ] Dodać e2e test kroków konsentów (Playwright) z mockiem API RODO

## Sprint 3 – Admin & QA
[ ] Zaktualizować panel admina o mapowanie statusów `draft/in_progress/ready/submitted/locked`
[ ] Rozbudować Flow 4 testów E2E o blokadę operatora i ponowne zatwierdzanie zgód po unlock
[ ] Przygotować dashboard monitorujący flagi feature’ów (`RODO_ADMIN_PANEL`, `CONSENT_VERSIONING`, `AUDIT_EXPORT`)
[ ] Ustawić cykliczny przegląd audytowy (raz w sprincie) i checklistę compliance
