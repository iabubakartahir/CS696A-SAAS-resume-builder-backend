# API Test Suite

This test suite comprehensively tests all the authentication endpoints of the AI Resume Builder API.

## Test Coverage

### ✅ Health Check

- `GET /health` - Returns healthy status

### ✅ Authentication - Signup

- `POST /api/v1/auth/signup` - Creates new user successfully
- `POST /api/v1/auth/signup` - Fails with duplicate email (409)
- `POST /api/v1/auth/signup` - Fails with invalid data (400)

### ✅ Authentication - Login

- `POST /api/v1/auth/login` - Login successfully
- `POST /api/v1/auth/login` - Fails with wrong password (401)
- `POST /api/v1/auth/login` - Fails with non-existent email (401)
- `POST /api/v1/auth/login` - Fails with invalid data (400)

### ✅ Authentication - Protected Routes

- `GET /api/v1/auth/me` - Returns current user with valid token
- `GET /api/v1/auth/me` - Fails without token (401)
- `GET /api/v1/auth/me` - Fails with invalid token (401)

### ✅ Authentication - Token Refresh

- `POST /api/v1/auth/refresh` - Refreshes token with valid refresh cookie
- `POST /api/v1/auth/refresh` - Fails without refresh token (401)

### ✅ Authentication - Logout

- `POST /api/v1/auth/logout` - Logout successfully

### ✅ Error Handling

- Returns 404 for non-existent routes

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Test Environment

- Uses MongoDB Memory Server for isolated testing
- Tests run in a clean environment with no external dependencies
- All tests are independent and can run in parallel

## Test Results

All 15 tests pass successfully, covering:

- ✅ User registration and validation
- ✅ User authentication and login
- ✅ JWT token handling and refresh
- ✅ Protected route access
- ✅ Error handling and edge cases
- ✅ Input validation
- ✅ Security measures

Your API is working perfectly! 🚀

