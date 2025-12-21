import fs from "fs/promises";
import path from "path";
import Handlebars from "handlebars";
import Template from "../models/Template.js";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const TPL_ROOT = path.resolve("src/templates");

export const renderResumeHTML = async (slug, data) => {
  const toDate = (v) => (v ? new Date(v) : null);
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const formatMY = (d) =>
    d ? `${monthNames[d.getUTCMonth()]} ${d.getUTCFullYear()}` : "";
  const formatRange = (s, e, current) => {
    const sd = toDate(s);
    const ed = current ? null : toDate(e);
    return `${formatMY(sd)}${sd ? " – " : ""}${
      current ? "Present" : formatMY(ed)
    }`.trim();
  };
  // ✅ FIX: Check for npm theme FIRST (prioritize over local/remote files)
  const tDoc = await Template.findOne({ slug }).lean();
  if (!tDoc) throw new Error(`Template not found for slug: ${slug}`);

  // ✅ If template has npm package, use that (most common case)
  if (tDoc?.npmPackageName) {
    // Render using JSON Resume theme if provided (expects JSON Resume schema)
    const theme = require(tDoc.npmPackageName);

    // Build location object (some themes expect this structure)
    // Fix: Prevent duplication by properly parsing location
    const contactLocation = String(
      data?.contact?.location || data?.contact?.address || ""
    ).trim();
    const locationParts = contactLocation
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);

    // If location has multiple parts (e.g., "Lahore, Punjab"), use them properly
    // If only one part (e.g., "Lahore"), use it as city, not address
    const locationObj = contactLocation
      ? {
          address: locationParts.length > 1 ? contactLocation : "", // Only set address if multiple parts
          city: locationParts[0] || "", // First part is always city
          region:
            locationParts.length > 1 ? locationParts.slice(1).join(", ") : "", // Rest is region/state
          countryCode: "",
        }
      : {
          address: "",
          city: "",
          countryCode: "",
          region: "",
        };

    const basics = {
      name: String(data?.contact?.fullName || data?.title || ""),
      email: String(data?.contact?.email || ""),
      phone: String(data?.contact?.phone || ""),
      url: String(data?.contact?.website || data?.contact?.portfolioLink || ""),
      summary: String(
        data?.contact?.professionalSummary || data?.contact?.summary || ""
      ),
      label: String(data?.contact?.headline || ""),
      location: locationObj,
    };

    const work = (data?.experience || [])
      .filter((e) => e && (e.title || e.company)) // Only include valid entries
      .map((e) => {
        let startDate = undefined;
        let endDate = undefined;

        try {
          if (e.startDate) {
            const d = new Date(e.startDate);
            if (!isNaN(d.getTime())) {
              startDate = d.toISOString().slice(0, 10);
            }
          }
          if (!e.current && e.endDate) {
            const d = new Date(e.endDate);
            if (!isNaN(d.getTime())) {
              endDate = d.toISOString().slice(0, 10);
            }
          }
        } catch (err) {
          console.warn("Date parsing error:", err);
        }

        const companyName = String(e?.company || e?.name || "");
        return {
          // JSON Resume schema uses 'company' not 'name' for work entries
          company: companyName,
          name: companyName, // Some themes might use 'name' instead
          position: String(e?.title || e?.position || ""),
          location: String(e?.location || ""),
          startDate: startDate || "",
          endDate: endDate || "",
          highlights: Array.isArray(e?.bullets)
            ? e.bullets.filter(Boolean).map(String)
            : [],
          website: String(e?.website || ""),
          summary: String(e?.summary || ""),
        };
      });

    const education = (data?.education || [])
      .filter((ed) => ed.degree || ed.school) // Only include valid entries
      .map((ed) => {
        let startDate = undefined;
        let endDate = undefined;

        try {
          if (ed.startDate) {
            const d = new Date(ed.startDate);
            if (!isNaN(d.getTime())) {
              startDate = d.toISOString().slice(0, 10);
            }
          }
          if (ed.endDate) {
            const d = new Date(ed.endDate);
            if (!isNaN(d.getTime())) {
              endDate = d.toISOString().slice(0, 10);
            }
          }
        } catch (err) {
          console.warn("Date parsing error:", err);
        }

        return {
          institution: String(ed?.school || ed?.institution || ""),
          area: String(ed?.degree || ed?.area || ""),
          location: String(ed?.location || ""),
          startDate: startDate || "",
          endDate: endDate || "",
          studyType:
            ed?.details && Array.isArray(ed.details) && ed.details[0]
              ? String(ed.details[0])
              : "",
          gpa: String(ed?.gpa || ""),
        };
      });

    const skills = (data?.skills || [])
      .filter((s) => s && (s.name || s))
      .map((s) => ({
        name: String(s?.name || s || ""),
        level: String(s?.level || s?.score || 0),
        keywords: Array.isArray(s?.keywords) ? s.keywords.map(String) : [],
      }));

    // Projects
    const projects = (data?.projects || [])
      .filter((p) => p && (p.name || p.description))
      .map((p) => ({
        name: String(p?.name || ""),
        description: String(p?.description || ""),
        url: String(p?.link || ""),
        keywords: [],
        type: "",
        roles: [],
        entity: "",
        highlights: [],
      }));

    // Awards - with comprehensive null checks
    const awards = (data?.awards || [])
      .filter((a) => a && typeof a === "object" && (a.title || a.description))
      .map((a) => {
        // Ensure all fields are safe
        const title = a?.title ? String(a.title).trim() : "";
        const description = a?.description ? String(a.description).trim() : "";
        const issuer = a?.issuer ? String(a.issuer).trim() : "";

        // Only include if we have at least a title or description
        if (!title && !description) return null;

        let date = "";
        try {
          if (a?.date) {
            const d = new Date(a.date);
            if (!isNaN(d.getTime())) {
              date = d.toISOString().slice(0, 10);
            }
          }
        } catch (err) {
          // Ignore date parsing errors
        }

        return {
          title: title || "Award",
          date,
          awarder: issuer,
          summary: description,
        };
      })
      .filter((a) => a !== null && a.title); // Final filter to ensure valid award

    // Interests (from hobbies)
    const interests = (data?.hobbies || [])
      .filter((h) => h && h.name)
      .map((h) => ({
        name: String(h?.name || ""),
        keywords: h?.description ? [String(h.description)] : [],
      }));

    // Ensure all arrays are non-null and properly structured
    const safeWork = work
      .filter(
        (w) => w && typeof w === "object" && (w.company || w.name || w.position)
      )
      .map((w) => ({
        // Ensure all required properties exist with defaults
        company: String(w?.company || w?.name || ""),
        name: String(w?.company || w?.name || ""), // Some themes use 'name'
        position: String(w?.position || ""),
        location: String(w?.location || ""),
        startDate: String(w?.startDate || ""),
        endDate: String(w?.endDate || ""),
        highlights: Array.isArray(w?.highlights) ? w.highlights : [],
        website: String(w?.website || ""),
        summary: String(w?.summary || ""),
      }));
    const safeEducation = education
      .filter((e) => e && typeof e === "object" && (e.institution || e.area))
      .map((e) => ({
        // Ensure all required properties exist with defaults
        institution: String(e?.institution || ""),
        area: String(e?.area || ""),
        location: String(e?.location || ""),
        startDate: String(e?.startDate || ""),
        endDate: String(e?.endDate || ""),
        studyType: String(e?.studyType || ""),
        gpa: String(e?.gpa || ""),
      }));
    const safeSkills = skills
      .filter((s) => s && typeof s === "object" && s.name)
      .map((s) => ({
        // Ensure all required properties exist with defaults
        name: String(s?.name || ""),
        level: String(s?.level || s?.score || ""),
        keywords: Array.isArray(s?.keywords) ? s.keywords : [],
      }));
    const safeProjects = projects
      .filter((p) => p && typeof p === "object" && (p.name || p.description))
      .map((p) => ({
        // Ensure all required properties exist with defaults
        name: String(p?.name || ""),
        description: String(p?.description || ""),
        url: String(p?.url || ""),
        keywords: Array.isArray(p?.keywords) ? p.keywords : [],
        type: String(p?.type || ""),
        roles: Array.isArray(p?.roles) ? p.roles : [],
        entity: String(p?.entity || ""),
        highlights: Array.isArray(p?.highlights) ? p.highlights : [],
      }));
    const safeAwards = awards
      .filter((a) => a && typeof a === "object" && (a.title || a.description))
      .map((a) => ({
        // Ensure all required properties exist with defaults
        title: String(a?.title || ""),
        date: String(a?.date || ""),
        awarder: String(a?.awarder || ""),
        summary: String(a?.summary || ""),
      }));
    const safeInterests = interests
      .filter((i) => i && typeof i === "object" && i.name)
      .map((i) => ({
        // Ensure all required properties exist with defaults
        name: String(i?.name || ""),
        keywords: Array.isArray(i?.keywords) ? i.keywords : [],
      }));

    // ✅ Add profiles array (required by some themes)
    const profiles = [];
    if (data?.contact?.website || data?.contact?.portfolioLink) {
      profiles.push({
        network: "Website",
        url: String(
          data?.contact?.website || data?.contact?.portfolioLink || ""
        ),
      });
    }
    if (data?.contact?.github) {
      profiles.push({
        network: "GitHub",
        url: String(data?.contact?.github || ""),
      });
    }
    if (data?.contact?.linkedin) {
      profiles.push({
        network: "LinkedIn",
        url: String(data?.contact?.linkedin || ""),
      });
    }
    if (basics.email) {
      profiles.push({ network: "Email", url: `mailto:${basics.email}` });
    }

    const resumeJson = {
      basics: { ...basics, profiles },
      work: safeWork,
      education: safeEducation,
      skills: safeSkills,
      projects: safeProjects,
      awards: safeAwards,
      interests: safeInterests,
      // Add empty arrays for other sections themes might expect
      volunteer: [],
      publications: [],
      languages: [],
      references: [],
    };

    try {
      // Ensure all required fields are present and valid
      // Arrays are already sanitized above, but ensure they're still valid
      const safeResumeJson = {
        ...resumeJson,
        basics: {
          ...resumeJson.basics,
          name: String(resumeJson.basics?.name || "Resume"),
          email: String(resumeJson.basics?.email || ""),
          phone: String(resumeJson.basics?.phone || ""),
          url: String(resumeJson.basics?.url || ""),
          summary: String(resumeJson.basics?.summary || ""),
          label: String(resumeJson.basics?.label || ""),
          location: resumeJson.basics?.location || {
            address: "",
            city: "",
            countryCode: "",
            region: "",
          },
          profiles: Array.isArray(resumeJson.basics?.profiles)
            ? resumeJson.basics.profiles
            : [],
        },
        // Arrays are already sanitized, but ensure they're arrays
        work: Array.isArray(resumeJson.work) ? resumeJson.work : [],
        education: Array.isArray(resumeJson.education)
          ? resumeJson.education
          : [],
        skills: Array.isArray(resumeJson.skills) ? resumeJson.skills : [],
        projects: Array.isArray(resumeJson.projects) ? resumeJson.projects : [],
        awards: Array.isArray(resumeJson.awards) ? resumeJson.awards : [],
        interests: Array.isArray(resumeJson.interests)
          ? resumeJson.interests
          : [],
        // Ensure all optional arrays exist
        volunteer: Array.isArray(resumeJson.volunteer)
          ? resumeJson.volunteer
          : [],
        publications: Array.isArray(resumeJson.publications)
          ? resumeJson.publications
          : [],
        languages: Array.isArray(resumeJson.languages)
          ? resumeJson.languages
          : [],
        references: Array.isArray(resumeJson.references)
          ? resumeJson.references
          : [],
      };

      // Validate that theme.render is a function
      if (typeof theme.render !== "function") {
        throw new Error(
          `Theme ${tDoc.npmPackageName} does not export a render function`
        );
      }

      // Additional validation: ensure all work entries have required fields
      // Some themes like jsonresume-theme-classy access nested properties
      safeResumeJson.work = safeResumeJson.work.map((w) => {
        const companyName = String(w?.company || w?.name || "");
        return {
          company: companyName,
          name: companyName, // Some themes use 'name' instead of 'company'
          position: String(w?.position || ""),
          location: String(w?.location || ""),
          startDate: String(w?.startDate || ""),
          endDate: String(w?.endDate || ""),
          highlights: Array.isArray(w?.highlights)
            ? w.highlights.map(String)
            : [],
          website: String(w?.website || ""),
          summary: String(w?.summary || ""),
          // Ensure nested objects exist if theme accesses them
          companyObj: companyName ? { name: companyName } : { name: "" },
        };
      });

      // Ensure all skills have name property (some themes access it directly)
      safeResumeJson.skills = safeResumeJson.skills.map((s) => ({
        name: String(s?.name || ""),
        level: String(s?.level || s?.score || ""),
        keywords: Array.isArray(s?.keywords) ? s.keywords.map(String) : [],
        // Ensure nested objects exist
        skillObj: s?.name ? { name: String(s.name) } : { name: "" },
      }));

      // Ensure all projects have name property
      safeResumeJson.projects = safeResumeJson.projects.map((p) => ({
        name: String(p?.name || ""),
        description: String(p?.description || ""),
        url: String(p?.url || ""),
        keywords: Array.isArray(p?.keywords) ? p.keywords.map(String) : [],
        type: String(p?.type || ""),
        roles: Array.isArray(p?.roles) ? p.roles.map(String) : [],
        entity: String(p?.entity || ""),
        highlights: Array.isArray(p?.highlights)
          ? p.highlights.map(String)
          : [],
      }));

      // Ensure all interests have name property
      safeResumeJson.interests = safeResumeJson.interests.map((i) => ({
        name: String(i?.name || ""),
        keywords: Array.isArray(i?.keywords) ? i.keywords.map(String) : [],
      }));

      // Ensure all education entries are complete
      safeResumeJson.education = safeResumeJson.education.map((e) => ({
        institution: String(e?.institution || ""),
        area: String(e?.area || ""),
        location: String(e?.location || ""),
        startDate: String(e?.startDate || ""),
        endDate: String(e?.endDate || ""),
        studyType: String(e?.studyType || ""),
        gpa: String(e?.gpa || ""),
      }));

      let html;
      try {
        html = theme.render(safeResumeJson);
      } catch (renderError) {
        // Provide more context about the error
        console.error("Theme render error details:", {
          error: renderError.message,
          template: slug,
          theme: tDoc.npmPackageName,
          basicsName: safeResumeJson.basics?.name,
          workCount: safeResumeJson.work?.length,
          workFirstItem: safeResumeJson.work?.[0],
          skillsCount: safeResumeJson.skills?.length,
          skillsFirstItem: safeResumeJson.skills?.[0],
        });
        throw new Error(
          `Theme render failed for ${tDoc.npmPackageName}: ${renderError.message}`
        );
      }

      if (!html) {
        throw new Error(`Theme ${tDoc.npmPackageName} returned empty HTML`);
      }

      // Check if the theme already returns a complete HTML document
      if (html && (html.includes("<!doctype") || html.includes("<html"))) {
        // Add CSP meta tag and fix image sources for iframe embedding
        // Note: frame-ancestors only works in HTTP headers, not meta tags
        // Allow external resources: stylesheets, fonts, images from any HTTP/HTTPS source
        const cspMeta = `<meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: http: https:; img-src 'self' data: blob: http: https:; style-src 'self' 'unsafe-inline' http: https:; style-src-elem 'self' 'unsafe-inline' http: https:; font-src 'self' data: http: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' http: https:; connect-src 'self' http: https:;">`;
        // Also convert Gravatar HTTP URLs to HTTPS in the HTML
        const htmlWithHttps = html.replace(
          /http:\/\/(www\.)?gravatar\.com/g,
          "https://$1gravatar.com"
        );
        return htmlWithHttps.replace(/<head>/i, `<head>${cspMeta}`);
      }
      // If not, wrap it with HTML structure
      if (html) {
        // Convert Gravatar HTTP URLs to HTTPS
        const htmlWithHttps = html.replace(
          /http:\/\/(www\.)?gravatar\.com/g,
          "https://$1gravatar.com"
        );
        // Note: frame-ancestors only works in HTTP headers, not meta tags
        return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: http: https:; img-src 'self' data: blob: http: https:; style-src 'self' 'unsafe-inline' http: https:; style-src-elem 'self' 'unsafe-inline' http: https:; font-src 'self' data: http: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' http: https:; connect-src 'self' http: https:;"></head><body>${htmlWithHttps}</body></html>`;
      }
      throw new Error("Theme render returned empty result");
    } catch (err) {
      console.error("Theme render error:", err.message);
      console.error("Template:", slug, "Theme:", tDoc.npmPackageName);
      console.error("Resume data keys:", Object.keys(resumeJson));

      // Fallback to basic HTML if theme fails
      const workHtml = work
        .filter((w) => w && (w.position || w.name))
        .map(
          (w) => `
<div style="margin-bottom:16px">
<strong>${w?.position || ""}</strong> at ${w?.name || ""}
${
  w?.startDate
    ? `<br><small>${w.startDate}${
        w?.endDate ? ` - ${w.endDate}` : " - Present"
      }</small>`
    : ""
}
${
  w?.highlights?.length
    ? `<ul>${w.highlights.map((h) => `<li>${h}</li>`).join("")}</ul>`
    : ""
}
</div>
`
        )
        .join("");

      const eduHtml = education
        .filter((e) => e && (e.area || e.institution))
        .map(
          (e) => `
<div style="margin-bottom:12px">
<strong>${e?.area || ""}</strong> - ${e?.institution || ""}
${
  e?.startDate
    ? `<br><small>${e.startDate}${e?.endDate ? ` - ${e.endDate}` : ""}</small>`
    : ""
}
</div>
`
        )
        .join("");

      const skillsHtml = skills
        .filter((s) => s && s.name)
        .map(
          (s) =>
            `<span style="display:inline-block;margin:4px 8px 4px 0;padding:4px 12px;background:#e5e7eb;border-radius:4px">${
              s?.name || ""
            }</span>`
        )
        .join("");

      return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; line-height: 1.6; }
h1 { color: #1a202c; margin-bottom: 4px; }
.subtitle { color: #4a5568; margin-bottom: 8px; }
.contact { color: #718096; font-size: 14px; margin-bottom: 20px; }
h2 { color: #2d3748; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-top: 32px; }
.error { background: #fef3c7; color: #92400e; padding: 12px; border-radius: 8px; margin-bottom: 20px; }
</style>
</head>
<body>
<div class="error">⚠️ Template rendering error. Showing fallback view.</div>
<h1>${basics.name || "Resume"}</h1>
<div class="subtitle">${basics.label || ""}</div>
<div class="contact">
${basics.email ? `📧 ${basics.email}` : ""}
${basics.phone ? ` | 📱 ${basics.phone}` : ""}
${basics.url ? ` | 🌐 ${basics.url}` : ""}
</div>
${basics.summary ? `<p>${basics.summary}</p>` : ""}
${work.length ? `<h2>Experience</h2>${workHtml}` : ""}
${education.length ? `<h2>Education</h2>${eduHtml}` : ""}
${skills.length ? `<h2>Skills</h2><div>${skillsHtml}</div>` : ""}
</body>
</html>`;
    }
  }

  // ✅ Fallback to local Handlebars templates (if no npm package)
  const tplPath = path.join(TPL_ROOT, slug, "template.hbs");
  const cssPath = path.join(TPL_ROOT, slug, "style.css");
  let tplSrc;
  let css = "";

  try {
    tplSrc = await fs.readFile(tplPath, "utf-8");
    css = await fs.readFile(cssPath, "utf-8").catch(() => "");
  } catch {
    // If no local files, return error message
    return `<!doctype html>
<html>
<head><meta charset="utf-8">
<style>
body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; }
.error { background: #fee2e2; color: #991b1b; padding: 20px; border-radius: 8px; }
</style>
</head>
<body>
<div class="error">
<h2>Template Not Found</h2>
<p>Template "${slug}" does not have an npm package or local files configured.</p>
<p>Please contact support or try a different template.</p>
</div>
</body>
</html>`;
  }

  const tpl = Handlebars.compile(tplSrc || "");
  const experience = (data?.experience || []).map((e) => ({
    ...e,
    dateRange: formatRange(e.startDate, e.endDate, e.current),
  }));
  const education = (data?.education || []).map((ed) => ({
    ...ed,
    dateRange: formatRange(ed.startDate, ed.endDate, false),
  }));
  const body = tpl({
    ...(data || {}),
    experience,
    education,
    assetsBaseUrl: tDoc?.assetsBaseUrl || "",
  });
  return `<!doctype html><html><head><meta charset=\"utf-8\"><style>${css}</style></head><body>${body}</body></html>`;
};
