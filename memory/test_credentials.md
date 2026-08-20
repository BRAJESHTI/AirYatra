# AirYatra - Test Credentials

## Application Users (Updated Aug 8, 2026)

| Role | Email | Password | Notes |
|------|-------|----------|-------|
| **CEO** | ceo@airyatra.co.in | CEO@123456 | Full executive access, CEO Dashboard, Board Reports |
| Admin | admin@airyatra.co.in | Admin123! | Full platform access (2FA DISABLED) |
| Operator | operator@airyatra.co.in | Operator@123456 | Fleet & booking management (2FA DISABLED) |
| Pilot | pilot@airyatra.co.in | Pilot@123 | Captain Rajesh Kumar (CPL-2024-0001), /pilot-portal access |
| Finance/CFO | finance@airyatra.co.in | Finance@123 | Finance Manager role, /finance access, Treasury ERP |
| Customer | customer@airyatra.co.in | Customer@123 | Demo customer account (.co.in, NOT .com) |
| **Corporate Admin** | corporate@airyatra.co.in | Corporate@123 | Rajesh Verma, CORP-DEMO26 "TechVista Solutions Pvt Ltd", /corporate dashboard |
| HR | hr@airyatra.co.in | HR@123456 | Priya Sharma, HR Manager |
| Sales | sales@airyatra.co.in | Sales@123456 | Rahul Kapoor, Sales Manager |
| Employee | employee@airyatra.co.in | Employee@123 | EMP-0001, HRMS portal |

## Emergency Recovery (June 2026) — for production when SMTP OTP unavailable
`ADMIN_RECOVERY_TOKEN` in backend/.env gates two endpoints (404 if env unset):
- POST /api/recovery/mint-otp {email} + header `X-Recovery-Token` → returns login OTP directly (staff only)
- POST /api/recovery/reset-password {email,new_password} + header `X-Recovery-Token` → resets staff password + clears lockout
Preview token: `9FLFzgJU1ih7jK-DopSezPnWgZbTRwW5hXbh76wwJhk`. PRODUCTION passwords for @airyatra.co.in accounts are UNKNOWN/different from preview (admin@ Admin123! fails on prod) — use recovery endpoints after deploying + adding ADMIN_RECOVERY_TOKEN env var to production.

## 2FA/OTP Status: ADMIN STEP-UP MFA ACTIVE (June 2026 — SEC-003)
Admin/privileged logins return `otp_required:true` (email OTP). For automated tests, mint OTP directly via backend OTPService (delete old `otp_codes` first to bypass 60s cooldown) then POST /api/auth/login/verify-otp — pattern in `/app/backend/tests/test_vertical_razorpay.py` `_mint_otp_and_verify()`. Customer/non-privileged users login directly without OTP.
**IMPORTANT**: backend/.env DB_NAME must stay `"airyatra_db"` (the `airyatra` DB is stale/empty — wrong DB caused destination search to return no suggestions).

## Additional Test Users

| Role | Email | Password | Notes |
|------|-------|----------|-------|
| Loyalty Test | loyaltytest@airyatra.co.in | Loyalty@123 | Gold BLACK membership |
| Emergency | emergencytest@airyatra.co.in | Emergency@123 | Emergency booking test |
| Test Admin | testadmin@airyatra.co.in | TestAdmin123! | Admin without 2FA |
| Test Finance | testfinance@airyatra.co.in | Test123! | Finance without 2FA |
| VRE Admin | vreadmin@airyatra.co.in | VREAdmin123! | Verification Rule Engine |

## Third-Party Services

### Email (Gmail SMTP)
| Setting | Value |
|---------|-------|
| Host | smtp.gmail.com |
| Port | 587 (STARTTLS) |
| Email | airyatraadmin@gmail.com |
| Password | ianpkrkgtyokjlbw (App Password) |

### Google OAuth (Emergent-Managed)
- Provider: Emergent Auth (auth.emergentagent.com)
- Integration Type: Managed OAuth (No API keys required)
- Status: ACTIVE
- Flow: 
  1. User clicks "Sign in with Google"
  2. Redirect to https://auth.emergentagent.com/?redirect={callback}
  3. Google sign-in handled by Emergent
  4. Callback to /auth/google/callback#session_id=xxx
  5. Frontend exchanges session_id for user data
  6. Backend creates/updates user via POST /api/auth/google/emergent-callback
- Backend Endpoint: POST /api/auth/google/emergent-callback
- Settings Endpoint: GET /api/auth/google/settings
- **SECURITY**: Backend ONLY accepts sessions verified by Emergent (200 OK). 404/invalid sessions are REJECTED.

## Quick Admin Login (DEV ONLY)
| Setting | Value |
|---------|-------|
| Endpoint | POST /api/auth/dev/quick-admin-token |
| Secret Key | airyatra-dev-quick-login-2026 |
| Status | ENABLED |

**Usage:**
```bash
curl -X POST "https://airyatra-corporate.preview.emergentagent.com/api/auth/dev/quick-admin-token" \
  -H "Content-Type: application/json" \
  -d '{"secret_key": "airyatra-dev-quick-login-2026"}'
```

## Stripe Test Payments
- Stripe TEST card: 4242 4242 4242 4242, exp 12/34, CVC 123
- Key: STRIPE_API_KEY=sk_test_emergent (backend/.env)

## Sandbox.co.in KYC API
| Setting | Value |
|---------|-------|
| API Key | key_live_07f61ca61046480a8702eb0c234b59db |
| API Secret | key_live_07f61ca61046480a8702eb0c234b59db |
| Base URL | https://api.sandbox.co.in |
| Status | ACTIVE (Sandbox test mode) |

---

*Last Updated: August 8, 2026*

## Note (June 2026): corporate@airyatra.co.in ab roles ['corporate','customer'] ke saath /corporate portal par land karta hai (TechVista Solutions CORP-DEMO26 linked).

## Vertical Business Lines (Added June 2026)
| yachtowner@airyatra.co.in | Yacht@123456 | Yacht Owner Dashboard (/yacht-owner) |
| cruiseop@airyatra.co.in | Cruise@123456 | Cruise Operator Dashboard (/cruise-operator) |
| helipadowner@airyatra.co.in | Helipad@123456 | Helipad Owner Dashboard (/helipad-owner) |

## ⚠️ SEC-003 UPDATE (June 2026) — Login OTP now ENFORCED for privileged roles
- `LOGIN_OTP_ENABLED=true` (production). Per-user backdoor (`login_shield_bypass`, `otp_enabled=false`) CLEARED for all privileged accounts (admin, super_admin, ceo, operator, finance, cfo, finance_head, accounts_manager, treasury_analyst).
- **Privileged logins (admin@, finance@, operator@, ceo@, etc.) now require an emailed 6-digit OTP.** Login flow: POST /api/auth/login → {otp_required:true, otp_sent:true} → OTP emailed → POST /api/auth/login/verify-otp {email, otp_code} → JWT. Use "Trust this device for 30 days" to skip OTP on the same device for 30 days.
- **Customer / non-privileged accounts** (customer@airyatra.co.in etc.) still log in directly (token in login response) — no OTP unless risk/new-device triggers it.
- AUTOMATED TESTING NOTE: OTP is SHA256-hashed in db.otp_codes (plaintext not recoverable). To test privileged flows programmatically, mint a known OTP server-side via services.otp_service.OTPService().create_otp(user_id, email, purpose='login') then call /login/verify-otp. Alternatively use a customer account (no OTP).

## Hostinger Email Era (Aug 17, 2026) — PREVIEW passwords updated
SMTP: smtp.hostinger.com:465 SSL, sender noreply@airyatra.co.in / Nor@Air123 (SMTP_SSL=true in backend/.env)
| Account | Password | Roles | Login OTP? |
|---|---|---|---|
| ceo@airyatra.co.in | Ceo@Air123 | ceo,admin,super_admin | YES |
| admin@airyatra.co.in | Adm@Air123 | admin | YES |
| finance@airyatra.co.in | Fin@Air123 | finance,cfo | YES |
| hr@airyatra.co.in | Hr@Air123 | hr,admin | YES |
| booking@airyatra.co.in | Boo@Air123 | booking (new) | YES |
| noreply@airyatra.co.in | Nor@Air123 | support (mailbox+app) | YES |
| sales@airyatra.co.in | Sal@Air123 | sales,admin | YES |
| dr.brajeshptiwari@gmail.com | Customer@123 | customer (real test user) | NO (exempt) |
OTP EXEMPT roles (never login OTP, even new device/location): customer, pilot, operator, vendor, yacht_owner, cruise_operator, helipad_owner. Employees (admin/ceo/finance/hr/sales/booking/support/cfo) always OTP.
Forgot-password OTP: works for all (rate limit 5/min per IP).
NOTE: PRODUCTION DB has @airyatra.com accounts — after redeploy use /api/recovery endpoints to set these passwords on prod.

## Recovery Seed Tool (Aug 18, 2026)
- One-shot fix for all 7 employee accounts (create/reset, idempotent):
  GET {BASE_URL}/api/recovery/seed-employees?token={ADMIN_RECOVERY_TOKEN}
  (or POST with X-Recovery-Token header). Works on any env where ADMIN_RECOVERY_TOKEN is set.
