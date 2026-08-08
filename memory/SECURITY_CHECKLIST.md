# AirYatra Security Assessment & Penetration Testing Checklist

## 📋 Pre-Launch Security Checklist

### ✅ Completed Security Measures

| Category | Control | Status | Date |
|----------|---------|--------|------|
| **Authentication** | JWT with iss/aud claims | ✅ Done | Aug 8, 2026 |
| **Authentication** | 24-hour token expiry | ✅ Done | Aug 8, 2026 |
| **Authentication** | bcrypt password hashing | ✅ Done | Aug 8, 2026 |
| **Authentication** | Account lockout (5 failed attempts) | ✅ Done | Aug 8, 2026 |
| **Authentication** | Dev endpoints disabled by default | ✅ Done | Aug 8, 2026 |
| **Authorization** | Role-based access control (RBAC) | ✅ Done | Aug 8, 2026 |
| **Authorization** | Refund restricted to Admin/Finance | ✅ Done | Aug 8, 2026 |
| **Authorization** | Booking ownership validation | ✅ Done | Aug 8, 2026 |
| **API Security** | Rate limiting on payment endpoints | ✅ Done | Aug 8, 2026 |
| **API Security** | Webhook signature validation | ✅ Done | Aug 8, 2026 |
| **API Security** | Server-side payment amount | ✅ Done | Aug 8, 2026 |
| **Headers** | HSTS (1 year, preload) | ✅ Done | Aug 8, 2026 |
| **Headers** | Content-Security-Policy | ✅ Done | Aug 8, 2026 |
| **Headers** | X-Frame-Options (SAMEORIGIN) | ✅ Done | Aug 8, 2026 |
| **Headers** | X-Content-Type-Options | ✅ Done | Aug 8, 2026 |
| **Headers** | Referrer-Policy | ✅ Done | Aug 8, 2026 |
| **Headers** | Permissions-Policy | ✅ Done | Aug 8, 2026 |
| **Data Protection** | PII field-level encryption (AES-256) | ✅ Done | Aug 8, 2026 |
| **Data Protection** | KYC file encryption at rest | ✅ Done | Aug 8, 2026 |
| **Data Protection** | Magic byte file validation | ✅ Done | Aug 8, 2026 |
| **Data Protection** | Secure file upload directory | ✅ Done | Aug 8, 2026 |

---

## 🔍 Penetration Testing Scope

### 1. Authentication & Session Management
- [ ] Test for brute force attack protection
- [ ] Test password complexity requirements
- [ ] Test session fixation vulnerabilities
- [ ] Test JWT token validation bypass
- [ ] Test for insecure "remember me" functionality
- [ ] Test logout functionality (token invalidation)
- [ ] Test concurrent session handling
- [ ] Test OTP/2FA bypass attempts

### 2. Authorization & Access Control
- [ ] Test horizontal privilege escalation (access other user's data)
- [ ] Test vertical privilege escalation (customer → admin)
- [ ] Test IDOR (Insecure Direct Object References) on all endpoints
- [ ] Test API endpoint authorization for all roles
- [ ] Test admin panel access without proper roles
- [ ] Test file download authorization

### 3. Input Validation & Injection
- [ ] Test for SQL/NoSQL injection
- [ ] Test for XSS (Stored, Reflected, DOM-based)
- [ ] Test for Command injection
- [ ] Test for LDAP injection
- [ ] Test for XML/XXE injection
- [ ] Test for Server-Side Request Forgery (SSRF)
- [ ] Test for Path traversal attacks
- [ ] Test file upload for malicious content

### 4. API Security
- [ ] Test API rate limiting effectiveness
- [ ] Test for mass assignment vulnerabilities
- [ ] Test for API versioning security
- [ ] Test GraphQL introspection (if applicable)
- [ ] Test WebSocket security
- [ ] Test for information disclosure in error messages
- [ ] Test API documentation exposure

### 5. Payment Security (Critical)
- [ ] Test Stripe checkout manipulation
- [ ] Test Razorpay order tampering
- [ ] Test payment amount modification
- [ ] Test refund authorization bypass
- [ ] Test webhook replay attacks
- [ ] Test payment status manipulation
- [ ] Test currency manipulation
- [ ] Test for race conditions in payments

### 6. Business Logic
- [ ] Test booking flow for manipulation
- [ ] Test price calculation logic
- [ ] Test discount/coupon bypass
- [ ] Test referral system abuse
- [ ] Test loyalty points manipulation
- [ ] Test auction bidding manipulation
- [ ] Test flight pricing manipulation

### 7. Infrastructure & Configuration
- [ ] Test for exposed debug endpoints
- [ ] Test for exposed admin panels
- [ ] Test for information disclosure in headers
- [ ] Test TLS/SSL configuration
- [ ] Test for clickjacking vulnerabilities
- [ ] Test CORS misconfiguration
- [ ] Test for exposed .env or config files
- [ ] Test for exposed .git directory
- [ ] Test for exposed backup files

### 8. Data Protection & Privacy
- [ ] Test for PII exposure in responses
- [ ] Test for sensitive data in logs
- [ ] Test for sensitive data in URLs
- [ ] Test data export functionality
- [ ] Test GDPR compliance (if applicable)
- [ ] Test data deletion functionality

---

## 🛠️ Recommended Penetration Testing Tools

### Automated Scanners
- **OWASP ZAP** - Web application scanner
- **Burp Suite** - Comprehensive web security testing
- **Nikto** - Web server scanner
- **SQLMap** - SQL injection detection
- **Nuclei** - Vulnerability scanner

### Manual Testing Tools
- **Postman/Insomnia** - API testing
- **jwt.io** - JWT analysis
- **CyberChef** - Data encoding/decoding
- **Hashcat** - Password analysis

### Infrastructure
- **nmap** - Port scanning
- **testssl.sh** - TLS configuration testing
- **securityheaders.com** - HTTP security headers

---

## 📅 Recommended Testing Schedule

### Pre-Launch (Required)
1. **Week 1-2**: Automated vulnerability scanning
2. **Week 2-3**: Manual penetration testing
3. **Week 3-4**: Remediation and re-testing

### Post-Launch (Quarterly)
- Q1: Full penetration test
- Q2: Focused test on new features
- Q3: Full penetration test
- Q4: Compliance audit + pentest

---

## 🚨 Severity Classification

| Level | Description | Response Time |
|-------|-------------|---------------|
| **Critical** | RCE, Auth bypass, Payment manipulation | Immediate (24 hours) |
| **High** | Data exposure, Privilege escalation | 48-72 hours |
| **Medium** | XSS, CSRF, Information disclosure | 1 week |
| **Low** | Missing headers, Minor issues | 2 weeks |

---

## 📞 Security Contact Information

For responsible disclosure of security vulnerabilities:
- Email: security@airyatra.co.in
- Response time: 24-48 hours

---

## 📝 Third-Party Penetration Testing Vendors (India)

1. **Indusface** - CERT-IN empaneled
2. **Sequretek** - Mumbai-based, CERT-IN empaneled
3. **Paladion Networks** - Enterprise security testing
4. **Lucideus (SAFE Security)** - AI-powered security
5. **Aujas Networks** - Comprehensive security services
6. **CyberArk** - Identity security specialists

### Estimated Cost
- Basic Web App Pentest: ₹2-5 Lakhs
- Comprehensive (Web + Mobile + API): ₹5-10 Lakhs
- Compliance-focused (PCI-DSS, SOC2): ₹10-20 Lakhs

---

## ✅ Sign-off Checklist

Before production launch, ensure:

- [ ] All Critical/High vulnerabilities remediated
- [ ] Pentest report reviewed by security team
- [ ] Re-test completed for fixed issues
- [ ] Security monitoring enabled
- [ ] Incident response plan documented
- [ ] Security training completed for developers
- [ ] Backup and recovery tested
- [ ] WAF rules configured (if applicable)

**Sign-off Date**: _______________
**Security Lead**: _______________
**CTO/Tech Lead**: _______________
