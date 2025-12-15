#!/usr/bin/env node

/**
 * Check if webhook is properly configured
 */

import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");
const envPath = join(rootDir, ".env");

console.log("🔍 Checking Stripe Webhook Configuration\n");

if (!existsSync(envPath)) {
  console.log("❌ .env file not found\n");
  process.exit(1);
}

const envContent = readFileSync(envPath, "utf8");

// Check required variables
const checks = {
  STRIPE_SECRET_KEY: envContent.match(/STRIPE_SECRET_KEY=(.+)/)?.[1],
  STRIPE_PRICE_ID_PROFESSIONAL: envContent.match(
    /STRIPE_PRICE_ID_PROFESSIONAL=(.+)/
  )?.[1],
  STRIPE_PRICE_ID_PREMIUM: envContent.match(
    /STRIPE_PRICE_ID_PREMIUM=(.+)/
  )?.[1],
  STRIPE_WEBHOOK_SECRET: envContent.match(/STRIPE_WEBHOOK_SECRET=(.+)/)?.[1],
  FRONTEND_URL: envContent.match(/FRONTEND_URL=(.+)/)?.[1],
};

let allGood = true;

for (const [key, value] of Object.entries(checks)) {
  if (!value || value.includes("YOUR_") || value.includes("PLEASE_GET")) {
    console.log(`❌ ${key}: Not configured`);
    allGood = false;
  } else {
    const displayValue =
      key.includes("SECRET") || key.includes("KEY")
        ? `${value.substring(0, 20)}...`
        : value;
    console.log(`✅ ${key}: ${displayValue}`);
  }
}

console.log("");

if (allGood) {
  console.log("✅ All Stripe configuration is set!\n");
  console.log("🚀 You can now:");
  console.log("   1. Start backend: npm run dev");
  console.log("   2. Start webhook listener: npm run webhook:listen");
  console.log("   3. Test webhook: npm run webhook:test\n");
} else {
  console.log("⚠️  Some configuration is missing\n");
  console.log("💡 Run: node scripts/setup-webhook.js to set up webhook\n");
  process.exit(1);
}
