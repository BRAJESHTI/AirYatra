# AirYatra - Product Requirements Document (PRD)
## India's First Complete Aviation Ecosystem Platform

---

## 1. Vision Statement

**AirYatra** aims to become India's most comprehensive aviation platform - not just a helicopter booking service, but a complete **Aviation Ecosystem** covering:
- Charter & Booking Services
- Aircraft Ownership & Investment
- Aviation Operations Management
- B2B Aviation Services
- Future Mobility (eVTOL, Urban Air Mobility)

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

## PHASE 1: CORE PLATFORM ENHANCEMENT
**Timeline**: Current Phase
**Goal**: Strengthen existing platform with critical business features

| # | Feature | Priority | Status | Description |
|---|---------|----------|--------|-------------|
| 1.1 | VIP Membership (Black Card) | P0 | 🔵 PLANNED | Premium membership tiers with exclusive benefits |
| 1.2 | Corporate Travel Console | P0 | 🔵 PLANNED | Centralized booking for corporate travel managers |
| 1.3 | Digital Document Vault | P0 | 🔵 PLANNED | Secure storage for DGCA docs, insurance, permits |
| 1.4 | Loyalty & Rewards Enhancement | P1 | 🔵 PLANNED | Advanced points system, tier benefits |
| 1.5 | Partner API Platform | P1 | 🔵 PLANNED | APIs for hotels, travel agencies, concierge |

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

---

## 9. Next Immediate Actions

1. **Review and approve this roadmap document**
2. **Start Phase 1.1**: VIP Membership (Black Card) implementation
3. **Parallel**: Corporate Travel Console design

---

*Document Version: 1.0*
*Last Updated: December 2025*
*Maintained by: AirYatra Development Team*
