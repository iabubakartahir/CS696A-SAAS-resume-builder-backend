// scripts/seed-templates.js
// Seeds diverse templates with UNIQUE layouts using different npm themes

import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { connectDB } from "../src/config/db.js";
import Template from "../src/models/Template.js";

const templates = [
  // FREE TEMPLATES - 3 unique layouts
  {
    name: "Tech Stack",
    slug: "tech-stack",
    category: "free",
    tags: ["tech", "developer", "orange"],
    isActive: true,
    ui: {
      accentColor: "#f48024",
      bulletStyle: "square",
      showPhoto: false,
      stepperStyle: "dots",
      fontFamily: "Arial, sans-serif",
    },
    npmPackageName: "jsonresume-theme-stackoverflow",
  },

  // PREMIUM TEMPLATES - many unique layouts
  {
    name: "Executive Gold",
    slug: "executive-gold",
    category: "premium",
    tags: ["premium", "executive", "gold"],
    isActive: true,
    ui: {
      accentColor: "#d97706",
      bulletStyle: "square",
      showPhoto: true,
      stepperStyle: "numbers",
      fontFamily: "Georgia, serif",
    },
    npmPackageName: "jsonresume-theme-spartan",
  },
  {
    name: "UK Business",
    slug: "uk-business",
    category: "premium",
    tags: ["premium", "international", "uk", "business"],
    isActive: true,
    ui: {
      accentColor: "#0f172a",
      bulletStyle: "square",
      showPhoto: true,
      stepperStyle: "numbers",
      fontFamily: "Times New Roman, serif",
    },
    npmPackageName: "jsonresume-theme-compact",
  },
  {
    name: "Legal Professional",
    slug: "legal-professional",
    category: "premium",
    tags: ["premium", "legal", "lawyer", "professional"],
    isActive: true,
    ui: {
      accentColor: "#1f2937",
      bulletStyle: "square",
      showPhoto: true,
      stepperStyle: "numbers",
      fontFamily: "Garamond, serif",
    },
    npmPackageName: "jsonresume-theme-kendall",
  },
  {
    name: "Engineering Lead",
    slug: "engineering-lead",
    category: "premium",
    tags: ["premium", "engineering", "tech", "leadership"],
    isActive: true,
    ui: {
      accentColor: "#3b82f6",
      bulletStyle: "square",
      showPhoto: true,
      stepperStyle: "numbers",
      fontFamily: "Roboto Mono, monospace",
    },
    npmPackageName: "jsonresume-theme-paper",
  },
  {
    name: "Data Scientist",
    slug: "data-scientist",
    category: "premium",
    tags: ["premium", "data", "science", "analytics"],
    isActive: true,
    ui: {
      accentColor: "#7c3aed",
      bulletStyle: "square",
      showPhoto: false,
      stepperStyle: "numbers",
      fontFamily: "Source Sans Pro, sans-serif",
    },
    npmPackageName: "jsonresume-theme-short",
  },
  // {
  //   name: "Product Manager",
  //   slug: "product-manager",
  //   category: "premium",
  //   tags: ["premium", "product", "management", "tech"],
  //   isActive: true,
  //   ui: {
  //     accentColor: "#f97316",
  //     bulletStyle: "dot",
  //     showPhoto: true,
  //     stepperStyle: "dots",
  //     fontFamily: "Open Sans, sans-serif",
  //   },
  //   npmPackageName: "jsonresume-theme-slick",
  // },
  {
    name: "HR Professional",
    slug: "hr-professional",
    category: "premium",
    tags: ["premium", "hr", "human-resources", "professional"],
    isActive: true,
    ui: {
      accentColor: "#ec4899",
      bulletStyle: "dot",
      showPhoto: true,
      stepperStyle: "dots",
      fontFamily: "Poppins, sans-serif",
    },
    npmPackageName: "jsonresume-theme-onepage",
  },
  // {
  //   name: "Lucide",
  //   slug: "lucide",
  //   category: "premium",
  //   tags: ["modern", "minimal", "light"],
  //   isActive: true,
  //   ui: {
  //     accentColor: "#22d3ee",
  //     bulletStyle: "dot",
  //     showPhoto: true,
  //     stepperStyle: "dots",
  //     fontFamily: "Rubik, sans-serif",
  //   },
  //   npmPackageName: "jsonresume-theme-lucide",
  // },
  {
    name: "Macchiato",
    slug: "macchiato",
    category: "premium",
    tags: ["warm", "designer", "creative"],
    isActive: true,
    ui: {
      accentColor: "#b45309",
      bulletStyle: "dot",
      showPhoto: true,
      stepperStyle: "dots",
      fontFamily: "Playfair Display, serif",
    },
    npmPackageName: "jsonresume-theme-macchiato",
  },
  {
    name: "Paper Plus Plus",
    slug: "paper-plus-plus",
    category: "premium",
    tags: ["paper", "print", "clean"],
    isActive: true,
    ui: {
      accentColor: "#111827",
      bulletStyle: "square",
      showPhoto: false,
      stepperStyle: "dots",
      fontFamily: "Serif, serif",
    },
    npmPackageName: "jsonresume-theme-paper-plus-plus",
  },
  {
    name: "Pumpkin",
    slug: "pumpkin",
    category: "premium",
    tags: ["fun", "orange", "creative"],
    isActive: true,
    ui: {
      accentColor: "#f97316",
      bulletStyle: "dot",
      showPhoto: true,
      stepperStyle: "dots",
      fontFamily: "Nunito, sans-serif",
    },
    npmPackageName: "jsonresume-theme-pumpkin",
  },
  {
    name: "Rickosborne",
    slug: "rickosborne",
    category: "premium",
    tags: ["personal", "creative", "developer"],
    isActive: true,
    ui: {
      accentColor: "#16a34a",
      bulletStyle: "dot",
      showPhoto: true,
      stepperStyle: "dots",
      fontFamily: "System-ui, sans-serif",
    },
    npmPackageName: "jsonresume-theme-rickosborne",
  },
  // {
  //   name: "Waterfall",
  //   slug: "waterfall",
  //   category: "premium",
  //   tags: ["minimal", "clean", "modern"],
  //   isActive: true,
  //   ui: {
  //     accentColor: "#0ea5e9",
  //     bulletStyle: "dot",
  //     showPhoto: false,
  //     stepperStyle: "dots",
  //     fontFamily: "Inter, sans-serif",
  //   },
  //   npmPackageName: "jsonresume-theme-waterfall",
  // },
  {
    name: "Nord",
    slug: "nord",
    category: "premium",
    tags: ["nord", "dark", "modern"],
    isActive: true,
    ui: {
      accentColor: "#5e81ac",
      bulletStyle: "square",
      showPhoto: false,
      stepperStyle: "dots",
      fontFamily: "System-ui, sans-serif",
    },
    npmPackageName: "jsonresume-theme-rnord",
  },
  // {
  //   name: "Simply Elegant",
  //   slug: "simply-elegant",
  //   category: "premium",
  //   tags: ["elegant", "classic", "professional"],
  //   isActive: true,
  //   ui: {
  //     accentColor: "#1f2937",
  //     bulletStyle: "dot",
  //     showPhoto: false,
  //     stepperStyle: "dots",
  //     fontFamily: "Georgia, serif",
  //   },
  //   npmPackageName: "jsonresume-theme-simplyelegant",
  // },
  // {
  //   name: "Straightforward",
  //   slug: "straightforward",
  //   category: "premium",
  //   tags: ["simple", "clean", "direct"],
  //   isActive: true,
  //   ui: {
  //     accentColor: "#3b82f6",
  //     bulletStyle: "square",
  //     showPhoto: false,
  //     stepperStyle: "dots",
  //     fontFamily: "Arial, sans-serif",
  //   },
  //   npmPackageName: "jsonresume-theme-straightforward",
  // },
  {
    name: "Projects",
    slug: "projects",
    category: "premium",
    tags: ["flat", "modern", "projects"],
    isActive: true,
    ui: {
      accentColor: "#6366f1",
      bulletStyle: "dot",
      showPhoto: false,
      stepperStyle: "dots",
      fontFamily: "Inter, sans-serif",
    },
    npmPackageName: "jsonresume-theme-projects",
  },
  {
    name: "MS Resume",
    slug: "ms-resume",
    category: "premium",
    tags: ["metalsmith", "classic", "professional"],
    isActive: true,
    ui: {
      accentColor: "#1e40af",
      bulletStyle: "square",
      showPhoto: false,
      stepperStyle: "numbers",
      fontFamily: "Times New Roman, serif",
    },
    npmPackageName: "jsonresume-theme-msresume",
  },
  // {
  //   name: "Timeline",
  //   slug: "timeline",
  //   category: "premium",
  //   tags: ["timeline", "chronological", "modern"],
  //   isActive: true,
  //   ui: {
  //     accentColor: "#059669",
  //     bulletStyle: "dot",
  //     showPhoto: false,
  //     stepperStyle: "dots",
  //     fontFamily: "Roboto, sans-serif",
  //   },
  //   npmPackageName: "jsonresume-theme-timeline-fixed",
  // },
];

async function main() {
  await connectDB();

  // Clear existing templates first
  await Template.deleteMany({});
  console.log("✅ Cleared existing templates");

  let inserted = 0;
  for (const t of templates) {
    const res = await Template.create(t);
    inserted += 1;
  }

  console.log(`✅ Templates created: ${inserted}`);
  console.log(`📊 Total templates: ${templates.length}`);
  console.log(
    `🆓 Free templates: ${
      templates.filter((t) => t.category === "free").length
    }`
  );
  console.log(
    `💎 Premium templates: ${
      templates.filter((t) => t.category === "premium").length
    }`
  );
  console.log(
    `🏢 Industry templates: ${
      templates.filter((t) => t.category === "industry").length
    }`
  );

  // Show theme distribution
  const themeCounts = {};
  templates.forEach((t) => {
    themeCounts[t.npmPackageName] = (themeCounts[t.npmPackageName] || 0) + 1;
  });

  console.log(`\n🎨 Theme distribution:`);
  Object.entries(themeCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([theme, count]) => {
      console.log(`   ${theme}: ${count} template${count > 1 ? "s" : ""}`);
    });

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
