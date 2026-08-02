# AirYatra - Test Credentials

## Application Users

| Role | Email | Password | Notes |
|------|-------|----------|-------|
| Admin | admin@airyatra.com | Admin123! | Full platform access |
| Operator | operator@airyatra.com | Operator@123456 | Fleet & booking management |
| Pilot | pilot@airyatra.com | Pilot@123 | Captain Rajesh Kumar (CPL-2024-0001), /pilot-portal access, 3 upcoming flights, medical expiring in 24 days |

## Third-Party Services

### Email (Gmail SMTP)
| Setting | Value |
|---------|-------|
| Host | smtp.gmail.com |
| Port | 587 (STARTTLS) |
| Email | airyatraadmin@gmail.com |
| Password | ianpkrkgtyokjlbw (App Password) |

### Google OAuth
- Managed by Emergent (No keys required)

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

*Last Updated: December 2025*

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
