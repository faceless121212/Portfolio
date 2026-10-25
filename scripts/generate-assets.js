// Build-time asset generation with fal.ai. Never runs in the browser.
// Usage: node scripts/generate-assets.js [--force] [--only=hero,covers,accents] [--name=cover-sippa] [--reuse-still]
import "dotenv/config";
import { fal } from "@fal-ai/client";
import sharp from "sharp";
import ffmpegPath from "ffmpeg-static";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ASSETS = join(ROOT, "assets");
const CACHE = join(ROOT, "scripts", ".cache");
const FORCE = process.argv.includes("--force");
const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];
const ONLY = arg("only") ? arg("only").split(",") : ["hero", "covers", "accents"];
const NAME = arg("name"); // regenerate a single image by name

if (!process.env.FAL_KEY) {
  console.error("Missing FAL_KEY. Copy .env.example to .env and add your key.");
  process.exit(1);
}
fal.config({ credentials: process.env.FAL_KEY });
mkdirSync(ASSETS, { recursive: true });
mkdirSync(CACHE, { recursive: true });

// Art direction: bold flat editorial vector illustration in the site palette.
const STYLE =
  "Bold flat geometric editorial illustration, limited palette of hot pink #FF7AAC, ink black #121117 and white, " +
  "thick confident black outlines, simple shapes, subtle grain, modern fintech brand illustration, " +
  "full-bleed white background, no border, no frame, no text, no letters, no numbers, no logos";
const PALETTE = [{ r: 255, g: 122, b: 172 }, { r: 18, g: 17, b: 23 }, { r: 255, g: 255, b: 255 }];
const IMAGE_MODEL = "fal-ai/recraft/v3/text-to-image";
const VIDEO_MODEL = "fal-ai/kling-video/v2.1/pro/image-to-video"; // pro supports an end frame for seamless loops

async function download(url, file) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed ${res.status} for ${url}`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  return file;
}

// Generates one illustration and returns a high-res PNG path (Recraft returns SVG for vector styles).
async function illustrate(name, prompt, size) {
  const { data } = await fal.subscribe(IMAGE_MODEL, {
    input: { prompt: `${prompt}. ${STYLE}`, image_size: size, style: "vector_illustration", colors: PALETTE },
    logs: false,
  });
  const url = data.images[0].url;
  const isSvg = url.includes(".svg") || data.images[0].content_type === "image/svg+xml";
  const src = await download(url, join(CACHE, `${name}.${isSvg ? "svg" : "png"}`));
  const png = join(CACHE, `${name}.png`);
  if (isSvg) await sharp(src, { density: 200 }).resize({ width: size.width * 1.5 }).png().toFile(png);
  return png;
}

async function toWebp(src, out, width, quality = 86) {
  await sharp(src).resize({ width, withoutEnlargement: true }).webp({ quality }).toFile(out);
  console.log("  wrote", out.replace(ROOT + "/", ""));
}

const skip = (name, out) => (NAME && NAME !== name) || (existsSync(out) && !FORCE && !NAME);
const ffmpeg = (args) => execFileSync(ffmpegPath, ["-y", "-loglevel", "error", ...args], { stdio: "inherit" });

const HERO_PROMPT =
  "a confident product manager woman stands beside a big pink funnel; colourful dots fall into the funnel and come out " +
  "the bottom as a row of rising bar chart columns with a bold upward arrow; a smartphone with a progress bar and a few " +
  "floating sparkles around; balanced composition centred in frame";

async function hero() {
  const mp4 = join(ASSETS, "hero.mp4");
  if (skip("hero", mp4)) return console.log("hero: exists, skipping");
  // --reuse-still re-animates the existing illustration instead of drawing a new one.
  let still = join(CACHE, "hero-still.png");
  if (!(process.argv.includes("--reuse-still") && existsSync(still))) {
    console.log("hero: generating illustration…");
    still = await illustrate("hero-still", HERO_PROMPT, { width: 1820, height: 1024 });
    await toWebp(still, join(ASSETS, "hero-poster.webp"), 1600);
    await sharp(still).resize(1200, 630, { fit: "cover" }).jpeg({ quality: 85 }).toFile(join(ASSETS, "og-image.jpg"));
    console.log("  wrote assets/og-image.jpg");
  }

  console.log("hero: animating (this can take a few minutes)…");
  const jpg = join(CACHE, "hero-still.jpg");
  await sharp(still).resize({ width: 1600 }).jpeg({ quality: 92 }).toFile(jpg);
  const image_url = await fal.storage.upload(new Blob([readFileSync(jpg)], { type: "image/jpeg" }));
  const { data } = await fal.subscribe(VIDEO_MODEL, {
    input: {
      prompt:
        "flat 2D illustration with very subtle motion: the small dots above the funnel gently float and drop in, sparkles " +
        "twinkle, the woman's hair sways slightly. The funnel, the bar chart columns, the arrow and the phone stay completely " +
        "still and unchanged. Static camera, keep the flat vector style",
      image_url,
      tail_image_url: image_url,
      duration: "5",
      negative_prompt: "camera movement, zoom, 3D, photorealistic, text, blur, morphing, bars changing height, distortion",
    },
    logs: false,
  });
  const raw = await download(data.video.url, join(CACHE, "hero-raw.mp4"));

  // Start and end frames are the same image, so the clip loops seamlessly as is.
  const loop = "[0:v]scale=1280:-2,fps=24[out]";
  ffmpeg(["-i", raw, "-filter_complex", loop, "-map", "[out]", "-an", "-c:v", "libx264", "-preset", "slow",
    "-crf", "24", "-pix_fmt", "yuv420p", "-movflags", "+faststart", mp4]);
  ffmpeg(["-i", raw, "-filter_complex", loop, "-map", "[out]", "-an", "-c:v", "libvpx-vp9", "-b:v", "0",
    "-crf", "34", "-row-mt", "1", join(ASSETS, "hero.webm")]);
  console.log("  wrote assets/hero.mp4, assets/hero.webm");
}

const COVERS = {
  "cover-activation": "a big smartphone shows a pink shield and a large power toggle switched on; three small happy people walk up a ramp into the phone; behind it three bar chart columns step up from short to tall with a bold upward arrow; only upward growth, nothing going down",
  "cover-payments": "a hand holds a smartphone near a payment terminal, a bank card floats beside it, a big pink circle with a checkmark pops above, small coins and sparkles",
  "cover-onboarding": "a person walks up a staircase made of giant smartphone screens, each step has a small checkmark, a pink flag waits at the top",
  "cover-funnels": "a big card with blank multiple-choice pill buttons (no letters), one selected in pink with a checkmark, a dotted path flows from it into a smartphone showing a rounded app icon, a person points at the card",
  // Side projects
  "cover-sippa": "a person relaxes on a sofa chatting on a smartphone; big speech bubbles float up with a friendly illustrated character face and a small pink flower",
  "cover-trackaai": "a kanban board with three columns of cards; a person and a friendly round robot move a card together from one column to the next",
  "cover-nativness": "two people shake hands across a big pink vault safe full of coins with a padlock, a dotted line connects a phone to the vault",
  "cover-linkit": "a person at a big wall calendar pins pink post cards into a neat queue, a bell rings with motion lines, a checklist on the side",
};

async function covers() {
  for (const [name, prompt] of Object.entries(COVERS)) {
    const out = join(ASSETS, `${name}.webp`);
    if (skip(name, out)) { console.log(`${name}: exists, skipping`); continue; }
    console.log(`${name}: generating…`);
    await toWebp(await illustrate(name, prompt, { width: 1820, height: 1024 }), out, 1600);
  }
}

const ACCENTS = {
  "accent-pill": "a single bold pink upward arrow bursting out of a small bar chart with sparkles, isolated spot illustration",
};

async function accents() {
  for (const [name, prompt] of Object.entries(ACCENTS)) {
    const out = join(ASSETS, `${name}.webp`);
    if (skip(name, out)) { console.log(`${name}: exists, skipping`); continue; }
    console.log(`${name}: generating…`);
    await toWebp(await illustrate(name, prompt, { width: 1024, height: 1024 }), out, 480);
  }
}

const steps = { hero, covers, accents };
for (const key of ONLY) await steps[key]();
console.log("Done.");
