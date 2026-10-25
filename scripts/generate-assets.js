// Build-time asset generation with fal.ai. Never runs in the browser.
// Usage: node scripts/generate-assets.js [--force] [--only=hero,covers,accents]
import "dotenv/config";
import { fal } from "@fal-ai/client";
import sharp from "sharp";
import ffmpegPath from "ffmpeg-static";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ASSETS = join(ROOT, "assets");
const CACHE = join(ROOT, "scripts", ".cache");
const FORCE = process.argv.includes("--force");
const onlyArg = process.argv.find((a) => a.startsWith("--only="));
const ONLY = onlyArg ? onlyArg.slice(7).split(",") : ["hero", "covers", "accents"];

if (!process.env.FAL_KEY) {
  console.error("Missing FAL_KEY. Copy .env.example to .env and add your key.");
  process.exit(1);
}
fal.config({ credentials: process.env.FAL_KEY });
mkdirSync(ASSETS, { recursive: true });
mkdirSync(CACHE, { recursive: true });

const STYLE =
  "soft playful 3D render, glossy rounded shapes, matte clay and glossy plastic materials, " +
  "palette strictly of bubblegum pink #FF7AAC, deep ink black #121117 and clean white, " +
  "clean studio lighting, soft shadows, minimal composition, generous negative space, " +
  "high-end product design aesthetic, no text, no letters, no logos, no watermark";

const IMAGE_MODEL = "fal-ai/flux/dev";
const VIDEO_MODEL = "fal-ai/kling-video/v2.1/standard/image-to-video";

async function download(url, file) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed ${res.status} for ${url}`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  return file;
}

// The safety checker sometimes returns an all-black image for harmless prompts; retry with a new seed.
async function flux(prompt, image_size, seed, attempts = 4) {
  for (let i = 0; i < attempts; i++) {
    const { data } = await fal.subscribe(IMAGE_MODEL, {
      input: { prompt: `${prompt}. ${STYLE}`, image_size, num_images: 1, seed: seed + i * 101, enable_safety_checker: true },
      logs: false,
    });
    if (!data.has_nsfw_concepts?.[0]) return data.images[0].url;
    console.log("  blocked by safety checker, retrying with a new seed…");
  }
  throw new Error(`Image kept getting blocked: ${prompt}`);
}

async function toWebp(src, out, width, quality = 78) {
  await sharp(src).resize({ width, withoutEnlargement: true }).webp({ quality }).toFile(out);
  console.log("  wrote", out.replace(ROOT + "/", ""));
}

const ffmpeg = (args) => execFileSync(ffmpegPath, ["-y", "-loglevel", "error", ...args], { stdio: "inherit" });

async function hero() {
  const mp4 = join(ASSETS, "hero.mp4");
  if (existsSync(mp4) && !FORCE) return console.log("hero: exists, skipping");
  console.log("hero: generating still…");
  const stillUrl = await flux(
    "floating composition of soft 3D shapes: pink capsule pills, white and black spheres, rounded pink blocks, " +
      "and a smooth pink funnel shape rising upward, objects hovering on a pale pink seamless background, " +
      "centered on the right side, left side mostly empty",
    "landscape_16_9",
    28
  );
  const still = await download(stillUrl, join(CACHE, "hero-still.png"));
  await toWebp(still, join(ASSETS, "hero-poster.webp"), 1600, 80);

  console.log("hero: animating (this can take a few minutes)…");
  const { data } = await fal.subscribe(VIDEO_MODEL, {
    input: {
      prompt:
        "the 3D shapes float gently and slowly bob up and down and rotate slightly in place, calm looping motion, " +
        "static camera, no new objects, clean studio light",
      image_url: stillUrl,
      duration: "5",
      negative_prompt: "camera movement, zoom, text, blur, distortion, new objects",
    },
    logs: false,
  });
  const raw = await download(data.video.url, join(CACHE, "hero-raw.mp4"));

  // Seamless loop: first 3s forward + reversed (ping-pong) = 6s, so the last frame meets the first.
  const loop = "[0:v]trim=0:3,setpts=PTS-STARTPTS,scale=1280:-2,fps=24,split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1:a=0[out]";
  ffmpeg(["-i", raw, "-filter_complex", loop, "-map", "[out]", "-an", "-c:v", "libx264", "-preset", "slow",
    "-crf", "28", "-pix_fmt", "yuv420p", "-movflags", "+faststart", mp4]);
  ffmpeg(["-i", raw, "-filter_complex", loop, "-map", "[out]", "-an", "-c:v", "libvpx-vp9", "-b:v", "0",
    "-crf", "40", "-row-mt", "1", join(ASSETS, "hero.webm")]);
  console.log("  wrote assets/hero.mp4, assets/hero.webm");
}

const COVERS = {
  "cover-activation": "a wide 3D funnel whose narrow end flows into a row of rising rounded bar chart columns growing taller left to right",
  "cover-payments": "a glossy 3D payment card tilted at an angle with a large rounded checkmark badge floating beside it",
  "cover-onboarding": "a smartphone lying at an angle with a stepped staircase progress path of rounded blocks rising out of its screen",
  "cover-funnels": "a rounded quiz card with multiple choice pill buttons flowing along a curved path into a rounded square app icon",
};

async function covers() {
  for (const [name, prompt] of Object.entries(COVERS)) {
    const out = join(ASSETS, `${name}.webp`);
    if (existsSync(out) && !FORCE) { console.log(`${name}: exists, skipping`); continue; }
    console.log(`${name}: generating…`);
    const file = await download(await flux(`${prompt}, on a soft pale pink background`, "landscape_16_9", 7), join(CACHE, `${name}.png`));
    await toWebp(file, out, 1200);
  }
  // Open Graph image: reuse the hero still, 1200x630 JPEG for broad crawler support.
  const og = join(ASSETS, "og-image.jpg");
  const heroStill = join(CACHE, "hero-still.png");
  if ((!existsSync(og) || FORCE) && existsSync(heroStill)) {
    await sharp(heroStill).resize(1200, 630, { fit: "cover" }).jpeg({ quality: 82 }).toFile(og);
    console.log("  wrote assets/og-image.jpg");
  }
}

const ACCENTS = {
  "accent-pill": "a single glossy pink 3D capsule pill floating, isolated",
  "accent-sphere": "a single matte black 3D sphere with a small glossy pink ring orbiting it, isolated",
  "accent-blocks": "three stacked rounded 3D blocks, pink, white and black, isolated",
};

async function accents() {
  for (const [name, prompt] of Object.entries(ACCENTS)) {
    const out = join(ASSETS, `${name}.webp`);
    if (existsSync(out) && !FORCE) { console.log(`${name}: exists, skipping`); continue; }
    console.log(`${name}: generating…`);
    const file = await download(await flux(`${prompt}, on a plain pure white background`, "square", 11), join(CACHE, `${name}.png`));
    await toWebp(file, out, 480, 80);
  }
}

const steps = { hero, covers, accents };
for (const key of ONLY) await steps[key]();
console.log("Done.");
