import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import catchAsync from "../utils/catchAsync.js";

export const subscribeNewsletter = catchAsync(async (req, res) => {
  const { email } = req.body;

  if (!email || !email.includes("@")) {
    throw new ApiError(400, "Please provide a valid email address");
  }

  // Mailchimp configuration (use environment variables)
  const MAILCHIMP_API_KEY =
    process.env.MAILCHIMP_API_KEY || "6676281b65267dbd6f7eb56c45b4d235-usa16"; // use the correct api key
  const MAILCHIMP_SERVER_PREFIX =
    process.env.MAILCHIMP_SERVER_PREFIX || "us16";
  const MAILCHIMP_AUDIENCE_ID =
    process.env.MAILCHIMP_AUDIENCE_ID || "0843b68410";

  // Extract API key (remove server prefix if included)
  const apiKey = MAILCHIMP_API_KEY.replace(/-us\d+$/, "");
  const url = `https://${MAILCHIMP_SERVER_PREFIX}.api.mailchimp.com/3.0/lists/${MAILCHIMP_AUDIENCE_ID}/members`;

  try {
    // Call Mailchimp API using fetch
    const mailchimpResponse = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`anystring:${apiKey}`).toString("base64")}`,
      },
      body: JSON.stringify({
        email_address: email.trim(),
        status: "subscribed",
      }),
    });

    const mailchimpData = await mailchimpResponse.json();

    if (!mailchimpResponse.ok) {
      // Handle Mailchimp errors
      if (
        mailchimpResponse.status === 400 &&
        mailchimpData.title === "Member Exists"
      ) {
        throw new ApiError(400, "This email is already subscribed to our newsletter");
      }

      throw new ApiError(
        500,
        mailchimpData.detail || "Failed to subscribe. Please try again later."
      );
    }

    res.json(
      new ApiResponse(
        200,
        mailchimpData,
        "Successfully subscribed to newsletter"
      )
    );
  } catch (error) {
    console.error("Mailchimp subscription error:", error);

    // If it's already an ApiError, re-throw it
    if (error instanceof ApiError) {
      throw error;
    }

    // Handle network or other errors
    throw new ApiError(
      500,
      error.message || "Failed to subscribe. Please try again later."
    );
  }
});
