import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import { Document, Packer, Paragraph, TextRun } from "docx";

const fileExists = (p) => {
  try {
    return !!p && fs.existsSync(p);
  } catch (_) {
    return false;
  }
};

const resolveChromePath = () => {
  // 1) Explicit env override
  if (fileExists(process.env.PUPPETEER_EXECUTABLE_PATH)) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  // 2) Puppeteer's own installed path
  try {
    if (typeof puppeteer.executablePath === "function") {
      const p = puppeteer.executablePath();
      if (fileExists(p)) return p;
    }
  } catch (_) {}
  // 3) Search local project cache first (bundled with build)
  const localCache = path.resolve(".puppeteer");
  const localChromeRoot = path.join(localCache, "chrome");
  try {
    if (fs.existsSync(localChromeRoot)) {
      const versions = fs.readdirSync(localChromeRoot).sort().reverse();
      for (const v of versions) {
        const candidate = path.join(localChromeRoot, v, "chrome-linux64", "chrome");
        if (fileExists(candidate)) return candidate;
        const alt = path.join(localChromeRoot, v, "chrome");
        if (fileExists(alt)) return alt;
      }
    }
  } catch (_) {}

  // 4) Search Render cache directory for chrome binary
  const cacheRoot = process.env.PUPPETEER_CACHE_DIR || "/opt/render/.cache/puppeteer";
  const chromeRoot = path.join(cacheRoot, "chrome");
  try {
    if (fs.existsSync(chromeRoot)) {
      const versions = fs.readdirSync(chromeRoot).sort().reverse();
      for (const v of versions) {
        // linux-<version>/chrome-linux64/chrome
        const candidate = path.join(chromeRoot, v, "chrome-linux64", "chrome");
        if (fileExists(candidate)) return candidate;
        // Alternate layout: <platform>/chrome
        const alt = path.join(chromeRoot, v, "chrome");
        if (fileExists(alt)) return alt;
      }
    }
  } catch (_) {}
  // 5) Common system paths
  const systemCandidates = [
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
  ];
  for (const c of systemCandidates) if (fileExists(c)) return c;
  // 6) As a last resort, return undefined (Puppeteer will try to use its default)
  return undefined;
};

export const exportPDF = async (html) => {
  const executablePath = resolveChromePath();

  const browser = await puppeteer.launch({
    headless: true,
    executablePath,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-zygote",
      "--single-process",
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 800, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: "networkidle0" });

  const buffer = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: {
      top: "0.5in",
      right: "0.5in",
      bottom: "0.5in",
      left: "0.5in",
    },
  });

  await browser.close();
  return buffer;
};

export const exportDOCX = async (resume) => {
const doc = new Document({
sections: [
{
children: [
new Paragraph({
children: [
new TextRun({
text: resume?.contact?.fullName || "Resume",
bold: true,
size: 28,
}),
],
}),
new Paragraph(resume?.contact?.summary || ""),
],
},
],
});
return Packer.toBuffer(doc);
};

