# Paystack Webhook Server (Express + Firebase Admin)

## What it does
- Exposes `POST /api/paystack/webhook`
- Verifies Paystack webhook signature (`x-paystack-signature`)
- On successful payment events, activates the user plan in Firestore
- Uses `payments/{reference}` for idempotency

## Setup
1. Install deps:
```bash
cd server
npm install
```

2. Environment variables:
- `PAYSTACK_SECRET_KEY` (Paystack secret key)

Firebase Admin credentials (choose one):
- `FIREBASE_SERVICE_ACCOUNT_JSON` (JSON string of service account) **recommended**

Optional:
- `PORT` (default 3000)

## Run locally
```bash
cd server
npm start
```
Then point Paystack webhook URL to your HTTPS endpoint (e.g., via ngrok).

## Important notes
- Webhook endpoint must be reachable via HTTPS.
- Never activate plans in the frontend callback; Firestore updates happen only via webhook.
- Amount mapping is hardcoded in `server/index.js`:
  - 25000 => gold
  - 35000 => platinum
  - 40000 => platinum_star

## Idempotency
If the same Paystack `reference` is sent again, it will respond `Already processed`.

