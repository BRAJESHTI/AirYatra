# AirYatra - Test Credentials

## Application Users (Updated Aug 8, 2026)

| Role | Email | Password | Notes |
|------|-------|----------|-------|
| **CEO** | ceo@airyatra.co.in | CEO@123456 | Full executive access, CEO Dashboard, Board Reports |
| Admin | admin@airyatra.co.in | Admin123! | Full platform access (2FA DISABLED) |
| Operator | operator@airyatra.co.in | Operator@123456 | Fleet & booking management (2FA DISABLED) |
| Pilot | pilot@airyatra.co.in | Pilot@123 | Captain Rajesh Kumar (CPL-2024-0001), /pilot-portal access |
| Finance/CFO | finance@airyatra.co.in | Finance@123 | Finance Manager role, /finance access, Treasury ERP |
| Customer | customer@airyatra.com | Customer@123 | Demo customer account, login_shield_bypass enabled |
| HR | hr@airyatra.co.in | HR@123456 | Priya Sharma, HR Manager |
| Sales | sales@airyatra.co.in | Sales@123456 | Rahul Kapoor, Sales Manager |
| Employee | employee@airyatra.co.in | Employee@123 | EMP-0001, HRMS portal |

## 2FA/OTP Status: DISABLED (Aug 8, 2026)
All users can login directly without OTP verification.

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
curl -X POST "https://aviation-erp-2.preview.emergentagent.com/api/auth/dev/quick-admin-token" \
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
