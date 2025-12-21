import Stripe from "stripe";
import User from "../models/User.js";

let stripeInstance;
const getStripe = () => {
  if (!stripeInstance) {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (!apiKey) {
      const error = new Error(
        "Missing STRIPE_SECRET_KEY. Set it in your environment (.env file in ai-resume-builder-api directory)."
      );
      error.code = "STRIPE_CONFIG_ERROR";
      throw error;
    }
    stripeInstance = new Stripe(apiKey);
  }
  return stripeInstance;
};

// Create or retrieve Stripe customer
export const getOrCreateCustomer = async (userId, email) => {
  const stripe = getStripe();
  const user = await User.findById(userId);

  // If user has a customer ID, verify it exists in Stripe
  if (user.stripeCustomerId) {
    try {
      // Try to retrieve the customer to verify it exists
      await stripe.customers.retrieve(user.stripeCustomerId);
      return user.stripeCustomerId;
    } catch (error) {
      // Customer doesn't exist (likely from different Stripe account)
      // Clear it and create a new one
      console.log(
        `⚠️  Customer ${user.stripeCustomerId} not found, creating new customer`
      );
      user.stripeCustomerId = null;
    }
  }

  // Create new customer
  const customer = await stripe.customers.create({
    email,
    metadata: { userId: userId.toString() },
  });

  user.stripeCustomerId = customer.id;
  await user.save();

  return customer.id;
};

export const createCheckoutSession = async ({ userId, priceId, userEmail }) => {
  const stripe = getStripe();

  // Validate priceId
  if (!priceId) {
    throw new Error(
      "Price ID is required. Please configure STRIPE_PRICE_ID_PROFESSIONAL or STRIPE_PRICE_ID_PREMIUM in your .env file. See STRIPE_SETUP.md for instructions."
    );
  }

  if (!priceId.startsWith("price_")) {
    throw new Error(
      `Invalid price ID format: "${priceId}". Price ID must start with 'price_'. Please check your Stripe configuration and ensure you're using the correct Price ID from Stripe Dashboard.`
    );
  }

  // Get or create customer
  const customerId = await getOrCreateCustomer(userId, userEmail);

  // Determine plan based on priceId
  const planMap = {
    // Professional plan - $22.99/month
    [process.env.STRIPE_PRICE_ID_PROFESSIONAL || ""]: "professional",
    // Premium plan - $32.99/month
    [process.env.STRIPE_PRICE_ID_PREMIUM || ""]: "premium",
  };

  // Determine plan - check exact match first, then check if priceId contains keywords
  let plan = planMap[priceId];
  if (!plan) {
    // Fallback: check if priceId contains plan name
    const priceIdLower = priceId.toLowerCase();
    if (priceIdLower.includes("professional")) {
      plan = "professional";
    } else if (priceIdLower.includes("premium")) {
      plan = "premium";
    } else {
      // Default to premium if can't determine
      plan = "premium";
    }
  }

  const baseUrl = process.env.FRONTEND_URL || "http://localhost:3000";

  try {
    // Verify price exists in Stripe and is recurring
    let price;
    try {
      price = await stripe.prices.retrieve(priceId);
    } catch (err) {
      if (err.code === "resource_missing") {
        throw new Error(
          `Price ID "${priceId}" not found in Stripe. Please verify:\n` +
            `1. The Price ID is correct (check Stripe Dashboard → Products → Your Product → Pricing)\n` +
            `2. The Price is active (not archived)\n` +
            `3. You're using test Price IDs with test keys (or live with live keys)\n` +
            `4. The Price ID matches in both frontend and backend .env files\n\n` +
            `See STRIPE_SETUP.md for detailed setup instructions.`
        );
      }
      if (err.type === "StripeAuthenticationError") {
        throw new Error(
          `Stripe authentication failed. Please verify STRIPE_SECRET_KEY is set correctly in your .env file and matches your Stripe account (test vs live mode).`
        );
      }
      throw err;
    }

    // Verify price is recurring (required for subscriptions)
    if (price.type !== "recurring" || !price.recurring) {
      throw new Error(
        `Price ID "${priceId}" is not a recurring subscription price.\n` +
          `Current type: ${price.type}\n\n` +
          `Your backend requires RECURRING prices for subscriptions.\n` +
          `Please create a new RECURRING price in Stripe Dashboard:\n` +
          `1. Go to Products → Your Product\n` +
          `2. Add a new price with "Recurring" billing (Monthly or Yearly)\n` +
          `3. Copy the new Price ID and update your .env file\n\n` +
          `See FIX_PRICE_IDS.md for detailed instructions.`
      );
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/dashboard?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `${baseUrl}/pricing?canceled=true`,
      metadata: {
        userId: userId.toString(),
        plan,
      },
      subscription_data: {
        metadata: {
          userId: userId.toString(),
          plan,
        },
      },
    });

    return { url: session.url, sessionId: session.id };
  } catch (err) {
    // Provide more helpful error messages
    if (err.type === "StripeInvalidRequestError") {
      throw new Error(
        `Stripe error: ${err.message}. Please check your Stripe configuration and price IDs.`
      );
    }
    throw err;
  }
};

export const verifyStripeWebhook = (rawBody, sig) => {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error("Missing STRIPE_WEBHOOK_SECRET");
  }

  return stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
};

// Handle subscription updates
export const handleSubscriptionUpdate = async (subscription) => {
  const userId = subscription.metadata?.userId;
  if (!userId) return;

  const user = await User.findById(userId);
  if (!user) return;

  user.stripeSubscriptionId = subscription.id;
  user.stripePriceId = subscription.items.data[0]?.price?.id;

  // Only set period end if it exists and is valid
  if (
    subscription.current_period_end &&
    typeof subscription.current_period_end === "number" &&
    !isNaN(subscription.current_period_end)
  ) {
    const periodEndDate = new Date(subscription.current_period_end * 1000);
    // Only set if date is valid
    if (!isNaN(periodEndDate.getTime())) {
      user.stripeCurrentPeriodEnd = periodEndDate;
    } else {
      // Invalid date, don't set it (will keep existing or be null)
      user.stripeCurrentPeriodEnd = null;
    }
  } else {
    // If no period end, set to null
    user.stripeCurrentPeriodEnd = null;
  }

  // Validate subscription status against enum
  const validStatuses = [
    "active",
    "canceled",
    "past_due",
    "trialing",
    "incomplete",
    "incomplete_expired",
  ];
  if (validStatuses.includes(subscription.status)) {
    user.subscriptionStatus = subscription.status;
  } else {
    // If status is not in enum, log warning and set to null
    console.warn(
      `⚠️  Invalid subscription status: ${subscription.status} for subscription ${subscription.id}`
    );
    user.subscriptionStatus = null;
  }

  // Map subscription status to plan
  if (subscription.status === "active" || subscription.status === "trialing") {
    // Get plan from metadata first, then try to determine from price ID
    let plan = subscription.metadata?.plan;

    if (!plan) {
      // Fallback: determine plan from price ID
      const priceId = subscription.items.data[0]?.price?.id;
      const professionalPriceId =
        process.env.STRIPE_PRICE_ID_PROFESSIONAL || "";
      const premiumPriceId = process.env.STRIPE_PRICE_ID_PREMIUM || "";

      if (priceId === professionalPriceId) {
        plan = "professional";
      } else if (priceId === premiumPriceId) {
        plan = "premium";
      } else {
        // Try to determine from price ID string
        const priceIdLower = priceId?.toLowerCase() || "";
        if (priceIdLower.includes("professional")) {
          plan = "professional";
        } else if (priceIdLower.includes("premium")) {
          plan = "premium";
        } else {
          // Default to premium if can't determine (safer for paid subscriptions)
          plan = "premium";
        }
      }
    }

    user.plan = plan;
    console.log(
      `✅ Updated user ${userId} to plan: ${plan}, status: ${subscription.status}, priceId: ${subscription.items.data[0]?.price?.id}`
    );
  } else {
    user.plan = "free";
    console.log(
      `⚠️  User ${userId} subscription ${subscription.status}, downgraded to free`
    );
  }

  try {
    await user.save();
    console.log(`✅ User ${userId} saved successfully`);
  } catch (saveError) {
    console.error(`❌ Error saving user ${userId}:`, saveError.message);
    // If save fails due to validation, try saving without the problematic field
    if (saveError.message.includes("stripeCurrentPeriodEnd")) {
      user.stripeCurrentPeriodEnd = undefined;
      await user.save();
      console.log(`✅ User ${userId} saved without period end date`);
    } else {
      throw saveError;
    }
  }
};

// Update subscription plan
export const updateSubscription = async (userId, newPriceId) => {
  const stripe = getStripe();
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");
  if (!user.stripeSubscriptionId)
    throw new Error("No active subscription found");

  // Retrieve current subscription
  const subscription = await stripe.subscriptions.retrieve(
    user.stripeSubscriptionId
  );

  // Get the current subscription item
  const subscriptionItemId = subscription.items.data[0]?.id;
  if (!subscriptionItemId) {
    throw new Error("No subscription items found");
  }

  // Update the subscription with new price
  const updatedSubscription = await stripe.subscriptions.update(
    user.stripeSubscriptionId,
    {
      items: [
        {
          id: subscriptionItemId,
          price: newPriceId,
        },
      ],
      proration_behavior: "always_invoice", // Prorate the difference
      metadata: {
        userId: userId.toString(),
        plan:
          newPriceId === process.env.STRIPE_PRICE_ID_PROFESSIONAL
            ? "professional"
            : newPriceId === process.env.STRIPE_PRICE_ID_PREMIUM
            ? "premium"
            : "unknown",
      },
    }
  );

  // Update user in database
  await handleSubscriptionUpdate(updatedSubscription);

  return updatedSubscription;
};

// Cancel subscription
export const cancelSubscription = async (userId) => {
  const stripe = getStripe();
  const user = await User.findById(userId);

  if (!user.stripeSubscriptionId) {
    throw new Error("No active subscription found");
  }

  const subscription = await stripe.subscriptions.cancel(
    user.stripeSubscriptionId
  );

  await handleSubscriptionUpdate(subscription);

  return { canceled: true };
};
