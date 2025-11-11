# Unlock flow – multi-step financing form

## Cel
Umożliwić Adminowi/Supervisorowi odblokowanie przesłanego wniosku, wysłanie nowego linku klientowi i wymuszenie ponownej akceptacji zgód (z aktualną wersją).

## Handshake statusów
- submitted/locked/ready → [akcja: unlock] → unlocked
- unlocked → klient otwiera link → in_progress → [submit] → submitted

## Backend
- Endpoint: `POST /api/application-forms/:id/unlock` (roles: ADMIN, SUPERVISOR)
- Efekty:
  - `status = UNLOCKED`
  - `uniqueLink`, `linkGeneratedAt`, `linkExpiresAt` – odświeżone
  - `isClientActive = false`, `lastClientActivity = null`
  - dopisanie `unlockHistory` (kto, kiedy, powód)
  - email do klienta z nowym linkiem
  - `EmailLog(type=UNLOCKED, payload: { reason, link, expiresAt })`

Link dla klienta:
`{APP_BASE_URL}/client-form/consents?applicationFormId={id}&leadId={leadId}&hash={accessCodeHash}`

## Frontend (CRM)
- Widok leada: przycisk „Odblokuj wniosek” (ADMIN/SUPERVISOR) widoczny dla statusów: `SUBMITTED | LOCKED | READY`
- Modal z opcjonalnym powodem → wywołanie `POST /unlock` → toast + odświeżenie karty leada
- Widok „Historia odblokowań” prezentuje `unlockHistory`

## Zachowanie danych
- `formData`, `currentStep`, `completionPercent` pozostają bez zmian – klient widzi wcześniej wprowadzone dane.
- Klient musi ponownie zaakceptować zgody; log zapisu zgód będzie odpowiadał najnowszym wersjom szablonów.

## Błędy i edge cases
- Próba edycji przez operatora przy aktywnej sesji klienta → `409 CLIENT_ACTIVE`
- Wygasły link → `401 LINK_EXPIRED` (klient musi poprosić o odświeżenie linku)

## Testy (skrót)
- Backend: po unlock status = UNLOCKED, nowy `uniqueLink`, EmailLog z linkiem i `expiresAt`, wysyłka maila do klienta (jeżeli ma email).
- Frontend E2E: Admin → Odblokuj → modal → potwierdzenie → toast → odświeżony status i wpis w historii.


