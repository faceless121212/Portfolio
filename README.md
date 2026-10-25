# Illia Ladyha · Portfolio

Personal portfolio for Illia Ladyha, Product Manager (Growth & Activation).
Plain HTML + CSS + a few lines of vanilla JS, so there's no build step for the site itself.

**Live:** https://faceless121212.github.io/Portfolio/

## Structure

```
index.html                  Home: hero, impact, case studies, product thinking, how I work, about, contact
case-studies/*.html         One page per case study (same template)
assets/styles.css           All styles (colour tokens at the top)
assets/main.js              Mobile menu + reduced-motion video fallback
assets/*.webp|mp4|webm|jpg  Generated visuals (committed)
assets/Illia_Ladyha_Resume.pdf
scripts/generate-assets.js  Build-time fal.ai asset generator (never runs in the browser)
.github/workflows/deploy.yml  Publishes to GitHub Pages on every push to main
```

## Run locally

```bash
npm run serve        # http://localhost:4321
```

## Regenerate visuals with fal.ai

1. `npm install`
2. `cp .env.example .env` and set `FAL_KEY=...` (get a key at fal.ai → Dashboard → Keys).
   `.env` is in `.gitignore`. Never commit it, and never reference the key from HTML/JS.
3. Run:

```bash
npm run assets                          # only creates missing files
node scripts/generate-assets.js --force # regenerate everything
node scripts/generate-assets.js --only=covers --force
```

Models: `fal-ai/flux/dev` for images and `fal-ai/kling-video/v2.1/standard/image-to-video` for the hero.
The hero is made seamless with a ping-pong loop (3s forward plus 3s reversed) and encoded to MP4 and WebM via `ffmpeg-static`.
Images are converted to WebP with `sharp`. Prompts live at the top of the script (`STYLE`, `COVERS`, `ACCENTS`).

## Edit content

- **Home page copy:** edit `index.html` directly. Sections are marked with HTML comments.
- **Case studies:** edit `case-studies/<slug>.html`. Yellow `[Add: …]` badges are placeholders for details
  only you know (hypotheses, goals, team size). Replace them with real content, and never invent numbers.
- **Products section:** `index.html` (`id="products"`) plus `case-studies/{sippa,trackaai,nativness,linkit}.html`, built from the GitHub docs.
- **Company links:** links use `class="ext"` plus `target="_blank" rel="noopener noreferrer"`. Companies without a URL
  (7motiff, AImaginarium, Genesis Academy) are plain text. When you have a URL, swap the text for
  `<a class="ext" href="URL" target="_blank" rel="noopener noreferrer">Name</a>` everywhere it appears.
- **Photo:** replace the `.photo` placeholder in the About section with
  `<img src="assets/photo.webp" alt="Illia Ladyha" width="560" height="700">`.

## Replace the resume

Overwrite `assets/Illia_Ladyha_Resume.pdf` with your file (keep the same name). Every "Download resume" button
saves it as `Illia_Ladyha_Product_Manager_Resume.pdf`.

## Deploy

Push to `main`. The GitHub Actions workflow publishes to GitHub Pages.
On the first run, make sure **Settings → Pages → Source** is set to **GitHub Actions**.
