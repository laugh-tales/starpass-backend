# API Reference

Base URL: `http://localhost:4000`

Interactive docs (Swagger): `http://localhost:4000/api/docs`

## Authentication

Most write endpoints require a JWT bearer token. Get one by completing the auth flow:

```bash
# 1. Get challenge
curl http://localhost:4000/auth/challenge?address=GYOUR_STELLAR_ADDRESS

# 2. Sign the challenge with your Stellar keypair (client-side)

# 3. Login
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"stellarAddress": "G...", "message": "...", "signature": "..."}'
```

Use the returned token as: `Authorization: Bearer <token>`

---

## Auth Endpoints

### GET /auth/challenge
Get a challenge message to sign with your Stellar keypair.

**Query params:** `address` (Stellar public key)

**Response:**
```json
{ "challenge": "StarPass authentication challenge for G... at 1716300000000" }
```

### POST /auth/login
Login with a signed Stellar challenge.

**Body:**
```json
{
  "stellarAddress": "GFAN...",
  "message": "StarPass authentication challenge for G... at 1716300000000",
  "signature": "base64-encoded-signature"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "user": { "id": "uuid", "stellarAddress": "G...", "role": "FAN" }
}
```

---

## Creator Endpoints

### GET /creators
List all creators with pagination.

**Query params:** `page` (default: 1), `limit` (default: 20)

### GET /creators/:address
Get creator profile by Stellar address. Includes active tiers.

### POST /creators/register 🔒
Register as a creator. Requires JWT.

**Body:**
```json
{
  "displayName": "My Creator Name",
  "bio": "Optional bio",
  "avatarUrl": "https://..."
}
```

### PATCH /creators/profile 🔒
Update your creator profile. Requires JWT.

### GET /creators/:address/earnings 🔒
Get creator earnings summary. Requires JWT.

### POST /creators/:id/blocks 🔒
Block a fan from purchasing passes from a creator. Requires JWT.

**Body:**
```json
{
  "fanAddress": "GFAN...",
  "reason": "Optional reason"
}
```

### DELETE /creators/:id/blocks/:fanAddress 🔒
Unblock a fan so they can purchase passes from a creator again. Requires JWT.

---

## Tier Endpoints

### GET /tiers/creator/:address
Get all active tiers for a creator.

**Response:**
```json
[
  {
    "id": "uuid",
    "onChainId": 1,
    "name": "Gold Member",
    "priceUsdc": "10.00",
    "durationDays": 30,
    "maxSupply": 0,
    "minted": 42,
    "active": true
  }
]
```

### GET /tiers/creator/:address/:onChainId
Get a specific tier by on-chain ID.

---

## Pass Endpoints

### GET /passes
List passes with optional filtering and pagination.

**Query params:**
- `fan` Stellar public key
- `tier_id` UUID
- `active` boolean
- `expired` boolean
- `page` default `1`
- `limit` default `20`, maximum `50`

**Response:**
```json
{
  "data": [],
  "total": 0,
  "page": 1,
  "limit": 20
}
```

### GET /passes/check/:fanAddress/tier/:tierId
Check if a fan has a valid pass for a specific tier.

**Response:**
```json
{ "valid": true }
```

### GET /passes/check/:fanAddress/creator/:creatorAddress
Check if a fan has any valid pass from a creator.

**Response:**
```json
{ "valid": false }
```

### GET /passes/fan/:address
Get all passes for a fan.

**Query params:** `activeOnly=true` to filter expired passes.

### GET /passes/creator/:address/count 🔒
Get pass count for a creator. Requires JWT.

**Response:**
```json
{ "total": 150, "active": 87 }
```

### GET /passes/:id/receipt 🔒
Get a purchase receipt for a pass. Requires JWT and only the pass owner can view it.

**Response:**
```json
{
  "pass": { "id": "uuid", "txHash": "transaction-hash" },
  "tier": { "id": "uuid", "priceUsdc": "10.00" },
  "creator": { "id": "uuid", "stellarAddress": "GCREATOR..." },
  "purchasedAt": "2026-01-01T00:00:00.000Z",
  "amount": "10.00",
  "txHash": "transaction-hash"
}
```

---

## Fan Endpoints

### GET /fans/:address
Get fan profile by Stellar address. Includes active passes.

### GET /fans/:address/subscriptions
Get all active subscriptions for a fan.

---

## Error Responses

| Status | Meaning |
|---|---|
| `400` | Bad request — invalid input |
| `401` | Unauthorized — missing or invalid JWT |
| `403` | Forbidden — valid JWT but insufficient permissions |
| `404` | Not found — resource does not exist |
| `409` | Conflict — resource already exists (e.g. creator already registered) |
| `500` | Internal server error |

All errors follow this format:
```json
{
  "statusCode": 404,
  "message": "Creator not found",
  "error": "Not Found"
}
```
