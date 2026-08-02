"""
AirYatra - Legal Pages & Consent Management
Terms & Conditions, Privacy Policy, Cancellation Policy, and Booking Consent
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional, List
from datetime import datetime, timezone
from pydantic import BaseModel
from database import get_database
from middleware import get_current_user
import uuid

router = APIRouter(prefix="/legal", tags=["Legal & Consent"])

# ==================== LEGAL CONTENT ====================

TERMS_AND_CONDITIONS = """
AIRYATRA TERMS AND CONDITIONS

AirYatra (Brand), a unit of Lucuma Corporation Pvt. Ltd.
Last Updated: August 2, 2026
Effective Date: 03.08.2026
Version: v1.0

1. ACCEPTANCE OF TERMS

1.1 These Terms and Conditions ("Terms") constitute a legally binding agreement between you ("User", "Customer", or "Operator", as applicable) and Lucuma Corporation Pvt. Ltd., operating under the brand AirYatra ("AirYatra", "Company", "we", "us", "our", "Platform").

1.2 By accessing, browsing, registering on, or using the AirYatra Platform (website, mobile application, customer support channels, or any related services), you acknowledge that you have read, understood, and agree to be bound by these Terms and all policies referenced herein.

1.3 If you do not agree to these Terms, you must immediately cease using the Platform.

1.4 AirYatra reserves the right to modify these Terms at any time. Changes will be effective upon posting on the Platform. Your continued use constitutes acceptance of the modified Terms.

2. DEFINITIONS

| Term | Definition |
|------|------------|
| Platform | AirYatra website, mobile applications, dashboards, and all related services operated by Lucuma Corporation Pvt. Ltd. |
| User | Any individual or entity accessing or using the Platform. |
| Customer | End-user booking helicopter/private charter services through the Platform. |
| Operator | DGCA-approved helicopter/private charter provider listed/registered on AirYatra. |
| Booking | A confirmed reservation for helicopter/private charter services facilitated through the Platform. |
| Services | Aggregation, inquiry, booking facilitation, payment collection, invoicing, and support services provided through the Platform. |
| Total Amount | Amount payable by Customer for a Booking as shown at checkout/confirmation (including fees and applicable taxes as displayed). |
| Platform Fee | AirYatra's fee/commission/service charge (may be 0%–30%) as disclosed at booking. |
| Operator Payout | Amount paid by AirYatra to the Operator after deducting Platform Fee and any other deductions disclosed to the Customer and/or agreed with the Operator (as applicable). |

3. ELIGIBILITY & USER REGISTRATION

3.1 Age Requirement: Users must be at least 18 years old to create an account and transact.

3.2 Account Registration: To use certain features, you must create an account and provide accurate, complete, and current information.

3.3 Account Responsibility: You are solely responsible for maintaining confidentiality of credentials and all activities under your account.

3.4 Prohibited Users: The following are prohibited from using the Platform:
- minors,
- persons under legal/regulatory restrictions,
- users involved in fraudulent transactions/chargeback abuse,
- individuals banned by AirYatra or regulatory authorities.

3.5 Suspension/Termination: AirYatra may suspend/terminate accounts for violation of Terms, fraud, repeated cancellations, non-payment, abuse, security risks, or regulatory directives.

4. SERVICES PROVIDED & PLATFORM ROLE

4.1 Aggregator Marketplace: AirYatra is a marketplace/aggregator connecting Customers with independent Operators.

4.2 No Direct Flight Operations: AirYatra does not own, operate, maintain, or control aircraft. All flights are operated by independent Operators.

4.3 No Employment Relationship: Operators are independent contractors and not employees/agents of AirYatra.

4.4 Service Availability: AirYatra aims to provide reliable access but does not guarantee uninterrupted service.

4.5 Not Medical Evacuation: AirYatra does not offer or advertise medical evacuation services.

5. BOOKING TERMS

5.1 Booking Process:
- Customers select/request route, date/time, passengers and requirements,
- Operator(s) provide quote/availability,
- Booking is confirmed only after Operator confirmation and receipt of required payment by AirYatra,
- Customer receives confirmation with booking details.

5.2 Subject to Availability & Safety: Bookings are subject to Operator availability, aircraft readiness, weather, NOTAM/ATC constraints, and safety considerations.

5.3 Customer Obligations:
- Provide accurate passenger details and documents,
- Provide accurate passenger/baggage weight where requested,
- Arrive on time, follow safety instructions and briefings,
- Comply with Operator baggage limits and security rules.

5.4 Identification: Valid government ID may be required for all passengers before boarding.

6. PRICING, PAYMENT COLLECTION, SETTLEMENT & INVOICING

6.1 Pricing: Pricing is set by Operators and displayed/communicated on the Platform (including any landing/parking charges, permits, waiting time, positioning/ferry, etc., where applicable and disclosed).

6.2 Platform Fee: AirYatra charges a Platform Fee/commission which may range from 0% to 30% depending on Operator/service and will be disclosed to the Customer at booking/checkout or in the booking confirmation.

6.3 Payment Collection by AirYatra:
(a) Customer makes payment to AirYatra using available methods (UPI, cards, net banking, corporate billing, etc.).
(b) AirYatra may deduct Platform Fee and other deductions (if any) only where disclosed and/or contractually agreed.
(c) AirYatra will remit the balance as Operator Payout to the Operator as per settlement timelines and arrangements between AirYatra and the Operator.

6.4 Invoice Issuance by AirYatra: AirYatra will issue the invoice/receipt for the booking to the Customer as per applicable law and tax requirements.

6.5 Payment Issues: AirYatra is not liable for failures/interruptions caused by banks/payment gateways. Customers must report payment issues within 7 days.

6.6 Taxes (GST, etc.): Applicable taxes (including GST where applicable) will be charged as per prevailing Indian tax law and shown on the invoice.

7. CANCELLATION, RESCHEDULING & REFUNDS

7.1 Disclosure: Cancellation/refund rules applicable to a booking will be shown/communicated at the time of booking/confirmation. Operator constraints may apply due to aviation scheduling and positioning costs.

7.2 Customer Cancellation (baseline):
- 72+ hours before scheduled departure: Full/near-full refund (minus non-refundable charges if explicitly disclosed)
- 24–72 hours before: Partial refund (typically 50%–75%)
- Within 24 hours / No-show: No refund

7.3 Refund Timeline: Refunds are typically processed within 7–10 business days, subject to bank/payment gateway timelines.

7.4 Operator Cancellation: If the Operator cancels (excluding force majeure), Customer is eligible for a full refund. AirYatra may assist with rebooking where feasible.

7.5 Force Majeure: Weather, natural disasters, ATC restrictions, DGCA/regulatory directives, law-and-order situations, and other events beyond control may cause cancellation/rescheduling. In such cases, Customer may be offered rescheduling or refund as per feasibility and disclosed policy.

8. LANDING PERMISSIONS & REGULATORY COMPLIANCE

8.1 Customer Responsibility: Customers are responsible for obtaining necessary landing permissions/NOCs from village/local authorities, helipad owners, or land owners unless explicitly agreed otherwise in writing.

8.2 AirYatra Support: AirYatra may assist with coordination/document submission but does not guarantee approvals.

8.3 Regulatory Compliance: All flights must comply with DGCA regulations/CARs, ANS/ATC requirements, state/local guidelines, security protocols, and environmental requirements.

8.4 Denial of Service: AirYatra/Operator may deny or cancel service if permissions are not obtained, documents are incomplete/false, regulations are violated, safety concerns arise, or the destination is unsafe/inaccessible.

9. INSURANCE, BAGGAGE, DAMAGE, LOSS (IMPORTANT)

9.1 Operator Insurance: Operators represent that they maintain insurance coverage as required by DGCA and applicable law (e.g., passenger/third-party/hull insurance as applicable).

9.2 No AirYatra Insurance: AirYatra does not provide insurance coverage for:
- passenger injury/death,
- baggage loss/delay/damage,
- property damage,
- theft, missing items, or consequential losses.

9.3 Baggage Rules: Baggage limits and allowed items depend on aircraft type and Operator policy. Customers must follow Operator instructions and aviation security rules.

9.4 Valuables: Customers should not pack valuables (cash, jewelry, important documents, sensitive electronics) in checked/handled baggage where possible. Any loss is primarily governed by Operator policy and applicable law.

9.5 Claims: Any claims relating to baggage/property loss or damage during flight operations must be raised with the Operator. AirYatra may help in coordination but is not liable.

10. SAFETY & PROHIBITED ITEMS

10.1 Customers must comply with all safety briefings and crew instructions.

10.2 Prohibited items include weapons, explosives, flammables, illegal substances, hazardous materials, and items restricted under aviation/security laws.

10.3 AirYatra/Operator may deny boarding/service for safety or regulatory reasons without liability.

11. OPERATOR TERMS (SUMMARY)

11.1 Eligibility: Operators must hold valid DGCA approvals and, where applicable, a valid Air Operator Certificate (AOC), and maintain required insurance and compliance.

11.2 Operational Responsibility: Operators are solely responsible for flight operations, safety, crew, maintenance, aircraft airworthiness, and regulatory compliance.

11.3 Availability & Service Quality: Operators must maintain accurate availability, honor confirmed bookings except for safety/regulatory reasons, and maintain professional standards. AirYatra may delist Operators for compliance failures, safety concerns, fraud, repeated cancellations, or poor service.

11.4 Disputes: AirYatra may mediate, but operational liability remains with the Operator.

12. CUSTOMER CONDUCT & RESTRICTIONS

12.1 Customers must not:
- provide false or misleading information,
- engage in fraud or illegal activity,
- harass/abuse/threaten Operators or staff,
- attempt to bypass the Platform and transact off-platform where prohibited,
- violate any applicable laws/regulations.

12.2 AirYatra may suspend or terminate accounts for violations.

13. PRIVACY & DATA PROTECTION

13.1 AirYatra collects data required to facilitate bookings and payments (name, contact details, passenger details, booking details, and payment-related metadata).

13.2 Data is handled in accordance with applicable Indian law including the Information Technology Act, 2000 and related rules, and applicable data protection law as enacted/amended.

13.3 Customer data is shared with Operators only as necessary to complete bookings and comply with law. See AirYatra's Privacy Policy for details.

13.4 The Platform may use cookies/analytics to improve user experience.

14. INTELLECTUAL PROPERTY

14.1 All Platform content, design, trademarks, software, and functionality are owned by AirYatra or its licensors.

14.2 Users receive a limited, non-exclusive, non-transferable license to use the Platform for lawful purposes.

14.3 Users must not reproduce, scrape, reverse engineer, distribute, or use Platform content for competitive purposes.

15. DISCLAIMERS & LIMITATION OF LIABILITY

15.1 The Platform is provided "as is" and "as available" without warranties of any kind.

15.2 AirYatra is not liable for flight delays, cancellations, diversions, incidents, accidents, or operational failures caused by Operators, weather, ATC, technical issues, or regulatory actions.

15.3 Limitation: To the maximum extent permitted by law, AirYatra's total liability for any claim related to a booking shall not exceed the Platform Fee actually received by AirYatra for that booking (or such amount as required by applicable law).

15.4 AirYatra is not liable for indirect/incidental/consequential damages (loss of profits, business interruption, reputational loss, etc.) to the extent permitted by law.

16. INDEMNIFICATION

You agree to indemnify and hold harmless AirYatra, its directors, employees, and affiliates from any claims, damages, losses, liabilities, costs, and expenses arising from your misuse of the Platform, breach of these Terms, violation of law, or prohibited items/conduct.

17. DISPUTE RESOLUTION & GOVERNING LAW

17.1 Grievance Procedure: Users may file complaints via the Platform grievance portal or email. AirYatra aims to respond within 48 business hours.

17.2 Mediation: AirYatra may facilitate mediation between Customer and Operator.

17.3 Arbitration: If unresolved, disputes shall be resolved by binding arbitration under the Arbitration and Conciliation Act, 1996. Seat/venue: Pune, Maharashtra, India.

17.4 Governing Law: Indian law applies, including the Indian Contract Act, 1872, Information Technology Act, 2000, Consumer Protection Act, 2019, and applicable DGCA rules/CARs.

17.5 Jurisdiction: Where arbitration is not applicable/enforceable, courts at Pune, Maharashtra shall have jurisdiction.

18. REGULATORY COMPLIANCE

18.1 Operators and flight operations must comply with DGCA rules, CARs, security requirements, and lawful directives.

18.2 AirYatra will comply with applicable tax laws (including GST where applicable) and legal obligations.

18.3 AirYatra may conduct verification checks and cooperate with lawful authorities as required.

19. TERMINATION OF SERVICE

19.1 AirYatra may suspend/terminate access for violation of Terms, fraud/illegal activity, repeated misuse, security concerns, or regulatory directives.

19.2 AirYatra may provide notice (e.g., 7 days) where reasonable; urgent cases may require immediate action.

19.3 Upon termination, outstanding dues remain payable and refunds (if applicable) will be processed as per policy and law.

20. CONTACT & GRIEVANCE REDRESSAL

Company Name: Lucuma Corporation Pvt. Ltd.
Brand: AirYatra (a unit of Lucuma Corporation Pvt. Ltd.)
Address: Pune, Maharashtra, India
Website: www.airyatra.com
Email: care@airyatra.co.in
Phone: +91-XXXXXXXXXX

Grievance Officer
Name: [To be updated]
Email: grievance@airyatra.co.in
Phone: +91-XXXXXXXXXX
Response Time: Within 48 business hours (best effort)

21. SEVERABILITY

If any provision is found invalid or unenforceable, the remaining provisions continue in full force and effect.

22. ENTIRE AGREEMENT

These Terms, along with the Privacy Policy, Cancellation/Refund Policy, and any other policies published on the Platform, constitute the entire agreement between you and AirYatra.

23. ACKNOWLEDGEMENT

By clicking "I Agree" or continuing to use the Platform, you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions.

24. Marketing Consent: "I agree to receive offers, promotions, and updates from AirYatra via SMS, email, and WhatsApp. I can opt out anytime."

25. Consent: I consent to AirYatra collecting and verifying my KYC documents (Aadhaar/PAN/photo/contact, etc.) for booking and compliance, and confirm my data will not be sold to third parties without my consent, except as required to provide services or by law.

© 2026 Lucuma Corporation Pvt. Ltd. All Rights Reserved.
"""

CANCELLATION_POLICY = """
AirYatra Cancellation & Refund Policy (Detailed) — Version v1.0

Effective from: 03.08.2026
Applies to: AirYatra website/app bookings where payment is collected by AirYatra and flight is operated by independent DGCA-approved Operators.

1) Scope & Important Notes

• AirYatra facilitates bookings and collects payment; flight services are performed by the Operator.
• Refund outcomes depend on (a) when you cancel, (b) whether the Operator cancels, (c) regulatory/weather constraints, and (d) any non-refundable components disclosed at booking.
• If you accept an alternate flight/reschedule offered after a disruption, you will not be eligible for a refund for the same disruption.

2) How to Cancel / Request Refund

You can request cancellation/refund by:
• Logging into your AirYatra account and using My Bookings → Cancel, or
• Contacting AirYatra Support at care@airyatra.co.in with your Booking ID.

You should cancel before the scheduled departure time. If you do not cancel and you do not travel (no-show), refunds are generally not available except in limited force majeure situations and where reliably documented.

3) Customer-Initiated Cancellation (Standard Refund Slabs)

Refund is calculated on the Total Amount paid (unless otherwise stated at checkout), and may exclude non-refundable components disclosed during booking (e.g., permits already paid, third-party charges, special positioning already performed).

3.1 Refund slabs (by time before scheduled departure)

• 10% mandatory Cancellation Fees Applicable: after confirmed booking on total Booking Amount.
• 48 to 72 hours before departure: Cancellation allowed; a cancellation fee 20% apply and the refundable amount may reduce based on costs already committed.
• 24 to 48 hours before departure: Cancellation allowed; a cancellation fee 30% apply and the refundable amount may reduce based on costs already committed.
• 12 to 24 hours before departure: Cancellation allowed; a cancellation fee 50% apply and the refundable amount may reduce based on costs already committed.
• Less than 12 hours before departure: No changes or refunds (except as covered under Section 6 Force Majeure / exceptional cases).

3.2 No-show

If you do not cancel in time and do not report for the flight, payments already made are not reimbursed, except in limited force majeure situations that are contemplated under this Policy and reliably documented.

4) Booking Modifications / Rescheduling (Customer Request)

• Free modifications (date/time/route change requests) are generally possible only if requested at least 24 hours before the scheduled departure, subject to Operator availability and regulatory feasibility.
• Requests made inside 24 hours may be declined and treated as a late cancellation (see Section 3).

Fare difference: If the new schedule costs more, you must pay the difference. If it costs less, the refund (if any) will follow the same rules and may be reduced by committed costs.

5) Operator Cancellation, Significant Schedule Change, or Significant Delay

If the Operator cancels the flight and you choose not to travel (and you do not accept reschedule/credit), you are entitled to a refund of the ticket price/amount paid for the affected flight.

If there is a significant schedule change or significant delay and you choose not to travel (and you do not accept the alternate option), you are entitled to a refund.

If you accept an alternate flight/reschedule offered, a refund is generally not due for the same disruption.

6) Force Majeure / Exceptional Circumstances

Examples: extreme weather, natural disasters, regulatory restrictions, ATC/airport closure, curfew, strikes, civil unrest, or similar events beyond reasonable control.

• Where force majeure is established with reliable documentation, AirYatra may offer rescheduling or a refund even where the booking/rate would otherwise be non-refundable, depending on feasibility and committed costs.
• AirYatra may request supporting documents (official notifications, ATC/regulatory orders, etc.) to process force majeure exceptions.

7) Refund Method & Timeline

• Refund method: Refunds are processed back to the original payment method where possible.
• Timeline: Approved refunds are typically processed within 7–10 business days, depending on bank/payment gateway timelines.
• Deductions: Payment gateway/bank charges (if any) and non-refundable third‑party costs (if disclosed at booking) may be deducted.

8) Ancillary Fees (if any) & Baggage-Related Fees

• If a separately-charged ancillary service was unavailable through no fault of the Customer (e.g., service not provided due to cancellation), the related fee may be refundable.
• For baggage-related fees, refund eligibility depends on the nature of the fee and outcome.
• AirYatra itself does not provide insurance for baggage loss/damage; operational/baggage handling is governed by the Operator and applicable law/contract.

9) Fraud, Abuse, and Chargebacks

AirYatra may withhold or reverse refunds and/or suspend accounts in cases of suspected fraud, misuse, repeated chargebacks, or violation of Platform Terms.

10) Contact & Escalation

For cancellations/refunds:
• Support Email: care@airyatra.co.in
• Target response time: within 48 business hours.

11) Policy Updates

AirYatra may update this Policy from time to time. The version effective on the date of your booking/cancellation request will generally apply unless a change is legally required or improves your rights.

© 2026 Lucuma Corporation Pvt. Ltd. All Rights Reserved.
"""

PRIVACY_POLICY = """
AirYatra Privacy Policy — Version v1.0

Effective from: 03.08.2026

Lucuma Corporation Pvt. Ltd., operating under the brand AirYatra ("AirYatra", "Company", "we", "us", "our"), is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Platform.

1. Information We Collect

1.1 Personal Information:
• Full name, email address, phone number
• Government ID details (for verification and compliance)
• Passport/travel document details (where required)
• Payment information (processed through secure gateways)
• Address and contact details

1.2 Booking Information:
• Travel dates, routes, passenger details
• Special requests and preferences
• Booking history and transaction records

1.3 Technical Information:
• Device information, IP address, browser type
• Cookies and similar tracking technologies
• Usage patterns and preferences

2. How We Use Your Information

2.1 Service Delivery:
• Process bookings and payments
• Communicate booking confirmations and updates
• Coordinate with Operators for flight services
• Provide customer support

2.2 Legal & Compliance:
• Verify identity (KYC requirements)
• Comply with DGCA and aviation regulations
• Maintain records as required by law
• Respond to legal requests and prevent fraud

2.3 Improvement & Marketing:
• Improve our Platform and services
• Send promotional communications (with consent)
• Analyze usage patterns for better experience

3. Information Sharing

3.1 We share information with:
• Operators (necessary for booking fulfillment)
• Payment processors (for transaction processing)
• Government authorities (as required by law)
• Service providers (under confidentiality agreements)

3.2 We DO NOT:
• Sell your personal data to third parties
• Share data for unrelated marketing purposes without consent
• Disclose sensitive information unnecessarily

4. Data Security

• We use industry-standard encryption (SSL/TLS)
• Access controls and authentication measures
• Regular security audits and monitoring
• Secure data storage with backup procedures

5. Your Rights

You have the right to:
• Access your personal data
• Correct inaccurate information
• Request deletion (subject to legal requirements)
• Opt-out of marketing communications
• Withdraw consent (where applicable)

6. Cookies

We use cookies for:
• Session management and authentication
• Preferences and settings
• Analytics and performance monitoring
• Security and fraud prevention

You can manage cookie preferences through your browser settings.

7. Data Retention

• Booking data: Retained as required by aviation regulations (minimum 7 years)
• Account data: Retained while account is active
• Marketing data: Until consent is withdrawn

8. Changes to This Policy

We may update this Privacy Policy periodically. Changes will be posted on the Platform with the updated effective date.

9. Contact Us

For privacy-related queries:
Email: privacy@airyatra.co.in
Address: Pune, Maharashtra, India

Data Protection Officer:
Email: dpo@airyatra.co.in

© 2026 Lucuma Corporation Pvt. Ltd. All Rights Reserved.
"""

# Mandatory consent items for booking
MANDATORY_CONSENTS = [
    {
        "id": "terms_conditions",
        "text": "I confirm that I have carefully read and understood the AirYatra Terms & Conditions, Privacy Policy, Refund Policy and Cancellation Policy.",
        "required": True,
        "category": "legal"
    },
    {
        "id": "flight_conditions",
        "text": "I understand that helicopter and charter flights are subject to weather conditions, DGCA regulations, operational safety, aircraft availability and applicable government permissions.",
        "required": True,
        "category": "operational"
    },
    {
        "id": "platform_role",
        "text": "I understand that AirYatra operates as an online aviation marketplace and technology platform connecting customers with verified operators unless specifically stated otherwise.",
        "required": True,
        "category": "legal"
    },
    {
        "id": "passenger_info",
        "text": "I confirm that all passenger information, travel details and documents provided by me are true and accurate.",
        "required": True,
        "category": "booking"
    },
    {
        "id": "village_landing",
        "text": "For Village Landing bookings, I confirm that all required permissions from the concerned authorities and land owner have been obtained or I have requested AirYatra only for coordination assistance where available.",
        "required": True,
        "show_for": ["village_landing"],
        "category": "operational"
    },
    {
        "id": "electronic_consent",
        "text": "I consent to electronic records, digital signatures, OTP authentication and online agreements in accordance with applicable Indian laws.",
        "required": True,
        "category": "legal"
    }
]

OPTIONAL_CONSENTS = [
    {
        "id": "marketing_consent",
        "text": "I agree to receive offers, promotions, and updates from AirYatra via SMS, email, and WhatsApp. I can opt out anytime.",
        "required": False,
        "category": "marketing"
    },
    {
        "id": "kyc_consent",
        "text": "I consent to AirYatra collecting and verifying my KYC documents (Aadhaar/PAN/photo/contact, etc.) for booking and compliance, and confirm my data will not be sold to third parties without my consent, except as required to provide services or by law.",
        "required": False,
        "category": "kyc"
    }
]


# ==================== API ROUTES ====================

@router.get("/terms-and-conditions")
async def get_terms_and_conditions():
    """Get Terms & Conditions content"""
    return {
        "title": "Terms & Conditions",
        "version": "v1.0",
        "effective_date": "03.08.2026",
        "last_updated": "August 2, 2026",
        "content": TERMS_AND_CONDITIONS,
        "company": "Lucuma Corporation Pvt. Ltd.",
        "brand": "AirYatra"
    }


@router.get("/cancellation-policy")
async def get_cancellation_policy():
    """Get Cancellation & Refund Policy content"""
    return {
        "title": "Cancellation & Refund Policy",
        "version": "v1.0",
        "effective_date": "03.08.2026",
        "content": CANCELLATION_POLICY,
        "company": "Lucuma Corporation Pvt. Ltd.",
        "brand": "AirYatra"
    }


@router.get("/privacy-policy")
async def get_privacy_policy():
    """Get Privacy Policy content"""
    return {
        "title": "Privacy Policy",
        "version": "v1.0",
        "effective_date": "03.08.2026",
        "content": PRIVACY_POLICY,
        "company": "Lucuma Corporation Pvt. Ltd.",
        "brand": "AirYatra"
    }


@router.get("/consents")
async def get_booking_consents(booking_type: Optional[str] = None):
    """
    Get all consent items required for booking
    booking_type: one_way, round_trip, village_landing, etc.
    """
    mandatory = []
    for consent in MANDATORY_CONSENTS:
        # Check if consent should be shown for this booking type
        show_for = consent.get("show_for")
        if show_for is None or (booking_type and booking_type in show_for):
            mandatory.append(consent)
    
    return {
        "mandatory": mandatory,
        "optional": OPTIONAL_CONSENTS,
        "message": "All mandatory consents must be accepted to proceed with payment."
    }


class ConsentRecord(BaseModel):
    booking_id: Optional[str] = None
    booking_type: Optional[str] = None  # one_way, round_trip, village_landing, etc.
    consents: List[str]  # List of consent IDs that were accepted
    optional_consents: List[str] = []
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None


@router.post("/consents/record")
async def record_booking_consent(
    consent: ConsentRecord,
    current_user: dict = Depends(get_current_user)
):
    """
    Record user's consent acceptance for a booking
    """
    db = get_database()
    
    # Build list of mandatory consents based on booking_type
    # This mirrors the logic in GET /api/legal/consents
    mandatory_ids = []
    for c in MANDATORY_CONSENTS:
        if not c.get("required"):
            continue
        show_for = c.get("show_for")
        # If show_for is None, consent is always required
        # If show_for is defined, consent is only required if booking_type matches
        if show_for is None or (consent.booking_type and consent.booking_type in show_for):
            mandatory_ids.append(c["id"])
    
    # Check which mandatory consents are missing
    missing = [cid for cid in mandatory_ids if cid not in consent.consents]
    
    if missing:
        raise HTTPException(
            status_code=400, 
            detail=f"Missing mandatory consents: {', '.join(missing)}"
        )
    
    consent_doc = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "booking_id": consent.booking_id,
        "mandatory_consents": consent.consents,
        "optional_consents": consent.optional_consents,
        "ip_address": consent.ip_address,
        "user_agent": consent.user_agent,
        "accepted_at": datetime.now(timezone.utc),
        "version": "v1.0"
    }
    
    await db.consent_records.insert_one(consent_doc)
    
    return {
        "success": True,
        "consent_id": consent_doc["id"],
        "message": "Consent recorded successfully"
    }


@router.get("/consents/verify/{booking_id}")
async def verify_booking_consent(
    booking_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Verify if consent was recorded for a booking
    """
    db = get_database()
    
    consent = await db.consent_records.find_one({
        "booking_id": booking_id,
        "user_id": current_user["id"]
    }, {"_id": 0})
    
    if not consent:
        return {"has_consent": False}
    
    return {
        "has_consent": True,
        "consent_id": consent["id"],
        "accepted_at": consent["accepted_at"].isoformat() if isinstance(consent["accepted_at"], datetime) else consent["accepted_at"]
    }
