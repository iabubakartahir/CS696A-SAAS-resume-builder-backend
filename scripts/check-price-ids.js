#!/usr/bin/env node

/**
 * Check if Price IDs exist in Stripe account
 */

import Stripe from "stripe";
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

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  console.log("❌ STRIPE_SECRET_KEY not found in .env\n");
  process.exit(1);
}

const stripe = new Stripe(stripeSecretKey);

const priceIds = {
  professional: process.env.STRIPE_PRICE_ID_PROFESSIONAL,
  premium: process.env.STRIPE_PRICE_ID_PREMIUM,
};

console.log("🔍 Checking Price IDs in Stripe account...\n");
console.log(`Using Secret Key: ${stripeSecretKey.substring(0, 20)}...\n`);

for (const [plan, priceId] of Object.entries(priceIds)) {
  if (!priceId) {
    console.log(`❌ ${plan}: Not configured\n`);
    continue;
  }

  try {
    const price = await stripe.prices.retrieve(priceId);
    console.log(`✅ ${plan}:`);
    console.log(`   Price ID: ${priceId}`);
    console.log(`   Type: ${price.type}`);
    console.log(`   Amount: $${(price.unit_amount / 100).toFixed(2)}`);
    if (price.recurring) {
      console.log(`   Interval: ${price.recurring.interval}`);
    } else {
      console.log(
        `   ⚠️  Not recurring (needs to be recurring for subscriptions)`
      );
    }
    console.log(`   Active: ${price.active}`);
    console.log("");
  } catch (error) {
    if (error.code === "resource_missing") {
      console.log(
        `❌ ${plan}: Price ID "${priceId}" NOT FOUND in this Stripe account`
      );
      console.log(
        `   This Price ID doesn't exist with the current Stripe secret key.\n`
      );
      console.log(`   💡 Solution:`);
      console.log(`   1. Go to Stripe Dashboard → Products`);
      console.log(`   2. Create a new ${plan} product with recurring pricing`);
      console.log(`   3. Copy the new Price ID`);
      console.log(
        `   4. Update STRIPE_PRICE_ID_${plan.toUpperCase()} in .env\n`
      );
    } else {
      console.log(`❌ ${plan}: Error - ${error.message}\n`);
    }
  }
}

console.log(
  "💡 If Price IDs are missing, create new products in Stripe Dashboard"
);
console.log("   and update your .env file with the new Price IDs.\n");
