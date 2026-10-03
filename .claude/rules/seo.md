---
paths:
    - 'apps/web/**'
---

# Web: SEO, performance and accessibility

Rules for the public web app (`apps/web`). The goal: fast, usable by everyone, and correctly
understood by search engines and AI assistants. Examples use Next.js; apply the same rule in
whatever framework the project chose.

## Target: 100 in all four Lighthouse categories

**Performance, Accessibility, Best Practices and SEO must be 100 — on mobile and desktop,
in every theme (light and dark).**

How to measure:

- Never judge a dev server. Measure a **production build** (`next build && next start`) or the
  live site.
- Run Lighthouse **at least 3 times** and read the median; single runs vary.
- **Mobile is the real target** — desktop 100 is easy.
- Measure each theme separately; contrast failures usually exist in only one of them.
- Local runs have no network latency: after deploying, confirm with PageSpeed Insights.
- Compare before/after under the same conditions (same machine, same build type) so a
  regression is visible.

## Performance

- The **LCP element is text**, not an image: the hero heading is real HTML, visible on first
  paint.
- Fonts are self-hosted through the framework's font loader (`next/font`) with only the subsets
  and weights in use. Turkish needs **`latin-ext`** — check that the font has ç ğ ı İ ö ş ü.
- Only above-the-fold images load eagerly; everything else is lazy. Every responsive image has a
  correct `sizes` value (a wrong one downloads a far larger file).
- **No layout shift:** reserve the space for anything that arrives late (skeletons, images,
  typed text). Controls hidden per breakpoint are hidden with CSS, not by measuring in JS after
  hydration.
- Continuous animations are cheap:
    - low frame rate (10–12 fps is plenty for pixel art),
    - static layers painted once and cached, only the moving part redrawn,
    - canvas instead of SVG when there are many elements,
    - paused while off-screen (`IntersectionObserver`).
      A page sitting idle keeps the main thread busy for **under ~2%** of the time.
- Ship as little client JS as possible: server components by default, client components only
  where interaction needs them.
- The same record is not fetched several times per request — when metadata, structured data and
  the page all read it, wrap the query in React `cache()`.

## Accessibility

Contrast:

- Body text **≥ 4.5:1**, large text (≥ 24px, or ≥ 18.5px bold) **≥ 3:1** — in **both** themes.
  Light-theme greens and greys are the usual offenders.
- **Never fade text with opacity** (`/50`, `/60`) to show a lower level or state; it breaks
  contrast in the light theme. Use an icon, pips or a border instead.
- Text over an animated or image background sits on a semi-opaque panel when needed.

Interaction:

- **Touch targets ≥ 24×24px** (WCAG 2.5.8); enlarge the hit area of small dots and icons.
- Every link and button has a meaningful name, and links to **different** destinations never
  share one name — append the item name as `sr-only` text (e.g. "Details → _Project name_").
- A second link to the same destination (e.g. a card image) is hidden from keyboard and screen
  readers: `tabIndex={-1}` + `aria-hidden`.
- Visible focus styles (`focus-visible`); everything works with Tab, Enter, Space and arrows.

Content:

- Decorative images and canvases are `aria-hidden="true"`.
- Text that is visually clamped or typed out by an animation stays **complete in the HTML** for
  screen readers and crawlers — clamp with CSS (`line-clamp`), never cut the string in JS.
- `<html lang>` matches the page language.
- `text-transform: uppercase` follows the page language: English words on a Turkish page become
  "MOBİLE". Give such elements `lang="en"`.
- With `prefers-reduced-motion: reduce`, animations stop and typing/transition effects complete
  instantly.
- No auto-advancing carousels, no autoplaying audio or video.

## Technical SEO

Metadata:

- Every page has its own `title` and `description`, per language on multilingual sites.
- `description` stays **≤ ~160 characters** — Google cuts it beyond that, and the same text
  often feeds cards in the UI.
- Open Graph + Twitter cards with a **1200×630** image; a base URL (`metadataBase`) is set so
  image URLs are absolute.
- `keywords` meta is optional — Google ignores it. Titles, descriptions and real content matter.

Structured data (JSON-LD):

- Detail pages use a fitting schema (`SoftwareApplication` / `WebApplication` /
  `SoftwareSourceCode` for projects, `Article` for posts) plus a **`BreadcrumbList`**.
- Never state what you cannot back up — leave a field out rather than guessing (e.g.
  `applicationCategory`).
- Escape `<` as `<` inside the JSON so user content cannot close the script tag.

`sitemap.xml` and `robots.txt`:

- The sitemap is generated from the database: published content appears automatically, with
  `lastModified` set to the real update date (not "now"). Every language URL is listed;
  deleted, inactive and admin pages are not.
- `robots.txt` points to the sitemap and disallows admin/internal paths.

`llms.txt` (**required in every project**, see https://llmstxt.org):

- Served at `/llms.txt` as `text/plain` or `text/markdown`, generated from the database so new
  content appears without a deploy.
- Written in **English**, in one consistent voice, with this structure:

    ```markdown
    # Site or person name

    > One or two sentence summary.

    Short introduction.

    ## Pages

    - [Page](https://absolute-url): what it contains

    ## Projects

    - [Project](https://absolute-url): short description

    ## Contact

    - [GitHub](https://...): ...
    ```

- It must contain at least one H1 and links — PageSpeed checks both.

Status codes:

- **No soft 404s.** A path that does not exist returns 404, never the home page with a 200.
- Validate every dynamic segment (`[locale]`, `[slug]`) and call `notFound()` on an unknown
  value. Paths with a dot (`/ads.txt`) often skip middleware and land in a dynamic segment —
  test that they return 404.

Links:

- Internal links are locale-aware on multilingual sites (`/en/...`); never use relative links
  like `projects/x` that can drop the locale prefix.
- Clean, readable slugs. External links with `target="_blank"` carry
  `rel="noopener noreferrer"`.

## Before a release

- Production build, type check and lint pass.
- Lighthouse on the production build: mobile + desktop, light + dark.
- `/sitemap.xml`, `/robots.txt` and `/llms.txt` open and their content is correct.
- An unknown path (and `/foo.txt`) returns 404.
- A detail page has JSON-LD that passes the Rich Results Test.
- Every language works and internal links stay in that language.
- Visual check on a large monitor (2560×1440), a laptop and a phone.

After deploying: PageSpeed Insights (mobile + desktop), Rich Results Test on a detail page, and
the sitemap submitted in Google Search Console.
