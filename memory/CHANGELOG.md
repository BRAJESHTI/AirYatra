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
