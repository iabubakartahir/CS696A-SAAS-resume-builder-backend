import natural from "natural";
import OpenAI from "openai";

// Initialize OpenAI client
let openaiInstance;
const getOpenAI = () => {
  if (!openaiInstance) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "Missing OPENAI_API_KEY. Set it in your environment (.env)"
      );
    }
    openaiInstance = new OpenAI({ apiKey });
  }
  return openaiInstance;
};

// Extract text from structured resume data
const extractTextFromResume = (resumeData) => {
  const parts = [];

  // Contact information
  if (resumeData.contact) {
    if (resumeData.contact.fullName) parts.push(resumeData.contact.fullName);
    if (resumeData.contact.headline) parts.push(resumeData.contact.headline);
    if (resumeData.contact.summary) parts.push(resumeData.contact.summary);
    if (resumeData.contact.email) parts.push(resumeData.contact.email);
    if (resumeData.contact.phone) parts.push(resumeData.contact.phone);
  }

  // Experience
  if (resumeData.experience && Array.isArray(resumeData.experience)) {
    resumeData.experience.forEach((exp) => {
      if (exp.title) parts.push(exp.title);
      if (exp.company) parts.push(exp.company);
      if (exp.location) parts.push(exp.location);
      if (exp.bullets && Array.isArray(exp.bullets)) {
        exp.bullets.forEach((bullet) => parts.push(bullet));
      }
    });
  }

  // Education
  if (resumeData.education && Array.isArray(resumeData.education)) {
    resumeData.education.forEach((edu) => {
      if (edu.degree) parts.push(edu.degree);
      if (edu.school) parts.push(edu.school);
      if (edu.details && Array.isArray(edu.details)) {
        edu.details.forEach((detail) => parts.push(detail));
      }
    });
  }

  // Skills
  if (resumeData.skills && Array.isArray(resumeData.skills)) {
    resumeData.skills.forEach((skill) => {
      if (skill.name) parts.push(skill.name);
    });
  }

  return parts.join(" ").toLowerCase();
};

// Analyze keywords match
const analyzeKeywords = (resumeText, jobDescription) => {
  if (!jobDescription || jobDescription.trim().length === 0) {
    return {
      score: 75, // Default score when no JD provided
      matchedKeywords: [],
      missingKeywords: [],
      description:
        "No job description provided. Add a job description for keyword analysis.",
    };
  }

  const tokenizer = new natural.WordTokenizer();
  const stemmer = natural.PorterStemmer;

  // Extract and stem keywords from job description
  const jdTokens = tokenizer.tokenize(jobDescription.toLowerCase());
  const jdStemmed = jdTokens
    .map((t) => stemmer.stem(t))
    .filter((t) => t.length > 2); // Filter out very short words

  // Extract and stem keywords from resume
  const resumeTokens = tokenizer.tokenize(resumeText);
  const resumeStemmed = resumeTokens
    .map((t) => stemmer.stem(t))
    .filter((t) => t.length > 2);

  // Create sets for comparison
  const jdSet = new Set(jdStemmed);
  const resumeSet = new Set(resumeStemmed);

  // Find matched and missing keywords
  const matched = [...jdSet].filter((k) => resumeSet.has(k));
  const missing = [...jdSet].filter((k) => !resumeSet.has(k));

  // Calculate score (weighted: more matches = higher score, but cap at 100)
  const matchRatio = jdSet.size > 0 ? matched.length / jdSet.size : 0;
  let score = Math.min(100, Math.round(matchRatio * 100));

  // Boost score if we have a good number of matches (even if ratio is lower)
  if (matched.length >= 10) score = Math.min(100, score + 10);
  if (matched.length >= 20) score = Math.min(100, score + 5);

  // Get original keywords (not stemmed) for display
  const matchedOriginal = jdTokens.filter((t, i) =>
    matched.includes(jdStemmed[i])
  );
  const missingOriginal = jdTokens.filter((t, i) =>
    missing.includes(jdStemmed[i])
  );

  // Remove duplicates and limit
  const uniqueMatched = [...new Set(matchedOriginal)].slice(0, 20);
  const uniqueMissing = [...new Set(missingOriginal)].slice(0, 15);

  return {
    score,
    matchedKeywords: uniqueMatched,
    missingKeywords: uniqueMissing,
    description:
      score >= 70
        ? "Excellent keyword coverage! Your resume matches most important terms from the job description."
        : score >= 50
        ? "Good keyword coverage, but some important terms are missing. Consider adding more relevant keywords."
        : "Low keyword coverage. Your resume is missing many important terms from the job description.",
  };
};

// Analyze formatting and structure
const analyzeFormatting = (resumeText, resumeData) => {
  let score = 100;
  const issues = [];

  // Check for standard sections
  const hasContact =
    resumeData?.contact?.fullName ||
    resumeData?.contact?.email ||
    resumeText.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
  const hasExperience =
    resumeData?.experience?.length > 0 ||
    resumeText.match(/\b(experience|work|employment|career)\b/i);
  const hasEducation =
    resumeData?.education?.length > 0 ||
    resumeText.match(/\b(education|degree|university|college|school)\b/i);
  const hasSkills =
    resumeData?.skills?.length > 0 ||
    resumeText.match(/\b(skills|competencies|proficiencies)\b/i);

  if (!hasContact) {
    score -= 15;
    issues.push("Missing contact information section");
  }
  if (!hasExperience) {
    score -= 20;
    issues.push("Missing experience/work history section");
  }
  if (!hasEducation) {
    score -= 15;
    issues.push("Missing education section");
  }
  if (!hasSkills) {
    score -= 10;
    issues.push("Missing skills section");
  }

  // Check for problematic formatting
  if (resumeText.match(/[█▄▀■●]/)) {
    score -= 10;
    issues.push("Contains special characters that may confuse ATS");
  }

  // Check for proper structure
  const lineCount = resumeText.split("\n").length;
  if (lineCount < 10) {
    score -= 10;
    issues.push("Resume appears too short");
  }

  // Check for summary/objective
  const hasSummary =
    resumeData?.contact?.summary ||
    resumeText.match(/\b(summary|objective|profile|about)\b/i);
  if (!hasSummary) {
    score -= 5;
    issues.push("Consider adding a professional summary");
  }

  score = Math.max(0, Math.min(100, score));

  return {
    score,
    issues,
    description:
      score >= 80
        ? "Your resume has excellent formatting and structure that ATS systems can easily parse."
        : score >= 60
        ? "Good formatting overall, but some improvements could enhance ATS compatibility."
        : "Your resume formatting needs improvement for better ATS compatibility.",
  };
};

// Analyze readability
const analyzeReadability = (resumeText) => {
  const sentences = resumeText.match(/[^.!?]+[.!?]+/g) || [];
  const words = resumeText.split(/\s+/).filter((w) => w.length > 0);
  const avgWordsPerSentence =
    sentences.length > 0 ? words.length / sentences.length : 0;

  let score = 100;

  // Check sentence length (optimal: 10-20 words)
  if (avgWordsPerSentence > 25) {
    score -= 15;
  } else if (avgWordsPerSentence > 20) {
    score -= 10;
  } else if (avgWordsPerSentence < 5 && sentences.length > 0) {
    score -= 10;
  }

  // Check for bullet points (good for readability)
  const bulletCount = (resumeText.match(/[•\-\*]\s/g) || []).length;
  if (bulletCount < 3) {
    score -= 5;
  }

  // Check for action verbs (good practice)
  const actionVerbs = [
    "achieved",
    "managed",
    "developed",
    "created",
    "implemented",
    "improved",
    "led",
    "designed",
    "built",
    "increased",
    "reduced",
    "optimized",
  ];
  const hasActionVerbs = actionVerbs.some((verb) =>
    resumeText.toLowerCase().includes(verb)
  );
  if (!hasActionVerbs) {
    score -= 10;
  }

  // Check for quantifiable results
  const hasNumbers = /\d+/.test(resumeText);
  if (!hasNumbers) {
    score -= 5;
  }

  score = Math.max(0, Math.min(100, score));

  return {
    score,
    description:
      score >= 80
        ? "Your resume is highly readable with clear, concise language that effectively communicates your value."
        : score >= 60
        ? "Good readability, but consider using more action verbs and quantifiable achievements."
        : "Your resume readability can be improved. Use action verbs, shorter sentences, and quantifiable results.",
  };
};

// Generate AI-powered suggestions
const generateAISuggestions = async (
  resumeText,
  resumeData,
  jobDescription,
  analysisResults
) => {
  try {
    const openai = getOpenAI();

    // Build comprehensive context about the analysis
    const scoreDetails = [];
    if (analysisResults.keywords?.score < 70) {
      scoreDetails.push(
        `Keywords: ${analysisResults.keywords?.score}/100 - ${
          analysisResults.keywords?.description || "Needs improvement"
        }`
      );
    }
    if (analysisResults.formatting?.score < 70) {
      scoreDetails.push(
        `Formatting: ${analysisResults.formatting?.score}/100 - ${
          analysisResults.formatting?.description || "Needs improvement"
        }`
      );
    }
    if (analysisResults.readability?.score < 70) {
      scoreDetails.push(
        `Readability: ${analysisResults.readability?.score}/100 - ${
          analysisResults.readability?.description || "Needs improvement"
        }`
      );
    }

    // Get missing keywords for context
    const missingKeywords =
      analysisResults.keywords?.missingKeywords?.slice(0, 10) || [];
    const matchedKeywords =
      analysisResults.keywords?.matchedKeywords?.slice(0, 10) || [];
    const formattingIssues = analysisResults.formatting?.issues || [];

    // Build comprehensive prompt
    const prompt = `You are a certified professional resume writer and ATS (Applicant Tracking System) optimization expert with 15+ years of experience. Your task is to analyze this resume and provide detailed, actionable suggestions to maximize ATS compatibility and improve overall resume quality.

RESUME CONTENT (first 3000 characters):
${resumeText.substring(0, 3000)}

JOB DESCRIPTION:
${
  jobDescription ||
  "No job description provided - provide general ATS optimization suggestions"
}

CURRENT ATS ANALYSIS SCORES:
- Keywords: ${analysisResults.keywords?.score || 0}/100
- Formatting: ${analysisResults.formatting?.score || 0}/100
- Readability: ${analysisResults.readability?.score || 0}/100
- Overall Score: ${Math.round(
      (analysisResults.keywords?.score || 0) * 0.4 +
        (analysisResults.formatting?.score || 0) * 0.35 +
        (analysisResults.readability?.score || 0) * 0.25
    )}/100

ANALYSIS DETAILS:
${
  scoreDetails.length > 0
    ? scoreDetails.join("\n")
    : "All scores are above 70 - focus on optimization and enhancement suggestions"
}
${
  missingKeywords.length > 0
    ? `\nMissing Keywords: ${missingKeywords.join(", ")}`
    : ""
}
${
  matchedKeywords.length > 0
    ? `\nMatched Keywords: ${matchedKeywords.join(", ")}`
    : ""
}
${
  formattingIssues.length > 0
    ? `\nFormatting Issues: ${formattingIssues.join(", ")}`
    : ""
}

INSTRUCTIONS:
Provide 5-7 professional, specific, and actionable suggestions to improve this resume's ATS compatibility and overall effectiveness. Each suggestion should:
1. Be specific and tailored to this resume
2. Explain WHY the improvement matters for ATS systems
3. Provide a clear, actionable step the user can take
4. Be prioritized based on impact (high = critical for ATS, medium = important, low = optimization)

Return your response as a valid JSON array with this exact structure (provide 5-7 suggestions):
[
  {
    "category": "Keywords" | "Formatting" | "Readability" | "Content" | "Structure" | "Optimization",
    "priority": "high" | "medium" | "low",
    "text": "Detailed explanation of the issue and why it matters for ATS systems (2-3 sentences)",
    "action": "Specific, actionable step the user can take to implement this improvement"
  }
]

IMPORTANT: 
- Return EXACTLY 5-7 suggestions (not fewer)
- Return ONLY the JSON array, no additional text, explanations, or markdown formatting
- Ensure each suggestion is unique and addresses different aspects of ATS optimization`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 2000, // Increased to allow more suggestions
    });

    const content = response.choices[0]?.message?.content?.trim() || "";

    // Try to parse as JSON object first (if OpenAI returns wrapped JSON)
    let suggestions = [];
    try {
      const parsed = JSON.parse(content);
      // If it's wrapped in an object, extract the array
      if (parsed.suggestions && Array.isArray(parsed.suggestions)) {
        suggestions = parsed.suggestions;
      } else if (Array.isArray(parsed)) {
        suggestions = parsed;
      } else if (typeof parsed === "object") {
        // Try to find array in object
        const keys = Object.keys(parsed);
        for (const key of keys) {
          if (Array.isArray(parsed[key])) {
            suggestions = parsed[key];
            break;
          }
        }
      }
    } catch (e) {
      // Fallback: try to extract JSON array from text
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          suggestions = JSON.parse(jsonMatch[0]);
        } catch (parseError) {
          console.error("Failed to parse JSON from AI response:", parseError);
        }
      }
    }

    // Ensure we have at least 5 suggestions
    if (Array.isArray(suggestions) && suggestions.length >= 5) {
      return suggestions.slice(0, 7); // Return up to 7 suggestions
    }
  } catch (error) {
    console.error("AI suggestion generation error:", error.message);
  }

  // Enhanced fallback suggestions - always provide multiple
  const fallbackSuggestions = [];

  // Keywords suggestions
  if (analysisResults.keywords?.score < 70) {
    const missing =
      analysisResults.keywords?.missingKeywords?.slice(0, 8) || [];
    fallbackSuggestions.push({
      category: "Keywords",
      priority: analysisResults.keywords?.score < 50 ? "high" : "medium",
      text: `Your resume has a keyword match score of ${analysisResults.keywords?.score}/100. ATS systems rank candidates based on keyword relevance. Missing important keywords reduces your chances of passing the initial screening.`,
      action:
        missing.length > 0
          ? `Incorporate these missing keywords naturally throughout your resume: ${missing.join(
              ", "
            )}. Add them to your summary, experience descriptions, and skills section.`
          : "Review the job description and identify key technical terms, skills, and qualifications. Integrate these keywords naturally into your resume sections.",
    });

    if (missing.length > 0) {
      fallbackSuggestions.push({
        category: "Keywords",
        priority: "medium",
        text: "Strategic keyword placement is crucial for ATS optimization. Keywords should appear in multiple sections, not just once.",
        action:
          "Distribute keywords across your summary, experience bullets, skills section, and education. Use variations and synonyms where appropriate.",
      });
    }
  }

  // Formatting suggestions
  if (analysisResults.formatting?.score < 70) {
    const issues = analysisResults.formatting?.issues || [];
    fallbackSuggestions.push({
      category: "Formatting",
      priority: analysisResults.formatting?.score < 60 ? "high" : "medium",
      text: `Your formatting score is ${
        analysisResults.formatting?.score
      }/100. ATS systems require clean, standardized formatting to properly parse your resume. ${
        issues.length > 0 ? `Issues detected: ${issues.join(", ")}.` : ""
      }`,
      action:
        issues.length > 0
          ? `Address these formatting issues: ${issues.join(
              "; "
            )}. Use standard section headers (Experience, Education, Skills), avoid special characters, tables, and graphics.`
          : "Use standard section headers, simple bullet points, and clean formatting. Avoid columns, tables, headers/footers, and graphics.",
    });
  }

  // Readability suggestions
  if (analysisResults.readability?.score < 70) {
    fallbackSuggestions.push({
      category: "Readability",
      priority: "medium",
      text: `Your readability score is ${analysisResults.readability?.score}/100. Clear, concise language with action verbs and quantifiable results makes your resume more impactful and ATS-friendly.`,
      action:
        "Start each bullet point with a strong action verb (e.g., 'Led', 'Developed', 'Increased', 'Optimized'). Include specific numbers, percentages, or metrics to quantify your achievements.",
    });

    fallbackSuggestions.push({
      category: "Content",
      priority: "medium",
      text: "Quantifiable achievements demonstrate impact and value to both ATS systems and hiring managers. Resumes with metrics get higher rankings.",
      action:
        "Review each experience bullet and add specific metrics: percentages (e.g., 'increased sales by 25%'), numbers (e.g., 'managed team of 10'), timeframes (e.g., 'reduced costs by $50K annually').",
    });
  }

  // Always add optimization suggestions
  if (fallbackSuggestions.length < 5) {
    fallbackSuggestions.push({
      category: "Optimization",
      priority: "low",
      text: "A professional summary at the top of your resume helps ATS systems understand your value proposition and increases keyword density.",
      action:
        "Add a 2-3 line professional summary highlighting your key skills, years of experience, and main achievements. Include relevant keywords from the job description.",
    });

    fallbackSuggestions.push({
      category: "Structure",
      priority: "low",
      text: "ATS systems scan resumes in a specific order. Having all standard sections (Contact, Summary, Experience, Education, Skills) improves parsing accuracy.",
      action:
        "Ensure your resume includes: Contact Information, Professional Summary, Work Experience, Education, and Skills sections in that order.",
    });

    fallbackSuggestions.push({
      category: "Content",
      priority: "low",
      text: "Tailoring your resume for each job application significantly improves ATS match rates and increases your chances of getting an interview.",
      action:
        "Customize your resume for each application by: adjusting your summary, emphasizing relevant experience, and incorporating job-specific keywords naturally throughout.",
    });
  }

  // Ensure we return at least 5 suggestions
  return fallbackSuggestions.length >= 5
    ? fallbackSuggestions.slice(0, 7)
    : [
        ...fallbackSuggestions,
        {
          category: "General",
          priority: "low",
          text: "Regular resume updates keep your content fresh and ensure you're highlighting your most recent achievements and skills.",
          action:
            "Review and update your resume quarterly, or whenever you complete a major project or gain new skills.",
        },
      ].slice(0, 7);
};

// Main ATS analysis function
export const analyzeATS = async (
  resumeText,
  jobDescription = "",
  resumeData = null
) => {
  // If resumeData is provided, extract text from it
  let fullResumeText = resumeText || "";
  if (resumeData) {
    const extractedText = extractTextFromResume(resumeData);
    fullResumeText = `${fullResumeText} ${extractedText}`.trim();
  }

  if (!fullResumeText || fullResumeText.trim().length < 10) {
    throw new Error("Resume text is too short or empty");
  }

  // Perform all analyses
  const keywordsAnalysis = analyzeKeywords(fullResumeText, jobDescription);
  const formattingAnalysis = analyzeFormatting(fullResumeText, resumeData);
  const readabilityAnalysis = analyzeReadability(fullResumeText);

  // Calculate overall score (weighted average)
  const overallScore = Math.round(
    keywordsAnalysis.score * 0.4 +
      formattingAnalysis.score * 0.35 +
      readabilityAnalysis.score * 0.25
  );

  // Generate AI suggestions
  const suggestions = await generateAISuggestions(
    fullResumeText,
    resumeData,
    jobDescription,
    {
      keywords: keywordsAnalysis,
      formatting: formattingAnalysis,
      readability: readabilityAnalysis,
    }
  );

  return {
    overallScore,
    score: overallScore, // For backward compatibility
    keywords: keywordsAnalysis,
    formatting: formattingAnalysis,
    readability: readabilityAnalysis,
    suggestions,
    matchedKeywords: keywordsAnalysis.matchedKeywords, // For backward compatibility
  };
};
