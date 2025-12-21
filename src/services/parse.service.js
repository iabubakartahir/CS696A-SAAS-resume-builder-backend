// src/services/parse.service.js
import fs from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
import mammoth from "mammoth";
import OpenAI from "openai";

// Import pdf-parse using require (CommonJS)
// pdf-parse v1.x exports the function directly
const pdfParseModule = require("pdf-parse");

// Handle different export formats (for compatibility)
const pdfParse =
  typeof pdfParseModule === "function"
    ? pdfParseModule
    : pdfParseModule.default || pdfParseModule;

// Verify pdfParse is a function
if (typeof pdfParse !== "function") {
  throw new Error(
    `pdf-parse is not available as a function. Please ensure pdf-parse version 1.x is installed.`
  );
}

const getOpenAI = () => {
  const key = process.env.OPENAI_API_KEY;
  if (!key)
    throw new Error(
      "Missing OPENAI_API_KEY. Set it in your environment (.env)"
    );
  return new OpenAI({ apiKey: key });
};

// Heuristic: extract a short summary from raw text when missing
const extractSummaryFallback = (text) => {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  // Skip first line (often the name), pick the first reasonably long line
  for (let i = 1; i < Math.min(lines.length, 15); i++) {
    const line = lines[i];
    if (line.length >= 40) return line.slice(0, 500);
  }
  // Fallback to first 300 chars of full text
  return text.slice(0, 300);
};

// Clean special glyphs/icons that break parsing
const cleanSpecials = (text) => (text || "").replace(/[✉]/g, " ");

// Heuristic: extract summary from common headings (ABOUT, SUMMARY, PROFESSIONAL SUMMARY, PROFILE)
const extractSummaryFromHeadings = (text) => {
  const targetHeadings = [
    "about",
    "summary",
    "professional summary",
    "profile",
    "about me",
  ];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim().toLowerCase();
    if (targetHeadings.some((h) => line === h || line.startsWith(h))) {
      // Collect following lines until blank or next heading (all-caps/short)
      const collected = [];
      for (let j = i + 1; j < Math.min(lines.length, i + 30); j++) {
        const raw = lines[j];
        const ln = raw.trim();
        if (!ln) break;
        // Stop at next obvious heading (all-caps short line)
        if (ln.length <= 40 && ln === ln.toUpperCase() && /[A-Z]/.test(ln)) break;

        const cleaned = ln.replace(/^[•\-\*\u2022]\s*/, "");
        if (!cleaned) continue;
        collected.push(cleaned);
        const joined = collected.join(" ").trim();
        if (joined.length >= 800) break;
      }
      const joined = collected.join(" ").trim();
      if (joined.length > 0) return joined.slice(0, 1200);
    }
  }
  return "";
};

// Extract common links (LinkedIn, GitHub, portfolio/personal site)
const extractLinks = (text) => {
  const linkedinMatch = text.match(/https?:\/\/(www\.)?linkedin\.com\/[^\s]+/i);
  const githubMatch = text.match(/https?:\/\/(www\.)?github\.com\/[^\s]+/i);
  // Generic URL, prefer non-linkedin/github for portfolio/website
  const urlMatches = Array.from(
    text.matchAll(/https?:\/\/[^\s)]+/gi)
  ).map((m) => m[0]);
  const portfolioMatch =
    urlMatches.find(
      (u) =>
        !/linkedin\.com/i.test(u) &&
        !/github\.com/i.test(u) &&
        !/mailto:/i.test(u)
    ) || "";

  return {
    linkedin: linkedinMatch ? linkedinMatch[0] : "",
    github: githubMatch ? githubMatch[0] : "",
    website: portfolioMatch || "",
  };
};

// Heuristic: extract list items under given headings (projects/awards/hobbies)
const extractSectionItems = (text, headingLabels = [], maxItems = 6) => {
  const lines = text.split("\n").map((l) => l.trim());
  const items = [];
  const isHeading = (line) =>
    headingLabels.some(
      (h) => line.toLowerCase() === h || line.toLowerCase().startsWith(h + " ")
    );

  for (let i = 0; i < lines.length; i++) {
    if (!isHeading(lines[i].toLowerCase())) continue;
    // Collect following lines until blank or another heading-like line
    for (let j = i + 1; j < lines.length && items.length < maxItems; j++) {
      const ln = lines[j];
      if (!ln) break;
      // stop if we hit another all-caps short line (likely a heading)
      if (ln.length <= 40 && ln === ln.toUpperCase() && /[A-Z]/.test(ln)) break;

      // bullets or plain
      const cleaned = ln.replace(/^[•\-\*\u2022]\s*/, "").trim();
      if (cleaned.length === 0) continue;

      // If line is a compact list (no spaces) with capitals, split on capitals
      if (!cleaned.includes(" ") && /[A-Z]/.test(cleaned) && cleaned.length > 4) {
        const parts = cleaned
          .split(/(?=[A-Z])/)
          .map((p) => p.trim())
          .filter(Boolean);
        parts.forEach((p) => items.push(p));
      } else {
        items.push(cleaned);
      }
    }
  }
  return items.slice(0, maxItems);
};

// Heuristic: extract a block of lines after a heading (uppercase or matching label)
const extractHeadingBlock = (text, headingLabels = [], maxItems = 6) => {
  const lines = text.split("\n").map((l) => l.trim());
  const items = [];
  const isHeading = (line) => {
    const lower = line.toLowerCase();
    return (
      headingLabels.some((h) => lower === h || lower.startsWith(h + " ")) ||
      (line.length <= 30 && line === line.toUpperCase() && /[A-Z]/.test(line))
    );
  };
  for (let i = 0; i < lines.length; i++) {
    if (!isHeading(lines[i])) continue;
    // collect after heading
    for (let j = i + 1; j < lines.length && items.length < maxItems; j++) {
      const ln = lines[j].trim();
      if (!ln) break;
      if (isHeading(ln)) break;
      const cleaned = ln.replace(/^[•\-\*\u2022]\s*/, "").trim();
      if (cleaned.length === 0) continue;
      items.push(cleaned);
    }
    if (items.length) break;
  }
  return items.slice(0, maxItems);
};

// Heuristic: extract projects with URLs from raw text (fallback)
const extractProjectsFromRaw = (text, maxItems = 6) => {
  const lines = text.split("\n").map((l) => l.trim());
  const items = [];
  let inProjects = false;
  for (let i = 0; i < lines.length && items.length < maxItems; i++) {
    const ln = lines[i];
    if (!inProjects) {
      if (/^projects?/i.test(ln)) {
        inProjects = true;
      }
      continue;
    }
    if (!ln) continue;
    const urlMatch = ln.match(/https?:\/\/[^\s)]+/i);
    if (urlMatch) {
      const link = urlMatch[0];
      // Look back for a title line
      let name = "";
      for (let j = i - 1; j >= 0 && j >= i - 3; j--) {
        const prev = lines[j].trim();
        if (prev && !/^projects?/i.test(prev)) {
          name = prev.replace(/^[-•*\u2022]\s*/, "");
          break;
        }
      }
      items.push({ name: name || link, link, description: "" });
    } else if (/^[-•*\u2022]\s*/.test(ln)) {
      const name = ln.replace(/^[-•*\u2022]\s*/, "");
      if (name) items.push({ name, link: "", description: "" });
    }
  }
  return items.slice(0, maxItems);
};

// Heuristic: extract projects from any URLs if heading-based extraction fails
const extractProjectsFromAnyUrl = (text, maxItems = 6) => {
  const lines = text.split("\n").map((l) => l.trim());
  const urls = Array.from(text.matchAll(/https?:\/\/[^\s)]+/gi)).map((m) => m[0]);
  const items = [];
  urls.forEach((link) => {
    if (items.length >= maxItems) return;
    let name = "";
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(link)) {
        for (let j = i - 1; j >= 0 && j >= i - 3; j--) {
          const prev = lines[j].trim();
          if (prev && !prev.match(/^https?:\/\//i)) {
            name = prev.replace(/^[-•*\u2022]\s*/, "");
            break;
          }
        }
        break;
      }
    }
    items.push({ name: name || link, link, description: "" });
  });
  return items.slice(0, maxItems);
};

// Normalize parsed data to avoid missing required fields
const normalizeParsed = (parsed, rawText) => {
  const safe = { ...parsed };
  const cleanRaw = cleanSpecials(rawText || "");
  const fallbackSummary = extractSummaryFallback(cleanRaw || "");
  const headingSummary = extractSummaryFromHeadings(cleanRaw || "");
  const parsedSummary =
    parsed.contact?.summary ||
    parsed.summary ||
    parsed.contact?.professionalSummary ||
    "";
  const links = extractLinks(cleanRaw || "");
  const cleanUrl = (url) =>
    (url || "")
      .replace(/[^\w\-@:%_\+.~#?&/=]+$/g, "") // strip trailing symbols (e.g. )
      .trim();
  const cleanPhone = (phone) => {
    const match =
      (phone || "").match(
        /(\+?\d[\d\-\s()]{6,})/
      ) ||
      (rawText || "").match(/(\+?\d[\d\-\s()]{6,})/);
    return match ? match[1].replace(/[^\d+]/g, "") : phone || "";
  };
  safe.contact = {
    fullName: parsed.contact?.fullName || "",
    email: parsed.contact?.email || "",
    phone: cleanPhone(parsed.contact?.phone || ""),
    address: parsed.contact?.address || "",
    location:
      parsed.contact?.location ||
      parsed.contact?.city ||
      parsed.contact?.address ||
      "",
    website: cleanUrl(parsed.contact?.website || links.website || ""),
    github: cleanUrl(parsed.contact?.github || links.github || ""),
    linkedin: cleanUrl(parsed.contact?.linkedin || links.linkedin || ""),
    portfolioLink: parsed.contact?.portfolioLink || "",
    headline: parsed.contact?.headline || "",
    summary:
      parsedSummary && parsedSummary.trim().length > 0
        ? parsedSummary
        : headingSummary && headingSummary.trim().length > 0
        ? headingSummary
        : fallbackSummary,
  };
  // Mirror summary into professionalSummary for templates that expect it
  safe.contact.professionalSummary = safe.contact.summary;

  safe.experience = Array.isArray(parsed.experience)
    ? parsed.experience.map((e) => ({
        title: e.title || "",
        company: e.company || "",
        location: e.location || "",
        startDate: e.startDate || null,
        endDate: e.endDate || null,
        current: typeof e.current === "boolean" ? e.current : false,
        bullets: Array.isArray(e.bullets)
          ? e.bullets.filter(Boolean)
          : typeof e.bullets === "string"
          ? [e.bullets]
          : [],
      }))
    : [];

  safe.education = Array.isArray(parsed.education)
    ? parsed.education.map((e) => ({
        degree: e.degree || "",
        school: e.school || "",
        location: e.location || "", // required in schema; ensure string
        startDate: e.startDate || null,
        endDate: e.endDate || null,
        details: Array.isArray(e.details)
          ? e.details.filter(Boolean)
          : typeof e.details === "string"
          ? [e.details]
          : [],
      }))
    : [];

  safe.skills = Array.isArray(parsed.skills)
    ? parsed.skills
        .map((s) => {
          if (!s) return null;
          if (typeof s === "string") return { name: s, level: 0 };
          return {
            name: s.name || "",
            level:
              typeof s.level === "number"
                ? Math.max(0, Math.min(100, s.level))
                : 0,
            score:
              typeof s.score === "number"
                ? Math.max(0, Math.min(100, s.score))
                : undefined,
          };
        })
        .filter((s) => s && s.name)
    : [];

  // Projects
  const parsedProjects = Array.isArray(parsed.projects)
    ? parsed.projects
    : Array.isArray(parsed.project)
    ? parsed.project
    : [];
  const fallbackProjectsFromHeadings = extractSectionItems(cleanRaw || "", ["projects", "project", "personal projects"], 6).map(
    (t) => ({ name: t.slice(0, 80), description: "" })
  );
  const fallbackProjectsFromUrls = extractProjectsFromRaw(cleanRaw || "", 6);
  const fallbackProjectsAny = extractProjectsFromAnyUrl(cleanRaw || "", 6);
  const projectList = parsedProjects.length
    ? parsedProjects
    : fallbackProjectsFromUrls.length
    ? fallbackProjectsFromUrls
    : fallbackProjectsAny.length
    ? fallbackProjectsAny
    : fallbackProjectsFromHeadings;
  const contactLinks = new Set(
    [links.website, links.github, links.linkedin].filter(Boolean)
  );
  safe.projects = projectList
    .map((p) => ({
      name: p.name || p.title || "",
      description: p.description || "",
      link: p.link || p.url || "",
    }))
    .filter(
      (p) =>
        p.name ||
        (p.link &&
          !/linkedin\.com|github\.com|mailto:/i.test(p.link) &&
          !contactLinks.has(p.link))
    );
  // Final fallback: if still empty, try any URLs as projects (excluding contact links)
  if (!safe.projects.length) {
    const extra = extractProjectsFromAnyUrl(cleanRaw || "", 6).filter(
      (p) =>
        p.link &&
        !/linkedin\.com|github\.com|mailto:/i.test(p.link) &&
        !contactLinks.has(p.link)
    );
    safe.projects = extra.map((p) => ({
      name: p.name || p.title || "",
      description: p.description || "",
      link: p.link || p.url || "",
    }));
  }

  // Awards
  const parsedAwards = Array.isArray(parsed.awards)
    ? parsed.awards
    : Array.isArray(parsed.achievements)
    ? parsed.achievements
    : [];
  // Only build fallback awards if an awards-related heading actually exists
  const hasAwardsHeading = /(\n|^)\s*(awards|achievements|honors)\s*[:\-]?\s*$/im.test(
    cleanRaw
  );
  const fallbackAwards = hasAwardsHeading
    ? extractSectionItems(cleanRaw || "", ["awards", "achievements", "honors"], 6)
        .concat(
          extractHeadingBlock(cleanRaw || "", ["awards", "achievements", "honors"], 6)
        )
        .slice(0, 6)
        .map((t) => ({ title: t.slice(0, 80), description: "" }))
    : [];

  const awardsList = parsedAwards.length ? parsedAwards : fallbackAwards;
  safe.awards = awardsList.map((a) => ({
    title: a.title || a.name || "",
    description: a.description || "",
    date: a.date || null,
    issuer: a.issuer || "",
  }));

  // Hobbies / Interests
  const parsedHobbies = Array.isArray(parsed.hobbies)
    ? parsed.hobbies
    : Array.isArray(parsed.interests)
    ? parsed.interests
    : [];
  const fallbackHobbies = extractSectionItems(cleanRaw || "", ["interests", "hobbies"], 6).map(
    (t) => ({ name: t.slice(0, 60), description: "" })
  );
  const hobbyList = parsedHobbies.length ? parsedHobbies : fallbackHobbies;
  safe.hobbies = hobbyList.map((h) => ({
    name: typeof h === "string" ? h : h.name || "",
    description: typeof h === "object" ? h.description || "" : "",
  }));
  // If still empty, try compact split on interests/hobbies merged line
  if (!safe.hobbies.length && cleanRaw.toLowerCase().includes("interests")) {
    const compact = cleanRaw.split("\n").find((l) => l.toLowerCase().includes("interests"));
    if (compact) {
      const parts = compact
        .replace(/interests[:\-]?\s*/i, "")
        .split(/[,•;\u2022]/)
        .map((p) => p.trim())
        .filter(Boolean)
        .slice(0, 6);
      safe.hobbies = parts.map((p) => ({ name: p, description: "" }));
    }
  }

  safe.rawText = rawText ? rawText.slice(0, 50000) : "";
  return safe;
};

// Helper to log parsed output (useful for debugging uploads)
const logParsed = (label, data) => {
  try {
    console.log(`[parse.service] ${label}:`, JSON.stringify(data, null, 2));
  } catch {
    console.log(`[parse.service] ${label}:`, data);
  }
};

export const parseResumeFile = async (filePath, extHint) => {
  const ext = (extHint || "").toLowerCase();
  let text = "";

  if (ext === "pdf") {
    try {
      const dataBuffer = fs.readFileSync(filePath);
      // pdf-parse expects a Buffer and returns a Promise
      const result = await pdfParse(dataBuffer);
      text = result.text || "";
    } catch (err) {
      console.error("PDF parsing error:", err);
      console.error("Error details:", {
        message: err.message,
        stack: err.stack,
        pdfParseType: typeof pdfParse,
      });
      throw new Error(`Failed to parse PDF: ${err.message}`);
    }
  } else if (ext === "docx") {
    try {
      const result = await mammoth.extractRawText({ path: filePath });
      text = result.value || "";
    } catch (err) {
      console.error("DOCX parsing error:", err);
      throw new Error(`Failed to parse DOCX: ${err.message}`);
    }
  } else {
    // Try both if unknown
    try {
      const dataBuffer = fs.readFileSync(filePath);
      const result = await pdfParse(dataBuffer);
      text = result.text || "";
    } catch (pdfErr) {
      try {
        const result = await mammoth.extractRawText({ path: filePath });
        text = result.value || "";
      } catch (docxErr) {
        throw new Error(
          `Failed to parse file. PDF error: ${pdfErr.message}, DOCX error: ${docxErr.message}`
        );
      }
    }
  }

  // Basic fallback parsing (regex-based)
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/);
  const phoneMatch = text.match(
    /[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}/
  );
  const firstLine = (
    text.split("\n").find((l) => l.trim().length > 0) || ""
  ).trim();

  const basicData = normalizeParsed(
    {
      contact: {
        fullName: firstLine,
        email: emailMatch?.[0] || "",
        phone: phoneMatch?.[0] || "",
        summary: extractSummaryFallback(text),
      },
      experience: [],
      education: [],
      skills: [],
    },
    text
  );
  logParsed("basicData", basicData);

  // Try OpenAI parsing if available
  try {
    const openai = getOpenAI();
    const prompt = `Extract structured resume data from the following text. Return ONLY valid JSON with this exact structure (all fields optional but include them if found):
{
  "contact": {
    "fullName": "string",
    "email": "string",
    "phone": "string",
    "address": "string",
    "location": "string",
    "website": "string",
    "github": "string",
    "linkedin": "string",
    "portfolioLink": "string",
    "summary": "string",
    "professionalSummary": "string",
    "headline": "string (job title)"
  },
  "experience": [
    {
      "title": "string",
      "company": "string",
      "location": "string",
      "startDate": "YYYY-MM-DD or null",
      "endDate": "YYYY-MM-DD or null",
      "current": boolean,
      "bullets": ["string"]
    }
  ],
  "education": [
    {
      "degree": "string",
      "school": "string",
      "location": "string",
      "startDate": "YYYY-MM-DD or null",
      "endDate": "YYYY-MM-DD or null",
      "details": ["string"]
    }
  ],
  "skills": [
    { "name": "string", "level": 0-100 }
  ],
  "projects": [
    { "name": "string", "description": "string", "link": "string" }
  ],
  "awards": [
    { "title": "string", "issuer": "string", "date": "YYYY-MM-DD or null", "description": "string" }
  ],
  "hobbies": [
    { "name": "string", "description": "string" }
  ]
}

Resume text:
${text.slice(0, 4000)}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 2000,
    });

    const content = completion.choices[0]?.message?.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const normalized = normalizeParsed(parsed, text);
      logParsed("openaiParsed", normalized);
      return normalized;
    }
  } catch (err) {
    console.warn("OpenAI parsing failed, using basic parsing:", err.message);
  }

  logParsed("fallbackParsed", basicData);
  return basicData;
};
