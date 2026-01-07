import catchAsync from "../utils/catchAsync.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import {
  createCheckoutSession,
  verifyStripeWebhook,
  handleSubscriptionUpdate,
  cancelSubscription,
  updateSubscription,
} from "../services/stripe.service.js";
import User from "../models/User.js";
import Stripe from "stripe";

export const createBillingSession = catchAsync(async (req, res, next) => {
  const { priceId } = req.body;
  if (!priceId) return next(new ApiError(400, "priceId is required"));

  try {
    const session = await createCheckoutSession({
      userId: req.user._id.toString(),
      priceId,
      userEmail: req.user.email,
    });

    res.json(new ApiResponse(200, session, "Checkout session created"));
  } catch (err) {
    // Provide user-friendly error message
    if (
      err.code === "STRIPE_CONFIG_ERROR" ||
      (err.message && err.message.includes("STRIPE_SECRET_KEY"))
    ) {
      console.error("❌ Stripe configuration error:", err.message);
      console.error("💡 Make sure STRIPE_SECRET_KEY is set in your .env file");
      return next(
        new ApiError(
          500,
          "Payment system is not configured. Please check server configuration."
        )
      );
    }
    console.error("❌ Checkout session error:", err.message);
    return next(
      new ApiError(500, err.message || "Failed to create checkout session")
    );
  }
});

export const getSubscriptionStatus = catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id);

  // If user has subscription ID, fetch latest from Stripe to ensure accurate period end
  let currentPeriodEnd = user.stripeCurrentPeriodEnd;
  if (user.stripeSubscriptionId) {
    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      const subscription = await stripe.subscriptions.retrieve(
        user.stripeSubscriptionId
      );

      // Update period end from Stripe if available
      if (subscription.current_period_end) {
        currentPeriodEnd = new Date(subscription.current_period_end * 1000);
        // Update user record if different
        if (
          !user.stripeCurrentPeriodEnd ||
          user.stripeCurrentPeriodEnd.getTime() !== currentPeriodEnd.getTime()
        ) {
          user.stripeCurrentPeriodEnd = currentPeriodEnd;
          await user.save();
        }
      }
    } catch (err) {
      console.error("Error fetching subscription from Stripe:", err.message);
      // Continue with stored value if Stripe fetch fails
    }
  }

  res.json(
    new ApiResponse(200, {
      plan: user.plan || "free",
      subscriptionStatus: user.subscriptionStatus,
      currentPeriodEnd: currentPeriodEnd,
      hasActiveSubscription:
        user.subscriptionStatus === "active" ||
        user.subscriptionStatus === "trialing",
    })
  );
});

export const syncSubscription = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user._id);
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  let subscription = null;

  // First, try to get subscription from stored ID
  if (user.stripeSubscriptionId) {
    try {
      subscription = await stripe.subscriptions.retrieve(
        user.stripeSubscriptionId
      );

      // If subscription is canceled or deleted, search for active one
      if (
        subscription.status === "canceled" ||
        subscription.status === "deleted"
      ) {
        subscription = null; // Will search for active one
      }
    } catch (err) {
      // Subscription not found, will search by customer
      console.log(
        `Subscription ${user.stripeSubscriptionId} not found, searching by customer`
      );
      subscription = null;
    }
  }

  // If no active subscription found, search by customer ID
  if (!subscription && user.stripeCustomerId) {
    try {
      const subscriptions = await stripe.subscriptions.list({
        customer: user.stripeCustomerId,
        status: "all",
        limit: 10,
      });

      // Find the most recent active subscription
      const activeSubscription = subscriptions.data.find(
        (sub) =>
          (sub.status === "active" || sub.status === "trialing") &&
          sub.metadata?.userId === req.user._id.toString()
      );

      if (activeSubscription) {
        subscription = activeSubscription;
        console.log(
          `✅ Found active subscription ${activeSubscription.id} for user ${req.user._id}`
        );
      } else if (subscriptions.data.length > 0) {
        // If no active, use the most recent one (might be canceled but still in period)
        subscription = subscriptions.data[0];
        console.log(
          `⚠️ No active subscription found, using most recent: ${subscription.id} (status: ${subscription.status})`
        );
      }
    } catch (err) {
      console.error("Error finding subscription by customer:", err.message);
      return next(new ApiError(400, "No subscription found to sync"));
    }
  }

  if (!subscription) {
    return next(new ApiError(400, "No subscription found to sync"));
  }

  try {
    console.log(
      `📡 Syncing subscription ${subscription.id} (status: ${subscription.status}) for user ${req.user._id}`
    );
    await handleSubscriptionUpdate(subscription);

    // Get updated user
    const updatedUser = await User.findById(req.user._id);

    res.json(
      new ApiResponse(200, {
        plan: updatedUser.plan || "free",
        subscriptionStatus: updatedUser.subscriptionStatus,
        currentPeriodEnd: updatedUser.stripeCurrentPeriodEnd,
        hasActiveSubscription:
          updatedUser.subscriptionStatus === "active" ||
          updatedUser.subscriptionStatus === "trialing",
        message: `Subscription synced successfully. Plan updated to: ${updatedUser.plan}`,
      })
    );
  } catch (err) {
    console.error("❌ Sync subscription error:", err.message);
    return next(
      new ApiError(500, err.message || "Failed to sync subscription")
    );
  }
});

export const updateUserSubscription = catchAsync(async (req, res, next) => {
  const { priceId } = req.body;
  if (!priceId) {
    return next(new ApiError(400, "priceId is required"));
  }

  try {
    const updatedSubscription = await updateSubscription(req.user._id, priceId);

    // Get updated user
    const updatedUser = await User.findById(req.user._id);

    res.json(
      new ApiResponse(
        200,
        {
          plan: updatedUser.plan || "free",
          subscriptionStatus: updatedUser.subscriptionStatus,
          currentPeriodEnd: updatedUser.stripeCurrentPeriodEnd,
          hasActiveSubscription:
            updatedUser.subscriptionStatus === "active" ||
            updatedUser.subscriptionStatus === "trialing",
        },
        "Subscription updated successfully"
      )
    );
  } catch (err) {
    console.error("Update subscription error:", err.message);
    return next(
      new ApiError(400, err.message || "Failed to update subscription")
    );
  }
});

export const cancelUserSubscription = catchAsync(async (req, res, next) => {
  try {
    await cancelSubscription(req.user._id);

    // Get updated user
    const updatedUser = await User.findById(req.user._id);

    res.json(
      new ApiResponse(
        200,
        {
          plan: updatedUser.plan || "free",
          subscriptionStatus: updatedUser.subscriptionStatus,
          hasActiveSubscription: false,
        },
        "Subscription canceled successfully. You will retain access until the end of your billing period."
      )
    );
  } catch (err) {
    console.error("Cancel subscription error:", err.message);
    return next(
      new ApiError(400, err.message || "Failed to cancel subscription")
    );
  }
});

export const stripeWebhook = async (req, res, next) => {
  // IMPORTANT: Respond to Stripe immediately (within 5 seconds)
  // Process webhook asynchronously after responding
  let event;
  
  try {
    const signature = req.headers["stripe-signature"];
    if (!signature) {
      console.error("❌ Missing Stripe signature");
      // Still return 200 to Stripe to prevent retries
      return res.status(200).json({ received: false, error: "Missing signature" });
    }

    event = verifyStripeWebhook(req.body, signature);
    console.log(`📥 Webhook received: ${event.type}`);
  } catch (err) {
    console.error("❌ Webhook verification error:", err.message);
    // Return 200 to Stripe even on verification errors to prevent infinite retries
    // Log the error for debugging but don't cause Stripe to retry
    return res.status(200).json({ received: false, error: err.message });
  }

  // Respond immediately to Stripe (within 5 seconds requirement)
  res.status(200).json({ received: true });

  // Process webhook asynchronously after responding
  // This prevents timeouts and ensures Stripe gets a quick response
  (async () => {
    try {
      // Handle different event types
      switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.metadata?.userId;
        console.log(`✅ Checkout completed for user: ${userId}`);

        if (userId) {
          const user = await User.findById(userId);
          if (user && session.subscription) {
            // Retrieve subscription to get full details
            const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
            const subscription = await stripe.subscriptions.retrieve(
              session.subscription
            );

            // Always update subscription, even if user had a canceled one
            await handleSubscriptionUpdate(subscription);
            console.log(
              `✅ Subscription updated for user: ${userId}, new status: ${
                subscription.status
              }, plan: ${subscription.metadata?.plan || "from price ID"}`
            );
          } else if (user && !session.subscription) {
            console.warn(
              `⚠️ Checkout completed but no subscription ID for user: ${userId}`
            );
          }
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const userId = subscription.metadata?.userId;
        console.log(
          `📝 Subscription ${event.type} for user: ${userId}, status: ${subscription.status}`
        );

        if (userId) {
          await handleSubscriptionUpdate(subscription);
          const user = await User.findById(userId);
          console.log(
            `✅ User ${userId} updated: plan=${user.plan}, status=${user.subscriptionStatus}`
          );
        } else {
          console.warn(
            `⚠️ Subscription ${event.type} but no userId in metadata`
          );
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const userId = subscription.metadata?.userId;
        console.log(`❌ Subscription deleted for user: ${userId}`);

        if (userId) {
          const user = await User.findById(userId);
          if (user) {
            user.plan = "free";
            user.subscriptionStatus = "canceled";
            user.stripeSubscriptionId = null;
            user.stripePriceId = null;
            user.stripeCurrentPeriodEnd = null;
            await user.save();
            console.log(`✅ User ${userId} downgraded to free plan`);
          }
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object;
        console.log(`💰 Payment succeeded for invoice: ${invoice.id}`);
        if (invoice.subscription) {
          const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
          const subscription = await stripe.subscriptions.retrieve(
            invoice.subscription
          );
          await handleSubscriptionUpdate(subscription);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        console.log(`⚠️ Payment failed for invoice: ${invoice.id}`);
        if (invoice.subscription) {
          const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
          try {
            const subscription = await stripe.subscriptions.retrieve(
              invoice.subscription
            );
            const userId = subscription.metadata?.userId;
            if (userId) {
              const user = await User.findById(userId);
              if (user) {
                user.subscriptionStatus = "past_due";
                await user.save();
                console.log(
                  `⚠️ User ${userId} subscription marked as past_due`
                );
              }
            }
          } catch (err) {
            console.error(
              "Error retrieving subscription for failed payment:",
              err
            );
          }
        }
        break;
      }

      // Handle payment_intent events (for one-time payments, if needed)
      case "payment_intent.succeeded":
      case "payment_intent.payment_failed":
      case "payment_intent.canceled": {
        console.log(
          `ℹ️ Payment intent event: ${event.type} (not used for subscriptions)`
        );
        // These are for one-time payments, not subscriptions
        // We can log them but don't need to process them
        break;
      }

      default:
        console.log(`ℹ️ Unhandled event type: ${event.type}`);
      }
    } catch (err) {
      // Log error but don't throw - we already responded to Stripe
      console.error("❌ Webhook processing error:", err);
      console.error("Event type:", event?.type);
      console.error("Error details:", err.message);
    }
  })();
};
