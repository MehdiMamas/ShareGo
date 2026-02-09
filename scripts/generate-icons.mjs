#!/usr/bin/env node
/**
 * generates app icon PNGs from the source SVG using playwright.
 * run: node scripts/generate-icons.mjs
 */
import { chromium } from "playwright-core";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SVG_PATH = path.join(ROOT, "apps/app/build/icon.svg");

const ELECTRON_SIZES = [16, 32, 64, 128, 256, 512, 1024];
const IOS_SIZES = [40, 58, 60, 80, 87, 120, 180, 1024];
const ANDROID_SIZES = [
  { name: "mipmap-mdpi", size: 48 },
  { name: "mipmap-hdpi", size: 72 },
  { name: "mipmap-xhdpi", size: 96 },
  { name: "mipmap-xxhdpi", size: 144 },
  { name: "mipmap-xxxhdpi", size: 192 },
];

async function generatePng(page, svgContent, size, outputPath) {
  await page.setContent(`
    <html>
      <body style="margin:0; padding:0; background:transparent;">
        <div id="icon" style="width:${size}px; height:${size}px;">
          ${svgContent.replace('viewBox="0 0 512 512"', `viewBox="0 0 512 512" width="${size}" height="${size}"`)}
        </div>
      </body>
    </html>
  `);
  const el = await page.locator("#icon");
  await el.screenshot({ path: outputPath, omitBackground: true });
}

async function main() {
  const svgContent = fs.readFileSync(SVG_PATH, "utf-8");

  let executablePath;
  // try to find playwright's bundled chromium
  try {
    const { executablePath: ep } = await import("playwright-core");
    executablePath = undefined; // let playwright find it
  } catch {
    // fallback
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // electron icons
  const buildDir = path.join(ROOT, "apps/app/build");
  fs.mkdirSync(buildDir, { recursive: true });
  for (const size of ELECTRON_SIZES) {
    const out = path.join(buildDir, `icon-${size}.png`);
    await generatePng(page, svgContent, size, out);
    console.log(`  electron: ${out}`);
  }
  // copy 512 as the main icon
  fs.copyFileSync(path.join(buildDir, "icon-512.png"), path.join(buildDir, "icon.png"));

  // iOS icons
  const iosDir = path.join(ROOT, "apps/app/ios/ShareGo/Images.xcassets/AppIcon.appiconset");
  fs.mkdirSync(iosDir, { recursive: true });
  for (const size of IOS_SIZES) {
    const out = path.join(iosDir, `icon-${size}.png`);
    await generatePng(page, svgContent, size, out);
    console.log(`  ios: ${out}`);
  }

  // Android icons
  const androidResDir = path.join(ROOT, "apps/app/android/app/src/main/res");
  for (const { name, size } of ANDROID_SIZES) {
    const dir = path.join(androidResDir, name);
    fs.mkdirSync(dir, { recursive: true });
    const out = path.join(dir, "ic_launcher.png");
    await generatePng(page, svgContent, size, out);
    console.log(`  android: ${out}`);
  }

  await browser.close();
  console.log("done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
