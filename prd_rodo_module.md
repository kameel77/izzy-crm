# PRD: Moduł Zarządzania Zgodami RODO

## 📋 Informacje podstawowe

**Projekt:** System zarządzania zgodami RODO w platformie pośrednictwa finansowego  
**Wersja:** 1.0  
**Data:** 2025-11-08  
**Owner:** Kamil  
**Stakeholderzy:** Admin systemu (ADMIN), pracownicy infolinii (OPERATOR, SUPERVISOR), partnerzy (PARTNER_MANAGER, PARTNER_EMPLOYEE), klienci

---

## 🎯 Cel biznesowy

Zapewnienie pełnej zgodności z RODO poprzez system zarządzania zgodami, który:
- Dokumentuje wszystkie zgody klientów i partnerów
- Umożliwia łatwe zarządzanie tekstami zgód
- Zapewnia transparentność i audytowalność procesów
- Minimalizuje ryzyko prawne związane z przetwarzaniem danych osobowych

---

## 📖 Kontekst biznesowy

### Model działania
Firma jest pośrednikiem finansowym w finansowaniu pojazdów. Leady pozyskiwane są z trzech źródeł:

1. **Partnerzy** - wprowadzają dane klienta przez formularz
2. **Online** - klient sam wypełnia formularz
3. **Infolinia** - pracownik (OPERATOR, SUPERVISOR) zakłada leada na podstawie rozmowy telefonicznej

### Rodzaje zgód w systemie

#### 1. Oświadczenia partnerów
- Partner potwierdza, że ma zgodę klienta na przekazanie danych do firmy

#### 2. Zgody marketingowe i handlowe (od klienta)
- Zgoda na kontakt i prezentację oferty

#### 3. Zgody na przesłanie danych do partnerów finansowych (od klienta)
- Umożliwia przesłanie wniosku do banków/leasingów

#### 4. Zgody na przesłanie danych do partnerów oferujących pojazdy (od klienta)
- Umożliwia przesłanie zapytania do dealerów

### Proces pracy z danymi

```
1. Partner przekazuje dane → oświadczenie partnera
2. Kontakt z klientem → prezentacja oferty
3. Wysłanie formularza online → klient potwierdza zgody
4. Przesłanie danych do partnerów → finalizacja
```

## 🔗 Integracja z multi-step application form
- **Statusy formularza:** moduł RODO przyjmuje i raportuje statusy `draft`, `in_progress`, `ready`, `submitted`, `locked` dokładnie tak, jak zdefiniowano w `prd_multiform_financing.md`. Każdy Consent Record przechowuje `application_form_id`, aby można było zmapować zgody do konkretnego etapu.
- **Blokada edycji:** kiedy `isClientActive = true` (heartbeat z formularza online), panel operatora nie pozwala zmienić danych ani zgód; próba akcji zwraca błąd `409 CLIENT_ACTIVE`.
- **Wersjonowanie zgód:** formularz podczas submitu przekazuje `consent_template_id` + `version`. Moduł RODO odrzuca zapis, jeżeli wersja jest nieaktualna i zwraca `TEMPLATE_OUTDATED`.
- **Odblokowanie (unlock):** gdy admin odblokuje wniosek, moduł RODO generuje nową instancję linku oraz wymusza ponowne zaakceptowanie zgód (nowe Consent Records, stara historia pozostaje tylko do wglądu).
- **Audit trail:** ApplicationForm przekazuje `ip`, `userAgent`, oraz `accessCodeHash`, które są kopiowane do Consent Records dla pełnego audytu.

---

## 👥 Persony użytkowników

### Admin systemu (ADMIN)
- Zarządza treściami zgód
- Monitoruje zgodność z RODO
- Wykonuje anonimizację danych
- Generuje raporty compliance

### Pracownik infolinii (OPERATOR)
- Zakłada leady z rozmów telefonicznych
- Potwierdza zgody ustne klientów
- Weryfikuje kompletność zgód

### Partner (PARTNER_EMPLOYEE)
- Przekazuje dane klientów
- Składa oświadczenia o posiadaniu zgód

### Klient
- Wypełnia formularze online
- Akceptuje zgody marketingowe/handlowe
- Potwierdza udostępnienie danych partnerom

---

## 🔧 Wymagania funkcjonalne

### 1. Zarządzanie tekstami zgód

#### 1.1 Typy zgód
System obsługuje 4 typy zgód:

1. **PARTNER_DECLARATION** - oświadczenie partnera o posiadaniu zgody
2. **MARKETING** - zgody marketingowe/handlowe od klienta
3. **FINANCIAL_PARTNERS** - zgoda na udostępnienie danych partnerom finansowym
4. **VEHICLE_PARTNERS** - zgoda na udostępnienie danych partnerom sprzedającym pojazdy

#### 1.2 Funkcje zarządzania tekstami

**Tworzenie i edycja zgód:**
- ✅ Tworzenie nowej wersji zgody z datą obowiązywania
- ✅ Edycja treści (automatycznie tworzy nową wersję, archiwizuje starą)
- ✅ Podgląd aktualnych i historycznych wersji
- ✅ Wyłączanie/włączanie zgody (soft delete)
- ✅ Oznaczanie jako wymagana/opcjonalna
- ✅ Tagowanie zgód dla łatwiejszego filtrowania (consent_type)
- ✅ Automatyczne wersjonowanie z timestampem i autorem zmiany

**Struktura obiektu Consent Template:**
Struktura musi zawierać odniesienie do konkretnej zgody lub zgód - tak, aby mozliwe było odniesienie do konkretnej treści wyrazonej zgody.

```javascript
{
  id: UUID,
  consent_type: "PARTNER_DECLARATION" | "MARKETING" | "FINANCIAL_PARTNERS" | "VEHICLE_PARTNERS",
  title: string,
  content: text/HTML,
  version: integer (auto-increment),
  valid_from: datetime,
  valid_to: datetime | null,
  is_active: boolean,
  is_required: boolean,
  created_by: user_id,
  created_at: datetime,
  updated_at: datetime,
  tags: array<string>
}
```

**Interfejs użytkownika:**
- Lista wszystkich zgód z filtrowaniem po typie i statusie
- Formularz tworzenia/edycji z edytorem WYSIWYG
- Podgląd na żywo jak zgoda będzie wyglądać dla użytkownika
- Historia wersji z możliwością porównania zmian (diff)

### 2. Archiwum zgód

#### 2.1 Przechowywanie zgód klientów

Każda zgoda wyrażona przez klienta jest zapisywana z pełnymi metadanymi:

**Struktura obiektu Consent Record:**

```javascript
{
  id: UUID,
  lead_id: UUID,
  consent_template_id: UUID,
  consent_type: "PARTNER_DECLARATION" | "MARKETING" | "FINANCIAL_PARTNERS" | "VEHICLE_PARTNERS",
  consent_given: boolean,
  consent_method: "online_form" | "phone_call" | "partner_submission",
  ip_address: string | null,
  user_agent: string | null,
  recorded_by_user_id: UUID | null,
  partner_id: UUID | null,
  recorded_at: datetime,
  withdrawn_at: datetime | null,
  notes: text | null
}
```

**Metadane zbierane w zależności od źródła:**

| Źródło | Zbierane dane |
|--------|---------------|
| **Formularz online** | IP address, user agent, timestamp |
| **Infolinia** | ID pracownika, timestamp, notatki z rozmowy |
| **Partner** | ID partnera, IP partnera, timestamp |

#### 2.2 Widok archiwum

**Funkcje:**
- Filtry: typ zgody, zakres dat, źródło, status (aktywna/wycofana)
- Sortowanie: data (najnowsze/najstarsze), typ, klient
- Wyszukiwanie: po nazwisku klienta, adresie email, nr telefonu, ID leada, typie zgody
- Paginacja: 50 rekordów na stronę
- Eksport: CSV, JSON

**Kolumny w tabeli:**
- Data i godzina wyrażenia zgody
- Klient (imię, nazwisko, adres email, nr telefonu)
- Typ zgody
- Źródło (ikona + tooltip)
- Status (aktywna/wycofana)
- Akcje (podgląd szczegółów, link do leada)

### 3. Lista klientów z zgodami

#### 3.1 Widok główny

**Tabela klientów:**

| Kolumna | Opis |
|---------|------|
| **Imię i nazwisko** | Lub "ANONIMIZOWANY UŻYTKOWNIK" jeśli dane zanonimizowane |
| **Email / Telefon** | Dane kontaktowe lub zahaszowane |
| **Data utworzenia** | Kiedy lead został założony |
| **Źródło** | Partner/Online/Infolinia (ikona + nazwa) |
| **Status zgód** | Wizualna reprezentacja (patrz niżej) |
| **Ostatnia aktywność** | Data ostatniej zmiany w leadzie |
| **Akcje** | Szczegóły, Anonimizuj, Eksport danych |

**Status zgód - wskaźniki wizualne:**
- 🟢 **Zielony** - wszystkie wymagane zgody aktualne i ważne
- 🟡 **Żółty** - brakuje opcjonalnych zgód
- 🔴 **Czerwony** - brakuje wymaganych zgód
- ⚫ **Szary** - dane zanonimizowane

**Funkcje:**
- Wyszukiwanie pełnotekstowe (imię, nazwisko, email, telefon)
- Filtry: źródło, status zgód, zakres dat
- Sortowanie: alfabetycznie, data utworzenia, ostatnia aktywność
- Bulk actions: eksport listy, powiadomienia

#### 3.2 Szczegóły klienta

**Sekcja: Dane podstawowe**
- Wszystkie dane osobowe klienta
- Źródło leada
- Daty: utworzenia, ostatniej aktywności, anonimizacji (jeśli dotyczy)
- Status procesowania leada

**Sekcja: Timeline zgód**

Chronologiczna lista wszystkich zgód (najnowsze na górze):

```
┌─────────────────────────────────────────────────────────────┐
│ 📅 2025-11-08 14:32:15                                      │
│ ✅ Zgoda na przesłanie danych do partnerów finansowych      │
│                                                               │
│ Źródło: Formularz online                                    │
│ IP: 192.168.1.100                                           │
│ Status: Aktywna                                             │
│                                                               │
│ [Podgląd treści zgody]                                      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 📅 2025-11-05 10:15:43                                      │
│ ✅ Zgoda marketingowa                                        │
│                                                               │
│ Źródło: Infolinia (Pracownik: Jan Kowalski)                │
│ Notatki: "Klient potwierdził zgodę ustnie podczas rozmowy" │
│ Status: Aktywna                                             │
│                                                               │
│ [Podgląd treści zgody]                                      │
└─────────────────────────────────────────────────────────────┘
```

**Funkcje timeline:**
- Każda zgoda to osobna karta z pełnymi metadanymi
- Link "Podgląd treści zgody" otwiera modal z oryginalną treścią z momentu wyrażenia
- Jeśli zgoda została wycofana - oznaczenie z datą wycofania
- Jeśli zgoda wygasła - oznaczenie "Nieaktualna" z wyjaśnieniem

**Sekcja: Akcje**
- Przycisk "Anonimizuj dane" (z potwierdzeniem)
- Przycisk "Eksportuj wszystkie dane klienta"
- Link do edycji leada (jeśli nie zanonimizowany)

### 4. Anonimizacja danych

#### 4.1 Ręczna anonimizacja

**Przebieg procesu:**

1. Admin klika "Anonimizuj dane" w szczegółach klienta
2. Modal z potwierdzeniem:
   ```
   ⚠️ UWAGA: Ta operacja jest nieodwracalna!
   
   Zanonimizowane zostaną następujące dane:
   • Imię i nazwisko
   • Email i telefon
   • Adres
   • PESEL i dokumenty
   
   Zachowane zostaną:
   • ID leada (dla spójności)
   • Historia zgód (z linkiem do zanonimizowanego użytkownika)
   • Dane statystyczne (daty, statusy, źródło)
   
   Czy na pewno chcesz kontynuować?
   
   [Anuluj]  [Potwierdź anonimizację]
   ```
3. Po potwierdzeniu - natychmiastowa anonimizacja
4. Toast notification: "✅ Dane zostały pomyślnie zanonimizowane"
5. Zapis w audit logu
6. Automatyczne odświeżenie widoku

**Zasady anonimizacji:**

| Pole | Przed | Po |
|------|-------|-----|
| Imię | "Jan" | "ANONIMIZOWANY" |
| Nazwisko | "Kowalski" | "UŻYTKOWNIK_123456" |
| Email | "jan.kowalski@example.com" | "anon_8a7f9b@anonymized.local" |
| Telefon | "+48 123 456 789" | "000000000" |
| Adres | "ul. Kwiatowa 5, Warszawa" | null |
| PESEL | "12345678901" | hash("12345678901") |
| Nr dokumentu | "ABC123456" | hash("ABC123456") |

#### 4.2 Zachowanie danych statystycznych

**Po anonimizacji pozostają:**
- ✅ ID leada (UUID nie zmienia się)
- ✅ Data utworzenia leada
- ✅ Źródło leada (partner/online/infolinia)
- ✅ Status procesowania (np. "zakończony", "odrzucony")
- ✅ Historia zgód (Consent Records) - z linkiem do zanonimizowanego leada
- ✅ Statystyki (liczba kontaktów, etapy procesowania)
- ✅ Audit log dotyczący tego leada

**Usuwane są:**
- ❌ Wszelkie dane osobowe (PII)
- ❌ Treść notatek zawierających dane osobowe
- ❌ Historia komunikacji (emaile, SMS) zawierająca PII

#### 4.3 Automatyczna anonimizacja

**Konfiguracja (w admin panel):**
- Okres retencji danych: [36] miesięcy (domyślnie)
- Warunek: Brak aktywności przez X miesięcy
- Dodatkowe warunki:
  - ☑️ Anonimizuj po wycofaniu wszystkich zgód + 30 dni
  - ☑️ Anonimizuj na żądanie klienta (natychmiast)

**Mechanizm działania:**
1. Cron job uruchamia się codziennie o 2:00
2. Wyszukuje leady spełniające kryteria:
   - Utworzone > 36 miesięcy temu
   - Brak aktywności przez ostatnie 12 miesięcy
   - Nie są już przetwarzane
3. Za 30 dni przed anonimizacją:
   - Email notification do admina z listą leadów
4. W dniu anonimizacji:
   - Batch processing (max 100 leadów na raz)
   - Zapis w audit logu dla każdego leada
   - Email z podsumowaniem do admina

**Safety measures:**
- Dry-run mode (testowanie bez faktycznej anonimizacji)
- Whitelist leadów (możliwość wykluczenia z auto-anonimizacji)
- Manual review przed anonimizacją VIP klientów

### 5. Procesy pozyskiwania zgód

#### 5.1 Lead od partnera

**Formularz partnera:**

```html
<form>
  <!-- Dane klienta -->
  <input name="client_name" required />
  <input name="client_email" required />
  <input name="client_phone" required />
  
  <!-- Dane pojazdu -->
  <input name="vehicle_type" />
  <input name="financing_amount" />
  
  <!-- SEKCJA ZGÓD -->
  <div class="consent-section">
    <h3>Oświadczenie partnera</h3>
    <label>
      <input type="checkbox" name="partner_declaration" required />
      Oświadczam, że posiadam zgodę klienta na przekazanie jego danych 
      do [Nazwa firmy] w celu prezentacji oferty finansowania pojazdów.
    </label>
    <p class="legal-note">
      Wyrażenie zgody jest dobrowolne, ale niezbędne do procesowania zapytania.
      [Link do pełnej treści oświadczenia]
    </p>
  </div>
  
  <button type="submit">Wyślij zapytanie</button>
</form>
```

**Backend processing:**
1. Walidacja formularza
2. Utworzenie leada z statusem: `consent_status = "partner_declaration_only"`
3. Zapis Consent Record:
   ```javascript
   {
     consent_type: "PARTNER_DECLARATION",
     consent_given: true,
     consent_method: "partner_submission",
     partner_id: <partner_id>,
     ip_address: <partner_ip>,
     recorded_at: <timestamp>
   }
   ```
4. Email do zespołu: "Nowy lead od partnera - wymaga potwierdzenia zgód klienta"

#### 5.2 Lead online (klient wypełnia sam)

**Formularz online (multi-step):**

**Krok 1: Dane podstawowe**
```html
<div class="step-1">
  <h2>Twoje dane</h2>
  <input name="name" required />
  <input name="email" required />
  <input name="phone" required />
  <button>Dalej</button>
</div>
```

**Krok 2: Informacje o finansowaniu**
```html
<div class="step-2">
  <h2>Szczegóły finansowania</h2>
  <select name="vehicle_type">...</select>
  <input name="amount" type="number" />
  <input name="down_payment" type="number" />
  <button>Dalej</button>
</div>
```

**Krok 3: Zgody (kluczowy)**
```html
<div class="step-3 consent-step">
  <h2>Zgody i potwierdzenia</h2>
  
  <!-- Zgoda wymagana -->
  <div class="consent-item required">
    <label>
      <input type="checkbox" name="consent_marketing" required />
      <strong>Wyrażam zgodę na kontakt w celu prezentacji oferty *</strong>
    </label>
    <a href="#" class="show-full-text">Pokaż pełną treść zgody</a>
  </div>
  
  <!-- Zgody opcjonalne -->
  <div class="consent-item">
    <label>
      <input type="checkbox" name="consent_financial" />
      Wyrażam zgodę na przesłanie moich danych do partnerów finansowych
    </label>
    <p class="consent-description">
      Pozwoli nam to sprawdzić dla Ciebie oferty leasingu i kredytu w wielu instytucjach.
    </p>
    <a href="#" class="show-full-text">Pokaż pełną treść zgody</a>
  </div>
  
  <div class="consent-item">
    <label>
      <input type="checkbox" name="consent_vehicle" />
      Wyrażam zgodę na przesłanie moich danych do dealerów pojazdów
    </label>
    <p class="consent-description">
      Dzięki temu dealerzy będą mogli przygotować dla Ciebie spersonalizowane oferty.
    </p>
    <a href="#" class="show-full-text">Pokaż pełną treść zgody</a>
  </div>
  
  <p class="required-note">* Pola wymagane</p>
  
  <button type="submit" :disabled="!consentMarketingChecked">
    Wyślij zapytanie
  </button>
</div>
```

**UX considerations:**
- Link "Pokaż pełną treść" otwiera modal z pełną treścią zgody
- Modal ma scroll (jeśli długa treść) i przycisk "Rozumiem" na dole
- Przycisk submit aktywny tylko gdy wymagane zgody zaznaczone
- Visual feedback: checkboxy required mają czerwoną gwiazdkę

**Backend processing:**
1. Walidacja: czy wymagane zgody są zaznaczone
2. Utworzenie leada z statusem: `consent_status = "complete"` (jeśli wszystkie) lub `"incomplete"`
3. Zapis Consent Records dla każdej zaznaczonej zgody:
   ```javascript
   {
     consent_type: "MARKETING" / "FINANCIAL_PARTNERS" / "VEHICLE_PARTNERS",
     consent_given: true,
     consent_method: "online_form",
     ip_address: <client_ip>,
     user_agent: <browser_user_agent>,
     recorded_at: <timestamp>
   }
   ```
4. Email do klienta: "Dziękujemy za zapytanie" + następne kroki
5. Email do zespołu: "Nowy lead online - gotowy do kontaktu"

#### 5.3 Lead z infolinii

**Interfejs dla pracownika (CRM panel):**

```html
<form class="create-lead-form">
  <h2>Nowy lead z infolinii</h2>
  
  <!-- Dane klienta -->
  <section class="client-data">
    <h3>Dane klienta</h3>
    <input name="name" placeholder="Imię i nazwisko" required />
    <input name="email" placeholder="Email" required />
    <input name="phone" placeholder="Telefon" required />
  </section>
  
  <!-- Informacje o finansowaniu -->
  <section class="financing-data">
    <h3>Szczegóły zapytania</h3>
    <select name="vehicle_type">...</select>
    <input name="amount" type="number" />
  </section>
  
  <!-- SEKCJA ZGÓD -->
  <section class="consent-section">
    <h3>⚠️ Potwierdzenie zgód ustnych</h3>
    <p class="instruction">
      Zaznacz poniższe zgody TYLKO jeśli klient wyraźnie je potwierdził podczas rozmowy.
    </p>
    
    <div class="consent-item">
      <label>
        <input type="checkbox" name="consent_marketing" required />
        <strong>Klient wyraził zgodę na kontakt i prezentację oferty *</strong>
      </label>
      <p class="legal-warning">
        Wymagane - bez tej zgody nie możemy kontaktować się z klientem.
      </p>
    </div>
    
    <div class="consent-item">
      <label>
        <input type="checkbox" name="consent_financial" />
        Klient wyraził zgodę na przesłanie danych do partnerów finansowych
      </label>
    </div>
    
    <div class="consent-item">
      <label>
        <input type="checkbox" name="consent_vehicle" />
        Klient wyraził zgodę na przesłanie danych do dealerów pojazdów
      </label>
    </div>
    
    <textarea 
      name="call_notes" 
      placeholder="Notatki z rozmowy (opcjonalne)"
      rows="4"
    ></textarea>
    
    <p class="gdpr-reminder">
      🔒 Przypomnienie: Zgodnie z RODO, możesz potwierdzić tylko te zgody, 
      które klient faktycznie wyraził podczas rozmowy.
    </p>
  </section>
  
  <button type="submit">Utwórz lead</button>
</form>
```

**Walidacja:**
- Consent marketing musi być zaznaczony (required)
- System loguje user_id pracownika
- System zapisuje timestamp rozmowy

**Backend processing:**
1. Utworzenie leada
2. Zapis Consent Records dla zaznaczonych zgód:
   ```javascript
   {
     consent_type: "MARKETING" / "FINANCIAL_PARTNERS" / "VEHICLE_PARTNERS",
     consent_given: true,
     consent_method: "phone_call",
     recorded_by_user_id: <employee_id>,
     notes: <call_notes>,
     recorded_at: <timestamp>
   }
   ```
3. Email do zespołu sales: "Nowy lead z infolinii"

#### 5.4 Formularz finansowy (follow-up)

**Scenariusz:**
Po pierwszym kontakcie z klientem, wysyłamy mu link do formularza z dokładnymi danymi do wniosku finansowego.

**Email do klienta:**
```
Temat: Dokończ swój wniosek o finansowanie

Cześć [Imię],

Dziękujemy za zainteresowanie naszą ofertą! Aby przygotować dla Ciebie 
najlepsze warunki finansowania, prosimy o wypełnienie szczegółowego formularza.

[WYPEŁNIJ FORMULARZ]

Link ważny przez 7 dni.

Pozdrawiamy,
Zespół [Firma]
```

**Formularz (token-based access):**

```html
<form class="financial-application-form">
  <h1>Wniosek o finansowanie</h1>
  
  <!-- Wstępnie wypełnione dane z leada -->
  <section class="prefilled-data">
    <h2>Twoje dane</h2>
    <input name="name" value="[Prefilled]" readonly />
    <input name="email" value="[Prefilled]" readonly />
    <!-- ... pozostałe dane podstawowe ... -->
  </section>
  
  <!-- Szczegółowe dane do uzupełnienia -->
  <section class="additional-data">
    <h2>Dodatkowe informacje</h2>
    <input name="employment_type" required />
    <input name="monthly_income" type="number" required />
    <input name="residence_type" required />
    <!-- ... więcej pól ... -->
  </section>
  
  <!-- Upload dokumentów -->
  <section class="documents">
    <h2>Dokumenty</h2>
    <div class="file-upload">
      <label>Dowód osobisty (skan lub zdjęcie)</label>
      <input type="file" accept="image/*,application/pdf" required />
    </div>
    <div class="file-upload">
      <label>Zaświadczenie o dochodach (opcjonalne)</label>
      <input type="file" accept="image/*,application/pdf" />
    </div>
  </section>
  
  <!-- KLUCZOWA SEKCJA - Wymagane zgody przed wysyłką -->
  <section class="final-consents">
    <h2>⚠️ Wymagane zgody przed wysłaniem wniosku</h2>
    
    <div class="consent-box required">
      <label>
        <input type="checkbox" name="consent_financial" required />
        <strong>
          Wyrażam zgodę na przesłanie moich danych osobowych oraz dokumentów 
          do partnerów finansowych w celu oceny zdolności kredytowej *
        </strong>
      </label>
      <a href="#" class="show-full-consent">Pokaż pełną treść zgody</a>
      <p class="consent-info">
        Twoje dane zostaną przesłane do: [Lista banków/leasingów]
      </p>
    </div>
    
    <div class="consent-box required">
      <label>
        <input type="checkbox" name="consent_vehicle" required />
        <strong>
          Wyrażam zgodę na przesłanie moich danych do dealerów pojazdów 
          w celu przygotowania oferty *
        </strong>
      </label>
      <a href="#" class="show-full-consent">Pokaż pełną treść zgody</a>
      <p class="consent-info">
        Twoje dane zostaną przesłane do: [Lista dealerów]
      </p>
    </div>
    
    <p class="required-note">
      * Wyrażenie tych zgód jest wymagane do procesowania wniosku.
      Bez nich nie będziemy mogli uzyskać dla Ciebie ofert finansowania.
    </p>
  </section>
  
  <button 
    type="submit" 
    :disabled="!consentFinancialChecked || !consentVehicleChecked"
    class="submit-button"
  >
    Wyślij wniosek
  </button>
  
  <p class="privacy-note">
    🔒 Twoje dane są bezpieczne. Przekazujemy je tylko sprawdzonym partnerom 
    i wyłącznie w celu realizacji Twojego wniosku.
  </p>
</form>
```

**UX highlights:**
- Przycisk submit disabled dopóki obie zgody nie zostaną zaznaczone
- Visual feedback: checkboxy pulsują delikatnie jeśli użytkownik próbuje wysłać bez zaznaczenia
- Po najechaniu na "Pokaż pełną treść" - tooltip z preview, kliknięcie otwiera modal
- Progress bar na górze: "Krok 3 z 3 - Prawie gotowe!"

**Backend processing:**
1. Walidacja tokena (czy link nie wygasł, czy dla właściwego leada)
2. Upload dokumentów do secure storage
3. Update leada z dodatkowymi danymi
4. **Kluczowe:** Zapis/update Consent Records:
   ```javascript
   // Jeśli zgody wcześniej nie było - nowy rekord
   // Jeśli była (np. z pierwszego formularza) - update z flagą "reconfirmed"
   {
     consent_type: "FINANCIAL_PARTNERS" / "VEHICLE_PARTNERS",
     consent_given: true,
     consent_method: "online_form",
     ip_address: <client_ip>,
     user_agent: <browser_user_agent>,
     recorded_at: <timestamp>,
     notes: "Reconfirmed in financial application form"
   }
   ```
5. Update statusu leada: `consent_status = "complete"`, `application_status = "ready_to_process"`
6. Email do klienta: "✅ Twój wniosek został przyjęty - przystępujemy do przetwarzania"
7. Email do zespołu: "Lead #123 - kompletny wniosek do procesowania"
8. Automatyczne uruchomienie procesu: przesłanie do partnerów finansowych i dealerów

### 6. Dashboard Compliance (Phase 2)

**Widok dla adminów z kluczowymi metrykami:**

#### 6.1 Główne statystyki

```
┌─────────────────────────────────────────────────────────────┐
│  OGÓLNY STATUS ZGODNOŚCI                                    │
├─────────────────────────────────────────────────────────────┤
│  ✅ Leady z kompletnymi zgodami:        1,234 (87%)         │
│  ⚠️  Leady z brakującymi zgodami:         156 (11%)         │
│  ⛔ Leady wymagające natychmiastowej akcji:  28 (2%)        │
│                                                               │
│  📊 W tym miesiącu: +15% kompletu zgód vs. poprzedni        │
└─────────────────────────────────────────────────────────────┘
```

#### 6.2 Breakdown według źródeł zgód

```
Źródło zgód          | Łącznie | Kompletne | Brakujące |
---------------------|---------|-----------|-----------|
Formularz online     |   756   |   702     |    54     |
Partner              |   412   |   358     |    54     |
Infolinia           |   250   |   174     |    76     |
```

#### 6.3 Breakdown według typu zgody

```
┌─────────────────────────────────────────┐
│  Zgody marketingowe:        98% (1,372) │
│  Zgody finansowe:           76% (1,064) │
│  Zgody dealerzy:            68% (952)   │
│  Oświadczenia partnerów:   100% (412)   │
└─────────────────────────────────────────┘
```

#### 6.4 Alerty i powiadomienia

**Panel alertów:**
- 🔴 **28 leadów bez wymaganej zgody >7 dni** - wymaga akcji
- 🟡 **156 leadów z niepełnymi zgodami** - potencjalne follow-up
- ⏰ **43 leady do anonimizacji w ciągu 30 dni** - sprawdź przed usunięciem
- ⚠️ **12 oświadczeń partnerów >12 miesięcy** - odśwież weryfikację

**Akcje:**
- Każdy alert ma przycisk "Zobacz szczegóły"
- Możliwość bulk export listy leadów do follow-up
- Możliwość wysyłki reminderów email do klientów

#### 6.5 Wykresy i trendy

**Wykres 1: Timeline wyrażonych zgód (ostatnie 6 miesięcy)**
- Linia przedstawiająca liczbę zgód dziennie
- Podział na typy zgód (kolorowe linie)
- Możliwość zoom-in na konkretny okres

**Wykres 2: Funnel konwersji zgód**
```
Lead utworzony         →  1,418 (100%)
Zgoda marketingowa     →  1,372 (97%)
Zgoda finansowa        →  1,064 (75%)
Zgoda dealerzy         →    952 (67%)
Kompletny proces       →    856 (60%)
```

**Wykres 3: Czas do wyrażenia wszystkich zgód**
- Histogram pokazujący średni czas od utworzenia leada do kompletu zgód
- Breakdown według źródła (online szybciej niż infolinia)

#### 6.6 Raporty do eksportu

**Dostępne raporty:**
1. **Raport compliance miesięczny** (PDF/Excel)
   - Podsumowanie zgód w danym miesiącu
   - Statystyki źródeł
   - Lista leadów wymagających akcji
   
2. **Raport audytowy** (PDF)
   - Kompletny audit log dla wybranego okresu
   - Wszystkie operacje RODO
   - Anonimizacje
   
3. **Raport retencji danych** (Excel)
   - Lista wszystkich leadów z datą utworzenia
   - Przewidywana data anonimizacji
   - Status procesowania

### 7. Audit Log

#### 7.1 Zakres logowania

**Wszystkie operacje na danych wrażliwych są automatycznie logowane:**

| Akcja | Opis | Priorytet |
|-------|------|-----------|
| `consent_template_created` | Utworzenie nowego szablonu zgody | Medium |
| `consent_template_updated` | Edycja szablonu (nowa wersja) | Medium |
| `consent_template_deleted` | Usunięcie/wyłączenie szablonu | High |
| `consent_given` | Klient wyraził zgodę | High |
| `consent_withdrawn` | Klient wycofał zgodę | High |
| `lead_anonymized` | Dane leada zanonimizowane | Critical |
| `data_exported` | Eksport danych klienta | High |
| `client_details_viewed` | Admin wszedł w szczegóły klienta | Low |
| `bulk_export` | Eksport listy leadów | Medium |
| `auto_anonymization_executed` | Automatyczna anonimizacja | Critical |

#### 7.2 Struktura logu

```javascript
{
  id: UUID,
  timestamp: datetime,
  user_id: UUID | null, // null dla akcji systemowych (cron)
  user_email: string,
  action: string, // enum z tabeli powyżej
  entity_type: "lead" | "consent" | "consent_template" | "system",
  entity_id: UUID | null,
  ip_address: string,
  user_agent: string,
  details: {
    // JSON z dodatkowymi informacjami zależnie od akcji
    // Np. dla consent_given:
    consent_type: "MARKETING",
    consent_method: "online_form",
    lead_id: UUID,
    // Dla anonymization:
    reason: "auto" | "manual" | "user_request",
    leads_count: 1
  },
  before_value: JSON | null, // Stan przed zmianą (dla edycji)
  after_value: JSON | null   // Stan po zmianie (dla edycji)
}
```

#### 7.3 Interfejs przeglądania audit logu

**Widok główny:**
- Tabela z wszystkimi akcjami (najnowsze na górze)
- Kolumny: Timestamp, Użytkownik, Akcja, Encja, Szczegóły
- Kolor tła zależny od priorytetu (Critical - czerwony, High - pomarańczowy)

**Filtry:**
- Zakres dat (date picker)
- Typ akcji (multi-select dropdown)
- Użytkownik (autocomplete)
- Typ encji
- Priorytet (Critical, High, Medium, Low)

**Wyszukiwanie:**
- Full-text search w details (JSON)
- Wyszukiwanie po entity_id (np. lead ID)

**Szczegóły akcji:**
- Kliknięcie w wiersz rozwija panel ze szczegółami
- Wyświetla pełny before/after diff dla edycji
- Link do encji (jeśli istnieje, np. link do leada)

**Eksport:**
- Filtrowany audit log do CSV/JSON
- Możliwość eksportu całego logu dla okresu (audit zewnętrzny)

### 8. Eksport danych klienta (Prawo dostępu RODO)

#### 8.1 Funkcjonalność

**Przycisk "Eksportuj wszystkie dane klienta"** w szczegółach leada.

**Modal potwierdzenia:**
```
📦 Eksport danych klienta

Czy chcesz wyeksportować wszystkie dane tego klienta?

Format eksportu:
○ JSON (do wglądu technicznego)
● PDF (czytelny dla klienta)

Eksport będzie zawierał:
✓ Wszystkie dane osobowe
✓ Historię zgód z pełnymi treściami
✓ Historię komunikacji
✓ Dokumenty i załączniki
✓ Audit log dotyczący tego klienta

⚠️ Ta operacja zostanie zapisana w audit logu.

[Anuluj]  [Eksportuj]
```

#### 8.2 Zawartość eksportu (PDF)

**Struktura dokumentu PDF:**

```
═══════════════════════════════════════════════
  EKSPORT DANYCH OSOBOWYCH
  Zgodnie z Art. 15 RODO (Prawo dostępu)
═══════════════════════════════════════════════

Data eksportu: 2025-11-08 15:30:45
ID leada: 123e4567-e89b-12d3-a456-426614174000
Wyeksportowane przez: admin@firma.pl

───────────────────────────────────────────────
1. DANE OSOBOWE
───────────────────────────────────────────────
Imię i nazwisko:    Jan Kowalski
Email:              jan.kowalski@example.com
Telefon:            +48 123 456 789
Adres:              ul. Kwiatowa 5, 00-001 Warszawa
Data urodzenia:     1985-03-15
PESEL:              [zaszyfrowane]

───────────────────────────────────────────────
2. INFORMACJE O LEADZIE
───────────────────────────────────────────────
Data utworzenia:    2025-11-05 10:15:00
Źródło:             Formularz online
Status:             W trakcie procesowania
Rodzaj pojazdu:     Osobowy
Kwota finansowania: 150,000 PLN

───────────────────────────────────────────────
3. HISTORIA ZGÓD
───────────────────────────────────────────────

3.1. Zgoda marketingowa
    Data wyrażenia:     2025-11-05 10:16:23
    Sposób wyrażenia:   Formularz online
    IP address:         192.168.1.100
    Status:             Aktywna
    
    Treść zgody:
    "Wyrażam zgodę na kontakt telefoniczny, email oraz SMS
    w celu prezentacji oferty finansowania pojazdów..."
    [pełna treść]

3.2. Zgoda na przesłanie danych do partnerów finansowych
    Data wyrażenia:     2025-11-08 14:30:15
    Sposób wyrażenia:   Formularz finansowy
    IP address:         192.168.1.100
    Status:             Aktywna
    
    Treść zgody:
    "Wyrażam zgodę na przesłanie moich danych..."
    [pełna treść]

───────────────────────────────────────────────
4. HISTORIA KOMUNIKACJI
───────────────────────────────────────────────

4.1. Email - 2025-11-05 10:20:00
    Od:      system@firma.pl
    Do:      jan.kowalski@example.com
    Temat:   Dziękujemy za zapytanie
    [treść emaila]

4.2. Telefon - 2025-11-06 14:00:00
    Przez:   Anna Nowak (konsultant)
    Czas:    15 minut
    Notatki: "Omówienie oferty, klient zainteresowany..."

───────────────────────────────────────────────
5. PRZEKAZANIE DANYCH DO PODMIOTÓW TRZECICH
───────────────────────────────────────────────

5.1. Bank XYZ
    Data przekazania:   2025-11-08 15:00:00
    Cel:                Ocena zdolności kredytowej
    Zakres danych:      Imię, nazwisko, dochody, zatrudnienie

5.2. Dealer ABC
    Data przekazania:   2025-11-08 15:00:00
    Cel:                Przygotowanie oferty pojazdu
    Zakres danych:      Imię, nazwisko, telefon, email

───────────────────────────────────────────────
6. AUDIT LOG (operacje na Twoich danych)
───────────────────────────────────────────────

2025-11-05 10:16:23 | Lead utworzony (formularz online)
2025-11-05 10:16:23 | Zgoda marketingowa wyrażona
2025-11-06 14:00:00 | Dane wyświetlone przez: Anna Nowak
2025-11-08 14:30:15 | Zgoda finansowa wyrażona
2025-11-08 15:00:00 | Dane przekazane do: Bank XYZ
2025-11-08 15:00:00 | Dane przekazane do: Dealer ABC
2025-11-08 15:30:45 | Dane wyeksportowane przez: admin@firma.pl

───────────────────────────────────────────────
7. TWOJE PRAWA
───────────────────────────────────────────────

Zgodnie z RODO masz prawo do:
✓ Dostępu do swoich danych (ten dokument)
✓ Sprostowania danych (jeśli są nieprawidłowe)
✓ Usunięcia danych ("prawo do bycia zapomnianym")
✓ Ograniczenia przetwarzania
✓ Przenoszenia danych
✓ Wniesienia sprzeciwu wobec przetwarzania
✓ Wycofania zgód w dowolnym momencie

Aby skorzystać z tych praw, skontaktuj się:
Email: rodo@firma.pl
Telefon: +48 22 123 4567

───────────────────────────────────────────────

Dokument wygenerowany automatycznie przez system.
Administrator danych: [Nazwa firmy], [Adres]
Inspektor Ochrony Danych: iod@firma.pl

═══════════════════════════════════════════════
```

#### 8.3 Backend processing

**Po kliknięciu "Eksportuj":**

1. Walidacja uprawnień użytkownika
2. Zebranie wszystkich danych z różnych tabel:
   - `leads` - dane podstawowe
   - `consent_records` - historia zgód
   - `consent_templates` - treści zgód (wersje z momentu wyrażenia)
   - `communications` - emaile, SMSy, telefony
   - `data_sharing_logs` - przekazania do podmiotów trzecich
   - `audit_logs` - operacje na tym leadzie
3. Generowanie PDF:
   - Użycie biblioteki do PDF (np. wkhtmltopdf, Puppeteer)
   - Template z branding firmy
   - Watermark: "CONFIDENTIAL - Personal Data"
4. Zapis w audit logu:
   ```javascript
   {
     action: "data_exported",
     entity_type: "lead",
     entity_id: <lead_id>,
     details: {
       format: "PDF",
       sections_included: ["personal_data", "consents", "communications", "audit_log"]
     }
   }
   ```
5. Download dla użytkownika: `lead_<lead_id>_export_<timestamp>.pdf`
6. Opcjonalnie: Zapis kopii eksportu w secure storage (retencja 30 dni)

#### 8.4 Eksport JSON (alternatywa techniczna)

Dla użytkowników technicznych, JSON export zwraca:

```json
{
  "export_metadata": {
    "export_date": "2025-11-08T15:30:45Z",
    "lead_id": "123e4567-e89b-12d3-a456-426614174000",
    "exported_by": "admin@firma.pl",
    "format": "JSON",
    "version": "1.0"
  },
  "personal_data": {
    "name": "Jan Kowalski",
    "email": "jan.kowalski@example.com",
    ...
  },
  "lead_info": {
    "created_at": "2025-11-05T10:15:00Z",
    ...
  },
  "consents": [
    {
      "consent_type": "MARKETING",
      "consent_given": true,
      "recorded_at": "2025-11-05T10:16:23Z",
      "full_consent_text": "...",
      ...
    }
  ],
  "communications": [...],
  "data_sharing": [...],
  "audit_log": [...]
}
```

---

## 📊 Struktura bazy danych

### Schemat ERD (uproszczony)

```
┌─────────────────┐
│     USERS       │
├─────────────────┤
│ id (PK)         │
│ email           │
│ role            │
└─────────────────┘
         │
         │ created_by
         ▼
┌──────────────────────┐         ┌────────────────────┐
│ CONSENT_TEMPLATES    │         │      PARTNERS      │
├──────────────────────┤         ├────────────────────┤
│ id (PK)              │         │ id (PK)            │
│ consent_type         │         │ name               │
│ title                │         │ email              │
│ content              │         │ api_key            │
│ version              │         └────────────────────┘
│ valid_from           │                  │
│ valid_to             │                  │
│ is_active            │                  │ partner_id
│ is_required          │                  ▼
│ created_by (FK)      │         ┌────────────────────┐
│ created_at           │         │       LEADS        │
│ updated_at           │         ├────────────────────┤
└──────────────────────┘         │ id (PK)            │
         │                       │ name               │
         │                       │ email              │
         │ consent_template_id   │ phone              │
         │                       │ address            │
         ▼                       │ pesel_hash         │
┌──────────────────────┐         │ source_type        │
│ CONSENT_RECORDS      │◄────────│ partner_id (FK)    │
├──────────────────────┤         │ consent_status     │
│ id (PK)              │         │ application_status │
│ lead_id (FK)         │         │ anonymized_at      │
│ consent_template_id  │         │ anonymized_by (FK) │
│ consent_type         │         │ created_at         │
│ consent_given        │         │ updated_at         │
│ consent_method       │         └────────────────────┘
│ ip_address           │                  │
│ user_agent           │                  │
│ recorded_by_user_id  │                  │
│ partner_id (FK)      │                  │
│ recorded_at          │                  │
│ withdrawn_at         │                  │
│ notes                │                  │
└──────────────────────┘                  │
                                          │
                                          ▼
                               ┌────────────────────┐
                               │    AUDIT_LOGS      │
                               ├────────────────────┤
                               │ id (PK)            │
                               │ user_id (FK)       │
                               │ action             │
                               │ entity_type        │
                               │ entity_id          │
                               │ ip_address         │
                               │ user_agent         │
                               │ details (JSON)     │
                               │ before_value (JSON)│
                               │ after_value (JSON) │
                               │ created_at         │
                               └────────────────────┘
```

### Indeksy (dla performance)

```sql
-- CONSENT_TEMPLATES
CREATE INDEX idx_consent_templates_type ON consent_templates(consent_type);
CREATE INDEX idx_consent_templates_active ON consent_templates(is_active);
CREATE INDEX idx_consent_templates_valid_dates ON consent_templates(valid_from, valid_to);

-- CONSENT_RECORDS
CREATE INDEX idx_consent_records_lead ON consent_records(lead_id);
CREATE INDEX idx_consent_records_type ON consent_records(consent_type);
CREATE INDEX idx_consent_records_recorded_at ON consent_records(recorded_at);
CREATE INDEX idx_consent_records_method ON consent_records(consent_method);
CREATE INDEX idx_consent_records_withdrawn ON consent_records(withdrawn_at);

-- LEADS
CREATE INDEX idx_leads_consent_status ON leads(consent_status);
CREATE INDEX idx_leads_source_type ON leads(source_type);
CREATE INDEX idx_leads_anonymized ON leads(anonymized_at);
CREATE INDEX idx_leads_created_at ON leads(created_at);
CREATE INDEX idx_leads_email ON leads(email); -- dla wyszukiwania

-- AUDIT_LOGS
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
```

### Partycjonowanie (opcjonalne, dla skalowalności)

```sql
-- Partycjonowanie CONSENT_RECORDS po roku (dla długoterminowego storage)
CREATE TABLE consent_records_2025 PARTITION OF consent_records
    FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');

CREATE TABLE consent_records_2026 PARTITION OF consent_records
    FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');

-- Podobnie dla AUDIT_LOGS
CREATE TABLE audit_logs_2025 PARTITION OF audit_logs
    FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
```

---

## 🎨 Wymagania niefunkcjonalne

### 1. Bezpieczeństwo

#### 1.1 Szyfrowanie danych (at rest)
- **Dane osobowe w bazie:** Szyfrowanie na poziomie kolumn dla PII
  - Imię, nazwisko, email, telefon, adres
  - PESEL: haszowanie SHA-256 + salt
  - Dokumenty: szyfrowanie AES-256
- **Backupy:** Szyfrowane backupy bazy danych
- **Klucze szyfrowania:** Przechowywane w AWS KMS / Azure Key Vault / HashiCorp Vault

#### 1.2 Szyfrowanie w tranzycie (in transit)
- **HTTPS wyłącznie:** TLS 1.3, certyfikaty SSL A+ rating
- **API:** Wszystkie endpointy wymuszają HTTPS
- **Internal communication:** Szyfrowane połączenia między serwisami

#### 1.3 Kontrola dostępu (RBAC)

**Role w systemie:**

| Rola | Uprawnienia |
|------|-------------|
| **Super Admin** | Pełny dostęp, zarządzanie użytkownikami, audit log, anonimizacja |
| **Admin** | Zarządzanie zgodami, widok leadów, eksport danych, ręczna anonimizacja |
| **Compliance Officer** | Tylko odczyt: dashboard, audit log, raporty |
| **Sales Manager** | Widok leadów, eksport listy, bez dostępu do zarządzania zgodami |
| **Sales Rep** | Widok przypisanych leadów, dodawanie notatek |
| **Infolinia** | Tworzenie leadów, potwierdzanie zgód, bez dostępu do zarządzania |

**Implementacja:**
- Middleware sprawdzający rolę przed każdą operacją
- Frontend: warunkowe renderowanie UI na podstawie roli
- Backend: walidacja uprawnień w każdym endpoincie

#### 1.4 Zabezpieczenia dodatkowe
- **Rate limiting:** Max 100 requests/min na IP dla API formularzy
- **CAPTCHA:** reCAPTCHA v3 dla formularzy publicznych (online)
- **IP whitelisting:** Opcjonalne ograniczenie dostępu admin panelu do biurowych IP
- **2FA:** Dwuskładnikowe uwierzytelnianie dla adminów (TOTP)
- **Session management:** Automatyczne wylogowanie po 30 min nieaktywności
- **Password policy:** Min. 12 znaków, wielkie/małe litery, cyfry, znaki specjalne

### 2. Performance

#### 2.1 Wymagania czasowe

| Operacja | Max czas odpowiedzi | Target |
|----------|---------------------|--------|
| Lista klientów (10k rekordów) | 2s | 1s |
| Szczegóły klienta | 1s | 500ms |
| Zapis zgody | 500ms | 200ms |
| Generowanie PDF eksportu | 10s | 5s |
| Dashboard compliance | 3s | 1.5s |
| Wyszukiwanie full-text | 1s | 500ms |

#### 2.2 Optymalizacje
- **Caching:** Redis cache dla tekstów zgód (TTL: 24h)
- **Database indexing:** Wszystkie klucze obce i kolumny używane w WHERE/JOIN
- **Pagination:** Wszystkie listy z paginacją (max 50-100 na stronę)
- **Lazy loading:** Szczegóły timeline zgód ładowane on-demand
- **CDN:** Statyczne assety (CSS, JS, obrazy) serwowane przez CDN
- **Database connection pooling:** Reużycie połączeń do bazy

#### 2.3 Monitoring
- **APM:** Application Performance Monitoring (New Relic / Datadog)
- **Query analysis:** Slow query log dla zapytań >1s
- **Alerting:** Powiadomienia gdy P95 response time >2s

### 3. Skalowalność

#### 3.1 Założenia wzrostu
- **Rok 1:** 50,000 leadów, 200,000 consent records
- **Rok 3:** 150,000 leadów, 600,000 consent records
- **Rok 5:** 300,000 leadów, 1,200,000 consent records

#### 3.2 Architektura skalowalna
- **Horizontal scaling:** Load balancer + multiple app servers
- **Database:** Master-slave replication dla odczytów
- **Partycjonowanie:** Tabele consent_records i audit_logs partycjonowane po roku
- **Archiwizacja:** Stare consent records (>5 lat) do cold storage

#### 3.3 Retencja danych
- **Active data:** Leady + zgody z ostatnich 3 lat w hot database
- **Archived data:** Starsze dane w read-only archival database
- **Audit logs:** Retencja 7 lat (wymóg prawny)

### 4. UX/UI

#### 4.1 Design System
- **Framework:** React + Tailwind CSS lub Material-UI
- **Responsywność:** Desktop-first (admin panel), mobile-friendly (formularze)
- **Breakpoints:** 
  - Mobile: 320px-768px
  - Tablet: 769px-1024px
  - Desktop: 1025px+

#### 4.2 Komponenty UI

**Status indicators:**
- 🟢 Zielony badge: "Wszystkie zgody"
- 🟡 Żółty badge: "Brakuje opcjonalnych"
- 🔴 Czerwony badge: "Brakuje wymaganych"
- ⚫ Szary badge: "Zanonimizowano"

**Loading states:**
- Skeleton loaders dla tabel (lepsze UX niż spinner)
- Progress bar dla długich operacji (eksport PDF, anonimizacja)
- Disabled state dla przycisków podczas przetwarzania

**Notifications (Toast):**
- ✅ Success: zielony, auto-dismiss po 3s
- ⚠️ Warning: pomarańczowy, auto-dismiss po 5s
- ❌ Error: czerwony, manual dismiss
- ℹ️ Info: niebieski, auto-dismiss po 4s

**Confirmations:**
- Modal dla destructive actions (anonimizacja, usunięcie)
- Wymóg wpisania potwierdzenia dla krytycznych akcji
  ```
  Wpisz "ANONIMIZUJ" aby potwierdzić: [____]
  ```

#### 4.3 Navigation
- **Breadcrumbs:** Zawsze widoczne (np. Dashboard > Klienci > Jan Kowalski > Zgody)
- **Sidebar menu:**
  ```
  📊 Dashboard
  👥 Klienci
  📄 Zgody (zarządzanie tekstami)
  📦 Archiwum zgód
  🔍 Audit Log
  ⚙️ Ustawienia
  ```
- **Search bar:** Globalny search w headerze (klienci, leady, consent records)

#### 4.4 Accessibility (WCAG 2.1 Level AA)
- **Keyboard navigation:** Tab order logiczny, focus indicators widoczne
- **Screen readers:** Semantic HTML, ARIA labels gdzie potrzebne
- **Kontrast kolorów:** Min. 4.5:1 dla tekstu, 3:1 dla UI elementów
- **Alternatywy:** Alt text dla ikon, text labels dla ikonek-buttonów
- **Skip links:** "Skip to main content" na początku strony

### 5. Dostępność i kompatybilność

#### 5.1 Przeglądarki (ostatnie 2 wersje)
- ✅ Chrome/Chromium
- ✅ Firefox
- ✅ Safari
- ✅ Edge
- ⚠️ IE11 (deprecated, basic support only jeśli wymagane)

#### 5.2 Urządzenia
- **Desktop:** 1920x1080, 1440x900, 1366x768
- **Tablet:** iPad, Android tablets
- **Mobile:** iPhone, Android (formularze publiczne)

#### 5.3 Lokalizacja
- **Język:** Polski (primary), możliwość rozszerzenia o angielski
- **Strefa czasowa:** Europe/Warsaw (UTC+1/+2)
- **Format dat:** DD-MM-YYYY HH:mm:ss (polski standard)
- **Format liczb:** Spacja jako separator tysięcy (150 000), przecinek jako separator dziesiętny (1,5)

---

## 🚀 Plan implementacji

### Phase 1: MVP (MUST HAVE)
**Czas: 4 tygodnie | Priorytet: P0**

#### Week 1: Backend Foundation
- [ ] Migracje bazy danych (schemat tabel)
- [ ] Modele: `ConsentTemplate`, `ConsentRecord`, `Lead` (rozszerzenie), `AuditLog`
- [ ] Seeders: Przykładowe dane do testów
- [ ] API endpoints:
  - `POST /api/consent-templates` - utworzenie szablonu zgody
  - `GET /api/consent-templates` - lista szablonów
  - `PUT /api/consent-templates/:id` - edycja (tworzy nową wersję)
  - `GET /api/consent-templates/:id/versions` - historia wersji
  - `POST /api/consent-records` - zapis zgody klienta
  - `GET /api/consent-records` - lista zgód (filtrowanie, paginacja)
- [ ] Middleware: RBAC, audit logging
- [ ] Logika wersjonowania zgód (auto-increment, archiwizacja)

#### Week 2: Admin Panel - Zarządzanie zgodami
- [ ] UI: Lista szablonów zgód (tabela z filtrowaniem)
- [ ] UI: Formularz tworzenia/edycji zgody (WYSIWYG editor)
- [ ] UI: Podgląd wersji zgody (modal)
- [ ] UI: Historia wersji z diff view
- [ ] Integracja z backend API
- [ ] Walidacje: wymagane pola, unikalność tytułów
- [ ] Toast notifications dla akcji (zapisano, błąd)

#### Week 3: Lista klientów + Archiwum zgód
- [ ] UI: Tabela klientów z statusem zgód (visual indicators)
- [ ] UI: Filtry (źródło, status zgód, zakres dat)
- [ ] UI: Wyszukiwanie full-text
- [ ] UI: Szczegóły klienta z timeline zgód
- [ ] UI: Podgląd treści zgody w modal (oryginalna wersja)
- [ ] UI: Archiwum zgód (osobna strona)
- [ ] Backend: Endpoints dla list i szczegółów
- [ ] Backend: Endpoint dla anonimizacji leada

#### Week 4: Formularze + Anonimizacja
- [ ] Update formularza partnera: checkbox oświadczenia
- [ ] Update formularza online: checkboxy zgód, walidacja
- [ ] Update formularza infolinii: potwierdzenia ustne
- [ ] Formularz finansowy: wymuszenie zgód przed submit
- [ ] Logika zapisu consent records dla każdego źródła
- [ ] UI: Przycisk "Anonimizuj dane" w szczegółach klienta
- [ ] UI: Modal potwierdzenia anonimizacji
- [ ] Backend: Logika anonimizacji (maskowanie PII)
- [ ] Audit log: Zapis kluczowych operacji
- [ ] Testing: E2E flow dla każdego źródła leadów

**Deliverables Phase 1:**
- ✅ Działający system zarządzania zgodami
- ✅ Formularze z checkboxami zgód
- ✅ Lista klientów z wizualizacją statusu
- ✅ Ręczna anonimizacja
- ✅ Podstawowy audit log

---

### Phase 2: Enhanced (SHOULD HAVE)
**Czas: 2 tygodnie | Priorytet: P1**

#### Week 5: Automatyzacja
- [ ] Backend: Cron job dla automatycznej anonimizacji
- [ ] Backend: Logika identyfikacji leadów do anonimizacji
- [ ] Backend: Email notifications dla adminów (alerty)
- [ ] UI: Konfiguracja okresów retencji w settings
- [ ] UI: Whitelist leadów (wykluczenie z auto-anonimizacji)
- [ ] UI: Dashboard z listą leadów do anonimizacji (preview przed akcją)
- [ ] Testing: Dry-run mode dla testowania

#### Week 6: Eksport i rozszerzony audit log
- [ ] Backend: Generowanie PDF eksportu danych klienta
- [ ] Backend: Generowanie JSON eksportu
- [ ] Backend: Zebranie wszystkich danych z tabel (zgody, komunikacja, audit)
- [ ] UI: Modal wyboru formatu eksportu
- [ ] UI: Progress bar dla generowania PDF
- [ ] UI: Download link po wygenerowaniu
- [ ] Rozszerzony audit log: więcej typów akcji
- [ ] UI: Interfejs przeglądania audit logu (filtry, wyszukiwanie)
- [ ] UI: Szczegóły akcji z before/after diff

**Deliverables Phase 2:**
- ✅ Automatyczna anonimizacja z konfiguracją
- ✅ Email notifications i alerty
- ✅ Eksport danych klienta (PDF/JSON)
- ✅ Rozszerzony audit log z UI

---

### Phase 3: Advanced (NICE TO HAVE)
**Czas: 2 tygodnie | Priorytet: P2**

#### Week 7: Dashboard Compliance
- [ ] Backend: Endpoints dla statystyk i metryk
- [ ] Backend: Agregacje SQL dla dashboardu
- [ ] UI: Dashboard główny z kafelkami (kluczowe metryki)
- [ ] UI: Wykresy (Recharts/Chart.js):
  - Timeline zgód (line chart)
  - Breakdown według typów (pie chart)
  - Funnel konwersji (funnel chart)
- [ ] UI: Panel alertów z listą problemów
- [ ] UI: Możliwość akcji z dashboardu (bulk export, remindery)

#### Week 8: Raporty i weryfikacja partnerów
- [ ] Backend: Generowanie raportów (compliance, audyt, retencja)
- [ ] Backend: Export raportów do PDF/Excel
- [ ] UI: Wybór typu raportu i parametrów
- [ ] UI: Download lub preview raportu
- [ ] UI: System weryfikacji oświadczeń partnerów
- [ ] UI: Remindery dla wygasających oświadczeń
- [ ] Backend: Notyfikacje email dla partnerów
- [ ] Polish UI: Drobne poprawki, feedback od użytkowników

**Deliverables Phase 3:**
- ✅ Dashboard compliance z analityką
- ✅ Raporty do eksportu
- ✅ Weryfikacja partnerów z reminderami
- ✅ Dopracowany, production-ready system

### Feature flag alignment z formularzem wieloetapowym
| Flaga (`prd_multiform_financing.md`) | Opis zależności | Faza modułu RODO |
| --- | --- | --- |
| `RODO_ADMIN_PANEL` | CRUD szablonów zgód + UI admina | Phase 1 Week 2 (MVP) |
| `CONSENT_VERSIONING` | Historyczne wersje i wymuszenie aktualizacji formularza | Phase 1 Week 1 (backend) |
| `AUDIT_EXPORT` | Audit log + eksport leadów z pełną historią zgód | Phase 2 Week 6 |
| `SMART_VALIDATION` | Weryfikacja danych klienta na podstawie metadanych zgód | Phase 3 Week 7+ |
| `E_SIGNATURE` | Możliwość podpisu elektronicznego zgód | Phase 3 Week 8+ |

> **Nota:** wdrożenia formularza nie mogą przejść do kolejnego etapu dopóki odpowiadająca flaga nie zostanie formalnie udostępniona przez moduł RODO.

---

## ✅ Kryteria akceptacji (Definition of Done)

### Zarządzanie tekstami zgód
- [ ] Admin może utworzyć nową zgodę ze wszystkimi wymaganymi polami
- [ ] Edycja zgody tworzy nową wersję (version auto-increment) i archiwizuje starą (valid_to = now)
- [ ] Historia wersji jest dostępna z widokiem diff (przed/po)
- [ ] Każda wersja ma timestamp, autora (created_by), i jest niemodyfikowalna
- [ ] Zgody można tagować dla łatwiejszego filtrowania
- [ ] Zgody można wyłączać (soft delete) bez usuwania z bazy

### Archiwum zgód
- [ ] Każda wyrażona zgoda jest zapisana z pełnymi metadanymi (IP, user_agent, timestamp, metoda)
- [ ] Archiwum można filtrować po: typ, data, źródło, status
- [ ] Archiwum można sortować: chronologicznie, po typie
- [ ] Możliwy eksport archiwum do CSV/PDF
- [ ] Wyszukiwanie full-text działa poprawnie (imię, nazwisko, email)

### Lista klientów z zgodami
- [ ] Tabela pokazuje wszystkich klientów z visual status indicators (🟢🟡🔴⚫)
- [ ] Status jest obliczany na podstawie wymaganych vs. posiadanych zgód
- [ ] Kliknięcie w klienta pokazuje szczegóły z timeline zgód
- [ ] Timeline jest chronologiczny (najnowsze na górze)
- [ ] Każda zgoda w timeline ma link do oryginalnej treści z momentu wyrażenia
- [ ] Filtry i wyszukiwanie działają sprawnie (<1s response time)

### Anonimizacja danych
- [ ] Admin może ręcznie zanonimizować dane klienta z poziomu szczegółów
- [ ] Modal potwierdzenia jasno komunikuje co zostanie zanonimizowane
- [ ] Anonimizacja maskuje wszystkie PII zgodnie ze specyfikacją
- [ ] Historia leada (zgody, audit log) pozostaje z linkiem do zanonimizowanego użytkownika
- [ ] Akcja jest logowana w audit logu z user_id, timestamp, details
- [ ] Zanonimizowane dane są nieodwracalne (brak możliwości cofnięcia)

### Formularze zgód
- [ ] Formularz partnera wymusza checkbox oświadczenia (required)
- [ ] Formularz online wymusza wymagane zgody przed wysyłką (button disabled)
- [ ] Formularz infolinii pozwala potwierdzić zgody ustne (checkboxy + notatki)
- [ ] Formularz finansowy wymusza obie zgody (finansowa + dealerzy) przed submit
- [ ] Każdy formularz zapisuje consent records z odpowiednimi metadanymi
- [ ] Link do pełnej treści zgody działa (modal lub new tab)

### Audit Log
- [ ] Wszystkie kluczowe operacje są automatycznie logowane
- [ ] Log zawiera: timestamp, user_id, akcja, entity_type, entity_id, IP, details
- [ ] Audit log jest read-only (nie można edytować/usuwać wpisów)
- [ ] Admin może przeglądać audit log z filtrami (data, akcja, użytkownik)
- [ ] Szczegóły akcji pokazują before/after dla edycji

### Eksport danych klienta
- [ ] Przycisk "Eksportuj wszystkie dane" jest dostępny w szczegółach klienta
- [ ] Możliwy wybór formatu (PDF/JSON)
- [ ] PDF zawiera wszystkie sekcje zgodnie ze specyfikacją
- [ ] Eksport zawiera oryginalne treści zgód z momentu wyrażenia
- [ ] Operacja jest logowana w audit logu
- [ ] Download działa poprawnie (proper filename, MIME type)

### Performance
- [ ] Lista klientów (10k rekordów) ładuje się w <2s
- [ ] Szczegóły klienta ładują się w <1s
- [ ] Zapis zgody zajmuje <500ms
- [ ] Generowanie PDF eksportu trwa <10s
- [ ] Wyszukiwanie full-text zwraca wyniki w <1s

### Security
- [ ] Wszystkie dane PII są szyfrowane w bazie (at rest)
- [ ] Wszystkie połączenia używają HTTPS (in transit)
- [ ] RBAC jest wdrożony i testowany (role mają odpowiednie uprawnienia)
- [ ] Rate limiting chroni API przed abuse
- [ ] CAPTCHA jest aktywna dla formularzy publicznych
- [ ] Session timeout działa (30 min nieaktywności)

---

## 🧪 Plan testów

### Unit Tests (Backend)
- [ ] `ConsentTemplate` model: walidacja pól, wersjonowanie, archiwizacja
- [ ] `ConsentRecord` model: zapis, aktualizacja, wycofanie zgody
- [ ] Logika anonimizacji: maskowanie PII, zachowanie historii
- [ ] Generowanie eksportu: zebranie danych, formatowanie PDF/JSON
- [ ] Audit logging: automatyczny zapis dla wszystkich akcji
- [ ] Cron job: identyfikacja leadów do anonimizacji

**Target coverage: >80%**

### Integration Tests (API)
- [ ] POST /api/consent-templates - utworzenie zgody (happy path, validation errors)
- [ ] PUT /api/consent-templates/:id - edycja tworzy nową wersję
- [ ] POST /api/consent-records - zapis zgody z różnych źródeł
- [ ] POST /api/leads/:id/anonymize - anonimizacja end-to-end
- [ ] GET /api/leads/:id/export - generowanie eksportu
- [ ] GET /api/audit-logs - filtrowanie, paginacja
- [ ] Auth middleware: weryfikacja RBAC dla każdego endpointa

**Target coverage: >70%**

### E2E Tests (User flows)
- [ ] **Flow 1: Partner submission**
  1. Partner wypełnia formularz z oświadczeniem
  2. Lead jest utworzony z PARTNER_DECLARATION consent record
  3. Status leada: "wymaga potwierdzenia zgód klienta"
  4. Admin widzi lead w liście z statusem 🟡
  
- [ ] **Flow 2: Online form**
  1. Klient wypełnia formularz online
  2. Zaznacza wszystkie zgody (marketing, financial, vehicle)
  3. Lead jest utworzony z 3 consent records
  4. Status leada: "kompletne zgody" 🟢
  5. Klient otrzymuje email potwierdzenia
  
- [ ] **Flow 3: Phone lead**
  1. Pracownik infolinii zakłada lead
  2. Potwierdza zgody ustne checkboxami
  3. Lead jest utworzony z consent records (metoda: phone_call)
  4. recorded_by_user_id = ID pracownika
  
- [ ] **Flow 4: Financial form follow-up**
  1. Klient otrzymuje link do formularza finansowego
  2. Wypełnia dodatkowe dane
  3. Musi zaznaczyć wymagane zgody przed submit
  4. Consent records są zaktualizowane/utworzone
  5. Status wniosku zgodnie z tabelą ze `prd_multiform_financing.md`: `draft` → `in_progress` → `ready` → `submitted`
  6. Moduł RODO blokuje edycję przez operatora, gdy `isClientActive = true` (sygnał z ApplicationForm)
  7. Przy wznowieniu (unlock) klient ponownie potwierdza zgody i powstają nowe Consent Records powiązane z nową wersją template’u
  
- [ ] **Flow 5: Manual anonymization**
  1. Admin wchodzi w szczegóły klienta
  2. Klika "Anonimizuj dane"
  3. Potwierdza w modalu
  4. Dane są natychmiast zanonimizowane
  5. Status zmienia się na 🔴⚫ "Zanonimizowano"
  6. Audit log zawiera wpis o anonimizacji
  
- [ ] **Flow 6: Data export**
  1. Admin klika "Eksportuj dane klienta"
  2. Wybiera format PDF
  3. PDF jest generowany z wszystkimi sekcjami
  4. Download działa
  5. Audit log zawiera wpis o eksporcie

**Tools: Cypress / Playwright**

### Manual Testing (QA)
- [ ] **UX formularzy:** Czy checkboxy zgód są jasne i zrozumiałe?
- [ ] **Modal zgód:** Czy pełna treść wyświetla się poprawnie?
- [ ] **Responsywność:** Testy na różnych rozdzielczościach
- [ ] **Edge cases:**
  - Co się dzieje gdy klient odznacza zgodę przed submit?
  - Co jeśli formularz wygaśnie (token expired)?
  - Co jeśli admin próbuje zanonimizować już zanonimizowany lead?
- [ ] **Performance:** Load testing z 10k rekordów w tabeli
- [ ] **PDF eksportu:** Czy wszystkie sekcje są czytelne? Czy formatowanie OK?
- [ ] **Accessibility:** Testy z screen readerem, keyboard navigation

### Security Testing
- [ ] Penetration testing (opcjonalnie: zewnętrzna firma)
- [ ] OWASP Top 10: SQL injection, XSS, CSRF
- [ ] Rate limiting: Czy blokuje burst requests?
- [ ] Auth: Czy unauthorized user może dostać się do API?
- [ ] RBAC: Czy Sales Rep może dostać się do admin-only endpoints?

---

## 📈 Metryki sukcesu (KPIs)

### Compliance
- **100%** leadów ma udokumentowane źródło zgód
- **≥95%** leadów z kompletnymi wymaganymi zgodami
- **0** naruszeń RODO w audytach wewnętrznych/zewnętrznych
- **<24h** czas reakcji na żądanie usunięcia danych (prawo do bycia zapomnianym)
- **7 lat** retencja audit logów (wymóg prawny)

### Performance
- **<2s** średni load time listy klientów (P95)
- **<1s** średni load time szczegółów klienta (P95)
- **<10s** czas generowania PDF eksportu (P95)
- **99.9%** uptime modułu RODO
- **0** data breaches

### Adoption
- **100%** pracowników przeszkolonych z nowego systemu (przed launch)
- **<5%** leadów z brakującymi wymaganymi zgodami (po 3 miesiącach)
- **0** skarg klientów na proces zgód
- **>90%** user satisfaction score (wewnętrzna ankieta)

### Operational
- **<30 min** czas reakcji na critical alert (P0)
- **<4h** czas naprawy critical bug (P0)
- **<2 dni** czas implementacji zmian w tekstach zgód
- **Weekly** backupy bazy danych (automated)

---

## 🚨 Ryzyka i mitigacje

| Ryzyko | Prawdopodobieństwo | Wpływ | Mitigacja |
|--------|-------------------|-------|-----------|
| **Błąd w logice anonimizacji - wyciek danych** | Niskie | Krytyczny | 1. Code review przez 2+ devs<br>2. Szczegółowe unit testy<br>3. Manual QA na staging<br>4. Dry-run mode przed production<br>5. Audyt zewnętrzny przed launch |
| **Niezgodność z RODO - kara UOD** | Średnie | Krytyczny | 1. Konsultacja z prawnikiem specjalizującym się w RODO<br>2. Audyt compliance przed launch<br>3. Regular reviews z Compliance Officer<br>4. Newsletter z UODO - śledzenie zmian w przepisach |
| **Słaba adopcja przez pracowników** | Średnie | Średni | 1. Zaangażowanie pracowników w design (feedback sessions)<br>2. Szkolenia przed launch (hands-on workshops)<br>3. Intuicyjny UX (user testing przed release)<br>4. Video tutorials + dokumentacja<br>5. Dedicated support w pierwszym miesiącu |
| **Problemy z wydajnością przy skalowaniu** | Średnie | Średni | 1. Load testing przed production<br>2. Database indexing<br>3. Query optimization<br>4. Caching strategy<br>5. Horizontal scaling architecture<br>6. Monitoring i alerting (APM) |
| **Utrata danych audit logu** | Niskie | Wysoki | 1. Daily automated backups<br>2. Replikacja bazy danych (master-slave)<br>3. Offsite backup storage<br>4. Quarterly restore tests<br>5. Append-only audit log (immutable) |
| **Nieautoryzowany dostęp do danych** | Niskie | Krytyczny | 1. RBAC strictly enforced<br>2. 2FA dla adminów<br>3. IP whitelisting dla admin panel<br>4. Session timeouts<br>5. Audit log wszystkich dostępów<br>6. Regular security audits |
| **Zmiana przepisów RODO** | Niskie | Średni | 1. Modular architecture (łatwa modyfikacja)<br>2. Wersjonowanie tekstów zgód<br>3. Monitoring zmian legislacyjnych<br>4. Buffer period dla implementacji zmian |
| **Długi czas generowania PDF eksportu** | Średnie | Niski | 1. Optymalizacja zapytań SQL<br>2. Async processing (queue)<br>3. Caching partial results<br>4. Progress bar dla user feedback |

---

## 📚 Dokumentacja

### Dla adminów (User Guide)
**Dokument: "Admin RODO - Podręcznik użytkownika"**

Spis treści:
1. Wprowadzenie do modułu RODO
2. Zarządzanie tekstami zgód
   - Tworzenie nowej zgody
   - Edycja zgody (wersjonowanie)
   - Archiwizacja zgód
3. Przeglądanie listy klientów
   - Interpretacja statusu zgód (kolory)
   - Filtrowanie i wyszukiwanie
4. Szczegóły klienta i timeline zgód
5. Proces ręcznej anonimizacji
   - Kiedy anonimizować?
   - Krok po kroku
   - Co zostaje po anonimizacji?
6. Eksport danych klienta (Art. 15 RODO)
7. Dashboard Compliance
   - Interpretacja metryk
   - Jak reagować na alerty?
8. Audit Log - monitoring operacji
9. FAQ
   - Co zrobić gdy klient żąda usunięcia danych?
   - Czy mogę cofnąć anonimizację?
   - Jak zmienić tekst zgody?

**Format:** PDF interaktywny ze screenshots, 30-40 stron

---

### Dla pracowników (Quick Start)
**Dokument: "Jak prawidłowo zakładać leady - przewodnik"**

Spis treści:
1. Zakładanie leada z infolinii
   - Zbieranie danych od klienta
   - **Jak pytać o zgody? (scripty rozmowy)**
   - Potwierdzanie zgód w systemie
   - Co zrobić gdy klient odmawia zgody?
2. Weryfikacja kompletności zgód
3. Follow-up z klientem (wysyłanie formularza finansowego)
4. FAQ dla infolinii

**Format:** PDF + video tutorial (5 min), 10-15 stron

---

### Dla partnerów
**Dokument: "Przewodnik partnera - przekazywanie leadów"**

Spis treści:
1. Jak wypełnić formularz partnera?
2. Oświadczenie o zgodzie - wymogi prawne
3. Jakie dane możesz nam przekazać?
4. Obowiązki partnera w kontekście RODO
5. Weryfikacja oświadczeń (odnawianie co 12 miesięcy)
6. FAQ

**Format:** PDF, 8-10 stron

---

### Dokumentacja techniczna
**1. API Documentation (Swagger/OpenAPI)**
- Wszystkie endpointy z przykładami request/response
- Authentication i authorization
- Error codes
- Rate limiting

**2. Database Schema Documentation**
- ERD diagram
- Opis wszystkich tabel i kolumn
- Indexy i ich uzasadnienie
- Constraints i relacje

**3. Deployment Guide**
- Environment setup (dev/staging/production)
- Environment variables
- Database migrations
- Cron jobs setup
- Monitoring i logging setup
- Backup strategy

**4. Developer Guide**
- Architektura systemu
- Code structure
- Naming conventions
- Testing guidelines
- Git workflow (branching strategy)
- Code review checklist

**5. Runbook (Operations)**
- Jak zrestartować serwis?
- Jak rollback deployment?
- Troubleshooting common issues
- Emergency contacts
- Incident response procedure

---

## 📞 Kontakt i wsparcie

**Product Owner:** [Twoje imię i email]  
**Tech Lead:** [Do uzupełnienia]  
**Legal/Compliance Officer:** [Do uzupełnienia]  
**Security Team:** [Do uzupełnienia]

**Support channels:**
- Email: rodo-support@firma.pl
- Slack: #rodo-module
- Jira board: [Link do board]

---

## 🔄 Historia zmian

| Wersja | Data | Autor | Zmiany |
|--------|------|-------|--------|
| 1.0 | 2025-11-08 | Claude | Pierwsza wersja PRD - pełna specyfikacja modułu RODO |

---

## 🎯 Następne kroki (Post-Launch)

### Miesiąc 1-3: Stabilizacja
- [ ] Zbieranie feedbacku od użytkowników (ankiety, wywiady)
- [ ] Hot-fixes dla zgłoszonych bugów (P0/P1)
- [ ] Fine-tuning performance na podstawie real traffic
- [ ] Pierwsze szkolenia dla nowych pracowników
- [ ] Monitoring metryk sukcesu

### Miesiąc 4-6: Optymalizacja
- [ ] Analiza metryk compliance (czy osiągamy KPIs?)
- [ ] Optymalizacja slow queries
- [ ] UI/UX improvements na podstawie feedbacku
- [ ] Rozszerzenie dokumentacji (FAQ na podstawie pytań users)
- [ ] A/B testing różnych formułowań zgód (conversion rate)

### Miesiąc 7-12: Rozbudowa
- [ ] Dashboard Analytics - zaawansowane raporty
- [ ] Integracja z zewnętrznymi systemami (CRM, marketing automation)
- [ ] API dla partnerów (programmatic lead submission)
- [ ] Mobile app dla sales reps
- [ ] AI-powered compliance assistant (sugestie poprawek)

---

## 💡 Pomysły na przyszłość (Backlog)

### Feature ideas (niski priorytet)
1. **Automated consent renewal reminders**
   - Gdy zgoda ma wygasnąć (jeśli ma termin ważności)
   - Email do klienta z linkiem do odnowienia

2. **Multi-language support**
   - Angielska wersja formularzy dla international clients
   - Tłumaczenia tekstów zgód

3. **Consent preferences center**
   - Portal dla klienta gdzie może zarządzać swoimi zgodami
   - Self-service wycofanie zgód, aktualizacja danych

4. **Advanced analytics**
   - Predykcja: które leady prawdopodobnie nie wyrażą zgód?
   - Heat maps: gdzie klienci drop-off w formularzach?
   - Cohort analysis: różnice w conversion rate zgód

5. **Blockchain-based consent proof**
   - Immutable ledger dla proof of consent
   - Timestamps nie do podrobienia

6. **Video consent recording**
   - Dla high-value leadów: nagranie wideo klienta wyrażającego zgodę
   - Storage w secure cloud

7. **Consent scoring**
   - Scoring quality of consent (czy był informed? czy voluntary?)
   - Red flags dla ryzykownych consent records

8. **Integration z e-signature platforms**
   - DocuSign, Adobe Sign dla formalnych zgód
   - Legally binding digital signatures

---

## 📖 Glosariusz

| Termin | Definicja |
|--------|-----------|
| **PII (Personally Identifiable Information)** | Dane osobowe pozwalające zidentyfikować osobę (imię, nazwisko, PESEL, email, telefon, adres) |
| **Consent Record** | Zapis w bazie danych dokumentujący wyrażenie zgody przez klienta |
| **Consent Template** | Szablon/treść zgody, wersjonowany |
| **Lead** | Potencjalny klient, zapytanie o finansowanie |
| **Anonimizacja** | Proces usunięcia/maskowania danych osobowych w sposób nieodwracalny |
| **Audit Log** | Historia wszystkich operacji na danych wrażliwych |
| **RODO/GDPR** | Rozporządzenie o Ochronie Danych Osobowych (General Data Protection Regulation) |
| **Art. 15 RODO** | Prawo dostępu - klient może żądać kopii swoich danych |
| **Art. 17 RODO** | Prawo do bycia zapomnianym - klient może żądać usunięcia danych |
| **UOD/DPA** | Urząd Ochrony Danych / Data Protection Authority |
| **IOD/DPO** | Inspektor Ochrony Danych / Data Protection Officer |
| **Retencja danych** | Okres przez który dane są przechowywane przed usunięciem/anonimizacją |
| **Consent method** | Sposób wyrażenia zgody (online_form, phone_call, partner_submission) |
| **Status zgód** | Stan kompletności zgód leada (complete, incomplete, withdrawn) |
| **Visual indicator** | Kolorowa ikona/badge pokazująca status (🟢🟡🔴⚫) |
| **Timeline zgód** | Chronologiczna lista wszystkich zgód wyrażonych przez klienta |
| **Wersjonowanie zgód** | System śledzenia zmian w treściach zgód (v1, v2, v3...) |

---

## 🔗 Linki i zasoby

### Prawne
- [RODO - pełny tekst rozporządzenia](https://uodo.gov.pl/pl/131/224)
- [Wytyczne UODO - zgody](https://uodo.gov.pl/pl/138/662)
- [Art. 15 RODO - prawo dostępu](https://uodo.gov.pl/pl/131/224#article-15)
- [Art. 17 RODO - prawo do usunięcia](https://uodo.gov.pl/pl/131/224#article-17)

### Techniczne
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [PostgreSQL Performance](https://www.postgresql.org/docs/current/performance-tips.html)
- [React Best Practices](https://react.dev/learn)

### Inspiracje (jak inni robią zgody?)
- [Stripe Consent Management](https://stripe.com/privacy)
- [Google Consent Mode](https://support.google.com/analytics/answer/9976101)
- [OneTrust Cookie Consent](https://www.onetrust.com/)

---

## 📝 Notatki implementacyjne

### Tech Stack (sugerowany)

**Backend:**
- **Framework:** Node.js + Express / Python + Django / Ruby on Rails
- **Database:** PostgreSQL 14+ (wspiera JSON, partycjonowanie)
- **ORM:** Prisma / Sequelize / TypeORM
- **Cache:** Redis
- **Queue:** Bull / Sidekiq (dla async tasks jak PDF generation)
- **PDF Generation:** Puppeteer / wkhtmltopdf / PDFKit
- **Cron:** node-cron / crontab

**Frontend:**
- **Framework:** React 18+ / Vue 3 / Next.js
- **Styling:** Tailwind CSS / Material-UI
- **State Management:** Redux / Zustand / Context API
- **Forms:** React Hook Form + Yup validation
- **HTTP Client:** Axios / Fetch API
- **Charts:** Recharts / Chart.js
- **Rich Text Editor:** Quill / TinyMCE (dla tekstów zgód)

**DevOps:**
- **Hosting:** AWS / Azure / Google Cloud
- **CI/CD:** GitHub Actions / GitLab CI / Jenkins
- **Monitoring:** New Relic / Datadog / Sentry
- **Logging:** ELK Stack / CloudWatch
- **Backups:** Automated daily backups to S3

**Security:**
- **Encryption:** AES-256 for data at rest
- **Secrets Management:** AWS Secrets Manager / HashiCorp Vault
- **SSL:** Let's Encrypt / AWS Certificate Manager
- **WAF:** Cloudflare / AWS WAF

### Environment Variables (przykład)

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/rodo_db

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-super-secret-key
JWT_EXPIRES_IN=30m

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@firma.pl
SMTP_PASS=xxx

# Storage
AWS_S3_BUCKET=company-documents
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx

# App
NODE_ENV=production
APP_URL=https://crm.firma.pl
API_URL=https://api.firma.pl

# RODO Settings
AUTO_ANONYMIZATION_ENABLED=true
DATA_RETENTION_MONTHS=36
AUDIT_LOG_RETENTION_YEARS=7

# Security
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
SESSION_TIMEOUT_MINUTES=30
```

### Database Migrations (przykładowe)

**Migration 001: Create consent_templates table**
```sql
CREATE TABLE consent_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consent_type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  valid_from TIMESTAMP NOT NULL DEFAULT NOW(),
  valid_to TIMESTAMP,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_required BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  tags TEXT[] DEFAULT '{}',
  CONSTRAINT consent_type_enum CHECK (
    consent_type IN ('PARTNER_DECLARATION', 'MARKETING', 'FINANCIAL_PARTNERS', 'VEHICLE_PARTNERS')
  )
);

CREATE INDEX idx_consent_templates_type ON consent_templates(consent_type);
CREATE INDEX idx_consent_templates_active ON consent_templates(is_active);
CREATE INDEX idx_consent_templates_valid_dates ON consent_templates(valid_from, valid_to);
```

**Migration 002: Create consent_records table**
```sql
CREATE TABLE consent_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  consent_template_id UUID NOT NULL REFERENCES consent_templates(id),
  consent_type VARCHAR(50) NOT NULL,
  consent_given BOOLEAN NOT NULL,
  consent_method VARCHAR(50) NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  recorded_by_user_id UUID REFERENCES users(id),
  partner_id UUID REFERENCES partners(id),
  recorded_at TIMESTAMP NOT NULL DEFAULT NOW(),
  withdrawn_at TIMESTAMP,
  notes TEXT,
  CONSTRAINT consent_method_enum CHECK (
    consent_method IN ('online_form', 'phone_call', 'partner_submission')
  ),
  CONSTRAINT consent_type_enum CHECK (
    consent_type IN ('PARTNER_DECLARATION', 'MARKETING', 'FINANCIAL_PARTNERS', 'VEHICLE_PARTNERS')
  )
);

CREATE INDEX idx_consent_records_lead ON consent_records(lead_id);
CREATE INDEX idx_consent_records_type ON consent_records(consent_type);
CREATE INDEX idx_consent_records_recorded_at ON consent_records(recorded_at);
CREATE INDEX idx_consent_records_method ON consent_records(consent_method);
```

**Migration 003: Update leads table**
```sql
ALTER TABLE leads 
  ADD COLUMN consent_status VARCHAR(20) DEFAULT 'incomplete',
  ADD COLUMN anonymized_at TIMESTAMP,
  ADD COLUMN anonymized_by UUID REFERENCES users(id);

CREATE INDEX idx_leads_consent_status ON leads(consent_status);
CREATE INDEX idx_leads_anonymized ON leads(anonymized_at);

ALTER TABLE leads 
  ADD CONSTRAINT consent_status_enum CHECK (
    consent_status IN ('complete', 'incomplete', 'partner_declaration_only', 'withdrawn')
  );
```

**Migration 004: Create audit_logs table**
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  user_email VARCHAR(255),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID,
  ip_address VARCHAR(45),
  user_agent TEXT,
  details JSONB,
  before_value JSONB,
  after_value JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- GIN index dla wyszukiwania w JSONB
CREATE INDEX idx_audit_logs_details ON audit_logs USING GIN (details);
```

### API Endpoints (lista)

```
# Authentication
POST   /api/auth/login
POST   /api/auth/logout
POST   /api/auth/refresh
GET    /api/auth/me

# Consent Templates
GET    /api/consent-templates
GET    /api/consent-templates/:id
POST   /api/consent-templates          [Admin only]
PUT    /api/consent-templates/:id      [Admin only]
DELETE /api/consent-templates/:id      [Admin only]
GET    /api/consent-templates/:id/versions

# Consent Records
GET    /api/consent-records
GET    /api/consent-records/:id
POST   /api/consent-records             [Public - for forms]
PUT    /api/consent-records/:id/withdraw

# Leads
GET    /api/leads
GET    /api/leads/:id
POST   /api/leads                       [Public - for forms]
PUT    /api/leads/:id
POST   /api/leads/:id/anonymize         [Admin only]
GET    /api/leads/:id/export            [Admin only]
GET    /api/leads/:id/consents

# Audit Logs
GET    /api/audit-logs                  [Admin only]
GET    /api/audit-logs/:id              [Admin only]

# Dashboard
GET    /api/dashboard/stats             [Admin only]
GET    /api/dashboard/alerts            [Admin only]
GET    /api/dashboard/charts            [Admin only]

# Reports
POST   /api/reports/compliance          [Admin only]
POST   /api/reports/audit               [Admin only]
POST   /api/reports/retention           [Admin only]

# Settings
GET    /api/settings/rodo               [Admin only]
PUT    /api/settings/rodo               [Admin only]
```

---

## ✨ Podsumowanie dla Vibe Coding

### Co masz w tym PRD?

✅ **Pełny kontekst biznesowy** - rozumiesz dlaczego to robimy  
✅ **Szczegółowe wymagania** - każda funkcja opisana krok po kroku  
✅ **User flows** - wiesz jak każdy typ użytkownika korzysta z systemu  
✅ **Struktura danych** - modele, relacje, indeksy gotowe  
✅ **API specification** - lista wszystkich endpointów  
✅ **UI/UX guidelines** - wiesz jak powinno wyglądać  
✅ **Plan implementacji w fazach** - od MVP do advanced features  
✅ **Kryteria akceptacji** - Definition of Done dla każdej funkcji  
✅ **Plan testów** - unit, integration, E2E  
✅ **Metryki sukcesu** - jak mierzymy czy projekt się udał  
✅ **Analiza ryzyk** - co może pójść nie tak i jak temu zapobiec  

### Jak zacząć?

1. **Setup projektu:**
   - Inicjalizuj repo (mono-repo lub osobne backend/frontend)
   - Setup CI/CD pipeline
   - Konfiguracja środowisk (dev, staging, prod)

2. **Database first:**
   - Implementuj migracje (001-004)
   - Seedy z przykładowymi danymi
   - Test połączenia

3. **Backend MVP (Week 1-2):**
   - Modele + walidacje
   - API endpoints dla Phase 1
   - Unit testy

4. **Frontend MVP (Week 2-4):**
   - Setup React/Vue
   - Komponenty UI z design system
   - Integracja z API

5. **Testing & QA:**
   - E2E testy dla kluczowych flows
   - Manual testing
   - Security review

6. **Deploy do staging:**
   - Internal testing
   - Feedback round
   - Bug fixes

7. **Production launch:**
   - Monitoring setup
   - Szkolenia dla users
   - Go live! 🚀

*Dokument PRD wersja 1.0 - gotowy do użycia dla zespołu deweloperskiego.*
