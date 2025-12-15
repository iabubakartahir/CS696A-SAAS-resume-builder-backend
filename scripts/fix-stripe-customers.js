#!/usr/bin/env node

/**
 * Fix Stripe Customer IDs - Clear invalid customer IDs from database
 * Run this if you switched Stripe accounts and get "No such customer" errors
 */

import mongoose from "mongoose";
import User from "../src/models/User.js";
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");
const envPath = join(rootDir, ".env");

// Load .env
dotenv.config({ path: envPath });

const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  console.log("❌ MONGODB_URI not found in .env\n");
  process.exit(1);
}

async function fixCustomers() {
  try {
    // Connect to database
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to database\n");

    // Find all users with stripeCustomerId
    const users = await User.find({
      stripeCustomerId: { $exists: true, $ne: null },
    });

    console.log(`Found ${users.length} users with Stripe customer IDs\n`);

    if (users.length === 0) {
      console.log("✅ No users with customer IDs to fix\n");
      await mongoose.disconnect();
      return;
    }

    console.log(
      "⚠️  This will clear all Stripe customer IDs from the database."
    );
    console.log(
      "   New customer IDs will be created automatically on next checkout.\n"
    );

    // Clear all customer IDs
    const result = await User.updateMany(
      { stripeCustomerId: { $exists: true, $ne: null } },
      { $set: { stripeCustomerId: null } }
    );

    console.log(`✅ Cleared ${result.modifiedCount} customer ID(s)\n`);
    console.log(
      "💡 Next time a user checks out, a new customer will be created\n"
    );

    await mongoose.disconnect();
    console.log("✅ Done!\n");
  } catch (error) {
    console.error("❌ Error:", error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

fixCustomers();
