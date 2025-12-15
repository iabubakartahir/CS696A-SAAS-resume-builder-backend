#!/usr/bin/env node

/**
 * Manually sync a user's subscription from Stripe
 * Usage: node scripts/manual-sync-subscription.js <userId>
 */

import mongoose from "mongoose";
import Stripe from "stripe";
import User from "../src/models/User.js";
import { handleSubscriptionUpdate } from "../src/services/stripe.service.js";
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

const userId = process.argv[2];

if (!userId) {
  console.log("❌ Usage: node scripts/manual-sync-subscription.js <userId>");
  console.log(
    "   Example: node scripts/manual-sync-subscription.js 507f1f77bcf86cd799439011\n"
  );
  process.exit(1);
}

const mongoUri = process.env.MONGODB_URI;
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!mongoUri || !stripeSecretKey) {
  console.log("❌ Missing MONGODB_URI or STRIPE_SECRET_KEY in .env\n");
  process.exit(1);
}

async function syncUser() {
  try {
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to database\n");

    const user = await User.findById(userId);
    if (!user) {
      console.log(`❌ User ${userId} not found\n`);
      await mongoose.disconnect();
      process.exit(1);
    }

    console.log(`📋 User: ${user.email}`);
    console.log(`   Current plan: ${user.plan || "free"}`);
    console.log(`   Subscription ID: ${user.stripeSubscriptionId || "none"}\n`);

    if (!user.stripeSubscriptionId) {
      console.log("⚠️  User has no subscription ID. Cannot sync.\n");
      await mongoose.disconnect();
      process.exit(1);
    }

    const stripe = new Stripe(stripeSecretKey);
    console.log("📡 Fetching subscription from Stripe...\n");

    const subscription = await stripe.subscriptions.retrieve(
      user.stripeSubscriptionId
    );

    console.log(`✅ Subscription found:`);
    console.log(`   Status: ${subscription.status}`);
    console.log(`   Plan: ${subscription.metadata?.plan || "unknown"}`);
    console.log(`   Price ID: ${subscription.items.data[0]?.price?.id}\n`);

    await handleSubscriptionUpdate(subscription);

    const updatedUser = await User.findById(userId);
    console.log(`✅ User updated:`);
    console.log(`   New plan: ${updatedUser.plan}`);
    console.log(`   Subscription status: ${updatedUser.subscriptionStatus}`);
    console.log(`   Period end: ${updatedUser.stripeCurrentPeriodEnd}\n`);

    await mongoose.disconnect();
    console.log("✅ Done!\n");
  } catch (error) {
    console.error("❌ Error:", error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

syncUser();
