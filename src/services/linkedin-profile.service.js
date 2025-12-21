// Service to fetch LinkedIn profile data for resume import
// Note: LinkedIn API requires specific scopes. Basic scopes (openid profile email) only provide limited data.
// For full profile data, you need: r_liteprofile, r_emailaddress, or the newer Profile API scopes.
export const fetchLinkedInProfileData = async (accessToken) => {
  try {
    // Fetch basic profile info using OpenID Connect
    const profileResponse = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!profileResponse.ok) {
      const errorText = await profileResponse.text();
      throw new Error(`LinkedIn profile fetch failed: ${profileResponse.status} ${errorText}`);
    }

    const profile = await profileResponse.json();

    // Initialize empty arrays for extended data
    let experience = [];
    let education = [];
    let skills = [];

    // Try to fetch positions (experience) - requires r_liteprofile or Profile API scope
    try {
      const positionsResponse = await fetch(
        "https://api.linkedin.com/v2/me?projection=(id,firstName,lastName)",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "X-Restli-Protocol-Version": "2.0.0",
          },
        }
      );
      // Note: Full positions require additional API calls and scopes
      // For now, we'll use basic profile data
    } catch (e) {
      console.warn("Could not fetch LinkedIn extended profile:", e.message);
    }

    // Return structured resume data with what we have
    return {
      contact: {
        fullName: profile.name || `${profile.given_name || ""} ${profile.family_name || ""}`.trim(),
        email: profile.email || "",
        linkedin: profile.sub ? `https://linkedin.com/in/${profile.sub}` : "",
      },
      experience,
      education,
      skills,
      summary: "",
    };
  } catch (error) {
    console.error("LinkedIn profile import error:", error);
    throw new Error(`Failed to import LinkedIn profile: ${error.message}`);
  }
};

