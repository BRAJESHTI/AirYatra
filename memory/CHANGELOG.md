# AirYatra - Changelog
## Development History & Updates

---

## July 2026

### Week 5 - Phase 1: Premium Services COMPLETED

#### 🚀 AirYatra BLACK Membership (COMPLETED)
- 4-tier premium membership system (Silver/Gold/Platinum/BLACK)
- Pricing: ₹25,000 / ₹75,000 / ₹2,00,000 / ₹5,00,000 annual
- Benefits: Discounts (5-20%), Priority booking, Dedicated pilot, Lounge access
- Loyalty multipliers: 1.25x to 3x points
- Card number generation with tier prefix (AY-SLV/GLD/PLT/BLK)
- Upgrade flow with prorated pricing
- Discount calculation API integration

**Files Created:**
- `/app/backend/routes/membership_routes.py`
- `/app/frontend/src/pages/MembershipPage.js`

**APIs:**
- GET `/api/membership/tiers` - All tier details
- GET `/api/membership/tier/{tier}` - Specific tier
- POST `/api/membership/subscribe` - New subscription
- POST `/api/membership/upgrade` - Tier upgrade
- GET `/api/membership/calculate-discount` - Booking discount
- GET `/api/membership/my-membership/{user_id}` - User membership

#### 🚀 Corporate Travel Console (COMPLETED)
- Company registration with GST/CIN verification
- Employee management with 5 roles (Admin/Manager/Approver/Booker/Traveler)
- Department-wise budget allocation (Monthly/Quarterly/Yearly)
- Booking approval workflow with auto-approval thresholds
- Travel policy configuration
- Corporate analytics and spend tracking
- Credit limit management

**Files Created:**
- `/app/backend/routes/corporate_routes.py`
- `/app/frontend/src/pages/CorporateDashboard.js`

**APIs:**
- POST `/api/corporate/register` - Register company
- GET `/api/corporate/account/{corporate_id}` - Account details
- POST `/api/corporate/employee/add` - Add employee
- GET `/api/corporate/employees/{corporate_id}` - List employees
- POST `/api/corporate/budget/department` - Set budget
- POST `/api/corporate/booking/request-approval` - Approval workflow
- GET `/api/corporate/analytics/{corporate_id}` - Travel analytics

#### 🚀 Smart Document Vault (COMPLETED)
- 10 document categories (DGCA, Insurance, Aircraft, Pilot, etc.)
- 22+ document types with category-specific classification
- File upload with metadata storage
- Expiry tracking with 30-day alerts
- Version control with full history
- Secure sharing with time-limited links
- Folder organization
- Bulk operations (archive, delete, move, tag)
- Statistics dashboard

**Files Created:**
- `/app/backend/routes/document_vault_routes.py`
- `/app/frontend/src/pages/DocumentVault.js`

**APIs:**
- POST `/api/vault/upload` - Upload document
- GET `/api/vault/documents/{owner_id}` - List documents
- GET `/api/vault/document/{document_id}` - Document details
- POST `/api/vault/share` - Share document
- GET `/api/vault/expiring/{owner_id}` - Expiring documents
- GET `/api/vault/statistics/{owner_id}` - Vault stats

#### 🐛 Bug Fixes
- Fixed DocumentStatus → DocumentVaultStatus enum reference
- Fixed ApprovalStatus → CorporateApprovalStatus enum reference
- Fixed MongoDB ObjectId serialization in corporate/employee responses
- All Phase 1 APIs passing 14/14 backend tests

---

## December 2025

### Week 4 - Roadmap & Planning

#### 📋 Documentation Created
- **PRD.md** - Complete Product Requirements Document
- **ROADMAP.md** - Full 9-Phase development roadmap
- **CHANGELOG.md** - This file

#### 🗺️ Roadmap Finalized
- 9 Phases defined
- 45+ features catalogued
- WhatsApp & Payment integrations deferred to Phase 9 (as per user request)

---

### Week 3 - Email System & Pricing Engine

#### ✅ Aviation-Grade Pricing Engine (COMPLETED)
- Dynamic pricing calculations
- Multi-leg support
- Dead-leg discounting
- Night halt calculations
- Landing infrastructure charges
- Operator-specific pricing configs

**Files Created/Modified:**
- `/app/backend/routes/pricing_engine_routes.py`
- `/app/backend/services/pricing_engine.py`
- `/app/backend/pricing_models.py`
- `/app/frontend/src/components/admin/AdminPricingControls.js`
- `/app/frontend/src/components/operator/OperatorPricingConfig.js`
- `/app/frontend/src/pages/BookingPage.js`

#### ✅ Email Notification System (COMPLETED)
- Hostinger SMTP integration
- 11 email templates created:
  1. Admin - New Inquiry Alert
  2. Admin - Booking Confirmation
  3. Admin - Payment Received
  4. Operator - New Inquiry
  5. Operator - Booking Assigned
  6. Operator - Flight Reminder
  7. Customer - Inquiry Received
  8. Customer - Quote Ready
  9. Customer - Booking Confirmed
  10. Customer - Flight Reminder
  11. Customer - Post-Flight Feedback

**Files Created:**
- `/app/backend/services/email_service.py`
- `/app/backend/routes/email_routes.py`

**Configuration:**
- SMTP Host: smtp.hostinger.com
- Email: info@airyatra.co.in

---

### Week 2 - Core Platform

#### ✅ Features Completed
- Multi-leg booking system
- Live flight tracking
- DGCA compliance module
- Operator dashboard
- Customer dashboard
- Admin dashboard
- CRM system
- HR module
- Invoice & billing
- Maintenance tracking
- SOS emergency system
- Reviews & feedback
- Loyalty program basics
- Marketing module

---

### Week 1 - Foundation

#### ✅ Initial Setup
- FastAPI backend setup
- React frontend setup
- MongoDB database
- Authentication (JWT + Google OAuth)
- High-performance middleware (50K+ users)
- Basic booking flow

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Completed |
| 🔄 | In Progress |
| ⏳ | Pending |
| 🐛 | Bug Fix |
| 🚀 | New Feature |
| 📋 | Documentation |
| ⚠️ | Breaking Change |

---

## Upcoming Changes

### Phase 1 (Remaining)
- [ ] Enhanced Loyalty Program
- [ ] Partner API Platform

### Phase 2 (Aviation Marketplace)
- [ ] Aviation Exchange
- [ ] Fractional Ownership
- [ ] Aircraft Auctions

---

*Last Updated: July 31, 2026*

## July 31, 2026 - Multi-Language Engine (Phase 1, P1)
- Added i18n scaffolding: `react-i18next` + `i18next-browser-languagedetector`
- 9 languages: English (default), Hindi, Marathi, Tamil, Telugu, Bengali, Gujarati, Kannada, Punjabi
- Files: `/app/frontend/src/i18n/index.js` (LANGUAGES export + init), `/app/frontend/src/i18n/locales/{en,hi,mr,ta,te,bn,gu,kn,pa}.js`
- New component: `/app/frontend/src/components/shared/LanguageSwitcher.js` (Globe dropdown, data-testid="language-switcher-btn", lang-option-{code})
- Applied to: LandingPage (fully translated), GlobalNav (Back/Home + switcher), BookingPage chrome (title, subtitle, step titles, Prev/Next, login prompt)
- Language persists in localStorage key `airyatra_lang`, auto-detects browser language
- NOTE: Deep booking form field labels still bilingual EN/HI inline (pending migration to i18n keys)
- Verified via screenshots: EN→HI→TA switch on landing, persistence to /booking, PA on booking page

## August 1, 2026 - Booking Form Full Translation (Multi-Language Phase 2)
- Migrated ENTIRE BookingPage form to i18n: all 4 steps, dropdown OPTIONS, price breakdown, booking summary, validation toasts, village landing warnings
- Added `bookingForm` (~100 keys) + `options` (22 keys) namespaces to all 9 locale files
- bookingConfig.js option labels now rendered via t(`options.${value}`) in BookingPage (config file untouched for backward compat)
- FIXED: file corruption at BookingPage.js end (duplicate export lines from misapplied edit) causing webpack parse error
- Tested: iteration_5.json - 16/16 passed (100%) - languages, persistence, dropdowns, toasts, mid-form switch state retention
- KNOWN SCOPE LIMIT: LandingPointSelector internal search UI strings still bilingual EN/HI (deliberate, pending future migration)

## August 1, 2026 - Loyalty Rewards Upgrade (P1 - 1.4)
- Backend (loyalty_routes.py): LOYALTY_TIER_MULTIPLIERS (bronze 1x, silver 1.25x, gold 1.5x, platinum 2x), effective multiplier = max(loyalty tier, active BLACK membership multiplier up to 3x)
- award_booking_points() helper: 1 pt per ₹100 spent × multiplier, idempotent per booking (points_history reference_id check), auto tier upgrade
- Hooked into journey completion (journey_routes.py complete-journey) - points auto-awarded on every completed flight
- New endpoints: GET /loyalty/rewards (seeded 7-item catalog, can_redeem/tier_locked flags), POST /loyalty/rewards/{id}/redeem (voucher RWD-XXXX, expiry), GET /loyalty/my-redemptions, POST /loyalty/earn/{booking_id} (manual/idempotent), POST /loyalty/admin/rewards (upsert)
- /loyalty/my-status now returns "earning" block (rate, multipliers, membership boost)
- Frontend: components/customer/LoyaltyRewards.js rendered at /customer/loyalty (CustomerDashboard 'loyalty' tab + App.js route + URL sync fix)
- Tested via curl (earn 1x & 1.5x membership multiplier, idempotency, tier-lock 403, redeem, deduction) + screenshots (UI, redeem dialog, voucher code toast, points 3500→2750)
- Test customer: loyaltytest@airyatra.com / Loyalty@123 (has gold membership + vouchers seeded)

## August 1, 2026 - Voucher At Checkout
- Backend: POST /loyalty/vouchers/validate (ownership, active, not expired, monetary value check) + validate_voucher_for_user() helper
- payment_routes.py: create-order accepts voucher_code -> validates, applies discount (min(value, amount)), stores original_amount/voucher_discount in payment_orders; verify marks voucher status=used with used_for_booking
- Frontend: PaymentPage.js (live flow at /customer/payment/:inquiryId) + PaymentCheckout.js both have voucher section: code input + Apply, "Your active vouchers" quick-pick chips, applied voucher card with remove, struck-through original + discounted payable, Pay button shows final amount
- E2E tested: curl (validate/invalid/order discount 50000->49500/verify/re-validate fails "already used") + full UI flow (chip apply ₹20,000->₹18,000, mock pay, booking confirmed, voucher marked used in DB)

## August 1, 2026 - Welcome Bonus Points
- auth_routes.py register: new customers get 500 welcome points (loyalty_profiles created + points_history "Welcome bonus" entry). Non-customer roles skipped.
- Tested via curl: new registration -> 500 points, bronze tier, history entry visible
