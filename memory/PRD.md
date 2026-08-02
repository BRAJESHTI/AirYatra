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
|| Operator Fleet Analytics | 🟢 DONE | (Aug 1, 2026) Operator Portal → Dashboard → Fleet Analytics. Monitors aircraft utilization, maintenance status & performance. Summary KPIs: Total Aircraft, Avg Utilization %, Total Flight Hours, Maintenance Due count. Tabs: (1) Utilization — 6-month trend line chart + per-aircraft utilization % with progress bars. (2) Maintenance — table with last service, next due, hours since maintenance, status badges (Good/Due Soon/Overdue). (3) Performance — Fuel efficiency per aircraft (L/hr), monthly flight hours bar chart. API: GET /api/operator/fleet/analytics calculates from db.aircraft + db.flight_records. Responsive UI with color-coded gradient cards |
|| Customer Price Trends | 🟢 DONE | (Aug 1, 2026) Customer Portal → Main → Price Trends. Route selector dropdown (Mumbai→Shirdi, Mumbai→Pune, Delhi→Agra, Bangalore→Coorg, Chennai→Tirupati). KPI Cards: Current Price, Lowest Price (with month), Highest Price (with month), Average Price. "Best Time to Book" tip card with savings estimate. 6-month price history area chart (orange gradient). Booking Tips section. API: GET /api/pricing/history?from=X&to=Y returns historical or estimated data. Helps customers find optimal booking windows |
|| Admin Commission Settings | 🟢 DONE | (Aug 1, 2026) Admin → Finance & Billing → Commission Settings. Global settings: Default Operator Rate %, Platform Fee %, GST Rate %. Validation: operator + platform must = 100%. Per-operator custom rates with "Custom" badge. Table shows all operators with status, commission rate, platform fee, Edit button. Edit dialog with live preview (on ₹1,00,000 booking). APIs: GET/PUT /api/admin/commission-settings (global), PUT /api/admin/operators/{id}/commission (per-operator). Audit logged |
|| Customer Referral Program | 🟢 DONE | (Aug 1, 2026) Full referral system with wallet rewards: (1) **Unique Referral Codes** — auto-generated 8-char code per customer (V5VK8ZA3 format), shareable link /booking?ref=CODE. (2) **Refer & Earn UI** (ReferAndEarn.js) — copy code, share via WhatsApp/Email, stats (total/successful referrals, earnings), wallet tab (balance, transactions), history tab. (3) **Booking Integration** — referral code input on price step, promo code input, wallet balance checkbox, live discount calculation, final price display. (4) **Referral Bonus Processing** — on payment success, process_referral_bonus() credits ₹500 to referrer wallet, tracks in referral_history. (5) **First Booking Discount** — referred users get 10% off (max ₹2,000). (6) **Admin Discount Codes** — CRUD for promo codes (percent/fixed), usage limits, date validity, purpose restrictions. APIs: /api/referral/* (my-code, stats, apply, wallet, validate-discount, settings). Collections: referral_codes, wallets, wallet_transactions, referral_history, discount_codes |
|| Admin Discount Code Manager | 🟢 DONE | (Aug 1, 2026) Admin → Marketing & Loyalty → Discount Codes. Full CRUD for promo codes: Create with auto-generate option, code preview, discount type (percent/fixed), max uses, min booking amount, validity dates, active toggle. Table view with copy button, usage progress bar, status badges (Active/Inactive/Expired), edit/delete actions. Stats cards: Total Codes, Active, Total Uses, Expired. Search & filter (All/Active/Inactive). Collection: discount_codes |
|| Referral Leaderboard | 🟢 DONE | (Aug 1, 2026) Customer → Refer & Earn → Leaderboard tab. Monthly rewards display: Gold ₹1,000, Silver ₹500, Bronze ₹250. Period toggle (This Month / All Time). Current user rank card with earnings. Top 10 referrers list with crown/medal/award icons for top 3. Badges for top performers. API: GET /api/referral/leaderboard?period=month|all-time |
|| Smart Wallet Auto-Apply | 🟢 DONE | (Aug 1, 2026) Booking Page automatically checks wallet balance and pre-selects "Use Wallet" checkbox if balance > 0. Wallet deduction API: POST /api/referral/wallet/use with amount, booking_id. Records transaction in wallet_transactions |
|| Referral Email Alerts | 🟢 DONE | (Aug 1, 2026) When process_referral_bonus() credits wallet, sends styled HTML email to referrer: "🎉 Referral Bonus Credited!" with bonus amount, new balance, friend's booking amount, CTA to view wallet. Uses existing email_service.send_email() |
|| Operator Pilot Duty Tracker | 🟢 DONE | (Aug 1, 2026) Operator → Tracking & Records → Pilot Duty Tracker / FDTL. DGCA FDTL compliance dashboard: Summary cards (Total Pilots, OK Status, Watch, Over Limit). DGCA Limits reference card (Daily 8h, Weekly 30h, Monthly 100h, Min Rest 10h). Pilot list with expandable rows showing: License number, Monthly hours progress bar, Status badges (OK/WATCH/OVER), Can Fly badge. Expanded view: Hours breakdown (daily/weekly/monthly/yearly), Last flight info, Rest since duty calculation, Violations & warnings. API: GET /api/dgca/operator/pilots/duty-status calculates from flight_duty_logs + pilots collections |
|| AI Route Suggestions | 🟢 DONE | (Aug 1, 2026) Customer → Main → Route Ideas. AI-powered personalized recommendations: (1) **For You** section — routes based on booking history, top 2 personalized with "Personalized" badge. (2) **Trending Routes** — 4 popular routes with popularity %, purpose icons (pilgrimage/business/tourism/leisure), duration, price range, best time. (3) **All Popular Routes** table — Mumbai→Shirdi, Delhi→Agra, etc. with Book buttons. (4) **Seasonal Suggestions** — Diwali/Wedding/Summer offers based on current month. Clicking "Book" navigates to /booking?from=X&to=Y. User preference summary shows top purpose and visited cities. API: GET /api/customer/route-suggestions |
|| Pilot Document Expiry Alerts | 🟢 DONE | (Aug 1, 2026) Auto-notify operators when pilot documents expire in 30 days. Scheduler job `check_pilot_document_expiry` runs daily. Checks: license_expiry, medical_expiry, type_rating_expiry. Urgency levels: critical (≤7 days), warning (≤14 days), info (≤30 days). Sends styled HTML email to operator with pilot list, document type, expiry date, days remaining. Records in notifications collection. Email includes: "Manage Pilot Documents →" CTA |
|| Fleet Maintenance Calendar | 🟢 DONE | (Aug 1, 2026) Operator → Fleet & Crew → Maintenance Calendar. Calendar view of maintenance schedule: Summary cards (Total Scheduled, Pending, Completed, Critical). Monthly calendar grid with color-coded priority badges. Click date to see detailed maintenance list. Status filter dropdown. **iCal Export**: GET /api/maintenance/calendar/ical generates .ics file for Google Calendar/Outlook import. Includes aircraft registration, type, description, estimated hours/cost, technician, priority. APIs: GET /api/maintenance/calendar (calendar data), GET /api/maintenance/calendar/ical (export) |
|| Pilot Assignment Calendar | 🟢 DONE | (Aug 1, 2026) Operator → Fleet & Crew → Pilot Assignment. Calendar-based pilot-to-flight assignment with visual scheduling |
|| Maintenance Cost Tracker | 🟢 DONE | (Aug 1, 2026) Operator → Fleet & Crew → Cost Tracker. Maintenance spending analytics with 6-month trend charts |
|| Advanced Pilot Document Portal | 🟢 DONE | (Aug 1, 2026) Enhanced document management with bulk upload, expiry alerts, send notification button |
|| Universal Global Search | 🟢 DONE | (Aug 1, 2026) Ctrl+K shortcut opens global search across Bookings, Users, Aircraft, Pilots. Component: GlobalSearch.js |
|| Notification Center | 🟢 DONE | (Aug 1, 2026) Bell icon with unread badge, dropdown with tabs (All/Bookings/System/Alerts). Component: NotificationBell.js |
|| Auto-Collapse Responsive Sidebar | 🟢 DONE | (Aug 1, 2026) All dashboards have responsive sidebars. Desktop: full→collapsed. Mobile: hamburger drawer. Components: Sidebar.js |
|| Three-Dot Context Menus | 🟢 DONE | (Aug 1, 2026) ⋮ icon on table rows opens contextual actions. Component: ContextMenu.js |
|| Keyboard Shortcuts Panel | 🟢 DONE | (Aug 1, 2026) Press `?` to open shortcuts panel. Component: KeyboardShortcutsPanel.js |
|| Quick Booking Actions | 🟢 DONE | (Aug 1, 2026) Recent Bookings have inline View/Copy/Action buttons |
|| Mobile UI Centering Fix | 🟢 DONE | (Aug 1, 2026) Fixed mobile grid alignment in Admin Overview stats |
|| Bulk Document Upload | 🟢 DONE | (Aug 1, 2026) Multi-file drag-drop upload with progress bars. Component: BulkDocumentUpload.js in PilotDocumentUpload |
|| Mobile Swipe Gestures | 🟢 DONE | (Aug 1, 2026) SwipeableCard.js - swipe left reveals actions on booking cards. "← Swipe for actions" hint on mobile |
|| Dark/Light Theme Toggle | 🟢 DONE | (Aug 1, 2026) ThemeToggle.js with Sun/Moon icons, localStorage persistence, CSS variables. Button in all nav bars |
|| Offline Mode Indicator | 🟢 DONE | (Aug 1, 2026) OfflineIndicator.js - red banner when offline, green "Back online!" auto-dismiss. In App.js |
|| Document Type Master | 🟢 DONE | (Aug 1, 2026) Admin → Document Master → Document Types. Enterprise master configuration for all document types across Customer/Pilot/Aircraft/Employee categories. 27 default types seeded. Features: Add/Edit/Deactivate types, Hindi names, required fields config, expiry tracking, verification API linkage, category filters, search. API: GET/POST/PUT/DELETE /api/admin/documents/types, POST /api/admin/documents/seed-defaults |
|| Verification API Settings | 🟢 DONE | (Aug 1, 2026) Admin → Document Master → Verification APIs. Government & third-party KYC API configuration panel. 8 APIs seeded (Aadhar eKYC, PAN, Bank Account, Passport, DL, DGCA License, GST, Company). Features: API endpoint config, key storage (masked), sandbox mode, enable/disable toggle, test connection, rate limits, cost per call tracking, provider info (Surepass, Karza, Digio). API: GET/POST/PUT/DELETE /api/admin/documents/verification-apis, POST /verify |
|| Document Expiry Dashboard | 🟢 DONE | (Aug 1, 2026) Admin → Document Master → Expiry Dashboard. Unified view of all expiring documents across pilots, aircraft, and employees. Stats: Expired, 7 Days Critical, 30 Days Warning, 90 Days, Total Tracked. Category filters (Pilot/Aircraft/Employee). Export to CSV. Send Reminder alerts. Color-coded urgency badges. Component: DocumentExpiryDashboard.js |
|| Command Center | 🟢 DONE | (Aug 1, 2026) Admin → Main Dashboard → Command Center. Approval workflow for critical actions (booking cancellation, refunds >₹10K, flight reschedule, pilot reassignment, aircraft swap, price override, document deletion). Stats: Pending, Critical, Approved, Rejected. Tabs: Pending vs History. Approve/Reject with modal details and rejection reason. API: /api/admin/approvals. Component: CommandCenter.js |
|| Customer KYC Upload | 🟢 DONE | (Aug 1, 2026) Customer → Account → KYC Documents. Upload identity documents (Aadhar, PAN, Passport, DL, Voter ID, Bank Account) for verification. KYC status banner (Complete/Incomplete). Document list with verification status (Uploaded/Pending/Verified/Rejected). Auto-verify in sandbox mode. Accepted documents grid from master config. Upload modal with document type dropdown, number input, expiry date (if applicable), file upload. Component: CustomerKYCUpload.js. API: /api/customer/kyc-documents |
|| Pilot Document Enhancement | 🟢 DONE | (Aug 1, 2026) Pilot Document Upload now fetches document types from master configuration. Dropdown shows 7 pilot document types from admin config (Pilot License, Medical Certificate, Type Rating, Instrument Rating, English Proficiency, Security Clearance, FRTO License) with bilingual names. Falls back to hardcoded types if master config unavailable |
|| Enterprise Security Hardening | 🟢 DONE | (Aug 2, 2026) **4 Advanced Security Features**: (1) **Rate Limiting** — slowapi integration, login 5/min, register 3/min, file uploads 10/min per IP. Returns 429 on excess. (2) **Audit Logging** — all auth events (login, login_failed, password_change, token_revoke), file operations (encrypt, decrypt) logged to `audit_logs` collection with masked PII, risk levels, IP/user-agent tracking. High-risk events create `security_alerts`. (3) **Session Invalidation** — password change auto-revokes all other sessions via `revoked_tokens` collection; JWT blocklist check in middleware; `/auth/logout-all-devices` endpoint. (4) **AES-256 File Encryption** — all KYC documents encrypted at rest using Fernet (AES-128-CBC), FILE_ENCRYPTION_KEY in .env, decrypted on download, original content preserved. Files stored as .enc. Backend: security_middleware.py (limiter, AuditLogger, SessionManager, FileEncryption classes), middleware.py (token revocation check), auth_routes.py (rate limits + change-password + logout-all), customer_kyc_routes.py (encrypt/decrypt). Tested via curl |
|| KYC Verification Service (Sandbox) | 🟢 DONE | (Aug 2, 2026) Full KYC verification API implementation in **Sandbox Mode**. Endpoints: `/api/kyc/verify/aadhaar`, `/api/kyc/verify/pan`, `/api/kyc/verify/dl`, `/api/kyc/verify/passport`, `/api/kyc/verify/bank`, `/api/kyc/verify/generic`. Returns realistic mock responses matching real KYC provider formats (Surepass/Karza style). Features: format validation (Aadhar 12-digit, PAN pattern, IFSC pattern), masked document numbers in logs, reference ID generation, verification history tracking. Auto-verify KYC documents via `/api/kyc/auto-verify/{doc_id}`. Backend: `kyc_verification_routes.py`. **Note: Switch to production by configuring real API keys in Admin → Verification API Settings** |
|| AI Business Advisor (CEO Chatbot) | 🟢 DONE | (Aug 2, 2026) GPT-4o powered business intelligence chatbot for CEO Dashboard. Features: (1) **Real-time Context** — fetches live metrics (revenue, bookings, customers, fleet, HR) from database. (2) **Quick Prompts** — Sales Report, Profit Analysis, Marketing Ideas, HR Summary, Customer Insights, Weekly Briefing. (3) **Custom Chat** — natural language Q&A about business. (4) **Marketing Content Generator** — creates social posts, emails, SMS, WhatsApp templates. (5) **Streaming SSE** — real-time token delivery. (6) **Chat History** — persistent sessions in `ai_advisor_chats` collection. Uses Emergent LLM Key. Backend: `ai_advisor_routes.py`. Frontend: `AIBusinessAdvisor.js` floating widget on CEO Dashboard with Hinglish responses |
|| Route Intelligence Engine | 🟢 DONE | (Aug 2, 2026) AI-powered route analytics. Features: Popular routes by bookings & revenue, Route profit analysis (cost vs revenue), Demand heatmap (city-wise), Seasonal trends (Q1-Q4), Monthly booking trends, Emerging routes detection, Peak day/month analysis, Demand forecasting with festival calendar (Diwali, Holi, etc.), Dynamic pricing recommendations. Backend: `/api/analytics/routes/*`. Frontend: `RouteIntelligence.js` with 3 tabs (Overview, Profit Analysis, Demand Forecast) |
|| Predictive Maintenance AI | 🟢 DONE | (Aug 2, 2026) AI-based fleet maintenance predictions. Features: Hours-based maintenance alerts, Risk scoring (critical/high/medium/low/optimal), Pattern detection (recurring issues, seasonal, age-related), Fleet health score, Component-level health monitoring (engine, rotors, transmission, avionics), 6-month cost forecasting, Budget allocation recommendations, AI-recommended maintenance schedule. Backend: `/api/maintenance/ai/*`. Frontend: `PredictiveMaintenance.js` |
|| Smart Hangar Management | 🟢 DONE | (Aug 2, 2026) Digital hangar operations. Features: Hangar slot booking (daily rates, purpose tracking), Real-time occupancy dashboard, Inventory management (spare parts, consumables, tools, safety equipment) with low-stock alerts, Parked aircraft tracking, Revenue tracking, Default hangars seeded (Mumbai, Delhi, Bangalore). Backend: `/api/hangar/*`. Frontend: `SmartHangarManagement.js` |
|| Admin Analytics Dashboard | 🟢 DONE | (Aug 2, 2026) Unified business analytics. Features: Revenue trends with daily breakdown, Booking conversion funnel (Inquiries→Quoted→Paid→Completed), Customer segmentation (new/occasional/regular/VIP), Top customers by revenue, Hourly & daily booking patterns, Top routes by revenue, Operational metrics (fleet, pilots, operators). Supports week/month/quarter/year periods. Backend: `/api/analytics/admin/dashboard`. Frontend: `AdminAnalyticsDashboard.js` |
|| Export Center | 🟢 DONE | (Aug 2, 2026) CSV report generation. Exports: Bookings (with customer details), Customers (all registered), Fleet (aircraft inventory), Finance (with GST breakdown). Date range filtering. Instant download. Backend: `/api/analytics/admin/export/*`. Integrated in AdminAnalyticsDashboard.js Export tab |
|| Real-time Operations Map | 🟢 DONE | (Aug 2, 2026) Live operations visualization. Features: 15 major Indian helipad locations (Mumbai, Delhi, Bangalore, Chennai, Hyderabad, Kolkata, Pune, Ahmedabad, Goa, Jaipur, Srinagar, Leh, Shimla, Kedarnath, Vaishno Devi), Real-time weather per location (temperature, wind, visibility, humidity), Flight status simulation (position, altitude, speed, heading, ETA, progress), Weather alerts (fog, high winds), Fleet status summary, Auto-refresh (30s). Backend: `/api/operations/map/live`. Frontend: `RealTimeOperationsMap.js` with interactive CSS-based map |
|| PWA Pilot Portal | 🟢 DONE | (Aug 2, 2026) Mobile-optimized React portal for pilots at `/pilot-portal`. **Backend APIs** (`/api/pilot/*`): GET `/mobile/dashboard` (stats, upcoming flights, alerts, duty status, documents, flight logs), POST `/duty/check-in` & `/duty/check-out` (FDTL tracking with hours calculation + **auto email notification**), GET `/documents` & `/flight-logs`. **Frontend**: Mobile-first responsive design with bottom navigation (Home/Duty/Docs/Flights/Profile), Welcome card with pilot info, FDTL progress bars (FDP 14h, Flight Time 8h, Weekly 60h), document expiry alerts (critical/warning/info), one-tap Check-In/Check-Out buttons, flight log viewer. **PWA Features**: Offline mode (Service Worker caching), Push notification support, Online/Offline status indicator. Accessible by pilots, operators, and admins. Files: `PilotMobilePortal.js`, `pilot_mobile_routes.py`, `service-worker.js` |
|| Gmail SMTP Email | 🟢 DONE | (Aug 2, 2026) Gmail SMTP integration for all app emails. Config: smtp.gmail.com:587 (STARTTLS), airyatraadmin@gmail.com. Auto-sends: Duty check-in/check-out notifications to pilots, Booking confirmations, Password resets. Files: `email_service.py`, backend `.env` |
|| Pilot Test Account | 🟢 DONE | (Aug 2, 2026) Captain Rajesh Kumar (pilot@airyatra.com / Pilot@123). License: CPL-2024-0001. Sample data: 3 upcoming flights (Mumbai→Shirdi, Delhi→Agra, Bangalore→Coorg), 3 documents (Medical expiring in 24 days), 3 flight logs, FDTL tracking. Medical expiry alert visible on portal. |
|| Flight Assignment UI | 🟢 DONE | (Already existed) Operator can assign pilots to bookings via `/operator/pilot-assignment`. Calendar view, pilot availability check, conflict detection. Backend: `/api/operator/pilots/assign`. Frontend: `PilotAssignmentCalendar.js` |
|| Booking Email Receipts | 🟢 DONE | (Aug 2, 2026) PDF receipt generation with AirYatra branding, auto-attached to booking confirmation emails. Features: Flight details, customer info, payment summary with GST, terms & conditions. API: `POST /api/email/booking/{id}/send-confirmation`, `GET /api/email/booking/{id}/receipt`. Files: `pdf_service.py`, `email_routes.py` |
|| Document Upload Portal | 🟢 DONE | (Aug 2, 2026) Pilots can upload license renewals from mobile portal. Supports PDF/JPG/PNG up to 5MB. Document types: license, medical, type_rating, insurance, passport, aadhar, pan. Auto-validation and pending verification status. APIs: `POST /api/pilot/documents/upload-file`, `GET /api/pilot/documents/{id}/download`. Frontend: Documents tab with upload form |
|| Flight Pre-Check Form | 🟢 DONE | (Aug 2, 2026) Digital pre-flight checklist with 19 items across 5 categories (Weather, Aircraft, Pilot, Passengers, Communications). 15 critical items must be checked. **Now includes live Weather Status card** with GO/CAUTION/NO-GO recommendation. APIs: `GET /api/pilot/preflight/checklist`, `POST /api/pilot/preflight/submit`, `POST /api/pilot/preflight/weather-check`. Frontend: Flights tab with "Pre-Check" button that opens checklist modal |
|| Crew Scheduling Board | 🟢 DONE | (Aug 2, 2026) Visual drag-drop scheduling for operators at `/operator/crew-scheduling`. Week view with pilot rows and day columns. Left panel shows unassigned bookings. Drag booking to pilot/date cell to assign. **Maintenance Alerts button** shows aircraft due for service. Week navigation, Today button, conflict highlighting. Frontend: `CrewSchedulingBoard.js` |
|| Export Flight Logs | 🟢 DONE | (Aug 2, 2026) Pilots can download their complete flight log history as PDF or Excel. Professional AirYatra-branded reports with pilot info, flight summary, detailed log table. APIs: `GET /api/pilot/flight-logs/export/pdf`, `GET /api/pilot/flight-logs/export/excel`. Frontend: Export PDF and Export Excel buttons on Flights tab. Files: `flight_log_export_service.py` |
|| Maintenance Alerts | 🟢 DONE | (Aug 2, 2026) Auto-flag aircraft approaching maintenance due dates. Tracks hours since service, days since inspection, engine hours, scheduled maintenance. Critical/Warning severity levels. API: `GET /api/operator/aircraft/maintenance-alerts`, `POST /api/operator/aircraft/{reg}/update-maintenance`. Frontend: Red "Maintenance" button on Crew Scheduling Board with alert panel |
|| Pilot Chat | 🟢 DONE | (Aug 2, 2026) Real-time messaging between pilots and operations team. Conversations with message history, read receipts, quick replies, unread count badge. APIs: `GET /api/chat/conversations`, `GET /api/chat/messages/{id}`, `POST /api/chat/messages/send`, `GET /api/chat/unread-count`. Frontend: Orange chat button on pilot portal that opens full-screen chat modal. Files: `pilot_chat_routes.py`, `PilotChat.js` |
|| Weather Integration | 🟢 DONE | (Aug 2, 2026) Live weather data for pre-flight checks using OpenWeatherMap API (falls back to simulated data if no key). 15+ Indian aviation locations with coordinates. Auto-calculates flight conditions (GO/CAUTION/NO-GO) based on wind, visibility, cloud cover, temperature. Route weather for origin + destination. APIs: `GET /api/pilot/weather/{location}`, `GET /api/pilot/weather/route/{origin}/{destination}`, `POST /api/pilot/preflight/weather-check`. Files: `weather_service.py` |
|| **Smart Inventory & Verified Aircraft Catalog** | 🟢 DONE | (Aug 2, 2026) Phase 5: Enhanced aircraft catalog with 40+ fields. **Backend**: New schema (engine_type, cruise_speed_kmh, max_range_km, max_altitude_ft), Enhanced Safety (tcas, oxygen_kit, terrain_awareness, weather_radar, autopilot, parachute_system, defibrillator), Crew Config (pilot_count, copilot_required, cabin_crew_count), Amenities (pressurized_cabin, meals_available, wifi_type, leather_seats, conference_table). Safety Score & Amenity Score calculations. 9 Booking Types (one_way to event_based). AI Comparison API: `POST /api/aircraft/compare`. Public Featured: `GET /api/aircraft/public/featured`. **Frontend**: 5-section CreateAircraftForm, AircraftComparison.js, CustomerPriceBreakup.js. Route unified: /operator/fleet → enhanced form. Customer Compare at /customer/compare. **Test Data**: Bell 407, Airbus H145, Cessna XLS seeded. Tested: iteration_27 |
|| **Emergent Google OAuth Integration** | 🟢 DONE | (Aug 2, 2026) Implemented Emergent-managed Google OAuth. **Backend**: POST `/api/auth/google/emergent-callback` - exchanges Emergent session for app JWT, creates/updates user with Google profile, stores session. GET `/api/auth/google/settings` - returns auth config. Features: auto-create users, profile picture sync, OTP bypass for Google users. **Frontend**: `GoogleLogin.js` has `EmergentAuthCallback` component handling session_id from URL hash. Redirects to `auth.emergentagent.com`, callback to `/auth/google/callback`. Login page shows "Google से Login करें" button. **Files**: `auth_routes.py`, `GoogleLogin.js`, `/auth_testing.md`. |
|| **Price Lock Timer & Booking Type Selector** | 🟢 DONE | (Aug 2, 2026) **Price Lock Timer UI**: `PriceLockTimer.js` component with 15-minute countdown, live decrement, warning at 2 min, auto-redirect on expiry, extend button (+5 min). Also `PriceLockBadge` for compact header display. Integrated into BookingPage Step 4 (Price Summary). **Booking Type Selector**: `BookingTypeSelector.js` with 9 booking types (one_way, round_trip, multi_city, hourly_charter, daily_charter, multi_day, group_booking, emergency, event_based). Each type has Hindi/English labels, icons, multipliers, discount hints. Dynamic pricing shown based on base price. Integrated into BookingPage Step 2. **bookingConfig.js** updated with `bookingTypes` array including multipliers (e.g., round_trip=1.85, multi_day=0.85, emergency=1.25). **Files**: `PriceLockTimer.js`, `BookingTypeSelector.js`, `bookingConfig.js`, `BookingPage.js`. |
|| **Admin Pricing Controls Refactor** | 🟢 DONE | (Aug 2, 2026) Refactored 787-line `AdminPricingControls.js` into modular components under `/components/admin/pricing/`: `CommissionFeesTab.js` (commission, GST, platform fees), `PeakSeasonTab.js` (peak dates, surge multipliers), `RoutePricingTab.js` (route-based pricing), `CorporateContractsTab.js` (corporate contracts), `CancellationPolicyTab.js` (cancellation slabs, weather refund), `AuditLogsTab.js` (change history). Main component now ~200 lines. Clean tab navigation with icons. **Files**: `/components/admin/pricing/index.js` for exports. |
|| **Multi-City Route Builder** | 🟢 DONE | (Aug 2, 2026) `MultiCityRouteBuilder.js` component for multi_city booking type. Supports 2-8 legs with auto-chaining (destination becomes next leg's origin). Per-leg discount (configurable, default 5% per additional leg, max 25%). Features: add/remove legs, distance calculation (Haversine), per-leg pricing, route summary with visual route display, total distance/price/savings. Integrated with LandingPointSelector for location selection. **Files**: `MultiCityRouteBuilder.js`, exported from booking index. |
|| **Role Selection Modal** | 🟢 DONE | (Aug 2, 2026) `RoleSelectionModal.js` for new Google sign-up users to choose Customer or Operator role. Shows Google profile info with verified badge. Features list for each role. Backend: POST `/api/auth/set-role` (sets role, creates operator profile if needed), GET `/api/auth/check-role-selection` (checks if role selection needed). Auto-creates operator record for new operators. **Files**: `RoleSelectionModal.js`, `auth_routes.py` (set-role, check-role-selection endpoints). |
|| **Soft-Delete Aircraft** | 🟢 DONE | (Aug 2, 2026) Archive/restore functionality instead of permanent deletion. Backend: DELETE `/api/aircraft/{id}` (soft delete - sets is_archived=true), POST `/api/aircraft/{id}/restore` (restore), GET `/api/aircraft/archived` (list archived), DELETE `/api/aircraft/{id}/permanent?confirm=true` (admin-only permanent delete). Frontend: Archive button on aircraft cards, "Archived" tab toggle in fleet dashboard, restore button on archived cards. Preserves booking history. **Files**: `aircraft_catalog_routes.py`, `AircraftCatalog.js`. |
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

### Latest Updates (Aug 1, 2026 - Session 2)

| Feature | Status | Description |
|---------|--------|-------------|
| Pilot Assignment Calendar | 🟢 DONE | Operator → Fleet & Crew → Pilot Assignment. Visual calendar to assign pilots to bookings: Summary cards (Total Pilots, Assigned, Unassigned, Total Bookings). Monthly calendar view. Right panel shows selected date bookings with Assign dropdown. APIs: GET /api/operator/pilots/availability, POST /api/operator/pilots/assign. Prevents double-booking |
| Maintenance Cost Tracker | 🟢 DONE | Operator → Fleet & Crew → Cost Tracker. Track estimated vs actual maintenance costs: Summary cards (Total Estimated, Total Actual, Variance %, Completed Count). Budget status cards (On/Under/Over Budget). Charts: Monthly Cost Trend, Cost by Type. API: GET /api/maintenance/cost-tracker |
| Pilot Document Upload Portal | 🟢 DONE | Operator → Fleet & Crew → Pilot Documents. Upload pilot licenses, medicals, certificates: Pilot selector, 11 document types, upload dialog with expiry date. Documents table with download/delete. APIs: GET/POST/DELETE /api/maintenance/pilot-documents |


### Latest Updates (Aug 1, 2026 - Session 3)

| Feature | Status | Description |
|---------|--------|-------------|
| Pilot Document Portal V2 | 🟢 DONE | Enhanced with: Pilot list view with document summary, filter by status (All/Expired/Expiring/No Docs), search by name/license, expandable cards with document table, direct Upload button per pilot, advanced upload form (Document No., Issue Date, Expiry, Issuing Authority), Send Alert button, auto-alert API (/api/maintenance/pilot-documents/send-alert) sends email to Operator/Admin/Pilot |
| Universal Search (Ctrl+K) | 🟢 DONE | Global search modal (⌘K/Ctrl+K). Searches: Bookings, Customers, Operators, Invoices, Aircraft, Pilots, Inquiries. Features: Quick Actions, Recent Searches, keyboard navigation (↑↓ Enter Esc), categorized results with badges, role-based filtering. API: GET /api/search/global?q=term&limit=20 |
| Notification Center V2 | 🟢 DONE | Enhanced NotificationBell with tabs (All/Bookings/System/Alerts), unread count badge, mark as read, mark all read, click-to-navigate, time formatting (Just now/Xm ago/Xh ago/Xd ago), polling every 30s |
| Auto-Collapse Sidebar | 🟢 DONE | Reusable component at /app/frontend/src/components/shared/Sidebar.js. SidebarProvider (context), Sidebar, SidebarGroup, SidebarItem, MobileMenuButton, SidebarToggle. Mobile: hidden by default + hamburger. Tablet: collapsed (icons only) + hover expand. Desktop: full sidebar. |
| Three-Dot Context Menus | 🟢 DONE | Reusable ContextMenu component at /app/frontend/src/components/shared/ContextMenu.js. Preset actions: View, Edit, Delete, Copy ID, Open Link, Download, Email, Share. Divider support. Keyboard (Escape) close. Animation. |

### Files Created/Modified This Session
- /app/frontend/src/components/operator/PilotDocumentUpload.js (enhanced)
- /app/frontend/src/components/shared/GlobalSearch.js (new)
- /app/frontend/src/components/shared/NotificationBell.js (enhanced)
- /app/frontend/src/components/shared/Sidebar.js (new)
- /app/frontend/src/components/shared/ContextMenu.js (new)
- /app/backend/routes/search_routes.py (new)
- /app/backend/routes/maintenance_routes.py (added send-alert API)
- /app/frontend/src/pages/AdminDashboard.js (added GlobalSearch)
- /app/frontend/src/pages/OperatorDashboard.js (added GlobalSearch)


### Latest Updates (Aug 1, 2026 - Session 4)

| Feature | Status | Description |
|---------|--------|-------------|
| Auto-Collapse Sidebar Integration | 🟢 DONE | Applied responsive sidebar to Admin & Operator dashboards. Mobile (<768px): Sidebar hidden, hamburger menu shows. Tablet (768-1024px): Sidebar collapsed (icons only), hover expands. Desktop (>1024px): Full sidebar expanded with toggle button. Components: MobileMenuButton, ResponsiveSidebar, CollapsibleNavGroup, NavItem. Dark overlay on mobile open. Smooth transitions. |
| Three-Dot Context Menus | 🟢 DONE | Added to BookingManagement.js and InvoiceManagement.js tables. Booking actions: View Details, Copy Booking ID, Download Invoice, Reassign Operator (warning), Cancel Booking (danger). Invoice actions: View Invoice, Print, Download PDF, Copy Invoice #, Mark as Sent/Paid, Send via Email, Delete (draft only). Proper dividers, danger/warning colors, keyboard (Esc) close. |

### Files Modified This Session
- /app/frontend/src/components/shared/Sidebar.js (rewritten for compatibility)
- /app/frontend/src/pages/AdminDashboard.js (integrated responsive sidebar)
- /app/frontend/src/pages/OperatorDashboard.js (integrated responsive sidebar)
- /app/frontend/src/components/admin/BookingManagement.js (added ContextMenu)
- /app/frontend/src/components/admin/InvoiceManagement.js (added ContextMenu)


### Latest Updates (Aug 1, 2026 - Session 5)

| Feature | Status | Description |
|---------|--------|-------------|
| Mobile UI Centering Bug Fix | 🟢 FIXED | Content was offset 64px on mobile due to sidebar 'relative' class overriding 'fixed'. Fix: Changed to 'lg:relative', used translate-x instead of left positioning. Main content now starts at x=0 with max-w-7xl mx-auto wrapper. |
| Customer Dashboard Sidebar | 🟢 DONE | Integrated responsive sidebar (hamburger menu, collapsed icons, full expanded). Added GlobalSearch to header. Content centered with max-w-6xl mx-auto. |
| Quick Booking Actions | 🟢 DONE | Added ContextMenu to Recent Bookings on Admin Dashboard home. Actions: View Details, Copy Booking ID, Cancel Booking (conditional). |
| Keyboard Shortcuts Panel | 🟢 DONE | Press ? to open modal. Shows Navigation (Ctrl+K, Esc, ↑↓, Enter), Quick Actions (G+D, G+B, G+S), Tables & Lists (J, K, X, Delete). Global component in App.js. |
| Admin Overview Mobile Responsive | 🟢 DONE | Stat cards grid-cols-2 on mobile (was grid-cols-1). Header stacks vertically on mobile with text-center. Smaller text sizes on mobile. |

### Files Modified This Session
- /app/frontend/src/components/shared/Sidebar.js - Fixed mobile positioning (translate-x vs left)
- /app/frontend/src/pages/AdminDashboard.js - Added max-w-7xl mx-auto wrapper
- /app/frontend/src/pages/OperatorDashboard.js - Added max-w-7xl mx-auto wrapper
- /app/frontend/src/pages/CustomerDashboard.js - Full responsive sidebar integration
- /app/frontend/src/components/admin/AdminOverview.js - Context menu on Recent Bookings, mobile responsive
- /app/frontend/src/components/shared/KeyboardShortcutsPanel.js - NEW
- /app/frontend/src/App.js - Added KeyboardShortcutsPanel globally


### Latest Updates (Aug 2, 2026 - Session 6: Phase 1 Completion)

| Feature | Status | Description |
|---------|--------|-------------|
| Emergency Contact Card | 🟢 DONE | Added to Pilot Portal home page. Shows grouped emergency contacts (Company, Aviation, Emergency Services). SOS button triggers alert to operations team. Uses /api/pilot/emergency-contacts endpoint. |
| Pilot Availability Calendar | 🟢 DONE | Full calendar UI in Pilot Profile tab. Pilots can mark dates as Available, Unavailable, Leave, Sick, Training, Standby. Shows flight assignments overlay. Month navigation, stats display. Uses /api/pilot/availability/* endpoints. |
| Flight Revenue Dashboard (Enhanced) | 🟢 DONE | Enhanced Operator Revenue Dashboard with new tabs: By Route (top performing routes), By Aircraft (revenue per aircraft type with RPH). Period selector (Day/Week/Month/Year). Uses /api/analytics/revenue/* endpoints. |

### Backend APIs Added
- `/api/pilot/availability/calendar` - GET monthly availability
- `/api/pilot/availability/set` - POST set single date availability
- `/api/pilot/availability/bulk-set` - POST bulk update
- `/api/pilot/availability/clear/{date}` - DELETE reset availability
- `/api/pilot/availability/all-pilots` - GET all pilots availability (Operator/Admin)
- `/api/analytics/revenue/dashboard` - GET revenue summary with charts
- `/api/analytics/revenue/by-route` - GET route-wise breakdown
- `/api/analytics/revenue/by-aircraft` - GET aircraft-wise breakdown
- `/api/analytics/revenue/summary` - GET quick revenue stats

### Files Modified This Session
- /app/frontend/src/components/pilot/PilotMobilePortal.js - Added EmergencyContactCard, AvailabilityCalendar components
- /app/frontend/src/components/operator/OperatorRevenueDashboard.js - Added route/aircraft analytics tabs, period selector
- /app/backend/routes/pilot_availability_routes.py - EXISTING (created in previous session)
- /app/backend/routes/revenue_analytics_routes.py - EXISTING (created in previous session)

---

## PHASE 2: MANDATORY ENTERPRISE SECURITY LAYER (MESL v1.0)

### Next Tasks (Upcoming)
| Feature | Priority | Description |
|---------|----------|-------------|
| Email OTP Login | P0 | Send OTP to email on login for extra verification |
| SMS OTP Login | P0 | Send OTP via SMS on login (Twilio/MSG91) |
| First Login OTP | P1 | Force OTP on first ever login |
| New Device Detection | P1 | Trigger OTP when login from unknown browser/device/IP |
| Device Trust ("Trust this Device 30 Days") | P1 | Skip OTP for trusted devices |
| Session Control | P1 | View active sessions, logout other devices |
| Account Lockout | P1 | Lock after 5 failed password attempts |
| OTP Expiry | P1 | OTP valid for 5 minutes only |
| Login Shield AI™ | P2 | Risk scoring, anomaly detection, admin alerts |


### Latest Updates (Aug 2, 2026 - Session 7: MESL v1.0 Security)

| Feature | Status | Description |
|---------|--------|-------------|
| Email OTP Login | 🟢 DONE | OTP sent to email on login. 6-digit code, 5-min expiry, 3 max attempts. Cooldown prevents spam (60s). |
| Device Trust ("30 Days") | 🟢 DONE | Users can check "Trust this device" to skip OTP for 30 days. Device fingerprint stored in `trusted_devices` collection. |
| Session Manager | 🟢 DONE | View all active sessions with device info, IP, last activity. Logout individual sessions or all devices. |
| Trusted Devices Management | 🟢 DONE | View/revoke trusted devices. Trust current device from security settings. |
| Security Settings UI | 🟢 DONE | Toggle OTP on/off, view security overview (sessions count, trusted devices count). |
| Security Audit Fixes | 🟢 DONE | Fixed: OTP not in email subject, generic error for account enumeration, constant-time OTP comparison. |

### Backend APIs Added (Security)
- `/api/auth/login` - Now returns `otp_required: true` when OTP needed
- `/api/auth/login/verify-otp` - POST verify OTP and get token
- `/api/auth/login/resend-otp` - POST resend OTP (rate limited)
- `/api/auth/sessions` - GET all active sessions
- `/api/auth/sessions/{id}` - DELETE revoke specific session
- `/api/auth/logout-all-devices` - POST logout from all devices
- `/api/auth/trusted-devices` - GET/DELETE manage trusted devices
- `/api/auth/trust-current-device` - POST trust current device
- `/api/auth/security-settings` - GET/PUT security settings

### New Services Created
- `/app/backend/services/otp_service.py` - OTP generation, verification, device trust management
- Email templates: `otp_login`, `new_device_login`, `device_trusted`

### Frontend Components Added
- `/app/frontend/src/pages/LoginPage.js` - Enhanced with OTP verification UI
- `/app/frontend/src/components/auth/SessionManager.js` - NEW: Session & device management UI
- `/app/frontend/src/services/authService.js` - Added OTP and session APIs

### Security Audit Results (Aug 2, 2026)
- Status: CONDITIONAL PASS - NEEDS ATTENTION
- SEC-001 (MEDIUM): Device trust fingerprint is IP+UA based - recommend cookie-based token (documented limitation)
- SEC-002 (LOW): Fixed - Generic error for account enumeration
- SEC-003 (LOW): X-Forwarded-For handling - proxy-dependent
- SEC-004 (LOW): Fixed - OTP not shown in email subject
- Additional hardening applied: constant-time OTP comparison using hmac.compare_digest

---

### Latest Updates (Aug 2, 2026 - Session 8: Login Shield AI™ + Panel Integration)

| Feature | Status | Description |
|---------|--------|-------------|
| Login Shield AI™ | 🟢 DONE | Complete risk scoring engine with factors: failed attempts, new device, new IP, unusual time, rapid device switching, VPN detection. Risk levels: LOW (0-30), MEDIUM (31-60), HIGH (61-80), CRITICAL (81-100). |
| IP Geolocation | 🟢 DONE | Location-based risk scoring using free ip-api.com API. Detects high-risk countries, VPN/proxy, datacenter IPs. Caches results for 24h. |
| Risk-Based Actions | 🟢 DONE | LOW=allow, MEDIUM=force OTP, HIGH=alert admin+OTP, CRITICAL=block login+alert+email user |
| Admin Security Alerts | 🟢 DONE | Auto-generated alerts for HIGH/CRITICAL risk logins, stored in `admin_alerts` collection |
| Security Incidents | 🟢 DONE | CRITICAL risk attempts create security incidents requiring investigation |
| Login Shield Dashboard | 🟢 DONE | Full admin UI showing stats, risk distribution, high-risk logins with location data, alerts, incidents |
| Session Manager Integration | 🟢 DONE | Integrated into Admin Dashboard, CEO Dashboard, HR Dashboard |
| Real Admin Test | 🟢 DONE | Verified OTP login flow with actual admin account, tested all Login Shield APIs |

### Backend APIs Added (Login Shield)
- `/api/auth/login-shield/stats` - GET security statistics (24h)
- `/api/auth/login-shield/high-risk-logins` - GET recent high-risk attempts
- `/api/auth/login-shield/alerts` - GET security alerts
- `/api/auth/login-shield/alerts/{id}/read` - PUT mark alert as read
- `/api/auth/login-shield/incidents` - GET security incidents
- `/api/auth/login-shield/incidents/{id}/resolve` - PUT resolve incident
- `/api/auth/login-shield/user-risk-history/{user_id}` - GET user's risk history

### New Services Created
- `/app/backend/services/login_shield_service.py` - Risk scoring engine, alert generation, incident management
- `/app/backend/services/ip_geolocation_service.py` - NEW: IP location lookup using ip-api.com, caching, country risk scoring

### Frontend Components Added
- `/app/frontend/src/components/admin/LoginShieldDashboard.js` - NEW: Full security monitoring dashboard
- Updated: AdminDashboard.js - Added Login Shield AI™ and Session Manager to Users & HR section
- Updated: HRDashboard.js - Added Security section with Login Shield and Session Manager
- Updated: CEODashboard.js - Added Security KPIs showing login stats, blocked attempts, incidents

### Panel Integration Summary
| Panel | Login Shield | Session Manager |
|-------|--------------|-----------------|
| Admin Dashboard | ✅ Full Dashboard | ✅ Full UI |
| CEO Dashboard | ✅ KPI Stats | - |
| HR Dashboard | ✅ Full Dashboard | ✅ Full UI |
| Customer Dashboard | ❌ Not added | ❌ Not added |
| Operator Dashboard | ❌ Not added | ❌ Not added |
| Pilot Portal | ❌ Not added | ❌ Not added |

### Latest Updates (Aug 2, 2026 - Session 9: Security Alerts + Command Palette)

| Feature | Status | Details |
|---------|--------|---------|
| In-App Security Notifications | 🟢 DONE | CRITICAL risk logins trigger notifications to Admin/CEO/HR. NotificationBell.js updated with: red alert banner, Security tab filter, beep sound for critical alerts. No email sent - in-app only. |
| Command Palette Security Index | 🟢 DONE | GlobalSearch.js updated: Login Shield AI™ and Session Manager added to QUICK_ACTIONS. Security category added (red color). Admins can press Ctrl+K → type "shield" or "session" to navigate directly. |

### Latest Updates (Aug 2, 2026 - Session 10: Password Strength + Login Activity)

| Feature | Status | Details |
|---------|--------|---------|
| Password Strength Meter | 🟢 DONE | Real-time strength indicator during registration. Shows requirements checklist (8+ chars, uppercase, lowercase, number, special char). Visual progress bar with Weak/Fair/Good/Strong labels (Hinglish). Eye icon for show/hide password. Component: `PasswordStrengthMeter.js` |
| Login Activity Log | 🟢 DONE | Backend API: `GET /api/auth/login-activity`. Shows recent logins with device, browser, OS, IP, location, risk level. Frontend component: `LoginActivityLog.js`. Integrated in Customer Dashboard security tab. Parses user-agent for device/browser info. |

### Latest Updates (Aug 2, 2026 - Session 11: Two-Factor Authentication)

| Feature | Status | Details |
|---------|--------|---------|
| Google Authenticator 2FA | 🟢 DONE | TOTP-based 2FA using PyOTP. Backend: `totp_service.py` with setup, verify, disable, recovery codes. APIs: `/api/auth/2fa/setup`, `/api/auth/2fa/verify-setup`, `/api/auth/2fa/verify`, `/api/auth/2fa/disable`, `/api/auth/2fa/regenerate-recovery`. Frontend: `TwoFactorSetup.js` with QR code (qrcode.react), manual secret entry, recovery codes download. Replay protection included. |

### Security Audit Fixes (Aug 2, 2026 - Session 12)

| Issue | Severity | Status | Fix Details |
|-------|----------|--------|-------------|
| SEC-001: Document Vault No Auth | CRITICAL | 🟢 FIXED | Added `Depends(get_current_user)` to all `/api/vault/*` endpoints. Added owner authorization checks - users can only access their own documents unless admin. |
| SEC-002: TOTP Not Enforced at Login | HIGH | 🟢 FIXED | Login now returns `totp_required: true` with short-lived `temp_token` (5 min) when user has TOTP enabled. New endpoint `/api/auth/login/verify-totp` issues full token after TOTP verification. Middleware blocks `pending_2fa` tokens from accessing protected resources. |

### Website Enhancement (Aug 2, 2026 - Session 13)

| Feature | Status | Details |
|---------|--------|---------|
| Hero Image Slider | 🟢 DONE | 5-slide carousel with auto-play (5s), left/right arrows, dot indicators. Images: Private Jet, Jet Excellence, Helicopter, Luxury Interior, In-Flight Dining |
| Services Section | 🟢 DONE | 6 premium service cards: Private Jet Charter, Helicopter Services, Corporate Solutions, Aircraft Management, Emergency Services, Concierge Services |
| About Section | 🟢 DONE | Company story, mission, values. Stats: 500+ flights, 50+ aircraft, 15+ cities, 100% safety |
| Services Page | 🟢 DONE | Dedicated `/services` page with detailed service descriptions and pricing |
| About Page | 🟢 DONE | Dedicated `/about` page with company story, timeline, certifications, team |
| Contact Section | 🟢 DONE | Updated address and email in contact cards and footer |
| Head Office Address | 🟢 UPDATED | Office No 7,8 Daynemic Granduer, D Wing, Ground Floor, Undri-Wadachi Road, Undri, Pune - 411060 |
| Email | 🟢 UPDATED | airyatraadmin@gmail.com |

### Remaining MESL Tasks
- P1: SMS OTP Integration (Twilio/MSG91)
- P1: Account Lockout (5 failed attempts)

### Website Link & Button Audit (Aug 2, 2026 - Session 14)

| Feature | Status | Details |
|---------|--------|---------|
| Footer Social Links | 🟢 FIXED | Facebook, Instagram (official), Twitter/X (official), LinkedIn (official) |
| Footer Support Links | 🟢 FIXED | Help Center → #contact, Safety Guidelines → /about, Terms → /terms, Privacy → /privacy |
| Terms of Service Page | 🟢 CREATED | `/terms` - Comprehensive legal terms page with 6 sections |
| Privacy Policy Page | 🟢 CREATED | `/privacy` - GDPR-compliant privacy policy |
| 404 Not Found Page | 🟢 CREATED | Catch-all route for invalid URLs |
| Document Vault | 🟢 REMOVED | Removed from landing page (internal feature for Operator/Employee dashboards) |

### New Enterprise Features (Aug 2, 2026 - Session 14)

| Feature | Status | Details |
|---------|--------|---------|
| Global Notification Center | 🟢 IMPLEMENTED | `/api/notifications/*` - Email, SMS, WhatsApp, Push, Approvals all in one place |
| Command Center (24×7) | 🟢 IMPLEMENTED | `/command-center` - Live Flights, Pending Approvals, SOS Alerts, AI Warnings, System Health |
| AI Pricing Advisor | 🟢 IMPLEMENTED | `/ai-pricing` - Route-based pricing suggestions with seasonal/demand factors |

### API Endpoints Added:
- `GET /api/command-center/dashboard` - Full command center data
- `GET /api/command-center/system-health` - System health status
- `GET /api/command-center/live-flights` - Active flights
- `GET /api/command-center/pending-approvals` - Approval queue
- `POST /api/command-center/sos-alert` - Create SOS alert
- `POST /api/ai-pricing/suggest` - Get AI pricing suggestion
- `GET /api/ai-pricing/popular-routes` - Popular routes list
- `GET /api/notifications/stats` - Notification statistics
- `GET /api/notifications/user/{user_id}` - User notifications
- `POST /api/notifications/create` - Create notification

### Frontend Components Added:
- `CommandCenterDashboard.js` - 24×7 monitoring dashboard
- `AIPricingAdvisor.js` - AI pricing interface with Hindi support
- `GlobalNotificationCenter.js` - Unified notification panel



### Latest Updates (Aug 2, 2026 - Session 7: Finance ERP Phase 1)

| Feature | Status | Description |
|---------|--------|-------------|
| Finance ERP Phase 1 Foundation | 🟢 DONE | (Aug 2, 2026) Complete Treasury Management System with 13 modules for ₹100 Cr+ turnover operations. **Backend**: `finance_treasury_routes.py` with endpoints for Treasury Dashboard (`/api/finance/treasury/dashboard`), Bank Account CRUD (`/api/finance/bank-accounts`), Transaction Management (`/api/finance/transactions`), Cash Management (`/api/finance/cash/*`), Daily/Monthly Summaries (`/api/finance/summary/*`), Cashflow Forecast (`/api/finance/forecast/cashflow`). **Frontend**: `TreasuryDashboard.js` (Cash position, bank balances, collections view, Add Bank Account modal), `FinanceCommandCenter.js` (24x7 real-time monitoring, AI insights, cashflow forecast). **New User Roles**: CFO, Finance Head, Accounts Manager, Treasury Analyst added to `models.py` UserRole enum. **Navigation**: Updated `FinanceDashboard.js` with Treasury ERP section (Treasury Dashboard, Command Center 24x7, Bank Accounts, Cashflow Forecast). **Tested**: All 6 API endpoints verified via curl. Bank accounts created with transactions showing real-time updates. |
| New Finance User Roles | 🟢 DONE | (Aug 2, 2026) Added 4 new enterprise finance roles to UserRole enum: `cfo` (Chief Financial Officer - Full treasury access), `finance_head` (Finance Head - Bank & payment management), `accounts_manager` (Accounts Manager - Daily transactions), `treasury_analyst` (Treasury Analyst - View & report access). Routing updated in `App.js` to grant access to `/finance/*` route for these roles. |
| Treasury Dashboard APIs | 🟢 DONE | (Aug 2, 2026) 6 comprehensive API endpoints: GET `/finance/treasury/dashboard` (CEO/CFO view with summary, pending, upcoming, monthly stats, alerts), GET/POST/PUT/DELETE `/finance/bank-accounts` (Multi-bank CRUD with primary flag), GET/POST `/finance/transactions` (Credit/Debit with auto-balance update), POST `/finance/cash/entry` & GET `/finance/cash/balance` (Cash management), GET `/finance/summary/daily` & `/finance/summary/monthly` (Period summaries), GET `/finance/forecast/cashflow` (AI-powered 30-day forecast). |
| Finance Command Center UI | 🟢 DONE | (Aug 2, 2026) Real-time 24x7 monitoring dashboard with: Current Position (Bank + Cash balance), Expected Inflow (Collections), Expected Outflow (Vendors, Salaries, Settlements, EMIs), 30-Day Forecast with health indicator (good/warning/critical), Today's Summary (Bank Credits, Debits, Cash Received, Net), Recent Transactions list with filter (All/Credits/Debits), AI Insights banner. Auto-refresh every 30 seconds. |
| Multi-Bank Management | 🟢 DONE | (Aug 2, 2026) Support for 11 Indian banks (ICICI, HDFC, SBI, Axis, BOB, Yes, Kotak, PNB, Canara, IDBI, Other). Account types: Current, Savings, Overdraft, Fixed Deposit. Features: Opening balance, Primary account flag, IFSC/Branch validation, Account deactivation (soft delete). UI: Add Bank Account modal with form validation. |

### Files Created/Modified (Session 7)
- /app/backend/routes/finance_treasury_routes.py - Already had 740 lines of Treasury APIs (verified working)
- /app/backend/server.py - Registered finance_treasury_routes router
- /app/backend/models.py - Added CFO, Finance Head, Accounts Manager, Treasury Analyst roles
- /app/frontend/src/components/finance/TreasuryDashboard.js - NEW (Cash position, bank accounts, Add Bank modal)
- /app/frontend/src/components/finance/FinanceCommandCenter.js - NEW (24x7 monitoring, AI insights)
- /app/frontend/src/pages/FinanceDashboard.js - Updated navigation with Treasury ERP section
- /app/frontend/src/App.js - Added new finance roles to route access

### Finance ERP Phase 1 - API Test Results
- POST /api/finance/bank-accounts: ✅ Created 2 accounts (ICICI ₹52.5L, HDFC ₹25L)
- POST /api/finance/transactions: ✅ Created credit transaction (₹2.5L booking payment)
- GET /api/finance/treasury/dashboard: ✅ Returns total bank balance ₹77.5L, today collection ₹2.5L
- GET /api/finance/forecast/cashflow: ✅ Returns projected balance with AI insights
- GET /api/finance/bank-accounts: ✅ Returns 2 accounts with total balance

### Upcoming Finance ERP Phases
- **Phase 2 (P1)**: Vendor Payment Management, Bill Approval Matrix with OTP, Bank Payment Hub (NEFT/UPI)
- **Phase 3 (P1)**: Government Challan Management (GST/TDS/PF), Compliance Dashboard, Auto Reminder Engine
- **Phase 4 (P2)**: Bill Repository, Bank Reconciliation, Budget vs Actual, AI Finance Assistant


### Finance ERP Phase 2 & 3 (Aug 2, 2026 - Session 7 Continued)

| Feature | Status | Description |
|---------|--------|-------------|
| Government Challans | 🟢 DONE | Complete challan management for GST, TDS, PF, ESIC, PT, IT. **APIs**: POST/GET `/api/finance/advanced/challans`, PUT `/challans/{id}/pay`, GET `/challans/upcoming`. **Features**: Due date tracking, auto-overdue detection, period-based filtering, challan status management. **Frontend**: `GovernmentChallans.js` with create modal, type filters, status badges. |
| Compliance Dashboard | 🟢 DONE | Unified compliance monitoring with health scoring. **API**: GET `/api/finance/advanced/compliance/dashboard`, `/compliance/calendar`. **Features**: Real-time compliance score (0-100), type-wise breakdown (GST/TDS/PF/ESIC/PT/IT), critical deadline alerts (≤7 days), compliance calendar with 3-month view. **Frontend**: `ComplianceDashboard.js` with score card, type-wise cards, calendar grid. |
| Bank Reconciliation | 🟢 DONE | Match bank statements with recorded transactions. **APIs**: POST `/api/finance/advanced/reconciliation/upload-statement`, GET `/reconciliation/entries`, POST `/reconciliation/auto-match`, PUT `/entries/{id}/match`, PUT `/entries/{id}/ignore`, GET `/reconciliation/summary`. **Features**: Auto-match by amount+date, manual match, ignore entries, reconciliation rate tracking. **Frontend**: `BankReconciliation.js` with upload modal, balance comparison, entries list. |
| Vendor Payment OTP | 🟢 DONE | OTP-based approval for vendor payments. **APIs**: POST `/api/finance/advanced/vendor-payment/initiate` (sends OTP), POST `/vendor-payment/approve` (verify OTP + process payment), GET `/vendor-payment/pending`. **Features**: 10-min OTP expiry, payment mode selection (NEFT/RTGS/IMPS/UPI), approval audit trail. |

### Finance ERP Test Results (Phase 2 & 3)
- POST /api/finance/advanced/challans: ✅ Created GST (₹1.25L), TDS (₹45K), PF (₹85K) challans
- GET /api/finance/advanced/compliance/dashboard: ✅ Score 94%, 3 pending challans, TDS deadline in 4 days
- POST /api/finance/advanced/reconciliation/upload-statement: ✅ 3 entries uploaded
- POST /api/finance/advanced/reconciliation/auto-match: ✅ 2/3 matched (66.7% rate)
- GET /api/finance/advanced/reconciliation/summary: ✅ Unreconciled amount ₹500 (bank charges)

### Files Created (Phase 2 & 3)
- /app/backend/routes/finance_advanced_routes.py - NEW (Challans, Compliance, Reconciliation, OTP Payments)
- /app/frontend/src/components/finance/GovernmentChallans.js - NEW
- /app/frontend/src/components/finance/ComplianceDashboard.js - NEW  
- /app/frontend/src/components/finance/BankReconciliation.js - NEW
- /app/frontend/src/pages/FinanceDashboard.js - Updated navigation with Compliance section

### Navigation Structure Updated
- Treasury ERP (Treasury Dashboard, Command Center, Bank Accounts, Cashflow Forecast, **Bank Reconciliation**)
- **Compliance** (Compliance Dashboard, Govt Challans GST/TDS)
- Dashboard, Payroll, Vendors, Billing, GST, Settlements, Accounting


### Finance ERP Phase 4 - Advanced Features (Aug 2, 2026 - Session 7 Final)

| Feature | Status | Description |
|---------|--------|-------------|
| Budget vs Actual | 🟢 DONE | Monthly budget tracking with category-wise comparison. **APIs**: POST/GET `/api/finance/phase4/budget`, GET `/budget/comparison`. **Features**: 16 budget categories (fuel, maintenance, salaries, insurance, etc.), month selector, planned vs actual comparison, variance tracking, 6-month trend chart. **Frontend**: `BudgetVsActual.js` with summary cards, category breakdown with progress bars, trend visualization. |
| AI Finance Assistant | 🟢 DONE | GPT-4o powered natural language finance queries. **APIs**: POST `/api/finance/phase4/ai-assistant/query` (non-streaming), POST `/ai-assistant/stream` (SSE streaming). **Features**: Gathers real-time financial context (bank balance, pending payments, challans, transactions), responds in Hinglish, suggested queries, fallback for offline mode. **Frontend**: `AIFinanceAssistant.js` with chat interface, streaming responses, quick stats shortcuts. |
| Auto Reminder Engine | 🟢 DONE | Configurable challan due date reminders. **APIs**: POST `/api/finance/phase4/reminders/configure`, GET `/reminders/config`, GET `/reminders/pending`, POST `/reminders/send`, GET `/reminders/history`. **Features**: Per-challan-type config, customizable days before (7, 5, 3, 2, 1), email & WhatsApp toggle, recipient list, reminder history logging. **Frontend**: `AutoReminders.js` with pending alerts, config cards, history tab. |
| Bill Repository | 🟢 DONE | Searchable archive for vendor invoices. **APIs**: POST/GET `/api/finance/phase4/bills`, GET `/bills/{id}`, PUT `/bills/{id}/archive`, PUT `/bills/{id}/tags`, GET `/bills/stats`. **Features**: Full-text search (vendor, invoice, description), category & tag filters, bill stats (total amount, by category, by month, average). **Frontend**: `BillRepository.js` with search, filters, bill cards, view modal with archive option. |

### Phase 4 Test Results
- POST /api/finance/phase4/budget: ✅ Created 4 budgets (Fuel ₹5L, Maintenance ₹2L, Salaries ₹8L, Insurance ₹1.5L)
- GET /api/finance/phase4/budget: ✅ Returns budgets with summary (Total Planned: ₹16.5L)
- POST /api/finance/phase4/ai-assistant/query: ✅ AI responds in Hinglish ("Aapka current bank balance ₹75.25L hai...")
- POST /api/finance/phase4/reminders/configure: ✅ GST reminder configured (7, 3, 1 days before)
- POST /api/finance/phase4/bills: ✅ Added 3 bills (IOC ₹1.25L, Air Works ₹85K, ICICI Lombard ₹3.5L)
- GET /api/finance/phase4/bills: ✅ Returns searchable bill repository

### Files Created (Phase 4)
- /app/backend/routes/finance_phase4_routes.py - NEW (Budget, AI Assistant, Reminders, Bills - 600+ lines)
- /app/frontend/src/components/finance/BudgetVsActual.js - NEW
- /app/frontend/src/components/finance/AIFinanceAssistant.js - NEW (GPT-4o streaming chat)
- /app/frontend/src/components/finance/AutoReminders.js - NEW
- /app/frontend/src/components/finance/BillRepository.js - NEW
- /app/frontend/src/pages/FinanceDashboard.js - Updated navigation with Analytics section

### Finance ERP Complete Summary
Total modules implemented: 17
- Phase 1 (Foundation): Treasury Dashboard, Finance Command Center, Multi-Bank Management, New User Roles
- Phase 2 (Payments): Vendor Payment OTP Approval, NEFT/UPI Hub
- Phase 3 (Compliance): Government Challans (GST/TDS/PF/ESIC/PT/IT), Compliance Dashboard, Auto Reminders
- Phase 4 (Advanced): Budget vs Actual, AI Finance Assistant, Bill Repository, Bank Reconciliation
- Phase 5 (Enterprise): Audit Trail Dashboard, PDF Invoice Export, Expense Analytics, Multi-Currency Support

### Phase 5 Finance ERP (Completed Aug 2, 2026)

| Feature | Status | Description |
|---------|--------|-------------|
| Audit Trail Dashboard | 🟢 DONE | Complete logging of all finance actions with filters (module, action, entity_type, user, date range), stats dashboard, detail modal. API: GET /api/finance/phase5/audit/logs, /audit/stats, POST /audit/log |
| PDF Invoice Export | 🟢 DONE | Professional GST-compliant invoice generation with AirYatra branding, auto CGST/SGST split, amount in words, bank details. Uses reportlab. API: POST /api/finance/phase5/invoice/generate |
| Expense Analytics | 🟢 DONE | Spending trends by period (day/week/month/quarter/year), category breakdown with drill-down, growth trends, top vendors analysis. API: GET /api/finance/phase5/analytics/expenses, /category/{category} |
| Multi-Currency Support | 🟢 DONE | Live forex rates (exchangerate-api.com + fallback), currency converter, forex vendor payments with INR conversion. Supports USD/EUR/GBP/AED/SGD/JPY/AUD/CAD/CHF. API: GET /currency/rates, POST /currency/convert, /currency/vendor-payment |

### Files Created/Modified (Phase 5)
- /app/backend/routes/finance_phase5_routes.py (all Phase 5 APIs)
- /app/frontend/src/pages/FinanceDashboard.js (updated - Phase 5 nav and rendering)
- /app/frontend/src/components/finance/AuditTrailDashboard.js
- /app/frontend/src/components/finance/ExpenseAnalytics.js
- /app/frontend/src/components/finance/MultiCurrencySupport.js
- /app/frontend/src/components/finance/PDFInvoiceExport.js

### Security Hardening (SEC-003 Fixes - Aug 2, 2026)

| Issue | Status | Fix Description |
|-------|--------|-----------------|
| X-Forwarded-For IP Spoofing | 🟢 FIXED | Implemented trusted proxy validation in `security_middleware.py`. Only trusts X-Forwarded-For when request comes from known private IP ranges (10.x, 172.16-31.x, 192.168.x). Prevents attackers from spoofing client IPs. |
| JWT in localStorage (XSS risk) | 🟢 FIXED | Added httpOnly cookie support in `middleware.py` and `auth_routes.py`. Token can now be stored in secure httpOnly cookies (SAMESITE=lax, SECURE=true in prod). Backwards compatible - still accepts Authorization header for API clients. |
| Logout endpoint missing | 🟢 FIXED | Added POST /api/auth/logout that clears httpOnly cookie and revokes current session token. |

### Files Modified (Security)
- /app/backend/security_middleware.py - `get_client_ip()` now validates trusted proxies
- /app/backend/middleware.py - `get_token_from_request()` reads from cookie or header
- /app/backend/routes/auth_routes.py - Added `set_auth_cookie()`, `clear_auth_cookie()`, `/logout` endpoint

### Finance Analytics Dashboard (Aug 2, 2026)

| Feature | Status | Description |
|---------|--------|-------------|
| Revenue Trends | 🟢 DONE | Monthly revenue visualization with period filter (3/6/12 months), advance vs balance breakdown, MoM growth rates, gateway breakdown. API: GET /api/finance/analytics/revenue-trends |
| Gateway Reconciliation | 🟢 DONE | Payment gateway reconciliation dashboard showing collected vs settled vs pending amounts by gateway (Stripe, Razorpay, UPI, NEFT). Auto-alerts for high pending settlements. API: GET /api/finance/analytics/gateway-reconciliation |
| Collection Summary | 🟢 DONE | Quick stats cards - Today, This Week, This Month, All Time revenue + Pending Balances count. API: GET /api/finance/analytics/collection-summary |
| Top Customers | 🟢 DONE | Leaderboard of top customers by revenue with booking count and membership tier. API: GET /api/finance/analytics/top-customers |

### Files Created (Analytics)
- /app/backend/routes/finance_analytics_routes.py (new)
- /app/frontend/src/components/finance/FinanceAnalyticsDashboard.js (new)
- /app/frontend/src/pages/FinanceDashboard.js (updated - added "Revenue & Recon" nav item)

### Payment Reconciliation System (Aug 2, 2026)

| Feature | Status | Description |
|---------|--------|-------------|
| Reconciliation Summary | 🟢 DONE | Dashboard showing total/matched/unmatched/disputed transactions, match rate percentage, amounts summary. API: GET /api/finance/reconciliation/summary |
| Transaction List | 🟢 DONE | Paginated transaction list with filters (gateway, status), enriched with booking info. API: GET /api/finance/reconciliation/transactions |
| Auto-Match | 🟢 DONE | Automatic matching of system transactions with gateway settlements (Stripe/Razorpay). Verifies amounts, flags mismatches as disputed. API: POST /api/finance/reconciliation/auto-match |
| Manual Match | 🟢 DONE | Manual matching for edge cases with notes. API: POST /api/finance/reconciliation/manual-match |
| Dispute Management | 🟢 DONE | Mark transactions as disputed with reason. API: POST /api/finance/reconciliation/dispute |

### Finance Reports PDF (Aug 2, 2026)

| Feature | Status | Description |
|---------|--------|-------------|
| Monthly Report PDF | 🟢 DONE | Professional PDF report with executive summary, revenue breakdown (by type, by gateway), expense breakdown, reconciliation status, top customers. Uses ReportLab. API: POST /api/finance/reconciliation/reports/monthly-pdf |
| Quick Summary | 🟢 DONE | JSON preview before PDF generation with revenue, expenses, net, transactions, bookings. API: GET /api/finance/reconciliation/reports/quick-summary |

### Files Created (Reconciliation & Reports)
- /app/backend/routes/finance_reconciliation_routes.py (new - 9 API endpoints)
- /app/frontend/src/components/finance/PaymentReconciliation.js (new - full UI with modals)
- /app/frontend/src/pages/FinanceDashboard.js (updated - added "Payment Reconciliation" nav item)

### Settlement Auto-Sync (Aug 2, 2026)

| Feature | Status | Description |
|---------|--------|-------------|
| Stripe Settlement Sync | 🟢 DONE | Daily auto-sync of Stripe payouts and balance transactions. Fetches last 30 days on each run. Stores in `stripe_settlements` and `stripe_balance_transactions` collections. |
| Razorpay Settlement Sync | 🟢 DONE | Daily auto-sync of Razorpay settlements with UTR numbers. Stores in `razorpay_settlements` collection. |
| Manual Sync Trigger | 🟢 DONE | API to manually trigger sync for either/both gateways. POST /api/finance/scheduled/settlement-sync/trigger |
| Sync Status Dashboard | 🟢 DONE | View sync logs, settlement counts, last sync times. GET /api/finance/scheduled/settlement-sync/status |

### Scheduled Finance Reports (Aug 2, 2026)

| Feature | Status | Description |
|---------|--------|-------------|
| Report Scheduling | 🟢 DONE | Create scheduled reports with daily/weekly/monthly frequency. Set specific send day (day of week for weekly, day of month for monthly). |
| Multi-Recipient | 🟢 DONE | Configure multiple email recipients per scheduled report. |
| Toggle Active/Pause | 🟢 DONE | Enable/disable scheduled reports without deleting. POST /api/finance/scheduled/reports/{id}/toggle |
| Send Now | 🟢 DONE | Manually trigger a scheduled report to be sent immediately with PDF attachment. POST /api/finance/scheduled/reports/{id}/send-now |
| Auto Email | 🟢 DONE | Scheduler job runs every 6 hours, checks for due reports, generates PDF, sends via email with attachment. |

### Files Created (Scheduled Reports & Settlement Sync)
- /app/backend/scheduler.py (updated - added 3 new jobs: stripe_settlement_sync, razorpay_settlement_sync, scheduled_finance_reports)
- /app/backend/routes/finance_scheduled_routes.py (new - 10 API endpoints)
- /app/backend/services/email_service.py (updated - added send_email_with_attachment helper)
- /app/frontend/src/components/finance/ScheduledReportsManager.js (new - full UI with tabs for reports and sync status)

### New Scheduler Jobs
- `stripe_settlement_sync` - Daily Stripe payout/balance sync
- `razorpay_settlement_sync` - Daily Razorpay settlement sync
- `scheduled_finance_reports` - Every 6 hours, processes due reports


---

## HYBRID SMART PRICING & AI DISPATCH ENGINE - Phase 1

### Latest Updates (Aug 2, 2026 - Session: Phase 1 Smart Pricing & Legal)

| Feature | Status | Description |
|---------|--------|-------------|
| Legal Content APIs | 🟢 DONE | Backend routes for Terms & Conditions, Privacy Policy, Cancellation Policy. Returns exact user-provided legal text (v1.0, effective 03.08.2026). GET /api/legal/terms-and-conditions, /privacy-policy, /cancellation-policy |
| Booking Consents API | 🟢 DONE | GET /api/legal/consents returns mandatory (5 base + 1 conditional for village_landing) and optional (2) consent items. POST /api/legal/consents/record validates and stores consent acceptance with booking_type-aware validation. |
| Fixed Route Pricing (Operator) | 🟢 DONE | POST /api/routes/fixed - Operators create fixed routes with aircraft, pricing breakdown (base, landing, operational, offer). Validates aircraft ownership, checks duplicate routes. |
| Fixed Route Pricing (Customer Search) | 🟢 DONE | GET /api/routes/search?origin=X&destination=Y&date=Z&passengers=N - Customer searches available instant-bookable routes. Returns full price breakdown with GST or suggest_auction=true if no match. |
| Fixed Route Admin APIs | 🟢 DONE | GET /api/routes/admin/all, POST /api/routes/admin/verify/{id}, PUT/GET /api/routes/admin/pricing-settings - Admin route management and platform pricing configuration. |
| Legal Pages Frontend | 🟢 DONE | /legal/terms, /legal/privacy, /legal/cancellation - Dynamic pages fetching content from backend APIs. Tab navigation between policies, bilingual titles (English/Hindi). |
| Mandatory Consent Checkboxes | 🟢 DONE | BookingPage step 4 shows 5 mandatory consent checkboxes. Submit button DISABLED until ALL 5 consents accepted. State tracks: terms_conditions, flight_conditions, platform_role, passenger_info, electronic_consent. |
| Consent Data in Inquiry | 🟢 DONE | Inquiry submission includes consents_accepted object with all accepted consent IDs and timestamp. |
| Village Landing Consent | 🟢 DONE | Conditional 6th consent (village_landing) shown only for village landing bookings. Backend validates based on booking_type. |

### Backend Files Created/Modified
- `/app/backend/routes/legal_routes.py` - Legal content constants (15K+ T&C, 5K+ Cancellation, 3K+ Privacy) and API endpoints
- `/app/backend/routes/fixed_route_pricing_routes.py` - 605 lines, full Operator CRUD + Customer search + Admin management
- `/app/backend/server.py` - Added imports and router registration for legal_routes and fixed_route_pricing_routes

### Frontend Files Created/Modified
- `/app/frontend/src/pages/LegalPage.js` - NEW - Dynamic legal content display with markdown-like rendering
- `/app/frontend/src/pages/BookingPage.js` - Added 5 mandatory consent checkboxes, allConsentsAccepted gate, submit button disabled logic
- `/app/frontend/src/App.js` - Added routes for /legal/terms, /legal/privacy, /legal/cancellation

### New DB Collections
- `fixed_routes` - Operator-defined route pricing
- `consent_records` - User consent acceptance logs
- `platform_settings` - Admin pricing settings (commission %, platform fee)

### Test Report
- `/app/test_reports/iteration_19.json` - Testing agent verified all legal APIs, fixed route APIs, and frontend consent UI

---

## HYBRID SMART PRICING & AI DISPATCH ENGINE - Phase 2

### Latest Updates (Aug 2, 2026 - Session: Phase 2 AI Reverse Auction)

| Feature | Status | Description |
|---------|--------|-------------|
| Auction Creation (Customer) | 🟢 DONE | POST /api/auctions/create - Customer creates auction with route, date, passengers, aircraft type. 3-30 minute auction window configurable. |
| Pending Auctions (Operator) | 🟢 DONE | GET /api/auctions/operator/pending - Operators see active auctions to bid on, sorted by end time. Shows if already quoted. |
| Quote Submission (Operator) | 🟢 DONE | POST /api/auctions/{id}/quote - Operators submit quotes with pricing breakdown (base, landing, handling, crew, fuel, discount). Auto-calculates 18% GST. |
| Quote Update/Withdraw | 🟢 DONE | PUT /api/auctions/{id}/quote to update, DELETE to withdraw. Only pending quotes can be modified. |
| Auction Details (Customer) | 🟢 DONE | GET /api/auctions/{id} - Customer sees all quotes sorted by price (lowest first). Operator sees only their quote. |
| Quote Selection (Customer) | 🟢 DONE | POST /api/auctions/{id}/select-quote - Customer selects winning quote. Other quotes auto-rejected. Auction status → quote_selected. |
| Auction Cancel | 🟢 DONE | POST /api/auctions/{id}/cancel - Customer cancels auction, all quotes expired. |
| Admin Stats | 🟢 DONE | GET /api/auctions/admin/stats - Total auctions, active, completed, conversion rate, revenue stats. |
| Auction Expiry System | 🟢 DONE | POST /api/auctions/system/expire-auctions - Cron endpoint to expire old auctions. |
| Customer Auction UI | 🟢 DONE | /customer/auctions - Create auction form, view active auctions, countdown timer, quotes list, select quote. |
| Operator Auction UI | 🟢 DONE | /operator/auctions - Live auctions feed, quote submission form with pricing breakdown. |
| Footer Legal Links | 🟢 DONE | Added T&C, Privacy Policy, Cancellation Policy links to website footer (Legal/कानूनी section). |
| Operator Notification Fix | 🟢 DONE | Fixed notify_operators_new_auction() to match both status="active" and is_active=true patterns. |

### Backend Files Created/Modified
- `/app/backend/routes/auction_routes.py` - NEW - 1060 lines, full auction CRUD, operator quotes, admin stats
- `/app/backend/server.py` - Registered auction_routes

### Frontend Files Created/Modified
- `/app/frontend/src/components/auction/AuctionDashboard.js` - NEW - CustomerAuctions, OperatorAuctions, CreateAuctionForm, QuoteForm components
- `/app/frontend/src/pages/CustomerDashboard.js` - Added "Live Auctions" nav item and route
- `/app/frontend/src/pages/OperatorDashboard.js` - Added "Live Auctions" nav item and route
- `/app/frontend/src/pages/LandingPage.js` - Added Legal section to footer with T&C, Privacy, Cancellation links

### New DB Collections
- `auctions` - Customer auction requests with status, timing, route details
- `auction_quotes` - Operator quotes with pricing breakdown, status

### Test Report
- `/app/test_reports/iteration_20.json` - 25/25 pytest tests passed for auction backend

### Auction Flow
1. Customer creates auction (origin → destination, date, passengers, aircraft type, duration)
2. System notifies operators (background task)
3. Operators submit competitive quotes with pricing breakdown
4. Customer sees all quotes sorted by price (lowest first)
5. Customer selects winning quote before timer expires
6. Selected quote proceeds to payment flow

---

## HYBRID SMART PRICING - Phase 3-5

### Latest Updates (Aug 2, 2026 - Session: Phase 3-5 Aircraft Catalog, Price Breakup, Price Lock)

| Feature | Status | Description |
|---------|--------|-------------|
| **PHASE 3: Aircraft Catalog & Verification** | | |
| Aircraft Creation | 🟢 DONE | POST /api/aircraft/create - Operator creates aircraft with basic_info (type, manufacturer, model, registration), features (seats, amenities), pricing |
| My Fleet Dashboard | 🟢 DONE | GET /api/aircraft/my-fleet - Operator sees all aircraft with stats (total, verified, pending, published) |
| Aircraft Documents | 🟢 DONE | PUT /api/aircraft/{id}/documents - Upload registration, insurance, maintenance certificates |
| Aircraft Photos | 🟢 DONE | PUT /api/aircraft/{id}/photos - Upload front, rear, cockpit, cabin, interior photos |
| Crew Management | 🟢 DONE | POST /api/aircraft/{id}/crew - Add pilot, co-pilot, crew with licence and medical info |
| Availability Status | 🟢 DONE | PUT /api/aircraft/{id}/availability - Set available, busy, maintenance, reserved, blocked |
| Admin Verification Queue | 🟢 DONE | GET /api/aircraft/admin/verification-queue - Admin sees pending aircraft for review |
| Admin Verify Aircraft | 🟢 DONE | PUT /api/admin/{id}/verify - Set verification status (pending→under_review→verified→premium_verified or suspended) |
| Expiring Documents Alert | 🟢 DONE | GET /api/aircraft/admin/expiring-documents - Admin sees insurance/maintenance expiring in 30/60/90 days |
| Verification Badge | 🟢 DONE | "✅ Verified by AirYatra" badge for verified/premium_verified aircraft |
| Public Search | 🟢 DONE | GET /api/aircraft/public/search - Customer searches verified, published aircraft |
| **PHASE 4: Transparent Price Breakup** | | |
| Customer Breakup | 🟢 DONE | POST /api/pricing/customer/breakup - Shows Base Fare, Landing, Handling, Crew, Fuel, Platform Fee (10% + ₹500), GST (18%) |
| Quote Breakup | 🟢 DONE | GET /api/pricing/customer/quote/{id}/breakup - Price breakdown for auction quote |
| Operator Settlement Preview | 🟢 DONE | POST /api/pricing/operator/settlement-preview - Shows quote, deductions (commission, TDS 2%), net payout |
| Quote Settlement | 🟢 DONE | GET /api/pricing/operator/quote/{id}/settlement - Settlement for submitted quote |
| **PHASE 5: Price Lock Timer** | | |
| Create Price Lock | 🟢 DONE | POST /api/pricing/lock - Lock price for 5-30 minutes (default 15) |
| Get Lock Status | 🟢 DONE | GET /api/pricing/lock/{id} - Check lock status with time remaining |
| Validate Lock | 🟢 DONE | GET /api/pricing/lock/{id}/validate - Validate lock is still active |
| Use Lock | 🟢 DONE | POST /api/pricing/lock/{id}/use - Mark lock as used after payment |
| Lock Timer UI | 🟢 DONE | PriceLockTimer component with countdown, expired state, locked total display |

### Backend Files Created
- `/app/backend/routes/aircraft_catalog_routes.py` - 893 lines, Aircraft CRUD, verification workflow, admin endpoints
- `/app/backend/routes/price_breakup_routes.py` - 450 lines, Customer/Operator breakup, price lock system

### Frontend Files Created
- `/app/frontend/src/components/aircraft/AircraftCatalog.js` - OperatorFleetDashboard, CreateAircraftForm, AircraftCard, VerificationBadge
- `/app/frontend/src/components/pricing/PriceBreakup.js` - CustomerPriceBreakup, OperatorSettlementView, PriceLockTimer

### New DB Collections
- `aircraft_catalog` - Full aircraft data with verification, documents, photos, crew, pricing
- `verification_logs` - Admin verification action history
- `price_locks` - Price lock records with timing and status
- `platform_settings` - Configurable platform fees and rates

### Pricing Formula
- Platform Commission: 10% of base fare
- Platform Fixed Fee: ₹500
- GST: 18% on (subtotal + platform_fee)
- TDS (Operator): 2% of total quote
- Net Payout: Quote - Commission - Fixed Fee - TDS

### Verification Levels
- 🔴 Pending - Initial state
- 🟡 Under Review - Admin reviewing
- 🟢 Verified - Documents verified
- 🔵 Premium Verified - Full verification + premium status
- ⚫ Suspended - Temporarily blocked

### Test Report
- `/app/test_reports/iteration_21.json` - 25/25 pytest tests passed

---

## AIRYATRA HYBRID SMART PRICING - PHASE 6: AI Compliance Monitor & Document Vault UI (Aug 2, 2026)

### Overview
Enterprise-level Aircraft Verification & Compliance System with:
1. **AI Compliance Monitor Dashboard** - CEO/Admin view of aircraft compliance status
2. **Admin Verification Queue** - Approve/Reject uploaded documents
3. **Operator Document Vault UI** - Upload aircraft photos & compliance documents

### Features Implemented

| Feature | Status | Notes |
|---------|--------|-------------|
| **AI Compliance Monitor Dashboard** | 🟢 DONE | ComplianceDashboard.js - Stats cards (total/verified/pending/suspended), expiry alerts, document categories, compliance reports |
| **Admin Verification Queue** | 🟢 DONE | AdminVerificationQueue.js - Pending/Verified/Rejected tabs, document preview, approve/reject with notes |
| **Aircraft Document Manager** | 🟢 DONE | AircraftDocumentManager.js - Drag-drop upload, DGCA docs, insurance, maintenance, photo categories |
| **Admin Document Routes** | 🟢 DONE | /api/admin/document-vault/* - verification-queue, stats, bulk-verify, operator documents |
| **Document Verification API** | 🟢 DONE | POST /api/vault/verify/{id} - Approve/reject documents (fixed 422 bug) |

### Backend Files Created/Modified
- `/app/backend/routes/admin_document_routes.py` - 100 lines, Admin verification queue endpoints (prefix: /admin/document-vault)
- `/app/backend/models.py` - DocumentVerification.document_id made Optional (fixes 422 on approve/reject)
- `/app/backend/routes/compliance_monitor_routes.py` - Existing compliance APIs

### Frontend Files Created
- `/app/frontend/src/components/admin/ComplianceDashboard.js` - AI Compliance Monitor dashboard with tabs
- `/app/frontend/src/components/admin/AdminVerificationQueue.js` - Document verification queue
- `/app/frontend/src/components/aircraft/AircraftDocumentManager.js` - Operator document/photo upload

### Admin Dashboard Integration
- `/admin?tab=compliance_dashboard` - AI Compliance Monitor
- `/admin?tab=verification_queue` - Document Verification Queue

### Document Categories (DGCA Compliant)
- **Regulatory**: Registration Certificate, Certificate of Airworthiness, AOC, DGCA Permissions
- **Insurance**: Aircraft Insurance, Third Party, Passenger Liability, Hull Insurance
- **Maintenance**: Maintenance Release, Technical Log, Component History, AD Compliance
- **Aircraft Photos**: Front, Rear, Left, Right, Cockpit, Cabin, Interior, VIP Cabin, Emergency Equipment

### Test Reports
- `/app/test_reports/iteration_22.json` - Backend compliance APIs 100% pass
- `/app/test_reports/iteration_23.json` - Found route collision & 422 bugs
- `/app/test_reports/iteration_24.json` - 18/18 tests pass after fixes
- `/app/test_reports/iteration_25.json` - Object storage + photo gallery tests

### Known Issues (Minor - Not Blocking)
- N+1 query in verification-queue enrichment (acceptable at current scale)
- bulk-verify uses primitive params instead of Pydantic model
- /new-version endpoint still uses base64 (needs update for object storage)

---

## PHASE 7: Real File Storage & Photo Gallery (Aug 2, 2026)

### Overview
Replaced base64-in-MongoDB storage with Emergent Object Storage. Added image thumbnails and photo gallery with lightbox preview.

### Features Implemented

| Feature | Status | Notes |
|---------|--------|-------------|
| **Emergent Object Storage** | 🟢 DONE | Primary storage for all document uploads via storage_service.py |
| **Image Thumbnails** | 🟢 DONE | Auto-generated 300x300 thumbnails for images using PIL |
| **Thumbnail API** | 🟢 DONE | GET /api/vault/thumbnail/{file_id} serves optimized thumbnails |
| **Photo Gallery API** | 🟢 DONE | GET /api/vault/photos/{owner_id} returns all photos with thumbnails |
| **Photo Gallery UI** | 🟢 DONE | Grid view with hover preview, upload progress bar |
| **Lightbox Viewer** | 🟢 DONE | PhotoGalleryLightbox with keyboard navigation (arrows, ESC) |
| **Base64 Fallback** | 🟢 DONE | Falls back to MongoDB if object storage fails |

### Backend Changes
- `/app/backend/routes/document_vault_routes.py`:
  - `POST /api/vault/upload` - Now uses object storage + generates thumbnails
  - `GET /api/vault/file/{file_id}` - Retrieves from object storage or base64 fallback
  - `GET /api/vault/thumbnail/{file_id}` - New endpoint for thumbnails
  - `GET /api/vault/image/{file_id}` - Inline image preview
  - `GET /api/vault/photos/{owner_id}` - Gallery endpoint

### Frontend Changes
- `/app/frontend/src/components/aircraft/AircraftDocumentManager.js`:
  - Added `PhotoGalleryLightbox` component with keyboard navigation
  - Photos tab shows actual image thumbnails
  - Hover preview with zoom button
  - Upload progress indicator
  - Cloud Storage badge for object storage uploads

### Storage Schema
```json
{
  "storage_type": "object_storage",
  "storage_path": "airyatra/vault/{owner_id}/{file_id}/{filename}",
  "thumbnail_url": "/api/vault/thumbnail/{file_id}",
  "thumb_storage_path": "airyatra/vault/{owner_id}/{file_id}/thumb_{filename}"
}
```

### Test Report
- `/app/test_reports/iteration_25.json` - 14/16 pass (thumbnail_url bug found and fixed)

---

## PHASE 8: Account Lockout Security & Code Refactoring (Aug 2, 2026)

### Overview
Implemented enterprise-grade account lockout security after 5 failed login attempts, and refactored large CRM components into smaller reusable modules.

### P0 Features Implemented

| Feature | Status | Notes |
|---------|--------|-------|
| **Account Lockout (5 attempts)** | 🟢 DONE | AccountLockoutService tracks failed attempts per email, locks for 30 min |
| **Email Unlock Link** | 🟢 DONE | Secure unlock token sent via email, 60 min expiry |
| **Admin Locked Accounts** | 🟢 DONE | GET /api/auth/admin/locked-accounts lists all locked users |
| **Admin Force Unlock** | 🟢 DONE | POST /api/auth/admin/unlock-account/{email} admin override |
| **Unlock Account Page** | 🟢 DONE | /unlock-account frontend page handles email token unlock |
| **PDF Document Viewer** | 🟢 DONE | PDFDocumentViewer.js with zoom, download, fullscreen |

### Backend Files Created/Modified
- `/app/backend/services/account_lockout_service.py` - 280 lines, full lockout logic
- `/app/backend/routes/auth_routes.py` - Added lockout integration to /login + new endpoints
- `/app/backend/services/email_service.py` - Added account_locked email template
- `/app/backend/security_middleware.py` - Raised login rate limit to 10/min (above lockout threshold)

### Frontend Files Created
- `/app/frontend/src/pages/UnlockAccountPage.js` - Email unlock link handler
- `/app/frontend/src/components/documents/PDFDocumentViewer.js` - PDF preview with zoom
- `/app/frontend/src/App.js` - Added /unlock-account route

### P2 Code Refactoring Completed

| Component | Before | After | Notes |
|-----------|--------|-------|-------|
| **CRM Dashboard** | 1107 lines | Modular | Split into CRMStatsCards, CRMLeadsList, CRMLeadModal |

### Refactored CRM Components
- `/app/frontend/src/components/crm/CRMStatsCards.js` - Dashboard stats cards
- `/app/frontend/src/components/crm/CRMLeadsList.js` - Leads table with filters
- `/app/frontend/src/components/crm/CRMLeadModal.js` - Lead create/edit modal
- `/app/frontend/src/components/crm/index.js` - Exports + shared configs

### Account Lockout Flow
```
1. User attempts login → failed
2. record_failed_attempt() increments counter
3. After 5 failures → account locked for 30 minutes
4. Email sent with unlock link (/unlock-account?email=x&token=y)
5. User clicks link → POST /api/auth/unlock-account → account unlocked
6. OR Admin uses /api/auth/admin/unlock-account/{email}
7. OR Wait 30 minutes for auto-unlock
```

### Test Reports
- `/app/test_reports/iteration_26.json` - 12/13 pass, 1 skipped (rate limit interaction)
- `/app/backend/tests/test_account_lockout.py` - 13 test cases

### Bug Fixes
- Fixed timezone-naive vs aware datetime comparison in unlock_with_token (CRITICAL)
- Raised /login rate limit from 5/min to 10/min to allow 423 pre-check to work

---
