import mongoose from "mongoose";

const templateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, unique: true, index: true },
    category: {
      type: String,
      enum: ["free", "premium", "industry"],
      default: "free",
    },
    atsOptimized: { type: Boolean, default: true },
    thumbnailUrl: String,
    previewUrl: String,
    // Optional: support CDN/remote-hosted templates and assets
    remoteTemplateUrl: String, // e.g. https://cdn.example.com/templates/random-blue/template.hbs
    remoteCssUrl: String, // e.g. https://cdn.example.com/templates/random-blue/style.css
    assetsBaseUrl: String, // base for images used inside template.hbs
    // Optional: use an npm theme that follows JSON Resume renderer API
    npmPackageName: String, // e.g. jsonresume-theme-elegant
    // Optional UI hints for frontend alignment and steppers
    ui: {
      accentColor: String, // e.g. #1a73e8
      bulletStyle: {
        type: String,
        enum: ["dot", "dash", "square"],
        default: "dot",
      },
      showPhoto: { type: Boolean, default: false },
      stepperStyle: {
        type: String,
        enum: ["dots", "numbers"],
        default: "numbers",
      },
      fontFamily: String,
    },
    engine: {
      type: String,
      enum: ["html", "handlebars"],
      default: "handlebars",
    },
    locked: { type: Boolean, default: false },
    tags: [String],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("Template", templateSchema);
