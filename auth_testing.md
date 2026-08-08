# Auth Testing Playbook for AirYatra

## Emergent-Managed Google OAuth Testing

### Step 1: Create Test User & Session (MongoDB)
```bash
mongosh --eval "
use('airyatra_db');
var userId = 'test-user-' + Date.now();
var sessionToken = 'test_session_' + Date.now();
db.users.insertOne({
  id: userId,
  email: 'test.user.' + Date.now() + '@example.com',
  full_name: 'Test User',
  profile_picture: 'https://via.placeholder.com/150',
  auth_provider: 'google_emergent',
  roles: ['customer'],
  is_active: true,
  is_verified: true,
  otp_enabled: false,
  created_at: new Date().toISOString()
});
db.user_sessions.insertOne({
  user_id: userId,
  session_token: sessionToken,
  auth_provider: 'google_emergent',
  expires_at: new Date(Date.now() + 7*24*60*60*1000).toISOString(),
  created_at: new Date().toISOString()
});
print('Session token: ' + sessionToken);
print('User ID: ' + userId);
"
```

### Step 2: Test Backend API
```bash
# Test Google auth settings endpoint
curl -X GET "https://airyatra-corporate.preview.emergentagent.com/api/auth/google/settings"

# Test auth/me endpoint with session
curl -X GET "https://airyatra-corporate.preview.emergentagent.com/api/auth/me" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"
```

### Step 3: Browser Testing with Playwright
```python
# Set cookie and navigate
await page.context.add_cookies([{
    "name": "access_token",
    "value": "YOUR_SESSION_TOKEN",
    "domain": "aviation-erp-2.preview.emergentagent.com",
    "path": "/api",
    "httpOnly": True,
    "secure": True,
    "sameSite": "None"
}])
await page.goto("https://airyatra-corporate.preview.emergentagent.com/customer")
```

### Step 4: Manual OAuth Flow Test
1. Go to: https://airyatra-corporate.preview.emergentagent.com/login
2. Click "Google से Login करें" button
3. Should redirect to: https://auth.emergentagent.com/?redirect=...
4. Complete Google sign-in
5. Should redirect back to: /auth/google/callback#session_id=xxx
6. EmergentAuthCallback component processes session_id
7. Calls backend: POST /api/auth/google/emergent-callback
8. User is logged in and redirected to dashboard

### Debug Commands
```bash
# Check MongoDB data
mongosh --eval "
use('airyatra_db');
db.users.find({auth_provider: 'google_emergent'}).limit(5).pretty();
db.user_sessions.find({auth_provider: 'google_emergent'}).limit(5).pretty();
"

# Clean test data
mongosh --eval "
use('airyatra_db');
db.users.deleteMany({email: /test\.user\./});
db.user_sessions.deleteMany({session_token: /test_session/});
"
```

### Success Indicators
✅ /api/auth/google/settings returns enabled:true
✅ Google button redirects to auth.emergentagent.com
✅ Callback URL includes session_id in hash
✅ Backend creates/updates user in MongoDB
✅ JWT token is returned and stored
✅ User is redirected to correct dashboard

### Failure Indicators
❌ 500 error on /api/auth/google/emergent-callback
❌ "No email in Emergent user data" error
❌ Redirect loop between login and callback
❌ User stuck on loading screen
