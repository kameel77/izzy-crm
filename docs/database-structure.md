# Struktura Bazy Danych Izzy CRM

Ten dokument opisuje konstrukcję bazy danych systemu Izzy CRM, opartej na PostgreSQL i zarządzanej za pomocą ORM Prisma. Schemat bazy danych jest zdefiniowany w pliku `prisma/schema.prisma`.

## Technologie

*   **Baza danych:** PostgreSQL
*   **ORM:** Prisma (z Prisma Client dla Node.js/TypeScript)

## Główne Modele (Tabele)

Poniżej przedstawiono główne modele danych wraz z ich przeznaczeniem i kluczowymi polami. Relacje między modelami są oparte na kluczach obcych.

### `User`
Reprezentuje użytkowników systemu (pracowników, partnerów).
*   `id`: Unikalny identyfikator użytkownika.
*   `email`: Adres e-mail (unikalny).
*   `hashedPassword`: Zahashowane hasło.
*   `role`: Rola użytkownika (np. `ADMIN`, `OPERATOR`, `PARTNER_MANAGER`).
*   `fullName`: Pełne imię i nazwisko.
*   `partnerId`: Klucz obcy do `Partner` (jeśli użytkownik jest powiązany z partnerem).
*   `status`: Status konta użytkownika (np. `ACTIVE`, `INACTIVE`).

### `Partner`
Reprezentuje partnerów biznesowych (np. salony samochodowe, agencje).
*   `id`: Unikalny identyfikator partnera.
*   `name`: Nazwa partnera.
*   `contact`: Dane kontaktowe (JSON).
*   `status`: Status partnera (np. `ACTIVE`, `PENDING`).

### `Lead`
Reprezentuje potencjalnego klienta (leada) w procesie finansowania.
*   `id`: Unikalny identyfikator leada.
*   `partnerId`: Klucz obcy do `Partner` (partner, który pozyskał leada).
*   `assignedUserId`: Klucz obcy do `User` (użytkownik przypisany do leada).
*   `createdByUserId`: Klucz obcy do `User` (użytkownik, który utworzył leada).
*   `status`: Aktualny status leada (np. `NEW`, `CREDIT_ANALYSIS`, `CLOSED_WON`).
*   `sourceMetadata`: Metadane źródła leada (JSON).
*   `leadCreatedAt`: Data utworzenia leada.

### `LeadStatusHistory`
Loguje każdą zmianę statusu leada.
*   `id`: Unikalny identyfikator wpisu.
*   `leadId`: Klucz obcy do `Lead`.
*   `oldStatus`: Poprzedni status leada.
*   `newStatus`: Nowy status leada.
*   `changedById`: Klucz obcy do `User` (kto zmienił status).
*   `timestamp`: Data i czas zmiany.
*   `reason`: Opcjonalny powód zmiany statusu.

### `LeadNote`
Notatki dodane do leada.
*   `id`: Unikalny identyfikator notatki.
*   `leadId`: Klucz obcy do `Lead`.
*   `authorId`: Klucz obcy do `User` (autor notatki).
*   `content`: Treść notatki.

### `CustomerProfile`
Szczegółowe dane profilu klienta powiązanego z leadem.
*   `id`: Unikalny identyfikator profilu.
*   `leadId`: Klucz obcy do `Lead` (unikalny).
*   `firstName`, `lastName`: Imię i nazwisko.
*   `dateOfBirth`: Data urodzenia.
*   `nationalIdHash`: Zahashowany numer dowodu osobistego.
*   `email`, `phone`: Dane kontaktowe.
*   `employmentInfo`, `address`: Informacje o zatrudnieniu i adresie (JSON).

### `VehicleCurrent`
Informacje o aktualnym pojeździe klienta.
*   `id`: Unikalny identyfikator.
*   `leadId`: Klucz obcy do `Lead` (unikalny).
*   `make`, `model`, `year`, `mileage`, `ownershipStatus`: Dane pojazdu.

### `VehicleDesired`
Informacje o pojeździe, który klient chce sfinansować.
*   `id`: Unikalny identyfikator.
*   `leadId`: Klucz obcy do `Lead` (unikalny).
*   `make`, `model`, `year`, `budget`, `preferences`: Dane pojazdu i preferencje.

### `FinancingApplication`
Szczegóły wniosku o finansowanie.
*   `id`: Unikalny identyfikator.
*   `leadId`: Klucz obcy do `Lead`.
*   `bank`: Nazwa banku/instytucji finansowej.
*   `loanAmount`, `downPayment`, `termMonths`, `income`, `expenses`, `creditScore`: Dane finansowe.
*   `decision`: Status decyzji banku (np. `PENDING`, `APPROVED`, `REJECTED`).

### `Document`
Dokumenty powiązane z leadem.
*   `id`: Unikalny identyfikator.
*   `leadId`: Klucz obcy do `Lead`.
*   `type`: Typ dokumentu.
*   `filePath`: Ścieżka do pliku.
*   `uploadedBy`: Kto przesłał.

### `Offer`
Oferty finansowania przedstawione klientowi.
*   `id`: Unikalny identyfikator.
*   `leadId`: Klucz obcy do `Lead`.
*   `title`: Tytuł oferty.
*   `price`, `currency`: Cena i waluta.
*   `availabilityStatus`: Status dostępności oferty.

### `Agreement`
Informacje o umowie finansowania.
*   `id`: Unikalny identyfikator.
*   `leadId`: Klucz obcy do `Lead` (unikalny).
*   `signatureStatus`: Status podpisu (np. `DRAFT`, `SIGNED`).
*   `signedFilePath`: Ścieżka do podpisanego pliku.

### `AuditLog`
Logi audytu zmian w systemie.
*   `id`: Unikalny identyfikator.
*   `leadId`: Klucz obcy do `Lead`.
*   `userId`: Klucz obcy do `User`.
*   `action`: Wykonana akcja.
*   `field`: Zmienione pole.
*   `oldValue`, `newValue`: Stara i nowa wartość (JSON).

### `Reminder`
Przypomnienia dla użytkowników.
*   `id`: Unikalny identyfikator.
*   `leadId`: Klucz obcy do `Lead`.
*   `assignedUserId`: Klucz obcy do `User` (do kogo przypisano).
*   `dueAt`: Termin przypomnienia.
*   `description`: Opis.

### `ApplicationForm`
Formularze wniosków o finansowanie.
*   `id`: Unikalny identyfikator.
*   `leadId`: Klucz obcy do `Lead` (unikalny).
*   `status`: Status formularza (np. `DRAFT`, `SUBMITTED`, `UNLOCKED`).
*   `uniqueLink`: Unikalny link do formularza.
*   `formData`: Dane formularza (JSON).

### `EmailLog`
Logi wysłanych e-maili.
*   `id`: Unikalny identyfikator.
*   `applicationFormId`: Klucz obcy do `ApplicationForm`.
*   `leadId`: Klucz obcy do `Lead`.
*   `type`: Typ e-maila (np. `LINK_SENT`, `REMINDER_24H`).
*   `status`: Status wysyłki (np. `SENT`, `DELIVERED`).

### `ConsentTemplate`
Szablony zgód.
*   `id`: Unikalny identyfikator.
*   `consentType`: Typ zgody.
*   `title`: Tytuł zgody.
*   `content`: Treść zgody.
*   `version`: Wersja zgody.

### `ConsentRecord`
Zapisy udzielonych zgód.
*   `id`: Unikalny identyfikator.
*   `consentTemplateId`: Klucz obcy do `ConsentTemplate`.
*   `applicationFormId`: Klucz obcy do `ApplicationForm`.
*   `leadId`: Klucz obcy do `Lead`.
*   `consentGiven`: Czy zgoda została udzielona.
*   `recordedByUserId`: Klucz obcy do `User` (kto zarejestrował).

## Enumy (Typy Wyliczeniowe)

Enumy zapewniają spójność danych i predefiniowane wartości dla kluczowych pól.

*   `UserRole`: Role użytkowników w systemie.
    *   `PARTNER`, `PARTNER_MANAGER`, `PARTNER_EMPLOYEE`, `OPERATOR`, `SUPERVISOR`, `ADMIN`, `AUDITOR`

*   `UserStatus`: Statusy kont użytkowników.
    *   `ACTIVE`, `INACTIVE`, `INVITED`

*   `PartnerStatus`: Statusy partnerów.
    *   `ACTIVE`, `INACTIVE`, `PENDING`

*   `LeadStatus`: Statusy leada w procesie finansowania.
    *   `NEW`, `FIRST_CONTACT`, `FOLLOW_UP`, `VERIFICATION`, `UNQUALIFIED`, `GATHERING_DOCUMENTS`, `CREDIT_ANALYSIS`, `OFFER_PRESENTED`, `NEGOTIATIONS`, `TERMS_ACCEPTED`, `CONTRACT_IN_PREPARATION`, `CONTRACT_SIGNING`, `CLOSED_WON`, `CLOSED_LOST`, `CLOSED_NO_FINANCING`, `CANCELLED`

*   `BankDecisionStatus`: Statusy decyzji banku.
    *   `PENDING`, `APPROVED`, `REJECTED`

*   `OfferStatus`: Statusy ofert.
    *   `PENDING`, `AVAILABLE`, `UNAVAILABLE`, `RESERVED`

*   `SignatureStatus`: Statusy podpisu umowy.
    *   `DRAFT`, `SENT`, `SIGNED`, `CANCELLED`

*   `ReminderStatus`: Statusy przypomnień.
    *   `OPEN`, `COMPLETED`, `CANCELLED`

*   `ApplicationFormStatus`: Statusy formularzy wniosków.
    *   `DRAFT`, `IN_PROGRESS`, `READY`, `SUBMITTED`, `LOCKED`, `UNLOCKED`

*   `ConsentType`: Typy zgód.
    *   `PARTNER_DECLARATION`, `MARKETING`, `FINANCIAL_PARTNERS`, `VEHICLE_PARTNERS`

*   `ConsentMethod`: Metody udzielenia zgody.
    *   `ONLINE_FORM`, `PHONE_CALL`, `PARTNER_SUBMISSION`

*   `EmailLogType`: Typy wysłanych e-maili.
    *   `LINK_SENT`, `REMINDER_24H`, `REMINDER_5DAYS`, `UNLOCKED`, `READY_FOR_REVIEW`

*   `EmailLogStatus`: Statusy wysyłki e-maili.
    *   `SENT`, `DELIVERED`, `FAILED`, `OPENED`

---

## Zarządzanie Migracjami (Workflow)

Aby zapewnić bezpieczeństwo i spójność danych, kluczowe jest stosowanie odpowiedniego procesu migracji bazy danych, szczególnie w środowisku produkcyjnym.

### Środowisko Deweloperskie

W trakcie lokalnego rozwoju, celem jest szybkość i iteracja.

*   **Polecenie:** `npx prisma migrate dev`
*   **Działanie:** Automatycznie tworzy i aplikuje migracje, porównując schemat Prisma z bazą danych. Jest to idealne do szybkiego prototypowania.
*   **Uwaga:** W przypadku konfliktów lub problemów, najszybszym rozwiązaniem jest często `npx prisma migrate reset --force`, które **usuwa wszystkie dane** i odbudowuje bazę od zera. **Tego polecenia nie wolno używać na produkcji.**

### Środowisko Produkcyjne (i Staging)

Na produkcji priorytetem jest **bezpieczeństwo i brak utraty danych**. Proces jest bardziej kontrolowany i składa się z dwóch kroków.

#### Krok 1: Wygenerowanie Pliku Migracji

Zamiast od razu aplikować zmiany, najpierw generujemy plik SQL z migracją.

```bash
npx prisma migrate dev --create-only
```

*   **Działanie:** Tworzy nowy plik `migration.sql` w katalogu `prisma/migrations/`, ale **nie uruchamia go** na bazie danych.
*   **Kluczowy Krok:** Po wygenerowaniu pliku, **należy go przejrzeć (code review)**. Sprawdź, czy wygenerowany SQL jest zgodny z oczekiwaniami i czy nie zawiera niebezpiecznych operacji (np. `DROP TABLE`), których się nie spodziewasz.

#### Krok 2: Zastosowanie Migracji

Gdy plik migracji zostanie zweryfikowany i zatwierdzony, można go bezpiecznie zaaplikować na bazie danych.

```bash
npx prisma migrate deploy
```

*   **Działanie:** Uruchamia wszystkie oczekujące migracje z katalogu `prisma/migrations/`. Jest to jedyne bezpieczne polecenie do uruchamiania w procesie wdrożenia (CI/CD) na produkcji.

### Postępowanie ze Złożonymi Zmianami

Niektóre zmiany (np. zmiana typu kolumny, modyfikacja `enum` z zachowaniem danych) wymagają migracji wieloetapowej, aby uniknąć utraty danych.

**Przykład (zmiana typu kolumny):**
1.  **Migracja 1 (Schema):** Dodaj nową, tymczasową kolumnę w nowym typie. Wdróż tę zmianę.
2.  **Skrypt migracji danych:** Uruchom skrypt (np. w TypeScript), który przekopiuje i przetransformuje dane ze starej kolumny do nowej.
3.  **Migracja 2 (Schema):** Usuń starą kolumnę i zmień nazwę nowej na docelową. Wdróż tę zmianę.

### Złote Zasady dla Produkcji

1.  **NIGDY** nie używaj `prisma migrate reset`.
2.  **ZAWSZE** rozdzielaj generowanie migracji (`--create-only`) od jej wdrażania (`deploy`).
3.  **ZAWSZE** przeglądaj wygenerowane pliki `migration.sql`.
4.  **DZIEL** złożone zmiany na kilka mniejszych, bezpiecznych migracji.
5.  **TESTUJ** migracje na środowisku stagingowym przed wdrożeniem na produkcję.