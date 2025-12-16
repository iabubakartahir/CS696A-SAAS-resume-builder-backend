import request from "supertest";
import mongoose from "mongoose";
import app from "../src/app.js";
import User from "../src/models/User.js";

describe("API Tests", () => {
  let testUser;
  let accessToken;
  let refreshToken;

  beforeAll(async () => {
    // Connect to test database (MongoDB Memory Server)
    await mongoose.connect(process.env.MONGODB_URI);
  });

  afterAll(async () => {
    // Clean up test data and close connection
    await User.deleteMany({});
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clean up before each test (except for the first one)
    if (testUser) {
      await User.deleteMany({});
    }
  });

  describe("Health Check", () => {
    test("GET /health should return healthy status", async () => {
      const response = await request(app).get("/health").expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: "healthy",
        data: { status: "ok" },
      });
    });
  });

  describe("Authentication - Signup", () => {
    test("POST /api/v1/auth/signup should create new user successfully", async () => {
      const userData = {
        name: "Test User",
        email: "test@example.com",
        password: "password123",
        dob: "1990-01-01",
      };

      const response = await request(app)
        .post("/api/v1/auth/signup")
        .send(userData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        message: "Account created",
        data: {
          user: {
            name: userData.name,
            email: userData.email,
            role: "user",
            provider: "local",
            isVerified: false,
          },
          token: expect.any(String),
        },
      });

      // Store for later tests
      testUser = response.body.data.user;
      accessToken = response.body.data.token;

      // Check refresh token cookie
      expect(response.headers["set-cookie"]).toBeDefined();
      const cookies = response.headers["set-cookie"];
      const refreshCookie = cookies.find((cookie) => cookie.startsWith("rt="));
      expect(refreshCookie).toBeDefined();
    });

    test("POST /api/v1/auth/signup should fail with duplicate email", async () => {
      // First create a user
      const firstUser = {
        name: "First User",
        email: "duplicate@example.com",
        password: "password123",
      };

      await request(app)
        .post("/api/v1/auth/signup")
        .send(firstUser)
        .expect(201);

      // Now try to create another user with the same email
      const duplicateUser = {
        name: "Another User",
        email: "duplicate@example.com", // Same email
        password: "password123",
      };

      const response = await request(app)
        .post("/api/v1/auth/signup")
        .send(duplicateUser)
        .expect(409);

      expect(response.body).toMatchObject({
        success: false,
        message: "Email already in use",
      });
    });

    test("POST /api/v1/auth/signup should fail with invalid data", async () => {
      const invalidData = {
        name: "", // Empty name
        email: "invalid-email", // Invalid email
        password: "123", // Too short password
      };

      const response = await request(app)
        .post("/api/v1/auth/signup")
        .send(invalidData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: "Validation failed",
        details: expect.any(Array),
      });
    });
  });

  describe("Authentication - Login", () => {
    test("POST /api/v1/auth/login should login successfully", async () => {
      // First create a user to login with
      const userData = {
        name: "Login Test User",
        email: "login@example.com",
        password: "password123",
      };

      await request(app).post("/api/v1/auth/signup").send(userData).expect(201);

      const loginData = {
        email: "login@example.com",
        password: "password123",
      };

      const response = await request(app)
        .post("/api/v1/auth/login")
        .send(loginData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: "Logged in",
        data: {
          user: {
            name: userData.name,
            email: userData.email,
            role: "user",
            provider: "local",
            isVerified: false,
          },
          token: expect.any(String),
        },
      });

      accessToken = response.body.data.token;

      // Check refresh token cookie
      expect(response.headers["set-cookie"]).toBeDefined();
    });

    test("POST /api/v1/auth/login should fail with wrong password", async () => {
      const loginData = {
        email: "test@example.com",
        password: "wrongpassword",
      };

      const response = await request(app)
        .post("/api/v1/auth/login")
        .send(loginData)
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: "Invalid email or password",
      });
    });

    test("POST /api/v1/auth/login should fail with non-existent email", async () => {
      const loginData = {
        email: "nonexistent@example.com",
        password: "password123",
      };

      const response = await request(app)
        .post("/api/v1/auth/login")
        .send(loginData)
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: "Invalid email or password",
      });
    });

    test("POST /api/v1/auth/login should fail with invalid data", async () => {
      const invalidData = {
        email: "invalid-email",
        password: "",
      };

      const response = await request(app)
        .post("/api/v1/auth/login")
        .send(invalidData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: "Validation failed",
        details: expect.any(Array),
      });
    });
  });

  describe("Authentication - Protected Routes", () => {
    test("GET /api/v1/auth/me should return current user with valid token", async () => {
      // First create a user and get a token
      const userData = {
        name: "Me Test User",
        email: "me@example.com",
        password: "password123",
      };

      const signupResponse = await request(app)
        .post("/api/v1/auth/signup")
        .send(userData)
        .expect(201);

      const token = signupResponse.body.data.token;

      const response = await request(app)
        .get("/api/v1/auth/me")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: "Current user",
        data: {
          user: {
            name: userData.name,
            email: userData.email,
            role: "user",
            provider: "local",
            isVerified: false,
          },
        },
      });
    });

    test("GET /api/v1/auth/me should fail without token", async () => {
      const response = await request(app).get("/api/v1/auth/me").expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: "Not authenticated",
      });
    });

    test("GET /api/v1/auth/me should fail with invalid token", async () => {
      const response = await request(app)
        .get("/api/v1/auth/me")
        .set("Authorization", "Bearer invalid-token")
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.any(String),
      });
    });
  });

  describe("Authentication - Token Refresh", () => {
    test("POST /api/v1/auth/refresh should refresh token with valid refresh cookie", async () => {
      // First create a user and login to get refresh token
      const userData = {
        name: "Refresh Test User",
        email: "refresh@example.com",
        password: "password123",
      };

      await request(app).post("/api/v1/auth/signup").send(userData).expect(201);

      const loginResponse = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "refresh@example.com",
          password: "password123",
        })
        .expect(200);

      const cookies = loginResponse.headers["set-cookie"];
      expect(cookies).toBeDefined();

      const refreshCookie = cookies.find((cookie) => cookie.startsWith("rt="));
      expect(refreshCookie).toBeDefined();

      const response = await request(app)
        .post("/api/v1/auth/refresh")
        .set("Cookie", refreshCookie)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: "Token refreshed",
        data: {
          token: expect.any(String),
        },
      });

      // Should set new refresh token cookie
      expect(response.headers["set-cookie"]).toBeDefined();
    });

    test("POST /api/v1/auth/refresh should fail without refresh token", async () => {
      const response = await request(app)
        .post("/api/v1/auth/refresh")
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: "Missing refresh token",
      });
    });
  });

  describe("Authentication - Logout", () => {
    test("POST /api/v1/auth/logout should logout successfully", async () => {
      const response = await request(app)
        .post("/api/v1/auth/logout")
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: "Logged out",
        data: {},
      });

      // Should clear refresh token cookie
      const cookies = response.headers["set-cookie"];
      const refreshCookie = cookies.find((cookie) => cookie.startsWith("rt="));
      expect(refreshCookie).toContain("Max-Age=0");
    });
  });

  describe("Error Handling", () => {
    test("Should return 404 for non-existent routes", async () => {
      const response = await request(app)
        .get("/api/v1/nonexistent")
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        message: "Route not found",
      });
    });
  });
});
