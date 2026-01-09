# Lead Merge API

## Endpoint

`POST /leads/:id/merge`

## Description

Merge a source lead into a target lead. The operator decides:
- whether to merge notes (manual + email notes)
- which lead provides the desired vehicle
- which email becomes the primary contact email

The source lead is kept for history and receives status `MERGED`.

## Payload

```json
{
  "sourceLeadId": "cuid",
  "mergeNotes": true,
  "desiredVehicleSource": "target",
  "primaryEmail": "email@example.com"
}
```

## Fields

- `sourceLeadId` (string, required): lead to merge into the target.
- `mergeNotes` (boolean, optional, default `false`): move notes from source to target.
- `desiredVehicleSource` ("target" | "source", optional, default `"target"`):
  which lead provides the desired vehicle.
- `primaryEmail` (string, email, required): primary email after merge.

## Response (200)

Returns the standard lead summary.

```json
{
  "id": "targetLeadId",
  "status": "FIRST_CONTACT",
  "partnerId": "partnerId",
  "leadCreatedAt": "2024-01-02T10:00:00.000Z",
  "assignedUser": { "id": "userId", "fullName": "Jan Kowalski", "email": "jan@example.com" },
  "partner": { "id": "partnerId", "name": "Partner Sp. z o.o." },
  "customerProfile": {
    "firstName": "Kamil",
    "lastName": "Tonkowicz",
    "email": "primary@example.com",
    "phone": "+48123123123"
  },
  "consentRecords": [],
  "applicationForm": null
}
```

## Errors

- `400` invalid payload, same source/target, missing primary email, partner mismatch, or missing customer profile.
- `401` unauthorized.
- `403` access denied.
- `404` lead not found.
- `409` operator blocked due to active client session.
