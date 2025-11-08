# PRD: Multi-step Application Form z Shared Link

## 1. Overview

### 1.1 Cel biznesowy
Umożliwienie klientom samodzielnego wypełniania wniosków o finansowanie pojazdu poprzez bezpieczny, unikalny link, z możliwością zapisywania postępu i finalnej akceptacji z timestampem zgód RODO.

### 1.2 Wartość dla biznesu
- Redukcja czasu operatorów na wprowadzanie danych
- Zwiększenie dokładności danych (klient sam weryfikuje)
- Compliance RODO z pełnym auditem zgód
- Lepsza konwersja leadów dzięki UX

### 1.3 Zakres MVP
- Multi-step formularz (6 kroków)
- Unikalny link z kodem dostępu (4 ostatnie cyfry telefonu)
- Auto-save co 30s
- Progress tracking
- Zarządzanie zgodami przez Admina
- Email reminders (24h, 5 dni przed wygaśnięciem)
- Audit log zgód z timestampem

---

## 2. User Stories

### 2.1 Operator (CRM)
**US-01**: Jako operator mogę wygenerować unikalny link do wniosku i wysłać go klientowi (email/SMS)  
**US-02**: Jako operator widzę status wniosku: `Roboczy` / `Wypełniany przez klienta` / `Gotowy do wysłania`  
**US-03**: Jako operator widzę zakres danych zapisanych przez klienta w czasie rzeczywistym  
**US-04**: Jako operator **nie mogę edytować** wniosku gdy klient ma aktywną sesję  
**US-05**: Jako operator mogę dodawać komentarze do wniosku  
**US-06**: Jako operator widzę historię wysłanych emaili (reminders, odblokowanie)

### 2.2 Klient (Frontend)
**US-07**: Jako klient otrzymuję link ważny 7 dni od wygenerowania  
**US-08**: Jako klient loguję się kodem (4 ostatnie cyfry telefonu)  
**US-09**: Jako klient widzę progress bar (% completion)  
**US-10**: Jako klient mogę zapisać formularz w dowolnym momencie (auto-save + manual)  
**US-11**: Jako klient mogę wielokrotnie wracać do formularza i edytować dane  
**US-12**: Jako klient po wypełnieniu wszystkich wymaganych pól mogę zaakceptować zgody i wysłać wniosek  
**US-13**: Jako klient otrzymuję email reminder po 24h jeśli nie dokończyłem formularza  
**US-14**: Jako klient otrzymuję email 5 dni przed wygaśnięciem linku

### 2.3 Administrator
**US-15**: Jako admin mogę odblokować wniosek do ponownej edycji  
**US-16**: Jako admin zarządzam szablonem zgód (dodawanie/edycja/usuwanie)  
**US-17**: Jako admin widzę audit log wszystkich zgód (timestamp, IP, user agent)  
**US-18**: Jako admin zarządzam tekstami pomocniczymi w formularzu online

---

## 3. Architecture & Data Model

### 3.1 Core Entities

#### ApplicationForm
```javascript
{
  id: UUID,
  leadId: UUID, // relacja do leada
  status: enum ['draft', 'in_progress', 'ready', 'submitted', 'locked'],
  createdBy: UUID, // operator_id lub 'system'
  
  // Link management
  uniqueLink: string, // hash token
  accessCode: string, // 4 ostatnie cyfry telefonu (hashed)
  linkGeneratedAt: timestamp,
  linkExpiresAt: timestamp, // +7 dni
  
  // Session tracking
  isClientActive: boolean, // czy klient ma otwartą sesję
  lastClientActivity: timestamp,
  lastAutoSave: timestamp,
  
  // Progress
  completionPercent: integer, // 0-100
  currentStep: integer, // 1-6
  
  // Form data (JSON)
  formData: {
    personalData: {...},
    document: {...},
    addresses: {...},
    employment: {...},
    budget: {...},
    consents: {...}
  },
  
  // Audit
  submittedAt: timestamp,
  submittedByClient: boolean,
  unlockHistory: [{
    unlockedBy: UUID,
    unlockedAt: timestamp,
    reason: string
  }],
  
  timestamps
}
```

#### ConsentTemplate
```javascript
{
  id: UUID,
  formType: 'financing_application', // dla różnych typów formularzy
  version: integer, // wersjonowanie zmian
  isActive: boolean,
  
  consents: [{
    id: UUID,
    internalName: string, // 'gdpr_processing_after_contract'
    displayText: string, // HTML - tekst zgody
    helpText: string, // tooltip/info dla klienta
    isRequired: boolean,
    order: integer,
    category: enum ['rodo', 'marketing', 'processing']
  }],
  
  createdBy: UUID,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### ConsentLog
```javascript
{
  id: UUID,
  applicationFormId: UUID,
  consentTemplateId: UUID,
  consentId: UUID,
  
  // Audit data
  accepted: boolean,
  acceptedAt: timestamp,
  ipAddress: string,
  userAgent: string,
  
  // RODO compliance
  consentText: string, // snapshot tekstu zgody
  version: integer // wersja szablonu
}
```

#### EmailLog
```javascript
{
  id: UUID,
  applicationFormId: UUID,
  leadId: UUID,
  
  type: enum ['link_sent', 'reminder_24h', 'reminder_5days', 'unlocked'],
  sentAt: timestamp,
  sentTo: string, // email
  status: enum ['sent', 'delivered', 'failed', 'opened'],
  
  // Automatycznie tworzy notatkę w CRM
  noteCreated: boolean,
  noteId: UUID
}
```

### 3.2 Status Flow Diagram

```
[Roboczy] 
    ↓ (operator generuje link)
[Roboczy + Link Active]
    ↓ (klient otwiera link)
[Wypełniany przez klienta] → (klient zapisuje) → [Wypełniany przez klienta]
    ↓ (klient klika "Wyślij wniosek")
[Gotowy do wysłania]
    ↓ (admin odblokowuje)
[Odblokowany - wymaga ponownej akceptacji]
    ↓ (klient ponownie akceptuje)
[Gotowy do wysłania]
```

---

## 4. Multi-Step Form Structure

### Krok 1: Dane osobowe (Personal Data)
**Pola wymagane (*)**
- PESEL * → auto-validate (algorytm kontrolny + data urodzenia)
- Płeć * → auto-populate z PESEL
- Imię *
- Nazwisko *
- Telefon komórkowy *
- E-mail *
- Data urodzenia * → auto-populate z PESEL
- Miejsce urodzenia *
- Kraj urodzenia *
- Obywatelstwo * (dropdown)
- Drugie obywatelstwo (dropdown, opcjonalne)
- Narodowość *
- Nazwisko rodowe *
- Stan cywilny * (dropdown)
- Nazwisko panieńskie matki *
- Rezydent podatkowy (Y/N) *
- Liczba dzieci * (number input, min: 0)

**Walidacje:**
- PESEL: 11 cyfr + algorytm kontrolny
- Email: format email
- Telefon: format +48 XXX XXX XXX

**Progress: 16.67%**

---

### Krok 2: Dokument tożsamości (Identity Document)
**Pola wymagane (*)**
- Rodzaj dokumentu * (dropdown: Dowód osobisty, Paszport)
- Numer dokumentu *
- Data wydania dokumentu * (date picker)
- Data ważności dokumentu * (date picker)
- Wykształcenie * (dropdown: podstawowe, średnie, wyższe, podyplomowe)

**Walidacje:**
- Data wydania < Data ważności
- Data ważności > dzisiaj (dokument nie może być przeterminowany)
- Numer dokumentu: format zależny od typu

**Progress: 33.33%**

---

### Krok 3: Adresy (Addresses)

#### 3A. Adres zameldowania
- Ulica oraz nr budynku i/lub mieszkania *
- Kod pocztowy * → sugeruje miejscowość (future: API GUS)
- Miejscowość *
- Poczta *

#### 3B. Adres zamieszkania (korespondencyjny)
**Checkbox:** "Adres zamieszkania taki sam jak zameldowania"
- Kraj zamieszkania * (dropdown)
- Ulica oraz nr budynku i/lub mieszkania *
- Kod pocztowy *
- Miejscowość *
- Poczta *
- Typ lokalu * (dropdown: dom, mieszkanie, inne)
- Rodzaj własności * (dropdown: własność, wynajem, zamieszkanie u rodziny, inne)
- Adres od (rrrr-mm) * (month picker)

**Walidacje:**
- Kod pocztowy: format XX-XXX
- Data "od" nie może być w przyszłości

**Progress: 50%**

---

### Krok 4: Zatrudnienie (Employment)
- Źródło dochodów * (dropdown: umowa o pracę, działalność gospodarcza, emerytura, renta, inne)
- Zatrudnienie od (rrrr-mm) *
- Zawód *
- Stanowisko *
- Sektor zatrudnienia * (dropdown: publiczny, prywatny)
- Całkowity staż pracy * (lata, miesiące)
- Rodzaj zakładu pracy * (dropdown)

#### Dane pracodawcy
- Nazwa *
- Ulica oraz nr budynku i/lub mieszkania *
- Kod pocztowy *
- Miejscowość *
- Poczta *
- Telefon * (format: +48 XXX XXX XXX)
- NIP (opcjonalnie, format: XXX-XXX-XX-XX)
- REGON (opcjonalnie)

**Walidacje:**
- Data zatrudnienia nie może być w przyszłości
- Całkowity staż ≥ okres zatrudnienia u obecnego pracodawcy

**Progress: 66.67%**

---

### Krok 5: Budżet (Budget)
**Dochody (PLN)**
- Główne dochody * (kwota netto)
- Inne dochody (opcjonalnie)

**Wydatki (PLN)**
- Opłaty za mieszkanie *
- Pozostałe koszty życia *
- Kwota rat kredytów * (suma wszystkich rat)
- Kwota limitów kart/kredytów * (suma dostępnych limitów)
- Inne obciążenia finansowe wnioskodawcy *

**Kalkulacja automatyczna:**
```
Dochód netto = Główne dochody + Inne dochody
Wydatki = Suma wszystkich wydatków
Zdolność kredytowa (informacyjnie) = Dochód netto - Wydatki
```

**Walidacje:**
- Wszystkie wartości ≥ 0
- Główne dochody > 0

**Progress: 83.33%**

---

### Krok 6: Zgody i podsumowanie (Consents & Summary)

#### 6A. Podsumowanie danych
Przegląd wszystkich wprowadzonych danych z możliwością powrotu do edycji (klik na sekcję → redirect do odpowiedniego kroku)

#### 6B. Zgody (dynamicznie ładowane z ConsentTemplate)
Dla każdej zgody:
- Checkbox
- Pełny tekst zgody
- Tooltip z helpText (jeśli istnieje)
- Oznaczenie czy zgoda jest wymagana (*)

**Przykładowe zgody (zarządzane przez Admina):**
- [ ] Zgoda na przetwarzanie danych po wygaśnięciu umowy *
- [ ] Zgoda na marketing produktów grupy kapitałowej
- [ ] Zgoda na przetwarzanie danych przez grupę kapitałową
- [ ] Zgoda na marketing elektroniczny (email i SMS)
- [ ] Zgoda na usługę e-korespondencja
- [ ] Zgoda na marketing po wygaśnięciu umowy
- [ ] Zgoda na marketing telefoniczny

**Akcje:**
- **Przycisk "Zapisz formularz"** → zapisuje stan, nie zmienia statusu
- **Przycisk "Wyślij wniosek"** → aktywny tylko gdy wszystkie wymagane pola wypełnione i wszystkie wymagane zgody zaznaczone
  - Po kliknięciu:
    - Zapis timestamp każdej zgody do ConsentLog (IP, User Agent)
    - Zmiana statusu na `Gotowy do wysłania`
    - Blokada formularza (read-only)
    - Email potwierdzający do klienta
    - Notyfikacja do operatora w CRM

**Progress: 100%**

---

## 5. Technical Requirements

### 5.1 Frontend (Client Portal)

#### Tech Stack
- **Framework:** React 18+ / Next.js 14+
- **Form Management:** React Hook Form + Zod validation
- **State:** Zustand / Context API
- **Styling:** Tailwind CSS + shadcn/ui
- **Auto-save:** debounced (30s) API call

#### Key Components
```
/client-portal
  /[linkToken]
    - LoginPage (4-digit code input)
    - MultiStepForm
      - ProgressBar
      - Step1PersonalData
      - Step2Document
      - Step3Addresses
      - Step4Employment
      - Step5Budget
      - Step6Consents
    - SessionManager (heartbeat co 60s)
```

#### Session Management
- **Heartbeat:** Ping API co 60s z flagą `isActive: true`
- **Timeout:** Jeśli brak pinga przez 5 min → `isClientActive: false`
- **Lock prevention:** Jeśli operator próbuje edytować podczas aktywnej sesji → błąd

#### Auto-save Logic
```javascript
const debouncedSave = useDebouncedCallback(
  async (formData, currentStep) => {
    await api.saveApplicationForm({
      formData,
      currentStep,
      completionPercent: calculateCompletion(formData)
    });
    showToast("Zapisano automatycznie", "success");
  },
  30000 // 30s
);
```

#### PESEL Validator
```javascript
function validatePESEL(pesel) {
  // 1. Sprawdź długość
  if (pesel.length !== 11) return false;
  
  // 2. Algorytm kontrolny
  const weights = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3];
  const checksum = weights.reduce((sum, weight, i) => 
    sum + weight * parseInt(pesel[i]), 0
  );
  const controlDigit = (10 - (checksum % 10)) % 10;
  
  if (controlDigit !== parseInt(pesel[10])) return false;
  
  // 3. Ekstrakcja danych
  const year = extractYear(pesel);
  const month = extractMonth(pesel);
  const day = parseInt(pesel.slice(4, 6));
  
  // 4. Walidacja daty
  const birthDate = new Date(year, month - 1, day);
  if (birthDate > new Date()) return false;
  
  return {
    valid: true,
    birthDate,
    gender: parseInt(pesel[9]) % 2 === 0 ? 'K' : 'M'
  };
}
```

---

### 5.2 Backend (CRM & API)

#### API Endpoints

**Link Management**
```
POST /api/applications/{applicationId}/generate-link
Response: {
  uniqueLink: "https://portal.example.com/form/abc123xyz",
  expiresAt: "2025-11-15T12:00:00Z"
}
```

**Client Access**
```
POST /api/applications/verify-access
Body: { linkToken, accessCode }
Response: { applicationId, formData, currentStep, expiresAt }
```

**Save Progress**
```
PATCH /api/applications/{applicationId}
Body: {
  formData: {...},
  currentStep: 3,
  completionPercent: 50
}
```

**Session Heartbeat**
```
POST /api/applications/{applicationId}/heartbeat
Body: { isActive: true }
Response: { acknowledged: true }
```

**Submit Application**
```
POST /api/applications/{applicationId}/submit
Body: {
  formData: {...},
  consents: [
    { consentId, accepted: true, timestamp, ip, userAgent },
    ...
  ]
}
Response: { status: 'ready', submittedAt: timestamp }
```

**Admin Unlock**
```
POST /api/applications/{applicationId}/unlock
Body: { reason: "Korekta danych klienta" }
Response: { status: 'unlocked', emailSent: true }
```

---

### 5.3 Email Service

#### Email Templates

**1. Link wysłany (link_sent)**
```
Temat: Dokończ swój wniosek o finansowanie
Body:
Dzień dobry [Imię],

Twój wniosek o finansowanie czeka na uzupełnienie.

🔗 Link do formularza: [LINK]
🔑 Kod dostępu: [4 ostatnie cyfry telefonu]
⏰ Link ważny do: [DATA]

Możesz zapisać postęp i wrócić później.

Pozdrawiamy,
[Nazwa Firmy]
```

**2. Reminder 24h (reminder_24h)**
```
Temat: Przypomnienie - dokończ swój wniosek
Body:
Dzień dobry [Imię],

Wczoraj rozpocząłeś wypełnianie wniosku o finansowanie.

📊 Postęp: [X]%
🔗 Kontynuuj tutaj: [LINK]

Link ważny jeszcze przez [X] dni.
```

**3. Reminder 5 dni przed wygaśnięciem (reminder_5days)**
```
Temat: ⚠️ Twój link wygasa za 5 dni
Body:
Dzień dobry [Imię],

Twój link do wniosku o finansowanie wygasa [DATA].

📊 Postęp: [X]%
🔗 Dokończ teraz: [LINK]

Jeśli nie zdążysz, skontaktuj się z nami.
```

**4. Wniosek odblokowany (unlocked)**
```
Temat: Twój wniosek wymaga ponownej akceptacji
Body:
Dzień dobry [Imię],

Twój wniosek został odblokowany przez naszego konsultanta w celu poprawki danych.

Prosimy o:
✓ Weryfikację wprowadzonych danych
✓ Ponowne zaakceptowanie zgód
✓ Ponowne wysłanie wniosku

🔗 Przejdź do wniosku: [LINK]
```

#### Email Job Scheduler
```javascript
// Cron jobs
- reminder_24h: Codziennie 09:00
  → Znajdź aplikacje: createdAt = -24h AND status = 'in_progress' AND completionPercent < 100
  
- reminder_5days: Codziennie 10:00
  → Znajdź aplikacje: linkExpiresAt = +5 dni AND status = 'in_progress' AND completionPercent < 100

- link_expired: Codziennie 00:00
  → Znajdź aplikacje: linkExpiresAt < now AND status = 'in_progress'
  → Ustaw status = 'expired'
```

---

### 5.4 Admin Panel - Consent Management

#### Funkcje dla Admina
1. **Lista szablonów zgód** (wersjonowanie)
2. **Edytor zgód** (WYSIWYG dla displayText)
3. **Podgląd formularza** (preview jak widzi klient)
4. **Audit log zgód** (kto, kiedy, która wersja)

#### UI Consent Editor
```
[+] Dodaj nową zgodę

Lista zgód:
┌─────────────────────────────────────────────────────┐
│ ✋ Zgoda na przetwarzanie danych po wygaśnięciu     │
│    Kategoria: RODO | Wymagana: ✓ | Kolejność: 1    │
│    [Edytuj] [Przenieś ↑↓] [Usuń]                   │
├─────────────────────────────────────────────────────┤
│ 📧 Zgoda na marketing elektroniczny                 │
│    Kategoria: Marketing | Wymagana: ✗ | Kolejność: 2│
│    [Edytuj] [Przenieś ↑↓] [Usuń]                   │
└─────────────────────────────────────────────────────┘

[Zapisz nową wersję] [Podgląd formularza]
```

---

### 5.5 CRM - Operator View

#### Widok szczegółów wniosku
```
┌─────────────────────────────────────────────────────┐
│ Wniosek #12345                                       │
│ Status: 🟡 Wypełniany przez klienta                 │
│ Postęp: ████████░░░░ 66%                            │
│                                                      │
│ 🔗 Link: [Kopiuj link] [Wyślij ponownie]           │
│ ⏰ Wygasa: 2025-11-15 12:00                         │
│                                                      │
│ 👤 Klient aktywny: TAK (ostatnia aktywność: 2 min) │
│                                                      │
│ ⚠️ Nie możesz edytować - klient wypełnia formularz │
│                                                      │
│ [Dane klienta - READ ONLY]                          │
│ ├─ Dane osobowe ✅ (kompletne)                      │
│ ├─ Dokument ✅ (kompletne)                          │
│ ├─ Adresy ✅ (kompletne)                            │
│ ├─ Zatrudnienie 🟡 (w trakcie)                      │
│ ├─ Budżet ⚪ (nie rozpoczęte)                       │
│ └─ Zgody ⚪ (nie rozpoczęte)                        │
│                                                      │
│ 📝 Komentarze operatora:                            │
│ [Dodaj komentarz]                                    │
│                                                      │
│ 📧 Historia emaili:                                 │
│ - Link wysłany: 2025-11-08 10:00 ✅ Dostarczono    │
│ - Reminder 24h: 2025-11-09 09:00 ✅ Otwarto        │
└─────────────────────────────────────────────────────┘
```

#### Widok gdy wniosek gotowy
```
┌─────────────────────────────────────────────────────┐
│ Wniosek #12345                                       │
│ Status: 🟢 Gotowy do wysłania                       │
│ Wysłany przez klienta: 2025-11-10 14:32            │
│                                                      │
│ [Podgląd pełnych danych]                            │
│ [Pobierz PDF]                                        │
│ [Odblokuj wniosek] ← tylko dla Admina               │
│                                                      │
│ ✅ Zgody zaakceptowane:                             │
│ - Przetwarzanie danych (RODO) - 14:32:15           │
│ - Marketing elektroniczny - 14:32:18                │
│ ...                                                  │
│                                                      │
│ 🔒 Wniosek zablokowany do edycji                    │
└─────────────────────────────────────────────────────┘
```

---

## 6. Security & Compliance

### 6.1 Bezpieczeństwo
- **Link token:** UUID v4 (128-bit entropy)
- **Access code:** bcrypt hash (4 cyfry telefonu)
- **Rate limiting:** Max 5 prób logowania / 15 min
- **HTTPS only:** Brak dostępu przez HTTP
- **CORS:** Whitelista domen
- **Session timeout:** 5 min bez aktywności
- **IP logging:** Każde zaakceptowanie zgody

### 6.2 RODO Compliance
- **Consent snapshots:** Pełny tekst zgody w momencie akceptacji
- **Timestamp precision:** Dokładność do sekundy
- **IP anonymization:** Ostatni oktet zamaskowany po 30 dniach
- **Right to be forgotten:** Endpoint do usunięcia danych
- **Data retention:** Audit log zgód przez 5 lat (wymóg prawny)

### 6.3 Backup & Recovery
- **Auto-save:** Minimalizuje ryzyko utraty danych
- **Database backups:** Codziennie, retention 30 dni
- **Point-in-time recovery:** Możliwość przywrócenia stanu z ostatnich 7 dni

---

## 7. User Experience

### 7.1 Progress Indicators
```
════════════════════════════════════════
[●──○──○──○──○──○] 16% ukończone

Krok 1 z 6: Dane osobowe
════════════════════════════════════════
```

### 7.2 Validation Feedback
- **Real-time:** PESEL, email, kod pocztowy
- **On blur:** Większość pól tekstowych
- **On submit:** Walidacja całego kroku przed przejściem dalej

### 7.3 Mobile Responsiveness
- **Touch-friendly:** Min. 44x44px buttony
- **Scrollowanie:** Smooth scroll do błędów walidacji
- **Input types:** `type="tel"`, `type="email"`, `type="number"` dla natywnych keyboardów
- **Date pickers:** Natywne dla mobile, custom dla desktop

### 7.4 Accessibility (WCAG 2.1 AA)
- **Keyboard navigation:** Tab order logiczny
- **Screen readers:** ARIA labels na wszystkich polach
- **Contrast ratio:** Min. 4.5:1 dla tekstu
- **Focus indicators:** Wyraźne outline

---

## 8. Monitoring & Analytics

### 8.1 Metryki biznesowe
- **Conversion rate:** % leadów kończących formularz
- **Avg completion time:** Średni czas wypełnienia
- **Step drop-off:** Na którym kroku użytkownicy rezygnują
- **Link utilization:** % wygenerowanych linków wykorzystanych

### 8.2 Technical Metrics
- **API latency:** P50, P95, P99
- **Auto-save success rate:** % udanych zapisów
- **Session timeouts:** Liczba sesji zakończonych timeoutem
- **Email delivery rate:** % dostarczonych emaili

### 8.3 Alerts
- **Email delivery failure:** > 5% failed w ciągu 1h
- **API errors:** > 10 błędów 5xx w ciągu 5 min
- **Database connection pool:** > 80% wykorzystania

---

## 9. Implementation Roadmap

### Phase 1: MVP (4-6 tygodni)
**Week 1-2: Backend Foundation**
- [ ] Database schema + migrations
- [ ] API endpoints (CRUD aplikacji)
- [ ] Link generation + access code verification
- [ ] Session management (heartbeat)
- [ ] Consent template CRUD (admin)

**Week 3-4: Frontend Core**
- [ ] Multi-step form (6 kroków)
- [ ] React Hook Form + Zod schemas
- [ ] Auto-save mechanism (debounced)
- [ ] Progress bar + step navigation
- [ ] PESEL validator
- [ ] Responsive layout (mobile + desktop)

**Week 5-6: Integration & Polish**
- [ ] Email service (4 szablony)
- [ ] Cron jobs (reminders)
- [ ] CRM integration (status updates, notes)
- [ ] Operator view (read-only gdy klient aktywny)
- [ ] Admin panel (consent management)
- [ ] Testing + bug fixes

### Phase 2: Optimizations (2-3 tygodnie)
- [ ] Smart validation (auto-fill PESEL → data + płeć)
- [ ] Kod pocztowy → auto-suggest miejscowość
- [ ] Duplicate detection (PESEL/email - jako ostrzeżenie)
- [ ] PDF export (gotowy wniosek)
- [ ] Advanced analytics dashboard

### Phase 3: Future Enhancements
- [ ] NIP/REGON validation via GUS API
- [ ] E-signature integration (Autenti, DocuSign)
- [ ] Multi-language support
- [ ] WhatsApp notifications (alternative do email)
- [ ] Voice-to-text (dla operatorów telefonicznych)

---

## 10. Testing Strategy

### 10.1 Unit Tests
- PESEL validator (pozytywne + negatywne przypadki)
- Form validation logic (Zod schemas)
- Completion percentage calculator
- Email template rendering

### 10.2 Integration Tests
- API endpoints (happy path + error cases)
- Session management (timeout, concurrent access)
- Email delivery (mock SMTP)
- Database transactions (rollback scenarios)

### 10.3 E2E Tests (Playwright)
```
Scenario: Klient kończy formularz end-to-end
1. Operator generuje link w CRM
2. Klient otwiera link
3. Wpisuje kod dostępu (4 cyfry)
4. Wypełnia wszystkie 6 kroków
5. Auto-save działa co 30s
6. Klient akceptuje zgody
7. Klika "Wyślij wniosek"
8. Status w CRM zmienia się na "Gotowy"
9. Email potwierdzający wysłany

Scenario: Operator nie może edytować podczas sesji klienta
1. Klient otwiera link i wypełnia formularz
2. Operator próbuje edytować ten sam wniosek
3. System pokazuje błąd "Klient aktywny"
4. Operator widzi tylko read-only view

Scenario: Admin odblokowuje wniosek
1. Wniosek w statusie "Gotowy"
2. Admin klika "Odblokuj"
3. Email wysłany do klienta
4. Klient otwiera link ponownie
5. Musi ponownie zaakceptować zgody
6. Wysyła wniosek ponownie
```

### 10.4 Performance Tests
- **Load test:** 100 concurrent users wypełniających formularze
- **Auto-save stress:** 1000 save requests/min
- **Database queries:** Max 50ms dla single-row selects
- **Email queue:** 1000 emails/min processing capacity

### 10.5 Security Tests
- **Brute force:** Rate limiting na access code
- **SQL injection:** Prepared statements + ORM
- **XSS:** Input sanitization + CSP headers
- **CSRF:** Token validation on state-changing requests

---

## 11. Dependencies & Integrations

### 11.1 External Services
- **Email provider:** SendGrid / AWS SES / Mailgun
- **Database:** PostgreSQL 14+
- **Cache:** Redis (session state)
- **CDN:** Cloudflare (static assets)
- **Monitoring:** Sentry (errors) + Datadog (metrics)

### 11.2 Internal Integrations
- **CRM System:** Bidirectional sync (lead data, status updates, notes)
- **RODO Module:** Consent log integration
- **Notification System:** Email/SMS triggering

### 11.3 API Contracts
```javascript
// CRM → Application Form (webhook)
POST /webhooks/crm/lead-updated
{
  leadId: UUID,
  phone: string,
  email: string,
  firstName: string,
  lastName: string
}

// Application Form → CRM (webhook)
POST /webhooks/application/status-changed
{
  applicationId: UUID,
  leadId: UUID,
  oldStatus: string,
  newStatus: string,
  timestamp: ISO8601
}

// Application Form → RODO Module
POST /api/rodo/log-consents
{
  userId: UUID,
  applicationId: UUID,
  consents: [
    {
      consentId: UUID,
      accepted: boolean,
      timestamp: ISO8601,
      ip: string,
      userAgent: string,
      consentText: string,
      version: integer
    }
  ]
}
```

---

## 12. Rollout Plan

### 12.1 Soft Launch (Week 1)
- **Audience:** 10 operatorów + 50 leadów testowych
- **Monitoring:** Hourly checks, immediate hotfix deployment
- **Rollback plan:** Feature flag OFF → fallback do starego procesu
- **Success criteria:** 
  - Zero critical bugs
  - < 5% complaint rate
  - Email delivery rate > 95%

### 12.2 Gradual Rollout (Week 2-3)
- **Phase A:** 25% operatorów (100 leadów/dzień)
- **Phase B:** 50% operatorów (200 leadów/dzień)
- **Phase C:** 100% operatorów (400+ leadów/dzień)

### 12.3 Monitoring During Rollout
```
Daily Report Template:
═══════════════════════════════════════
📊 Application Form - Day X Report
═══════════════════════════════════════
Links generated: XXX
Active sessions: XXX
Completed forms: XXX (XX% conversion)
Drop-off at step:
  - Step 1: XX%
  - Step 2: XX%
  - Step 3: XX%
  - Step 4: XX%
  - Step 5: XX%
  - Step 6: XX%

Email delivery:
  - Sent: XXX
  - Delivered: XXX (XX%)
  - Opened: XXX (XX%)
  - Failed: XX (XX%)

Technical:
  - API errors: XX
  - Avg response time: XXms
  - Auto-save success: XX%

Issues:
  - [Lista zgłoszonych problemów]
  
Actions needed:
  - [Decyzje do podjęcia]
═══════════════════════════════════════
```

---

## 13. Training & Documentation

### 13.1 Operator Training (1h)
**Agenda:**
1. Demo: Generowanie linku i wysyłanie do klienta (10 min)
2. Demo: Monitorowanie postępu klienta (10 min)
3. Demo: Obsługa sytuacji "klient aktywny" (10 min)
4. Demo: Dodawanie komentarzy do wniosku (10 min)
5. Q&A + hands-on practice (20 min)

**Materiały:**
- Video tutorial (5 min)
- PDF quick guide (1 strona)
- FAQ (najczęstsze pytania)

### 13.2 Admin Training (2h)
**Agenda:**
1. Zarządzanie szablonami zgód (30 min)
2. Odblokowywanie wniosków (20 min)
3. Audit log i compliance (30 min)
4. Troubleshooting typowych problemów (30 min)
5. Q&A (10 min)

### 13.3 Technical Documentation
- **Architecture diagram** (system overview)
- **API documentation** (Swagger/OpenAPI)
- **Database schema** (ERD + migrations)
- **Deployment guide** (CI/CD pipeline)
- **Runbook** (incident response procedures)

---

## 14. Success Metrics & KPIs

### 14.1 Primary KPIs (Month 1-3)
| Metric | Target | Measurement |
|--------|--------|-------------|
| **Completion rate** | > 60% | (Submitted / Links generated) × 100 |
| **Avg. completion time** | < 15 min | Median time from link open to submit |
| **Operator time saved** | 30 min/lead | Compare: manual entry vs. client self-service |
| **Data accuracy** | > 95% | % of applications without data correction needed |
| **Email delivery rate** | > 98% | (Delivered / Sent) × 100 |

### 14.2 Secondary KPIs
- **Link utilization:** > 70% (opened / generated)
- **Return visits:** Avg. 2.5 sessions per completed form
- **Mobile usage:** > 40% of completions on mobile
- **Drop-off reduction:** < 10% drop at any single step

### 14.3 Technical KPIs
- **API uptime:** > 99.5%
- **P95 response time:** < 500ms
- **Auto-save success rate:** > 99%
- **Session timeout rate:** < 5%

---

## 15. Risk Management

### 15.1 Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Database bottleneck** (auto-save load) | Medium | High | Connection pooling, read replicas, query optimization |
| **Email delivery failures** | Low | Medium | Retry queue, fallback provider, SMS as backup |
| **Session conflicts** (race conditions) | Low | High | Pessimistic locking, transaction isolation |
| **Link expiration confusion** | Medium | Low | Clear UI messaging, email reminders |
| **Browser compatibility issues** | Low | Medium | Progressive enhancement, polyfills, broad testing |

### 15.2 Business Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Low adoption by clients** | Medium | High | UX testing pre-launch, clear instructions, operator support |
| **Operator resistance** | Low | Medium | Training, highlighting time savings, feedback loop |
| **RODO compliance violation** | Low | Critical | Legal review, penetration testing, audit log |
| **Data loss during migration** | Low | Critical | Staged rollout, backup strategy, rollback plan |

### 15.3 Contingency Plans

**If completion rate < 40% after 2 weeks:**
1. User research: Exit interviews with 10 incomplete users
2. Analyze drop-off points (heatmaps, session recordings)
3. A/B test: Simplified version (4 steps instead of 6)
4. Add live chat support during form filling

**If email delivery < 90%:**
1. Switch to backup provider immediately
2. Add SMS notification option
3. Investigate spam filters / domain reputation

**If operator complaints > 20%:**
1. Emergency training session
2. Create video tutorials for common issues
3. Assign super-users as internal support

---

## 16. Post-Launch Plan

### 16.1 Week 1 Post-Launch
- [ ] Daily standup (15 min) - discuss issues
- [ ] Monitor dashboards 24/7
- [ ] Hotfix deployment capability (< 1h turnaround)
- [ ] User feedback collection (survey after form completion)

### 16.2 Month 1 Review
- [ ] Analyze all KPIs vs. targets
- [ ] Prioritize quick wins (low-effort, high-impact improvements)
- [ ] Plan Phase 2 features based on feedback
- [ ] Present results to stakeholders

### 16.3 Continuous Improvement
**Monthly:**
- Review drop-off analytics
- A/B test UI improvements
- Update consent templates if regulations change
- Optimize slow database queries

**Quarterly:**
- User satisfaction survey (NPS)
- Competitor analysis (UX benchmarking)
- Security audit (penetration testing)
- Performance review with team

---

## 17. Budget Estimate

### 17.1 Development Costs (MVP)
| Resource | Time | Rate | Total |
|----------|------|------|-------|
| **Backend Developer** | 160h | $50/h | $8,000 |
| **Frontend Developer** | 160h | $50/h | $8,000 |
| **QA Engineer** | 80h | $40/h | $3,200 |
| **DevOps** | 40h | $60/h | $2,400 |
| **Product Manager** | 80h | $60/h | $4,800 |
| **UX Designer** | 40h | $50/h | $2,000 |
| **TOTAL DEV** | | | **$28,400** |

### 17.2 Infrastructure Costs (Monthly)
| Service | Cost |
|---------|------|
| Database (managed PostgreSQL) | $150 |
| Redis cache | $50 |
| Email service (10k emails/month) | $100 |
| CDN + hosting | $100 |
| Monitoring (Sentry + Datadog) | $200 |
| **TOTAL MONTHLY** | **$600** |

### 17.3 Ongoing Costs (Annual)
- Maintenance & support: $12,000
- Feature development (Phase 2-3): $20,000
- Infrastructure: $7,200
- **TOTAL YEAR 1:** $39,200

---

## 18. Appendix

### 18.1 Glossary
- **Lead:** Potencjalny klient pozyskany z różnych źródeł
- **Application Form:** Formularz wniosku o finansowanie
- **Consent Template:** Szablon zgód zarządzany przez Admina
- **Consent Log:** Audit log każdej zaakceptowanej zgody
- **Link Token:** Unikalny identyfikator linku (UUID)
- **Access Code:** 4 ostatnie cyfry telefonu klienta

### 18.2 Sample User Flows

#### Flow 1: Happy Path - Klient kończy wniosek
```
1. Lead przypisany do Operatora
2. Operator otwiera szczegóły leada w CRM
3. Operator klika "Generuj link do formularza"
4. System tworzy link ważny 7 dni
5. Operator wysyła link SMS/email do klienta
6. Klient klika link (ten sam lub kolejnego dnia)
7. Klient wpisuje kod dostępu (4 ostatnie cyfry tel.)
8. Klient wypełnia kroki 1-5 (zapisując po drodze)
9. Klient przegląda podsumowanie w kroku 6
10. Klient zaznacza wszystkie wymagane zgody
11. Klient klika "Wyślij wniosek"
12. System zapisuje timestampy zgód
13. Status zmienia się na "Gotowy do wysłania"
14. Operator dostaje notyfikację w CRM
15. Operator procesuje wniosek dalej
```

#### Flow 2: Klient przerywa i wraca później
```
1-7. [Jak w Flow 1]
8. Klient wypełnia kroki 1-3
9. Klient klika "Zapisz formularz"
10. Klient zamyka przeglądarkę
11. [Dzień później] Klient otwiera link ponownie
12. Klient wpisuje kod dostępu
13. System pokazuje progress: "Ukończono 50%"
14. Klient kontynuuje od kroku 4
15-17. [Jak w Flow 1, punkty 9-15]
```

#### Flow 3: Admin odblokowuje wniosek
```
1. Wniosek w statusie "Gotowy do wysłania"
2. Operator zauważa błąd w danych klienta
3. Operator kontaktuje się z Adminem
4. Admin otwiera wniosek w CRM
5. Admin klika "Odblokuj wniosek"
6. Admin wpisuje powód: "Korekta NIP pracodawcy"
7. System wysyła email do klienta
8. Status zmienia się na "Odblokowany"
9. Klient otrzymuje email z linkiem
10. Klient otwiera link i loguje się
11. System informuje: "Wymagana ponowna akceptacja"
12. Klient weryfikuje/poprawia dane
13. Klient ponownie zaznacza zgody
14. Klient wysyła wniosek ponownie
15. Status → "Gotowy do wysłania"
```

### 18.3 Database Indexes (Performance Optimization)
```sql
-- Application Forms
CREATE INDEX idx_applications_status ON application_forms(status);
CREATE INDEX idx_applications_lead_id ON application_forms(lead_id);
CREATE INDEX idx_applications_link_token ON application_forms(unique_link);
CREATE INDEX idx_applications_expires_at ON application_forms(link_expires_at) 
  WHERE status = 'in_progress';

-- Consent Logs
CREATE INDEX idx_consent_logs_app_id ON consent_logs(application_form_id);
CREATE INDEX idx_consent_logs_timestamp ON consent_logs(accepted_at);

-- Email Logs
CREATE INDEX idx_email_logs_app_id ON email_logs(application_form_id);
CREATE INDEX idx_email_logs_sent_at ON email_logs(sent_at);
CREATE INDEX idx_email_logs_type_status ON email_logs(type, status);
```

### 18.4 Feature Flags
```javascript
const FEATURE_FLAGS = {
  // MVP features (always ON in production)
  AUTO_SAVE: true,
  EMAIL_REMINDERS: true,
  MULTI_STEP_FORM: true,
  
  // Phase 2 features (gradual rollout)
  SMART_VALIDATION: false,  // PESEL auto-fill
  GUS_API_INTEGRATION: false,  // NIP/REGON lookup
  DUPLICATE_DETECTION: false,  // PESEL/email check
  
  // Phase 3 features (future)
  E_SIGNATURE: false,
  WHATSAPP_NOTIFICATIONS: false,
  MULTI_LANGUAGE: false
};
```

---

## 19. Open Questions & Decisions Needed

### 19.1 Decisions Required Before Development
- [ ] **Email provider selection:** SendGrid vs AWS SES vs Mailgun?
- [ ] **Hosting environment:** Cloud (AWS/GCP/Azure) vs On-premise?
- [ ] **CI/CD pipeline:** GitHub Actions vs GitLab CI vs Jenkins?
- [ ] **Monitoring stack:** Sentry + Datadog vs Alternatives?

### 19.2 Nice-to-Have (Can Be Decided Later)
- [ ] PDF generation library: Puppeteer vs PDFKit?
- [ ] SMS provider (if adding SMS notifications)
- [ ] Translation service (if going multi-language)

### 19.3 Legal Review Required
- [ ] Consent wording approval (zespół prawny)
- [ ] Data retention policy confirmation
- [ ] Cross-border data transfer compliance (if applicable)

---

## 20. Conclusion & Next Steps

### Summary
Ten PRD definiuje MVP dla systemu multi-step application form z funkcjonalnością unique link, który pozwala klientom samodzielnie wypełniać wnioski o finansowanie. System zapewnia:
- ✅ Compliance RODO z pełnym audit logiem
- ✅ Efektywność operacyjną (oszczędność 30 min/lead)
- ✅ Lepszy UX dla klienta (mobilny, auto-save, progress tracking)
- ✅ Bezpieczeństwo (access code, rate limiting, encryption)
- ✅ Skalowalność (auto-save, caching, monitoring)

### Immediate Next Steps
1. **Stakeholder review:** Prezentacja PRD do zatwierdzenia (1 tydzień)
2. **Technical refinement:** Architecture deep-dive z dev team (2 dni)
3. **UI/UX mockups:** Wireframes + high-fidelity designs (1 tydzień)
4. **Sprint planning:** Break down epics into user stories (3 dni)
5. **Development kickoff:** Week 1 Sprint 0 starts 🚀

### Contact & Ownership
- **Product Owner:** [Imię Nazwisko]
- **Tech Lead:** [Imię Nazwisko]
- **Project Manager:** [Imię Nazwisko]
- **Document Version:** 1.0
- **Last Updated:** 2025-11-08
- **Next Review:** Po zakończeniu MVP (Week 6)

---

**Document Status:** ✅ Ready for Development  
**Approval Required From:** Product Owner, CTO, Legal Team, QA Lead