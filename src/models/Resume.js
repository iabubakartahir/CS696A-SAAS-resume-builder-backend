import mongoose from "mongoose";

const contactSchema = new mongoose.Schema(
  {
    fullName: String,
    email: String,
    phone: String,
    location: String, // Added location field
    address: String,
    website: String,
    github: String, // Added GitHub
    linkedin: String, // Added LinkedIn
    portfolioLink: String, // Added portfolio link
    summary: String,
    headline: String,
    professionalSummary: String, // Professional summary in paragraph form
  },
  { _id: false }
);

const experienceSchema = new mongoose.Schema(
  {
    title: String,
    company: String,
    location: String,
    startDate: Date,
    endDate: Date,
    current: Boolean,
    bullets: [String],
  },
  { _id: false }
);

const educationSchema = new mongoose.Schema(
  {
    degree: String,
    school: String,
    // Location made optional to avoid parsing failures; default to empty string
    location: { type: String, default: "" },
    startDate: Date,
    endDate: Date,
    gpa: String,
    details: [String],
  },
  { _id: false }
);

const skillSchema = new mongoose.Schema(
  {
    name: String,
    level: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    score: Number, // Added score field for templates that support it
  },
  { _id: false }
);

const projectSchema = new mongoose.Schema(
  {
    name: String,
    description: String,
    link: String,
  },
  { _id: false }
);

const hobbySchema = new mongoose.Schema(
  {
    name: String,
    description: String,
  },
  { _id: false }
);

const awardSchema = new mongoose.Schema(
  {
    title: String,
    description: String,
    date: Date,
    issuer: String,
  },
  { _id: false }
);

const resumeSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Types.ObjectId, ref: "User", index: true },
    title: { type: String, default: "Untitled Resume" },
    template: { type: mongoose.Types.ObjectId, ref: "Template" },
    planRequired: { type: String, enum: ["free", "premium"], default: "free" },

    contact: contactSchema,
    experience: [experienceSchema],
    education: [educationSchema],
    skills: [skillSchema],
    projects: [projectSchema], // Added projects
    hobbies: [hobbySchema], // Added hobbies
    awards: [awardSchema], // Added awards/achievements
    extras: mongoose.Schema.Types.Mixed,

    steps: {
      basicsDone: { type: Boolean, default: false },
      experienceDone: { type: Boolean, default: false },
      educationDone: { type: Boolean, default: false },
      skillsDone: { type: Boolean, default: false },
      summaryDone: { type: Boolean, default: false },
      reviewDone: { type: Boolean, default: false },
    },

    atsScore: { type: Number, default: 0 },
    atsReportId: String,
  },
  { timestamps: true }
);

export default mongoose.model("Resume", resumeSchema);
