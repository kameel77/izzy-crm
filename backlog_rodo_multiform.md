# Backlog: Multi-step Financing Form & RODO Module

Źródła zakresu: `prd_rodo_module.md` (wspólny moduł zgód) oraz `prd_multiform_financing.md` (formularz wieloetapowy). Backlog ma zapewnić spójność modeli (`ConsentTemplate`, `ConsentRecord`, `ApplicationForm`) oraz statusów (`draft/in_progress/ready/submitted/locked`) pomiędzy systemami, zanim wejdziemy w implementację UI.

## Sprint 0 – Alignment & Contracts
[ ] Zatwierdzić wspólny model `ConsentTemplate`/`ConsentRecord` oraz mapowanie pól `application_form_id`, `form_type`, `help_text`, `ip`, `userAgent`, `accessCodeHash` między formularzem a modułem RODO
[ ] Przygotować migracje DB rozszerzające schemat RODO i ApplicationForm o brakujące pola (`form_type`, `help_text`, `withdrawn_at`, `application_form_id`, `consentText`, `version` snapshot)
[ ] Udokumentować w Confluence handshake statusów (`draft/in_progress/ready/submitted/locked`) i zasady blokady `isClientActive` opisane w PRD, wraz z audytem prób edycji
[ ] Zaimplementować kontrakt API (`GET /api/consent-templates?form_type=financing_application`, `POST /api/consent-records`) z testami kontraktowymi i walidacją wersji
[ ] Uzgodnić i opisać w OpenAPI scenariusze błędów (`TEMPLATE_OUTDATED`, `LINK_EXPIRED`, `REQUIRED_CONSENT_MISSING`, `CLIENT_ACTIVE`) oraz format komunikatów dla portalu i CRM

## Sprint 1 – Backend Readiness
[x] Wystawić 5-minutowy cache dla `GET /api/consent-templates?form_type=financing_application` + metryki hit/miss oraz ostrzeżenie, gdy lista wersji jest starsza niż 15 min
[x] Wymusić blokadę operatora (`409 CLIENT_ACTIVE`) przy `isClientActive = true`, logować zdarzenia do audytu i wysyłać powiadomienie do SUPERVISOR
[x] Wdrożyć idempotencję zapisów zgód po `(applicationFormId, consentTemplateId, version)` oraz retry politykę dla konfliktów `TEMPLATE_OUTDATED`
[x] Rozszerzyć webhook/notification do CRM o event `application.ready_for_review` zawierający `consent_template_id`, `version`, `client_ip`, `userAgent`
[x] Zsynchronizować moduł e-maili z eventami odblokowania (trigger `EmailLog.type = 'unlocked'`) i wygenerować notatkę CRM automatycznie

## Sprint 2 – Frontend Client Portal
[x] Podpiąć pobieranie zgód z `GET /api/consent-templates?form_type=financing_application` wraz z automatycznym re-fetchem po odpowiedzi 409 (`TEMPLATE_OUTDATED`)
[x] Dodać modal błędów z UX z PRD (401 – wygasły link, 409 – aktywna sesja/wersja, 422 – brak wymaganej zgody) oraz telemetry dla tych ścieżek
[x] Przechować `consent_template_id`, `version`, timestamp akceptacji i `ip/userAgent` w store formularza, żeby wysłać je w submit payload
[x] Napisać Playwright e2e covering: fetch zgód, aktywacja modala błędów, aktualizacja store po re-fetcha 409, oraz pomiar czasu wypełniania konsentów
[x] Zintegrować stan blokady `isClientActive` z bannerem/CTA disable w UI, zgodnie z handshake ze Sprintu 1

## Sprint 3 – Admin & QA
[x] Wygenerować ApplicationForm i link klienta z poziomu panelu operatora (`POST /leads/:id/application-form`), wysłać e-mail/SMS z linkiem
[ ] Zaimplementować odświeżanie linku po `unlock` oraz obsłużyć `accessCodeHash`/expiry w CRM
[x] Zaktualizować panel admina tak, by pokazywał statusy `draft/in_progress/ready/submitted/locked`, blokadę `isClientActive` oraz historię unlocków
- Stworzono dashboard monitorujący zablokowane formularze i nieudane próby odblokowania PIN-em.
[ ] Rozszerzyć Flow 4 testów E2E o przypadki: (a) blokada operatora, (b) ponowne zebranie zgód po unlock, (c) eksport audytu z nowymi metadanymi
[ ] Przygotować dashboard monitorujący feature flagi (`RODO_ADMIN_PANEL`, `CONSENT_VERSIONING`, `AUDIT_EXPORT`) + alerty na brak synchronizacji wersji zgód
[ ] Ustawić cykliczny przegląd audytowy (raz w sprincie) wraz z checklistą compliance i checklistą sanity do modułu zgód
[ ] Dodać raport QA automatycznie walidujący spójność `ConsentRecord.version` z najnowszym `ConsentTemplate` i publikować go w kanale #compliance

## Testy automatyczne do wdrożenia
- **Testy kontraktowe API**: `GET /api/consent-templates` (filtr `form_type`, cache headers) oraz `POST /api/consent-records` (walidacja wersji, idempotencja, kody błędów 401/409/422).
- **Testy integracyjne backendu**: scenariusze blokady `isClientActive`, retry policy po `TEMPLATE_OUTDATED`, webhook `application.ready_for_review` z kompletnym payloadem, synchronizacja eventu `EmailLog.type = 'unlocked'`.
- **Playwright e2e (Client Portal)**: pobieranie i odświeżanie zgód, modale błędów, aktualizacja store, blokada UI przy `isClientActive`, pełny submit z zapisaniem metadanych audytu.
- **E2E CRM/Admin**: Flow 4 z ponownymi zgodami, eksport audytu, dashboard flag oraz checklisty compliance.
- **Raport QA/monitoring**: job porównujący `ConsentRecord.version` vs `ConsentTemplate.version`, alerty na stare cache (>15 min), coverage telemetry błędów.

### Opcje uruchamiania testów (CI/CD)
1. **GitHub Actions (Free tier)** – uruchamia testy kontraktowe i integracyjne na każdym PR (limit minut/konkurencji, więc E2E tylko na gałęzi main lub ręcznie).
2. **Self-hosted runner na VPS Hetzner (Coolify)** – dedykowany agent do ciężkich Playwright/E2E + jobów monitorujących; wymaga utrzymania i izolacji od instancji produkcyjnej.
3. **Harmonogram w Coolify/cron na VPS** – nocne joby QA/monitoringu (porównanie wersji, alerty cache) poza pipeline CI.
4. **Manual/triggered pipelines** – workflow uruchamiany na żądanie przed release (pełny zestaw E2E + checklisty compliance), aby nie blokować codziennego developmentu.

## Sprint 4 – Jakość i Usprawnienia UX
[ ] **Implementacja zapisu adresu IP przy zgodach (RODO)**
    - *Cel:* Zapewnienie pełnej zgodności z `US-17` (`prd_multiform_financing.md`) poprzez zapisywanie adresu IP i User Agent w `ConsentRecord`.
    - *Kryteria akceptacji:* Adres IP jest pobierany z nagłówków żądania w backendzie i poprawnie zapisywany w bazie danych podczas wysyłania formularza przez klienta.

[ ] **Automatyczne testy E2E dla formularza wieloetapowego**
    - *Cel:* Zabezpieczenie kluczowego procesu biznesowego przed regresją, zgodnie z `10.3 E2E Tests` (`prd_multiform_financing.md`).
    - *Kryteria akceptacji:* Stworzenie scenariusza testowego w Playwright, który weryfikuje:
        1. Poprawne wypełnianie wszystkich 6 kroków.
        2. Działanie walidacji na każdym kroku.
        3. Pomyślne wysłanie formularza i przekierowanie na stronę z podziękowaniem.
        4. Zapisanie `ConsentRecord` w bazie danych po wysłaniu.

[ ] **Powiadomienie dla operatora po złożeniu wniosku przez klienta**
    - *Cel:* Realizacja `US-02` i `6B. Akcje` (`prd_multiform_financing.md`) poprzez informowanie operatorów o nowych, gotowych do przejrzenia wnioskach.
    - *Kryteria akceptacji:* Po pomyślnym wysłaniu formularza przez klienta, system wysyła powiadomienie (w aplikacji lub e-mail) do przypisanego operatora lub ogólnej grupy.

[ ] **Refaktoryzacja formularza tworzenia leada i walidacja "na żywo"**
    - *Cel:* Ujednolicenie technologii formularzy i poprawa UX zgodnie z `7.2 Validation Feedback` (`prd_multiform_financing.md`).
    - *Kryteria akceptacji:*
        1. Formularz `CreateLeadForm` zostaje przepisany na `react-hook-form` i `zod`.
        2. Walidacja pól "Email" i "Phone" odbywa się w czasie rzeczywistym, a nie tylko `onBlur`.