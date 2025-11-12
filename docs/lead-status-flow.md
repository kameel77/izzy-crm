# Proces Zarządzania Statusami Leada w Izzy CRM

Ten dokument opisuje proponowany cykl życia leada (Lead Status Lifecycle) w systemie Izzy CRM, uwzględniając specyfikę pośrednictwa w finansowaniu pojazdów. Celem jest usystematyzowanie pracy, poprawa jakości danych, zwiększenie przejrzystości procesu sprzedaży oraz umożliwienie lepszej analityki.

## Fazy i Statusy Leada

Proces zarządzania leadami został podzielony na pięć głównych faz, z których każda zawiera szczegółowe statusy:

### Faza 1: Pozyskanie (Acquisition)

*   **Nowy** (New)
    *   **Opis:** Lead właśnie trafił do systemu (np. z formularza kontaktowego, importu, ręcznego dodania). Nikt jeszcze nie podjął kontaktu.
    *   **Możliwe przejścia:** `Pierwszy kontakt`, `Nieskwalifikowany`.

*   **Pierwszy kontakt** (First Contact)
    *   **Opis:** Podjęto próbę kontaktu z klientem (telefon, e-mail), ale bez powodzenia, lub trwa proces umawiania rozmowy/spotkania.
    *   **Możliwe przejścia:** `Follow-up`, `Weryfikacja`, `Nieskwalifikowany`.

*   **Follow-up** (Follow-up)
    *   **Opis:** Kontakt został nawiązany, ale klient poprosił o ponowny kontakt w późniejszym terminie.
    *   **Możliwe przejścia:** `Weryfikacja`, `Nieskwalifikowany`.

### Faza 2: Kwalifikacja (Qualification)

*   **Weryfikacja** (Verification)
    *   **Opis:** Trwa rozmowa z klientem, zbieranie podstawowych informacji, badanie potrzeb i wstępna ocena, czy klient kwalifikuje się do dalszego procesu finansowania.
    *   **Możliwe przejścia:** `Kompletowanie dokumentów`, `Nieskwalifikowany`.

*   **Nieskwalifikowany** (Unqualified)
    *   **Opis:** Klient nie spełnia podstawowych kryteriów finansowania (np. brak zdolności kredytowej, negatywna historia w BIK, rezygnacja na wczesnym etapie). **Wymaga podania powodu.**
    *   **Wymagany powód:** Tak (np. "Brak zdolności kredytowej", "Klient zrezygnował", "Brak kontaktu po wielu próbach").
    *   **Status końcowy fazy:** Tak.

### Faza 3: Wniosek i Analiza (Application & Analysis)

*   **Kompletowanie dokumentów** (Gathering Documents)
    *   **Opis:** Klient jest zdecydowany na kontynuowanie procesu. Trwa zbieranie od niego niezbędnych dokumentów (dowód osobisty, zaświadczenia o dochodach, wyciągi bankowe itp.).
    *   **Możliwe przejścia:** `Analiza kredytowa`, `Zakończony - Utracony`, `Anulowany`.

*   **Analiza kredytowa** (Credit Analysis)
    *   **Opis:** Dokumenty są kompletne. Wniosek o finansowanie został złożony do instytucji finansowej (banku/leasingodawcy) i oczekujemy na decyzję.
    *   **Możliwe przejścia:** `Oferta przedstawiona`, `Zakończony - Utracony`, `Zakończony - Brak zdolności`, `Anulowany`.

### Faza 4: Decyzja i Oferta (Decision & Offer)

*   **Oferta przedstawiona** (Offer Presented)
    *   **Opis:** Otrzymaliśmy pozytywną decyzję od instytucji finansowej i przedstawiliśmy klientowi konkretne warunki finansowania (np. wysokość raty, oprocentowanie, okres kredytowania).
    *   **Możliwe przejścia:** `Negocjacje`, `Akceptacja warunków`, `Zakończony - Utracony`, `Anulowany`.

*   **Negocjacje** (Negotiations)
    *   **Opis:** Klient analizuje przedstawioną ofertę, trwają ewentualne negocjacje warunków (np. próba uzyskania lepszych warunków, zmiana parametrów finansowania).
    *   **Możliwe przejścia:** `Akceptacja warunków`, `Zakończony - Utracony`, `Anulowany`.

*   **Akceptacja warunków** (Terms Accepted)
    *   **Opis:** Klient zaakceptował przedstawioną ofertę i warunki finansowania.
    *   **Możliwe przejścia:** `Umowa w przygotowaniu`, `Zakończony - Utracony`, `Anulowany`.

### Faza 5: Finalizacja (Closing)

*   **Umowa w przygotowaniu** (Contract in Preparation)
    *   **Opis:** Trwa przygotowywanie finalnej umowy finansowania dla klienta.
    *   **Możliwe przejścia:** `Podpisanie umowy`, `Zakończony - Utracony`, `Anulowany`.

*   **Podpisanie umowy** (Contract Signing)
    *   **Opis:** Umowa została wysłana do klienta lub przekazana do podpisu (np. w placówce, zdalnie).
    *   **Możliwe przejścia:** `Zakończony - Sukces`, `Zakończony - Utracony`, `Anulowany`.

*   **Zakończony - Sukces** (Closed - Won)
    *   **Opis:** Umowa została podpisana, środki uruchomione, a proces finansowania zakończony sukcesem.
    *   **Status końcowy:** Tak.

## Statusy Końcowe (Terminal Statuses)

Te statusy oznaczają zakończenie procesu leada, niezależnie od jego wyniku.

*   **Zakończony - Utracony** (Closed - Lost)
    *   **Opis:** Klient wybrał ofertę konkurencji, zrezygnował na późnym etapie procesu lub z innych powodów nie doszło do finalizacji umowy. **Wymaga podania powodu.**
    *   **Wymagany powód:** Tak (np. "Lepsza oferta konkurencji", "Długi czas oczekiwania", "Rezygnacja klienta", "Brak wymaganych dokumentów").
    *   **Status końcowy:** Tak.

*   **Zakończony - Brak zdolności** (Closed - No financing)
    *   **Opis:** Klient nie dostal oferty finansowania od zadnej instytucji finansowej. **Wymaga podania powodu.**
    *   **Wymagany powód:** Tak (np. "Brak mozliwości sfinansowania klienta").
    *   **Status końcowy:** Tak.

*   **Anulowany** (Cancelled)
    *   **Opis:** Proces został przerwany z przyczyn niezależnych od klienta lub doradcy (np. błąd danych, wycofanie produktu przez bank, zmiana regulacji). **Wymaga podania powodu.**
    *   **Wymagany powód:** Tak (np. "Błąd w danych klienta", "Produkt wycofany z oferty", "Zmiana regulacji prawnych").
    *   **Status końcowy:** Tak.

## Wymagania Funkcjonalne i Techniczne

### Baza Danych (Prisma Schema)

*   Modyfikacja modelu `Lead`: Pole `status` powinno zostać zmienione na `Enum` z nowymi, predefiniowanymi wartościami statusów.
*   Dodanie nowego modelu `LeadStatusHistory` do logowania każdej zmiany statusu. Model powinien zawierać pola: `id`, `leadId`, `oldStatus`, `newStatus`, `changedById` (ID użytkownika, który zmienił status), `timestamp` (data i czas zmiany), `reason` (opcjonalny powód zmiany, wymagany dla statusów `Nieskwalifikowany`, `Zakończony - Utracony`, `Anulowany`).

### Backend API

*   Modyfikacja endpointu do aktualizacji leada (np. `PUT /api/leads/:id`): Powinien przyjmować nowy status oraz opcjonalnie pole `reason`.
*   Logika serwera powinna automatycznie tworzyć wpis w tabeli `LeadStatusHistory` przy każdej zmianie statusu.
*   Walidacja: Wymuszanie podania `reason` dla statusów końcowych (`Nieskwalifikowany`, `Zakończony - Utracony`, `Anulowany`).

### Frontend (UI/UX)

*   **Formularz aktualizacji statusu:** Standardowe pole tekstowe lub input do wyboru statusu powinno zostać zastąpione listą rozwijaną (`<select>`) z nowymi, predefiniowanymi statusami.
*   **Warunkowe pole "Powód":** Gdy użytkownik wybierze status `Nieskwalifikowany`, `Zakończony - Utracony` lub `Anulowany`, powinno pojawić się dodatkowe, **wymagane** pole tekstowe (lub lista rozwijana z predefiniowanymi powodami) do wpisania/wybrania powodu zmiany statusu.
*   **Widok szczegółów leada:** Dodanie nowej sekcji "Historia statusów", która będzie wyświetlać chronologiczną listę zmian statusu wraz z datą, użytkownikiem i powodem (jeśli istnieje).
*   **Lista leadów:** Rozszerzenie możliwości filtrowania i sortowania leadów o nowe statusy.

## Propozycje Automatyzacji

*   **Powiadomienia:** Automatyczne powiadomienia (np. e-mail, powiadomienie w aplikacji) dla odpowiednich użytkowników/ról przy zmianie statusu na kluczowe etapy (np. `Analiza kredytowa`, `Oferta przedstawiona`).
*   **Zadania:** Automatyczne tworzenie zadań dla doradców po zmianie statusu (np. po przejściu na `Kompletowanie dokumentów` - zadanie "Skontaktuj się z klientem w celu zebrania dokumentów").

---