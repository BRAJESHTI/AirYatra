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

### Recent Additions (Aug 1, 2026)
| Feature | Status | Notes |
|---------|--------|-------|
| Full HRMS Suite (Phase 3) | 🟢 DONE | (Aug 1, 2026) Complete HRMS: (1) **Employee Management** — new `employee` UserRole, Admin/HR creates staff accounts w/ salary structure via HR Dashboard → Employees → All Employees (EmployeeManagement.js), auto EMP-xxxx codes, activate/deactivate, set-salary dialog. Backend: hr_employee_routes.py (POST/GET/PUT /api/hr/employees). (2) **Employee Self-Service Portal** at /employee (EmployeePortal.js, sky-blue theme) — Overview KPIs, geolocation Check-in/Check-out, monthly attendance table, Leave apply + balance + history, Payslip viewer w/ branded PDF download (reportlab, GET /api/hr/payroll/{id}/payslip.pdf), Expense claims (create→receipt upload→auto-submit, status tracking). (3) **Payroll** — existing generate flow + payslip PDF buttons in admin AttendancePayroll; FIXED regenerate bug (insert_one ObjectId mutation + id overwrite in hr_routes.py). Test employee: employee@airyatra.com / Employee@123 (EMP-0001). Tested: iteration_12, 100% pass |
| Leave Email Alerts | 🟢 DONE | (Aug 1, 2026) HR/Admin users emailed on new leave application; employee emailed on approve ✅ / reject ❌ (with reason). BackgroundTasks + Hostinger SMTP, branded HTML template (_leave_email_html in hr_routes.py). HR role can now also approve/reject leaves. Tested: iteration_13 |
| Attendance Selfie | 🟢 DONE | (Aug 1, 2026) Check-in now requires camera selfie (capture="user" dialog in EmpAttendance.js) → POST /api/hr/attendance/{id}/selfie → stored at /app/uploads/attendance_selfies (served via /api/uploads static). Selfie thumbnails in employee monthly table + admin Attendance report 'Selfies' column (hover-zoom, opens full image). Owner-only upload (404 otherwise). Tested: iteration_13 |
| Payroll Auto-Run | 🟢 DONE | (Aug 1, 2026) apscheduler job `monthly_payroll_run` (12h interval): on 1st of month generates previous month's payroll drafts + emails HR summary (count + total net). Period guard in db.hr_settings (type=payroll_auto_run). Admin toggle + last-run status card in AttendancePayroll Payroll tab (GET/POST /api/hr/payroll-auto-run). Manual Generate Payroll unchanged. First run logged: July 2026. Tested: iteration_13 |
| Team Attendance View | 🟢 DONE | (Aug 1, 2026) Live team view: HR Dashboard → Dashboard → Today Attendance (TeamAttendanceToday.js) — In Office / Checked Out / On Leave / Missing count cards (click to filter), staff table w/ check-in/out times, selfie thumbnails, leave type, 30s auto-refresh, holiday banner. Backend: GET /api/hr/attendance/today. Tested: iteration_14 |
| Expense Payout Emails | 🟢 DONE | (Aug 1, 2026) Employee emailed on: expense fully APPROVED ✅ (after hr→finance→admin chain), REJECTED ❌ (with reason + stage), and REIMBURSED 💰 (add-to-salary, with period). BackgroundTasks + branded HTML (_send_expense_email in hr_advanced_routes.py). Tested: iteration_14 |
| Holiday Calendar | 🟢 DONE | (Aug 1, 2026) Company holidays CRUD (db.company_holidays): admin UI at HR Dashboard → Payroll → Holiday Calendar (HolidayCalendar.js, add/delete, year filter, duplicate-date guard). Payroll counts holidays as paid days (holiday_days credit in generate_payroll, skips days w/ existing attendance). Employee portal shows upcoming-holidays chips + today-holiday banner. Endpoints: GET(all users)/POST/DELETE(HR-admin) /api/hr/holidays. Seeded: Independence Day 15 Aug, Diwali 20 Oct 2026. Tested: iteration_14 |
| Attendance Monthly Export | 🟢 DONE | (Aug 1, 2026) One-click CSV (Excel-compatible, UTF-8 BOM) export: GET /api/hr/attendance/export?month&year (HR/admin) — flat records + per-employee SUMMARY + HOLIDAYS sections. Button in AttendancePayroll Attendance tab (export-attendance-btn). Tested: iteration_15 |
| Missing Staff Nudge | 🟢 DONE | (Aug 1, 2026) Scheduler job `attendance_nudge` (15-min interval): after 11 AM IST (11:00-14:00 window), emails staff who haven't checked in (skips Sundays, holidays, on-leave, already-checked-in). Once/day guard in hr_settings (type=attendance_nudge). Self-tested with mocked time: 7/7 emails sent |
| Employee Directory | 🟢 DONE | (Aug 1, 2026) Employee Portal → Directory tab (EmpDirectory.js): searchable staff cards (name/dept/designation/email search), profile photos w/ initials fallback, self photo upload (POST /api/hr/employee/photo → /api/uploads/profile_photos). GET /api/hr/directory (staff-only, customers 403). Tested: iteration_15 |
| Operator ERP Command Center | 🟢 DONE | (Aug 1, 2026) /operator/erp (OperatorERP.js + operator_erp_routes.py prefix /erp/operator): Digital Flight Logbook + Maintenance Alerts ek jagah. KPIs (fleet, flights, hours, revenue, open maint, critical alerts), severity alerts (OVERDUE/HOURS DUE/DUE SOON/APPROACHING — 100h interval rule via aircraft.last_maintenance_hours), fleet health bars, logbook table w/ pilot names + aircraft filter, Add Flight Log dialog, Schedule Maintenance dialog, Mark Complete (resets hours counter). ADVANCED (same day): GET /analytics — 6-month utilization trend chart, fuel efficiency L/hr per aircraft, pilot duty hours w/ DGCA FDTL badges (OK/WATCH/OVER 100h), maintenance spend YTD vs upcoming, revenue from accepted quotes; GET /logbook/export CSV (DGCA audit). Demo fleet seeded for operator@airyatra.com (H125 VT-AYR, Bell 407 VT-AYB, 2 pilots, ~79 flight records Mar-Aug). Tested: iteration_15 (core) + self-tested analytics/export |
| Aircraft Document Expiry | 🟢 DONE | (Aug 1, 2026) Compliance doc registry (insurance/c_of_a/permit/arc/radio_license) in db.aircraft_documents via ERP: GET/POST/DELETE /api/erp/operator/documents (ownership guarded). ERP overview alerts add doc_expired (critical) + doc_expiring (≤45 days). UI: Compliance Docs panel w/ days-left badges + add/delete dialogs. Demo: insurance 24d left, expired C of A. Self-tested curl + UI |
| Fuel Price Tracking | 🟢 DONE | (Aug 1, 2026) Reuses db.fuel_records (POST /api/fuel-records/ w/ cost_per_liter): GET /api/erp/operator/fuel — this-month spend ₹/liters/avg rate, 6-month spend trend, recent purchases. ERP UI: Fuel Purchases panel + Log Purchase dialog (live total calc). Self-tested |
| ERP Weekly Digest | 🟢 DONE | (Aug 1, 2026) Scheduler job `erp_weekly_digest` (6h interval): Monday ≥8AM IST, once/week guard (hr_settings type=erp_weekly_digest) — emails each operator: last-7-day flights/hours, overdue maint, 100h+ aircraft, doc expiry count, upcoming maintenance list. Self-tested w/ mocked Monday: 4 operators emailed; guard reset for real Monday |
| Stripe Payments (TEST MODE) | 🟢 DONE | (Aug 1, 2026) FINAL PHASE part 1. Real payment gateway replacing mock Razorpay: stripe_payment_routes.py via emergentintegrations (STRIPE_API_KEY=sk_test_emergent in backend/.env — India not supported by claimable sandboxes, so shared test key; user will switch to own Razorpay/Cashfree keys for live). Flow: PaymentPage → POST /api/payments/stripe/checkout (SERVER-side amount = advance% of accepted quote, voucher discount support) → Stripe hosted checkout (INR) → /payment/success polling page (PaymentSuccessPage.js) → idempotent _mark_paid_if_needed → inquiry/booking payment_status=paid + status=confirmed + voucher marked used + confirmation email. Also /api/webhook/stripe. Old mock /payments/create-order routes still exist but unused by frontend. E2E tested with test card 4242: iteration_16, 100% pass |
| WhatsApp Alerts | 🟡 PENDING USER CREDS | User must provide Twilio Account SID + Auth Token + WhatsApp sandbox number (twilio.com console) OR Meta Cloud API tokens. Do NOT implement without keys |
| Remaining Balance Pay + PDF Receipts | 🟢 DONE | (Aug 1, 2026) Balance flow: payment_type=advance/balance in POST /api/payments/stripe/checkout — balance amount = total − credited (voucher discount credited as paid value via _payment_ledger). On balance paid → booking payment_status=fully_paid + balance_paid_at. GET /api/payments/transactions/{booking_id} ledger (owner/admin). GET /api/payments/receipt/{session_id} → branded reportlab PDF receipt (owner/admin, paid only). UI: InquiryStatus 'Payments & Receipts' section (txn list + Receipt PDF buttons + Pay Remaining ₹X button / Fully Paid badge), PaymentPage ?type=balance mode (voucher hidden), PaymentSuccessPage Download Receipt button. Self-tested via curl + screenshot (NO testing agent — user credit concern): ledger 50k/25k/25k → balance session → fully_paid, both receipts %PDF 200, re-pay guards |
| Admin Payments Dashboard | 🟢 DONE | (Aug 1, 2026) Admin → Finance & Billing → Payments Dashboard: KPIs (today/week/month/all-time collections + pending balances count & total), 7-day bar chart trend (recharts), Pending Balances tab (bookings with advance paid but 50% remaining with customer details), Recent Transactions tab with customer/route enrichment. Backend: GET /api/admin/payments/dashboard (admin only). UI: AdminPaymentsDashboard.js with color-coded gradient KPI cards (green/blue/purple/orange), Stripe Test Mode badge |
| Receipt PDF Email Attachment | 🟢 DONE | (Aug 1, 2026) Automatic email with PDF receipt attachment sent on EVERY successful payment (advance & balance). email_service.send_payment_receipt_with_pdf() generates branded HTML email + attaches the reportlab PDF receipt. Triggered in _apply_payment_success() for both payment types. Email includes: receipt summary, route, booking ref, amount, gateway badge, and CTA to View Bookings |
| Quick Payment Link | 🟢 DONE | (Aug 1, 2026) Admin can generate shareable payment links for balance collection. POST /api/admin/payments/generate-payment-link/{booking_id} → returns payment_url, whatsapp_url with pre-formatted Hinglish message, token (7-day expiry). UI: Link2 icon in Pending Balances → Dialog with amount, payment URL, WhatsApp message, Share via WhatsApp button. Stores in payment_links collection |
| Balance Reminder Emails | 🟢 DONE | (Aug 1, 2026) Admin can send nudge email to customers with pending balances. POST /api/admin/payments/send-balance-reminder/{booking_id} → branded HTML email with amount due, booking details, departure date, Pay Now CTA. Logs in balance_reminders collection. UI: Mail icon button in Pending Balances table |
| Payment Analytics Export | 🟢 DONE | (Aug 1, 2026) CSV export for accounts team. GET /api/admin/payments/export/csv?report_type=[transactions|daily_summary|pending_balances]. Returns Excel-compatible CSV with BOM. Transactions: all paid txns with customer/route enrichment. Daily Summary: date-wise advance/balance breakdown with totals. Pending Balances: customers with 50% due including contact info. UI: Export CSV dropdown in header |
| Auto Balance Reminders | 🟢 DONE | (Aug 1, 2026) Automated scheduler job runs twice daily (every 12 hours) to send reminder emails to customers with pending balances when departure is 1-3 days away. Sends max 1 reminder per booking (auto_balance_reminder_sent flag). Email includes: countdown days, booking details, total/paid/remaining amounts, Pay Now CTA, urgency styling for ≤1 day. Job: send_auto_balance_reminders in scheduler.py |
| Payment Link Landing Page | 🟢 DONE | (Aug 1, 2026) Public /pay/{token} page for customers to pay balance without login. GET /api/payments/link/{token} verifies token, returns booking details + remaining balance. POST /api/payments/link/{token}/checkout creates Stripe session. Frontend: PaymentLinkPage.js with AirYatra branding, booking summary, payment breakdown, Pay button, error states (expired/invalid/already-paid). Fully mobile responsive, secure SSL badge |
| Customer Payment History | 🟢 DONE | (Aug 1, 2026) Customer Portal → Rewards & Offers → Payment History. Shows: Total Paid (green), Pending Balance (orange), Total Receipts (blue) KPI cards. Per-booking grouped view with route, departure date, total amount, payment status (Fully Paid badge or pending amount). Transaction table: date, type (Advance/Balance), amount, status, PDF download button. Component: CustomerPaymentHistory.js. Route: /customer/payments |
| Payment Link QR Code | 🟢 DONE | (Aug 1, 2026) Admin can generate/download/print QR codes for payment links. GET /api/admin/payments/payment-link-qr/{token} returns PNG image with orange QR code. UI: QR Code button in Payment Link dialog → QR Code Dialog with image, URL, Print QR button (opens print-friendly page), Download button. Uses qrcode Python library with ERROR_CORRECT_H |
| Payment Success Animation | 🟢 DONE | (Aug 1, 2026) Confetti celebration on payment success using canvas-confetti library. Multi-burst animation: center burst (100 particles), left side burst, right side burst, star shapes from top. Colors: orange, green, gold, blue, purple. Glowing success icon with pulse animations, sparkle icons, bounce animation on checkmark. Triggers automatically when payment_status becomes 'paid' |
| Booking Calendar View | 🟢 DONE | (Aug 1, 2026) Admin → Bookings & Flights → Flight Calendar. Interactive calendar showing all flights with payment status via colored dots. Legend: Green (Fully Paid), Blue (Advance Paid), Orange (Payment Pending). Click date to see bookings. Filter tabs: All/Paid/Pending. Right panel shows selected date bookings with route, customer, amount, payment badge. API: GET /api/admin/payments/calendar-bookings with date range support |
| Calendar Export (iCal) | 🟢 DONE | (Aug 1, 2026) Export flights to iCal/ICS format for Google Calendar, Outlook, Apple Calendar. GET /api/admin/payments/calendar-export with date range. Generates valid ICS file with VEVENTs per flight: payment emoji status (✅💳⏳), route, customer, amount in SUMMARY. 2-hour event duration. Download button "Export iCal" in Flight Calendar header |
| Bulk Payment Reminders | 🟢 DONE | (Aug 1, 2026) Send reminder emails to ALL customers with pending balances at once. POST /api/admin/payments/bulk-reminders runs in background, sends branded email with booking details, Pay Now CTA. Logs to bulk_reminders collection. Button "Bulk Reminders" in Flight Calendar header. Actually sent 2 emails for ₹1,85,000 total pending |
| Operator Revenue Dashboard | 🟢 DONE | (Aug 1, 2026) Operator Portal → Dashboard → Revenue Dashboard. KPI Cards: Total Earnings, This Month, Pending Payout (Next: 15th), Commission Rate (85%). Tabs: Monthly Trend (6-month bar chart), Commission Breakdown (Pie chart + table: Gross Value, Platform Fee 15%, GST 18%, Net Earnings), Payout History (date, period, flights, amount, status, reference). API: GET /api/operator/revenue/dashboard calculates real earnings from paid inquiries. Hinglish labels |
| Customer Booking Stats | 🟢 DONE | (Aug 1, 2026) Customer Portal → Main → My Stats. Loyalty Tier Progress card (Bronze/Silver/Gold/Platinum) with gradient, progress bar to next tier, "Spend ₹X more to unlock Y". Stats grid: Total Flights, Unique Routes, Flight Hours, Points Earned. Tier Benefits list with next tier preview. Recent Flights list. Tier Roadmap at bottom. API: GET /api/customer/booking-stats calculates from bookings/inquiries. Tested: ₹90,000 spend, 3 flights, 900 points, Bronze tier |
| Auction Outbid Alerts | 🟢 DONE | Instant email to previous highest bidder on outbid (SMTP verified) |
| Auction Watchlist | 🟢 DONE | Bell watch toggle on auction cards + "N watching" count. Watchers get email reminder when auction ends within 60 min (apscheduler job `auction_ending_reminders` every 10 min). Endpoints: POST /api/exchange/auctions/{id}/watch, GET /api/exchange/auctions/watchlist/my |
| CEO Board Report PDF | 🟢 DONE | "Board Report (PDF)" button on CEO Dashboard → reportlab investor report (Financial, Operations, Marketplace, HR, Partnerships sections). GET /api/ceo/report.pdf |
| HRMS in CEO Panel | 🟢 DONE | "People & HR (HRMS)" KPI row on CEO Dashboard: employees, attendance today, pending leaves, pending expense claims (+amount), payroll this month. Existing HRMS backend (hr_routes: attendance check-in/out, leave, payroll generate; hr_advanced_routes: expense claims approval flow, salary payments) surfaced to executives |
| Auction Winner Flow | 🟢 DONE | "🏆 You WON" congratulations email with 5-step next-steps checklist (welcome call, sale agreement, payment coordination, pre-delivery inspection, DGCA transfer) fires exactly once when auction finalizes as sold (atomic guard in _finalize_if_due) |
| Report Scheduler | 🟢 DONE | Board report PDF auto-emails investors on 1st of month (scheduler job `monthly_board_report`, 12h interval + period guard). Admin UI: CEO Dashboard → "Investors" dialog (save email list in ceo_settings + "Send Now"). Endpoints: GET/POST /api/ceo/investors, POST /api/ceo/investors/send-now |
| Watchlist Page | 🟢 DONE | Customer dashboard → "My Watchlist" tab (/customer/watchlist): watched auctions with live ticking countdowns, LIVE/result badges, "You're leading!" indicator, Bid Now (→ /exchange?mode=auctions via query param), Unwatch. GET /api/exchange/auctions/watchlist/details |
| Exchange SEO/Public Pages | 🟢 DONE | Shareable public link per listing: /exchange/listing/{id} (no login, dynamic document.title) — specs, share buttons (Copy Link, WhatsApp wa.me, Twitter intent), login-gated inquiry + inspection CTAs, in-auction redirect. Share buttons also on exchange detail dialog + seller "My Aircraft" active listings |
| Partner Webhooks | 🟢 DONE | Per-partner webhook_url (admin Webhook dialog with delivery logs). On booking status change backend POSTs signed JSON (X-AirYatra-Signature = HMAC-SHA256 of body keyed by api_key, X-AirYatra-Event header) via httpx BackgroundTask, logged in partner_webhook_logs. Webhook docs card in API Docs tab. Endpoints: PATCH /api/partners/{id}/webhook, GET /api/partners/{id}/webhook-logs |
| Country CEO Dashboard | 🟢 DONE | Admin → Analytics & Reports → CEO Dashboard: revenue, bookings, customers, fleet, marketplace KPIs, 6-month booking trend chart (recharts), membership breakdown, partner summary. Backend: /api/ceo/dashboard |
| Partner API Platform | 🟢 DONE | Admin → Integrations → Partner API Platform: create partners w/ auto API keys (ayk_*), revoke/activate/regenerate, partner bookings pipeline (received→processing→confirmed/cancelled), API Docs tab. Public API: /api/partner/v1/{ping,aircraft,bookings} via X-API-Key header w/ usage tracking |
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
| 1.4 | Loyalty & Rewards Enhancement | P1 | 🟢 DONE | Tier-based earning multipliers (Bronze 1x → Platinum 2x, BLACK members up to 3x), auto points on flight completion (1pt/₹100, idempotent), 7-item rewards catalog with tier-locked rewards, voucher redemption (RWD- codes, expiry), UI at /customer/loyalty. Vouchers applicable at checkout (/customer/payment) for instant discounts — validated, single-use, marked used on payment success |
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
| 2.1 | AirYatra Aviation Exchange | P0 | 🟢 MVP DONE | Aircraft resale marketplace LIVE at /exchange — listings (6 seeded), category/search/price filters, detail dialog, buyer inquiries, seller submission (pending_review), admin approve/sold. (Aug 1, 2026) Sell Aircraft Form (photo upload via object storage) + Admin Exchange Panel (approve/reject/sold, inquiry management, seller email notifications on approve/reject via Hostinger SMTP). (Aug 1, 2026) Seller Dashboard "My Aircraft" tab in customer dashboard (own listings, views, inquiries) + Featured Listings (admin Feature/Unfeature toggle, premium spotlight strip on /exchange). Future: escrow, inspection booking |
| 2.2 | Aircraft Auction Platform | P0 | 🟢 MVP DONE | (Aug 1, 2026) Live timed auctions on /exchange "Live Auctions" mode — countdown timer, min-increment bidding, masked bid history, reserve price (hidden from public), lazy auto-finalize (sold/reserve_not_met/no_bids), listing auto moves in_auction↔active/sold. Admin: Start Auction on active listings + End Now + Auctions tab. Sellers can opt-in "Sell via Auction" in sell form (auto-starts 72h auction on approval). Future: payment/escrow for winners, proxy bidding |
| 2.3 | Fractional Aircraft Ownership | P0 | 🟢 MVP DONE | (Aug 1, 2026) Fractional mode on /exchange — 3 seeded offerings (1/8 & 1/4 shares), share price, shares-left progress, Reserve Share = Expression of Interest (NO payment — deferred). Admin "Fractional EOIs" tab: approve (atomic share allocation), reject, mark contacted. (Aug 1, 2026) Ownership Certificates: "My Investments" tab in customer dashboard + branded PDF share certificate download (reportlab) for approved allocations. Inspection Booking: buyers book pre-purchase inspection slot from listing detail (date/slot/phone), admin Inspections tab confirm/complete/cancel with buyer email notifications. Future: payment integration, usage scheduling |
| 2.4 | Aviation Finance Marketplace | P1 | ⚪ BACKLOG | Aircraft loans, leasing, EMI options |
| 2.5 | Investor Dashboard | P1 | ⚪ BACKLOG | ROI tracking, ownership management |

---

## PHASE 3: OPERATIONAL EXCELLENCE
**Goal**: Complete ERP solution for aviation operators

| # | Feature | Priority | Status | Description |
|---|---------|----------|--------|-------------|
| 3.0 | Full HRMS Suite | P1 | 🟢 DONE | (Aug 1, 2026) Employee Mgmt + Attendance + Leave + Payroll/Payslip PDF + Expense Reimbursement, with employee self-service portal at /employee |
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
