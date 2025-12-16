import dotenv from "dotenv";
import { MongoMemoryServer } from "mongodb-memory-server";

// Load environment variables for testing
dotenv.config();

// Set test environment variables
process.env.NODE_ENV = "test";
process.env.JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET || "test-access-secret";
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || "test-refresh-secret";
process.env.JWT_ACCESS_TTL = "15m";
process.env.JWT_REFRESH_TTL = "1d";

// Global setup for MongoDB Memory Server
let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
});

afterAll(async () => {
  if (mongod) {
    await mongod.stop();
  }
});
