import ApiError from "../utils/ApiError.js";
import User from "../models/User.js";

export const requirePlan =
  (needed = "free") =>
  async (req, res, next) => {
    // Refresh user data to get latest plan status
    const user = await User.findById(req.user._id);
    if (!user) {
      return next(new ApiError(401, "User not found"));
    }

    const plan = user.plan || "free";

    // Plan hierarchy: free < professional < premium
    const order = { free: 0, professional: 1, premium: 2 };
    const neededOrder = order[needed] || 0;
    const userOrder = order[plan] || 0;

    // Check if subscription is active
    const hasActiveSubscription =
      user.subscriptionStatus === "active" ||
      user.subscriptionStatus === "trialing";

    // Free users can access free features
    if (needed === "free") {
      return next();
    }

    // For premium/professional features, check subscription
    if (userOrder >= neededOrder && hasActiveSubscription) {
      return next();
    }

    return next(
      new ApiError(
        402,
        `Upgrade to ${needed} plan required for this feature. Your current plan: ${plan}`
      )
    );
  };
