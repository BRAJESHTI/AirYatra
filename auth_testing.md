# Auth-Gated App Testing Playbook for AirYatra

## Step 1: Create Test User & Session in MongoDB

```bash
mongosh --eval "
use('airyatra_db');
var userId = 'test-google-user-' + Date.now();
var sessionToken = 'test_session_' + Date.now();
db.users.insertOne({
  id: userId,
  email: 'test.google.user.' + Date.now() + '@example.com',
  full_name: 'Test Google User',
  profile_picture: 'https://via.placeholder.com/150',
  google_id: 'google_' + Date.now(),
  auth_provider: 'emergent_google',
  roles: ['customer'],
  status: 'active',
  email_verified: true,
  created_at: new Date()
});
db.user_sessions.insertOne({
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
});
print('Session token: ' + sessionToken);
print('User ID: ' + userId);
"
```

## Step 2: Test Backend APIs

```bash
# Get external API URL
API_URL=$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d '=' -f2)

# Test Google Auth settings endpoint
curl -s "$API_URL/api/auth/google/settings"

# Test Emergent callback endpoint with mock data
curl -X POST "$API_URL/api/auth/google/emergent-callback" \
  -H "Content-Type: application/json" \
  -d '{
    "emergent_user": {
      "id": "test_google_123",
      "email": "testgoogle@example.com",
      "name": "Test Google User",
      "picture": "https://via.placeholder.com/150"
    },
    "device_info": {
      "os": "Windows",
      "browser": "Chrome"
    },
    "session_token": "test_session_token"
  }'
```

## Step 3: Browser Testing with Cookie

```python
# Set cookie and navigate
await page.context.add_cookies([{
    "name": "token",
    "value": "YOUR_JWT_TOKEN",
    "domain": "yatrahub.preview.emergentagent.com",
    "path": "/",
}])
await page.goto("https://flightbook-india.preview.emergentagent.com/customer")
```

## Step 4: Test Google Login Button Click

```python
# Go to login page
await page.goto("https://flightbook-india.preview.emergentagent.com/login")
await page.wait_for_load_state('networkidle')

# Find and click Google login button
google_btn = page.locator('button:has-text("Google")')
await google_btn.click()

# Should redirect to Emergent auth
# Expected URL: https://auth.emergentagent.com/?redirect=...
```

## Checklist
- [ ] Google settings endpoint returns enabled: true
- [ ] Emergent callback endpoint creates new user
- [ ] Emergent callback endpoint logs in existing user  
- [ ] JWT token is generated
- [ ] User data stored in MongoDB
- [ ] Google button visible on login page
- [ ] Button click redirects to Emergent auth
