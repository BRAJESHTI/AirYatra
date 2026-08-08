# AirYatra Customer Booking Portal — Blueprint & Workflow Model
*(Generated Aug 2026 — reflects actual implemented system)*

## 1. Actors
- **Customer**: creates inquiry, compares quotes, pays
- **Operator**: quotes on inquiries (Accept/Reject/Revise)
- **Admin**: village landing approvals, refunds, disputes
- **System**: pricing engine, emails, price lock, status automation

## 2. Master Workflow
```
LOGIN → BOOKING WIZARD (4 Steps) → INQUIRY CREATED
  → OPERATORS NOTIFIED (500km radius, email + dashboard)
  → QUOTES RECEIVED → CUSTOMER ACCEPTS QUOTE
  → PASSENGER DETAILS + KYC
  → 50% ADVANCE PAYMENT (Stripe) → CONFIRMED
  → BALANCE PAYMENT → FLIGHT
  → INVOICE + RATING + LOYALTY POINTS
```

### Status Lifecycle
`pending_acceptance → quote_received → quote_accepted → passenger_details_filled → payment_pending → confirmed → completed`
Side paths: `cancelled` (→ refund flow), `rejected`

## 3. Booking Wizard (4 Steps)
### Step 1 — Service & Passengers
- 6 service categories with images + price multipliers:
  helicopter (1x), chartered_plane/Private Jet (1.5x), air_ambulance (1.8x),
  yacht_cruiser (1.2x), cargo (1.3x), joy_ride (0.8x)
- Male/Female adults + max 2 children
### Step 2 — Booking Type & Purpose
- 9 booking types (One Way, Round Trip -5-10%, Multi-City, Hourly, Daily,
  Multi-Day -10-15%, Group 5+, Emergency +surcharge, Event)
- Flight type (udan_prakar), Booking For, Purpose
### Step 3 — Route
- Landing point live search (/api/landing/public/search, 73 points)
- Village landing: PIN code + docs (Collector NOC, Fire, Police, SP/DCP) + admin approval
- Date/time, Haversine distance
### Step 4 — Price & Submit
- Breakup: base + per-km + multipliers + landing charges + 5% convenience + 2% insurance + GST
- Referral (10% first booking) / Promo / Wallet
- Price Lock timer, 5 mandatory legal consents → Submit Inquiry

## 4. Quote Model
1. Inquiry → operators within 500km emailed (with estimated earning)
2. Operator: Accept / Revise Quote / Reject
3. Customer compares quotes on inquiry status page → Accepts
4. accepted_quote locked → passenger details form

## 5. Payment Model (Stripe, server-side amounts)
- ADVANCE 50% → Stripe hosted checkout → confirmed
- BALANCE before flight
- Voucher/loyalty discounts at checkout; success page + PDF receipt
- Ledger: GET /api/payments/transactions/{id}

## 6. Post-Booking
My Trips, GST invoice PDF, refund requests (5-7 days), ratings, loyalty (Rs.100 = 1 pt), referral earnings

## 7. Data Model (airyatra_db)
inquiries, landing_points, payment_transactions, operator_inquiries,
refund_requests, loyalty_points, ratings

## 8. Key APIs (all /api prefixed)
- POST /bookings/inquiry (ALLOWED_SERVICE_TYPES validated)
- GET /landing/public/search?query=
- GET /bookings/inquiry/{id}/status
- POST /bookings/{id}/accept-quote
- POST /payments/stripe/checkout
- GET /customer/trips | /customer/booking-stats | /customer/refunds

## 9. Security
JWT + account lockout (5 attempts), OTP flag (LOGIN_OTP_ENABLED, currently off),
server-side pricing, consent audit trail

## 10. Status
DONE: wizard + 6 services, quotes, payments, invoices, refunds, ratings, referral/wallet, corporate portal
PENDING: Pre-flight checklist, live flight tracking, WhatsApp notifications, service landing pages
