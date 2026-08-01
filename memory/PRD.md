# AirYatra - Product Requirements Document (PRD)
## World's First Aviation Super Ecosystem Platform

---

## 1. Vision Statement

**AirYatra** is not just software - it's **Aviation Infrastructure**. The platform aims to become the world's most comprehensive aviation ecosystem covering:

- B2C Services (Bookings, Membership, Travel)
- B2B Services (Operator SaaS, Cloud Platform)
- Aviation Marketplace (Exchange, Auctions, Fractional Ownership)
- AI Intelligence Layer (15+ AI modules)
- Future Mobility (eVTOL, Urban Air Mobility)
- Enterprise Services (API Marketplace, Digital Identity)

**Platform Scale Vision:**
- 100 Million Users
- 50,000 Operators
- 250,000 Aircraft
- 75+ Countries
- 100 Million+ Daily AI Requests

**Note:** Space Tourism moved to Vision 2045 (not in core roadmap) for realistic investor deck.

---

## 2. Target Users

| User Type | Description |
|-----------|-------------|
| **Customers** | HNIs, Corporates, Pilgrimage groups, Medical emergency cases |
| **Operators** | Helicopter/Charter operators, Fleet owners |
| **Investors** | Fractional aircraft ownership participants |
| **Corporates** | Large companies needing travel management |
| **Partners** | Hotels, Hospitals, Event planners, Travel agencies |
| **Pilots & Crew** | Freelance aviation professionals |
| **Admin** | AirYatra internal team |

---

## 3. Platform Architecture

### 3.1 Current Tech Stack
- **Frontend**: React.js + Shadcn UI + TailwindCSS
- **Backend**: FastAPI (Python) + MongoDB
- **Auth**: JWT + Google OAuth (Emergent-managed)
- **Email**: Hostinger SMTP (11 templates configured)
- **Performance**: High-performance middleware (50K+ users capacity)

### 3.2 Current Modules (COMPLETED)
| Module | Status | Description |
|--------|--------|-------------|
| Core Booking System | ✅ DONE | Multi-leg helicopter booking |
| Aviation-Grade Pricing Engine | ✅ DONE | Dynamic pricing with multipliers |
| Admin Dashboard | ✅ DONE | Complete admin controls |
| Operator Dashboard | ✅ DONE | Fleet & booking management |
| Customer Dashboard | ✅ DONE | Booking history, tracking |
| Email Notifications | ✅ DONE | 11 multi-templates (Admin/Operator/Customer) |
| Landing Infrastructure | ✅ DONE | Helipad management & charges |
| DGCA Compliance | ✅ DONE | Regulatory document management |
| Live Tracking | ✅ DONE | Real-time flight tracking |
| CRM System | ✅ DONE | Customer relationship management |
| HR Module | ✅ DONE | Employee management |
| Invoice & Billing | ✅ DONE | GST compliant invoicing |
| Maintenance Module | ✅ DONE | Aircraft maintenance tracking |
| SOS Emergency | ✅ DONE | Emergency alert system |
| Reviews & Feedback | ✅ DONE | Rating system |
| Loyalty Program | ✅ DONE | Points & rewards |
| Marketing Module | ✅ DONE | Campaign management |

---

## 4. Product Roadmap - Complete Feature List

### Legend:
- 🟢 **DONE** - Fully implemented
- 🟡 **IN PROGRESS** - Currently being built
- 🔵 **PLANNED** - Next in queue
- ⚪ **BACKLOG** - Future consideration
- 🔴 **DEFERRED** - Moved to end (WhatsApp, Payments)

---

## PHASE 1: CORE PLATFORM ENHANCEMENT (PREMIUM SERVICES)
**Timeline**: Completed - July 31, 2026
**Goal**: Strengthen existing platform with critical business features

| # | Feature | Priority | Status | Description |
|---|---------|----------|--------|-------------|
| 1.1 | AirYatra BLACK Membership | P0 | 🟢 DONE | Premium 4-tier membership (Silver/Gold/Platinum/BLACK) with up to 20% discount, priority booking, dedicated pilot, lounge access |
| 1.2 | Corporate Travel Console | P0 | 🟢 DONE | Complete corporate registration, employee management, budget controls, approval workflows, travel analytics |
| 1.3 | Smart Document Vault | P0 | 🟢 DONE | Secure encrypted storage for DGCA docs, insurance, licenses with expiry alerts, version control, secure sharing |
| 1.4 | Loyalty & Rewards Enhancement | P1 | 🔵 PLANNED | Advanced points system, tier benefits |
| 1.5 | Partner API Platform | P1 | 🔵 PLANNED | APIs for hotels, travel agencies, concierge |
| 1.6 | Multi-Language Engine | P1 | 🟢 DONE | 9 languages (EN + Hindi, Marathi, Tamil, Telugu, Bengali, Gujarati, Kannada, Punjabi) via react-i18next. Landing Page, FULL Booking Form (all steps, dropdowns, price breakdown, validation toasts), Global Navigation. Persists in localStorage (`airyatra_lang`) |

### Phase 1 Implementation Details:

**1.1 AirYatra BLACK Membership:**
- 4 Tiers: Silver (₹25,000), Gold (₹75,000), Platinum (₹2,00,000), BLACK (₹5,00,000) per year
- Benefits include: Discount (5-20%), Priority booking, Dedicated pilot, Lounge access, 24x7 concierge, Free cancellation
- Loyalty multiplier: 1.25x to 3x points
- Card number generation, upgrade flow, discount calculation API

**1.2 Corporate Travel Console:**
- Company registration with GST/CIN verification
- Employee management with roles (Admin/Manager/Approver/Booker/Traveler)
- Department-wise budget allocation (Monthly/Quarterly/Yearly)
- Booking approval workflow with auto-approval thresholds
- Travel policy configuration
- Corporate analytics and spend tracking

**1.3 Smart Document Vault:**- 10 document categories (DGCA, Insurance, Aircraft, Pilot, Corporate, Personal, Contract, Invoice, Other)
- 22+ document types with category-specific classification
- Expiry tracking with 30-day alerts
- Version control with full history
- Secure sharing with time-limited links
- Folder organization, bulk operations, and statistics

---

## PHASE 2: AVIATION MARKETPLACE & EXCHANGE
**Goal**: Create India's first aviation asset marketplace

| # | Feature | Priority | Status | Description |
|---|---------|----------|--------|-------------|
| 2.1 | AirYatra Aviation Exchange | P0 | ⚪ BACKLOG | Aircraft resale marketplace |
| 2.2 | Aircraft Auction Platform | P0 | ⚪ BACKLOG | Live/timed auctions for aircraft |
| 2.3 | Fractional Aircraft Ownership | P0 | ⚪ BACKLOG | Multiple investors in single aircraft |
| 2.4 | Aviation Finance Marketplace | P1 | ⚪ BACKLOG | Aircraft loans, leasing, EMI options |
| 2.5 | Investor Dashboard | P1 | ⚪ BACKLOG | ROI tracking, ownership management |

---

## PHASE 3: OPERATIONAL EXCELLENCE
**Goal**: Complete ERP solution for aviation operators

| # | Feature | Priority | Status | Description |
|---|---------|----------|--------|-------------|
| 3.1 | AirYatra OS (Operator SaaS) | P0 | ⚪ BACKLOG | Complete ERP for operators |
| 3.2 | Digital Flight Logbook | P0 | ⚪ BACKLOG | Automatic flight history tracking |
| 3.3 | Predictive Maintenance AI | P0 | ⚪ BACKLOG | AI-based maintenance alerts |
| 3.4 | Smart Hangar Management | P1 | ⚪ BACKLOG | Hangar scheduling, inventory |
| 3.5 | Route Intelligence Engine | P1 | ⚪ BACKLOG | Demand & profitability analytics |
| 3.6 | Digital Twin for Aircraft | P2 | ⚪ BACKLOG | AI-based health monitoring |

---

## PHASE 4: SPECIALIZED SERVICES
**Goal**: Niche high-value aviation services

| # | Feature | Priority | Status | Description |
|---|---------|----------|--------|-------------|
| 4.1 | Medical Organ Transport Network | P0 | ⚪ BACKLOG | Critical organ/patient transport |
| 4.2 | Emergency Operations Center | P0 | ⚪ BACKLOG | Air ambulance, disaster relief |
| 4.3 | International Charter Booking | P1 | ⚪ BACKLOG | Cross-border charter services |
| 4.4 | Flight Simulator & Training | P2 | ⚪ BACKLOG | Pilot training center bookings |

---

## PHASE 5: WORKFORCE & MARKETPLACE
**Goal**: Aviation talent and service marketplace

| # | Feature | Priority | Status | Description |
|---|---------|----------|--------|-------------|
| 5.1 | Crew Marketplace | P0 | ⚪ BACKLOG | Verified pilots, engineers, cabin crew |
| 5.2 | AI Flight Dispatcher | P0 | ⚪ BACKLOG | Intelligent flight scheduling |
| 5.3 | Autonomous Flight Readiness | P1 | ⚪ BACKLOG | Pre-flight checklist automation |
| 5.4 | Drone Services Marketplace | P2 | ⚪ BACKLOG | Survey, agriculture, inspection drones |

---

## PHASE 6: ANALYTICS & INTELLIGENCE
**Goal**: Data-driven decision making platform

| # | Feature | Priority | Status | Description |
|---|---------|----------|--------|-------------|
| 6.1 | Marketplace Analytics | P0 | ⚪ BACKLOG | Demand heatmaps, trends |
| 6.2 | Weather & Flight Risk Integration | P0 | ⚪ BACKLOG | Real-time weather, NOTAMs |
| 6.3 | Carbon Emission Dashboard | P1 | ⚪ BACKLOG | Sustainability reporting |
| 6.4 | Aviation Cyber Security Center | P2 | ⚪ BACKLOG | Security monitoring |

---

## PHASE 7: PLATFORM & ECOSYSTEM
**Goal**: Open platform for aviation industry

| # | Feature | Priority | Status | Description |
|---|---------|----------|--------|-------------|
| 7.1 | Open API Platform | P0 | ⚪ BACKLOG | Third-party integrations |
| 7.2 | AirYatra Cloud (SaaS) | P0 | ⚪ BACKLOG | White-label platform for operators |
| 7.3 | Global Aviation API Marketplace | P1 | ⚪ BACKLOG | API marketplace |
| 7.4 | Aviation Digital Identity | P2 | ⚪ BACKLOG | Verified aviation profiles |

---

## PHASE 8: FUTURE MOBILITY
**Goal**: Next-gen aviation services

| # | Feature | Priority | Status | Description |
|---|---------|----------|--------|-------------|
| 8.1 | eVTOL / Air Taxi Platform | P0 | ⚪ BACKLOG | Electric vertical takeoff booking |
| 8.2 | Urban Air Mobility Network | P0 | ⚪ BACKLOG | City-to-city air routes |
| 8.3 | Space Tourism Booking | P2 | ⚪ BACKLOG | Future vision - space flights |

---

## PHASE 9: INTEGRATIONS (FINAL PHASE)
**Goal**: Payment and communication integrations
**Note**: To be implemented AFTER all other phases as per user request

| # | Feature | Priority | Status | Description |
|---|---------|----------|--------|-------------|
| 9.1 | WhatsApp API Integration | P0 | 🔴 DEFERRED | "AirYatra" branded notifications |
| 9.2 | RazorpayX Integration | P0 | 🔴 DEFERRED | Payment gateway |
| 9.3 | Cashfree Integration | P0 | 🔴 DEFERRED | Alternative payment gateway |
| 9.4 | Direct Bank APIs | P1 | 🔴 DEFERRED | ICICI, IDFC, Axis integration |

---

## 5. Database Collections (Current)

| Collection | Purpose |
|------------|---------|
| users | All user accounts |
| operators | Operator profiles |
| bookings | Booking records |
| quotes | Quote requests |
| fleet | Aircraft inventory |
| documents | DGCA documents |
| invoices | Billing records |
| operator_pricing | Pricing configurations |
| dead_leg_pricing | Dead leg discounts |
| landing_points | Helipad infrastructure |
| notifications | Alert records |
| audit_logs | System audit trail |

---

## 6. API Structure (Current)

All APIs prefixed with `/api/`

| Category | Endpoints |
|----------|-----------|
| Auth | /auth/login, /auth/register, /auth/google |
| Booking | /bookings, /quotes, /multileg |
| Fleet | /fleet, /aircraft-documents |
| Pricing | /pricing/calculate, /operator/base-pricing |
| Admin | /admin/*, /admin-user/*, /admin-operator/* |
| Operations | /flight-records, /fuel-records, /maintenance |
| Finance | /invoices, /payments, /settlements |
| Compliance | /dgca-compliance, /documents |

---

## 7. Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@airyatra.com | Admin123! |
| Operator | operator@airyatra.com | Operator@123456 |
| SMTP | info@airyatra.co.in | Info123@@123 |

---

## 8. Key Decisions Log

| Date | Decision | Reason |
|------|----------|--------|
| Dec 2025 | WhatsApp & Payments deferred to FINAL phase | User preference to complete all features first |
| Dec 2025 | Phase-wise roadmap created | Systematic development approach |
| Dec 2025 | Space Tourism moved to Vision 2045 | Realistic investor deck |
| Dec 2025 | Master Blueprint v2.0 created | 55 modules documented |
| Dec 2025 | Digital Twin Sandbox added | User suggestion for enterprise confidence |

---

## 9. Master Blueprint Reference

**FINAL ROADMAP DOCUMENT:** `/app/memory/AIRYATRA_FINAL_ROADMAP.md`

**Complete Blueprint:** `/app/memory/AIRYATRA_MASTER_BLUEPRINT.md`

**Version:** 4.0 (CTO-Level, Unicorn Edition)

```
╔═══════════════════════════════════════════════════════════════════╗
║                    AIRYATRA FINAL SUMMARY                         ║
╠═══════════════════════════════════════════════════════════════════╣
║                                                                   ║
║   Total Modules:                84                                ║
║   AI Sub-modules:               15                                ║
║   HRMS Sub-modules:              8                                ║
║   ──────────────────────────────────                             ║
║   Total Components:            107+                               ║
║                                                                   ║
║   Foundation Completed:         15 modules ✅                     ║
║   Remaining to Build:           69 modules                        ║
║                                                                   ║
║   Implementation Phases:        10 (+ Final)                      ║
║   Languages:                    25+                               ║
║   Countries:                    50+                               ║
║   Revenue Streams:              40+                               ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
```

**Strategic Product Architecture:**
```
┌─────────────────────────────────────────────────────────┐
│     THREE PRODUCTS, ONE BACKEND                         │
├─────────────────────────────────────────────────────────┤
│  1. AirYatra Consumer (B2C) - For Customers            │
│  2. AirYatra Business (B2B) - For Partners             │
│  3. AirYatra OS Enterprise - For Aviation Companies    │
└─────────────────────────────────────────────────────────┘
```

**Global Expansion Roadmap:**
- Phase 1: India
- Phase 2: South Asia (Nepal, Bhutan, Sri Lanka, Bangladesh, Maldives)
- Phase 3: Middle East (Dubai, Saudi, Qatar, Oman)
- Phase 4: South-East Asia (Thailand, Malaysia, Indonesia, Vietnam, Singapore)
- Phase 5: Global (Europe, Africa, Australia, USA)

---

## 10. Next Immediate Actions

1. ✅ **Master Blueprint v2.0 approved**
2. **Start Phase 1**: Premium Services Layer
   - Module 16: VIP Membership (Black Card)
   - Module 17: Corporate Travel Console
   - Module 18: Digital Document Vault

---

*Document Version: 2.0*
*Last Updated: December 2025*
*AirYatra - World's First Aviation Super Ecosystem*
