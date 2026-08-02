# AirYatra - Test Credentials

## Application Users

| Role | Email | Password | Notes |
|------|-------|----------|-------|
| Admin | admin@airyatra.com | Admin123! | Full platform access (TOTP 2FA enabled) |
| Operator | operator@airyatra.com | Operator@123456 | Fleet & booking management (OTP required) |
| Pilot | pilot@airyatra.com | Pilot@123 | Captain Rajesh Kumar (CPL-2024-0001), /pilot-portal access |
| Finance/CFO | finance@airyatra.com | Finance@123 | Finance Manager role, /finance access, Treasury ERP |

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
- Status: ✅ ACTIVE
- Flow: 
  1. User clicks "Google से Login करें"
  2. Redirect to https://auth.emergentagent.com/?redirect={callback}
  3. Google sign-in handled by Emergent
  4. Callback to /auth/google/callback#session_id=xxx
  5. Frontend exchanges session_id for user data
  6. Backend creates/updates user via POST /api/auth/google/emergent-callback
- Backend Endpoint: POST /api/auth/google/emergent-callback
- Settings Endpoint: GET /api/auth/google/settings
- Notes: 
  - Google users skip OTP/TOTP verification
  - New users get "customer" role by default
  - Profile picture synced from Google account

## Pending Integrations (Phase 9)

### WhatsApp API
- Provider: TBD
- API Key: TBD
- Status: DEFERRED to final phase

### Payment Gateway
- RazorpayX: TBD
- Cashfree: TBD
- Status: DEFERRED to final phase

---

*Last Updated: August 2, 2026*

## Test Finance User (No 2FA - API Testing)
| Role | Email | Password | Notes |
|------|-------|----------|-------|
| CFO | testfinance@airyatra.com | Test123! | Created for backend API testing. Login Shield may trigger OTP, use direct JWT token generation for testing. |

## Test Admin (No 2FA - API Testing, Aug 2, 2026)
| Role | Email | Password | Notes |
|------|-------|----------|-------|
| Admin | testadmin@airyatra.com | TestAdmin123! | Created for testing admin APIs without TOTP. otp_enabled=false, totp_enabled=false. Use for Document Vault, Compliance Dashboard testing. |

## Loyalty Test Customer (created Aug 1, 2026)
| Role | Email | Password | Notes |
|------|-------|----------|-------|
| Customer | loyaltytest@airyatra.com | Loyalty@123 | Has gold BLACK membership (1.5x multiplier), loyalty points, redeemed vouchers. Use for /customer/loyalty testing |

## HRMS Employee (created Aug 1, 2026)
| Role | Email | Password | Notes |
|------|-------|----------|-------|
| Employee | employee@airyatra.com | Employee@123 | EMP-0001 Rahul Verma, Operations dept, salary structure set (₹66,000 gross). Logs into /employee self-service portal (check-in, leave, payslips, expenses) |

## Stripe Test Payments (Aug 1, 2026)
- Customer with unpaid test inquiry: loyaltytest@airyatra.com / Loyalty@123 → inquiry `test-stripe-inquiry-1` (NOW PAID after iteration_16 E2E; seed a fresh unpaid inquiry for re-testing)
- Stripe TEST card: 4242 4242 4242 4242, exp 12/34, CVC 123
- Key: STRIPE_API_KEY=sk_test_emergent (backend/.env)

## Emergency Booking Test (Aug 2, 2026)
| Role | Email | Password | Notes |
|------|-------|----------|-------|
| Customer | emergencytest@airyatra.com | Emergency@123 | Created for Emergency Booking P0 testing. Use direct JWT token for API testing (OTP still triggers). |
