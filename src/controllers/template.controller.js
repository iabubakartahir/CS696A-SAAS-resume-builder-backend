import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import catchAsync from "../utils/catchAsync.js";
import Template from "../models/Template.js";

export const listTemplates = catchAsync(async (req, res) => {
  const { category } = req.query;
  const filter = { isActive: true };
  if (category) filter.category = category;

  const items = await Template.find(filter).sort({ createdAt: -1 });

  // ✅ Generate preview URL for each template
  const itemsWithPreview = items.map((t) => ({
    ...t.toObject(),
    // Generate preview URL dynamically
    previewUrl: `/api/v1/templates/${t.slug}/preview`,
    thumbnailUrl: `/api/v1/templates/${t.slug}/thumbnail`,
  }));

  res.json(new ApiResponse(200, { items: itemsWithPreview }));
});

export const getTemplate = catchAsync(async (req, res, next) => {
  const t = await Template.findOne({
    slug: req.params.slug,
    isActive: true,
  });
  if (!t) return next(new ApiError(404, "Template not found"));

  // ✅ Add preview URLs
  const templateWithPreview = {
    ...t.toObject(),
    previewUrl: `/api/v1/templates/${t.slug}/preview`,
    thumbnailUrl: `/api/v1/templates/${t.slug}/thumbnail`,
  };

  res.json(new ApiResponse(200, { template: templateWithPreview }));
});

export const listTemplatesGrouped = catchAsync(async (req, res) => {
  const allTemplates = await Template.find({ isActive: true }).sort({
    createdAt: -1,
  });

  // ✅ Add preview URLs to all templates
  const templatesWithPreview = allTemplates.map((t) => ({
    ...t.toObject(),
    previewUrl: `/api/v1/templates/${t.slug}/preview`,
    thumbnailUrl: `/api/v1/templates/${t.slug}/thumbnail`,
  }));

  const grouped = {
    free: templatesWithPreview.filter((t) => t.category === "free"),
    premium: templatesWithPreview.filter((t) => t.category === "premium"),
    industry: templatesWithPreview.filter((t) => t.category === "industry"),
  };

  res.json(new ApiResponse(200, { grouped }));
});

// ✅ NEW: Generate template preview
export const getTemplatePreview = catchAsync(async (req, res, next) => {
  const { slug } = req.params;
  const template = await Template.findOne({ slug, isActive: true });

  if (!template) {
    return next(new ApiError(404, "Template not found"));
  }

  // Generate comprehensive sample resume data with all new fields
  const sampleData = {
    contact: {
      fullName: "John Doe",
      email: "john.doe@example.com",
      phone: "+1 (555) 123-4567",
      address: "San Francisco, CA",
      location: "San Francisco, CA",
      website: "johndoe.com",
      github: "https://github.com/johndoe",
      linkedin: "https://linkedin.com/in/johndoe",
      portfolioLink: "https://johndoe.dev",
      headline: "Senior Software Engineer",
      summary:
        "Experienced software engineer with 8+ years of expertise in full-stack development, cloud architecture, and team leadership. Passionate about building scalable solutions and mentoring junior developers.",
      professionalSummary:
        "Experienced software engineer with 8+ years of expertise in full-stack development, cloud architecture, and team leadership. Passionate about building scalable solutions and mentoring junior developers. Proven track record of delivering high-quality software solutions that drive business value.",
    },
    experience: [
      {
        title: "Senior Software Engineer",
        company: "Tech Corp",
        location: "San Francisco, CA",
        startDate: "2020-01-01",
        current: true,
        bullets: [
          "Led development of microservices architecture serving 1M+ users",
          "Mentored team of 5 junior developers",
          "Improved system performance by 40% through optimization",
        ],
      },
      {
        title: "Software Engineer",
        company: "StartupXYZ",
        location: "New York, NY",
        startDate: "2017-06-01",
        endDate: "2019-12-31",
        current: false,
        bullets: [
          "Built RESTful APIs using Node.js and Express",
          "Implemented CI/CD pipeline reducing deployment time by 60%",
          "Collaborated with product team on feature development",
        ],
      },
    ],
    education: [
      {
        degree: "Bachelor of Science in Computer Science",
        school: "University of California",
        location: "Berkeley, CA",
        startDate: "2013-09-01",
        endDate: "2017-05-31",
        details: ["GPA: 3.8/4.0", "Dean's List"],
      },
    ],
    skills: [
      { name: "JavaScript", level: 90, score: 90 },
      { name: "React", level: 85, score: 85 },
      { name: "Node.js", level: 85, score: 85 },
      { name: "Python", level: 75, score: 75 },
      { name: "AWS", level: 70, score: 70 },
      { name: "Docker", level: 75, score: 75 },
    ],
    projects: [
      {
        name: "E-Commerce Platform",
        description:
          "Built a full-stack e-commerce platform using React and Node.js, serving 10K+ users",
        link: "https://github.com/johndoe/ecommerce",
      },
      {
        name: "Task Management App",
        description:
          "Developed a collaborative task management application with real-time updates",
        link: "https://github.com/johndoe/taskapp",
      },
    ],
    hobbies: [
      {
        name: "Photography",
        description: "Landscape and portrait photography",
      },
      {
        name: "Open Source",
        description: "Contributing to open source projects",
      },
    ],
    awards: [
      {
        title: "Employee of the Year",
        description: "Recognized for outstanding contributions to the team",
        issuer: "Tech Corp",
        date: "2023-12-01",
      },
      {
        title: "Best Innovation Award",
        description:
          "Awarded for innovative solution in microservices architecture",
        issuer: "Tech Corp",
        date: "2022-06-15",
      },
    ],
  };

  // Import render service
  const { renderResumeHTML } = await import("../services/render.service.js");

  // Render with template
  const html = await renderResumeHTML(slug, { ...sampleData, template });

  // Set headers to allow iframe embedding and fix CSP issues
  // Allow Gravatar images (both HTTP and HTTPS), external stylesheets, fonts
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("X-Frame-Options", "ALLOWALL"); // Allow iframe embedding
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: http: https:; img-src 'self' data: blob: http: https:; style-src 'self' 'unsafe-inline' http: https:; style-src-elem 'self' 'unsafe-inline' http: https:; font-src 'self' data: http: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' http: https:; connect-src 'self' http: https:; frame-ancestors *;"
  );
  // Convert Gravatar HTTP URLs to HTTPS in the HTML
  const htmlWithHttps = html.replace(
    /http:\/\/(www\.)?gravatar\.com/g,
    "https://$1gravatar.com"
  );
  res.send(htmlWithHttps);
});

// ✅ NEW: Generate template thumbnail (smaller preview)
export const getTemplateThumbnail = catchAsync(async (req, res, next) => {
  const { slug } = req.params;
  const template = await Template.findOne({ slug, isActive: true });

  if (!template) {
    return next(new ApiError(404, "Template not found"));
  }

  // Generate minimal sample data for thumbnail
  const sampleData = {
    contact: {
      fullName: "John Doe",
      email: "john@example.com",
      phone: "+1 555-1234",
      headline: "Software Engineer",
    },
    experience: [
      {
        title: "Senior Developer",
        company: "Tech Corp",
        startDate: "2020-01-01",
        current: true,
        bullets: ["Led development team", "Built scalable systems"],
      },
    ],
    skills: [{ name: "JavaScript" }, { name: "React" }, { name: "Node.js" }],
  };

  const { renderResumeHTML } = await import("../services/render.service.js");
  const html = await renderResumeHTML(slug, { ...sampleData, template });

  // Add CSS to scale down for thumbnail
  const thumbnailHtml = html.replace(
    "</head>",
    "<style>body { transform: scale(0.5); transform-origin: top left; width: 200%; }</style></head>"
  );

  res.setHeader("Content-Type", "text/html");
  res.send(thumbnailHtml);
});
