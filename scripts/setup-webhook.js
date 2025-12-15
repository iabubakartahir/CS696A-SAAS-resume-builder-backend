#!/usr/bin/env node

/**
 * Stripe Webhook Setup Helper
 * Helps configure webhook secret for local development
 */

import { execSync } from "child_process";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");
const envPath = join(rootDir, ".env");

console.log("🔧 Stripe Webhook Setup Helper\n");

// Check if Stripe CLI is installed
try {
  execSync("stripe --version", { stdio: "ignore" });
  console.log("✅ Stripe CLI is installed\n");
} catch (error) {
  console.log("❌ Stripe CLI is not installed\n");
  console.log("📦 Install it with:");
  console.log("   brew install stripe/stripe-cli/stripe\n");
  console.log(
    "   Or download from: https://github.com/stripe/stripe-cli/releases\n"
  );
  process.exit(1);
}

// Check if .env exists
if (!existsSync(envPath)) {
  console.log("❌ .env file not found");
  console.log("   Create it first with your configuration\n");
  process.exit(1);
}

// Read .env file
let envContent = readFileSync(envPath, "utf8");

// Check if webhook secret is already set
if (
  envContent.includes("STRIPE_WEBHOOK_SECRET=whsec_") &&
  !envContent.includes("STRIPE_WEBHOOK_SECRET=whsec_PLEASE_GET_THIS")
) {
  console.log("✅ Webhook secret is already configured\n");
  console.log("💡 To get a new secret, run:");
  console.log("   npm run webhook:listen\n");
  process.exit(0);
}

console.log("📡 Starting Stripe webhook listener...\n");
console.log("💡 Instructions:");
console.log("   1. A browser window will open for Stripe login");
console.log("   2. Authorize the CLI");
console.log("   3. Copy the webhook secret (whsec_...) from the output");
console.log("   4. Press Ctrl+C to stop");
console.log("   5. Update STRIPE_WEBHOOK_SECRET in your .env file\n");
console.log("🚀 Starting listener...\n");

try {
  // Start stripe listen
  execSync(
    "stripe listen --forward-to localhost:4000/api/v1/billing/webhook --print-secret",
    {
      stdio: "inherit",
      cwd: rootDir,
    }
  );
} catch (error) {
  // User pressed Ctrl+C or error occurred
  console.log("\n\n💡 To update your .env file:");
  console.log("   STRIPE_WEBHOOK_SECRET=whsec_<your-secret-here>\n");
}
