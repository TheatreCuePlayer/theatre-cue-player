# Tools page — working notes

Everything about `tools.html` lives here: what it is, the rules it follows, how to add a tool,
what is built, and what is on the list. Update this file in the same commit as the change.

Page: `tools.html` → <https://theatrecueplayer.app/tools>

---

## 1. What this page is for

A teacher or a student hits a wall the night before tech: a file won't play, a video stutters
through the projector, the script PDF is three documents. The tools page fixes those specific
walls, in the browser, for free, without an account.

It is not a general media suite. Every tool here should trace back to something that actually
goes wrong in a school show.

## 2. Ground rules

1. **Nothing is uploaded.** The page makes no network requests with user files, ever. That claim
   is on the page, so it has to stay true — including for any library we add.
2. **Plain language.** Written for a non-technical teacher and a 13-year-old. No codecs, bitrates
   or container jargon in the visible copy unless the sentence explains itself. Say what to do
   next, not what went wrong internally.
3. **One tool at a time.** The page is hash-routed: `/tools` is the index, `/tools#downsize`
   opens a tool. Not an endless scroll, not separate documents.
4. **Always a way out.** The mark at the top goes home, the "Theatre Cue Player home" button says
   so out loud, and inside a tool there is an "All tools" button at the top and a "Done — back to
   all tools" button at the foot. Nobody should need the browser back button.
5. **Honest about limits.** A browser can only re-encode what it can already decode. When a tool
   can't help, it says so and names something that can (CloudConvert, HandBrake).
6. **Vanilla.** No framework, no build step. Same as the extension.

## 3. How the page is wired

Single file, single `<script>`, no dependencies today.

- `TOOLS` — an object at the top of the script: `id → title`. **Adding a tool is one line here.**
- `show(name)` / `route()` — hash router. Toggles `#view-index` against `#view-<id>`, rebuilds the
  breadcrumb, shows/hides the "All tools" button, sets `document.title`.
- `.to-index` — put this class on any button or link and a single delegated handler sends the
  user back to the tool index. Used by the nav button, both foot buttons and the breadcrumb.
- Shared helpers: `ext()`, `human()`, `clock()`, `esc()`, `wireDrop()`, `probe()`.
  `probe()` loads a file into a real `<audio>`/`<video>` element and reports whether it decodes —
  `canPlayType()` is only a guess ("maybe" is a real answer it gives).

### Adding a tool — checklist

1. Add `id: 'Title'` to `TOOLS`.
2. Add a `<button class="tool-btn" data-tool="id">` card to `#view-index`.
3. Add `<div class="view" id="view-id" hidden>` with a `.panel` inside, and end it with
   `<div class="exit-row"><button class="navbtn to-index">&larr; Done — back to all tools</button></div>`.
4. Reuse `.drop` + a hidden file input via `wireDrop()`.
5. If it pulls in a library, add it to the attribution footer (§6) and check the licence.
6. Add a row to §4 below.

### Thresholds shared with the extension

The checker mirrors the extension's own numbers so the two never disagree. If they change in
`Theatre-Cue-Player-PWA-V2`, change them here too:

| Thing | Value | Source in the extension |
|---|---|---|
| "heavy" video | over 1920×1080 | `js/video-engine.js` (~line 1883) |
| reliable audio extensions | `mp3 wav ogg m4a aac flac` | `js/audio-engine.js` (~line 16) |

## 4. Built

| Tool | Hash | Engine | Notes |
|---|---|---|---|
| Will this file play? | `#check` | native media elements | Decodes the file for real; verdicts: Good to go / Plays, but heavy / Risky / Won't play. Handles images too. |
| Trim a video | `#trim` | ffmpeg.wasm, stream copy | Lossless and about a second, whatever the length. Cut lands on the nearest keyframe and the tool says so. See §4.1. |
| Shrink a video | `#downsize` | Canvas + `MediaRecorder` | Real-time encode (a 2-min clip takes 2 min) — the UI says so. MP4 when the browser can write it, WebM otherwise. Only works on files the browser can already decode. |

### 4.1 The trimmer, and the FFmpeg decision that came with it

Built 2026-08-15. The command is a stream copy — no decode, no encode:

    ffmpeg -ss START -to END -i input -c copy -avoid_negative_ts make_zero output

**Decisions, and why:**

- **GPL was accepted, knowingly.** `@ffmpeg/core` on npm is `GPL-2.0-or-later`, not LGPL as
  first assumed — it is built with `--enable-gpl`. The tools page is therefore a combined work
  offered under GPL-2.0-or-later. The repo is already public, so this is a licence statement
  rather than a code change. Full detail in `vendor/ffmpeg/NOTICE.md`.
- **Single-threaded core.** The multi-threaded build needs `SharedArrayBuffer`, which needs
  COOP/COEP headers site-wide. Not worth it for a stream copy. **No Netlify header change was
  needed** — the earlier worry about that was unfounded.
- **ESM build, via dynamic `import()`, not UMD.** ffmpeg.wasm always spawns its worker as
  `type: "module"`, where `importScripts` does not exist; the worker then falls back to
  `import()`ing the core, and in the UMD bundle webpack has replaced that import with a stub
  that throws `Cannot find module`. The ESM build keeps a real import. This cost an hour —
  do not "simplify" it back to a UMD `<script>` tag.
- **All URLs handed to ffmpeg are absolute** (`abs()`). They are resolved inside a worker,
  where a relative path resolves against the worker's location, not the page's.
- **Lazy and cached.** The 32 MB engine is fetched only when a trim actually starts, and kept
  in the Cache API under `FF_CACHE`, so it is once per machine rather than once per visit. The
  progress bar measures against `FF_WASM_SIZE`, the exact uncompressed byte count, because
  `Content-Length` is the *compressed* length when the server gzips and the bar would run past
  100%.
- **Requires a file the browser can preview.** The in/out points are marked against a real
  `<video>`, so a file Chrome cannot decode is turned away and sent to the checker — even
  though FFmpeg itself could open it. Lifting that means a no-preview mode with typed
  timestamps; not worth it yet.
- **Keyframe snap is surfaced, not hidden.** The result is measured after the fact and the
  status line reports the real length, with a plain-language explanation when it differs from
  what was marked by more than 0.15s.
- **Container:** stream-copies into MP4 where the packets allow it (mp4/m4v/mov/mkv/avi/ts),
  keeps webm/ogv as they are, and retries once into `.mkv` if the first mux is rejected.

**Now false, and fixed:** the checker used to say "no web tool can rescue a file Chrome cannot
open". Shipping FFmpeg makes that untrue — it decodes plenty Chrome will not. The copy now
just points at CloudConvert and HandBrake without the absolute claim.

**The page must be served, not opened.** Double-clicking `tools.html` opens it as `file://`,
where the browser refuses the engine fetch and every video fails identically with
"Failed to fetch" — which reads as "your video is broken". The trimmer now detects `file:`
up front, says so, and disables the button; there is a test for the message. To try the page
locally, run `npx http-server . -p 8765 -c-1` and use the localhost address.

**Follow-ups this unlocks** (the 32 MB is already paid for): audio extractor, GIF→MP4, a real
converter for the "Won't play" verdict, and a non-real-time rewrite of the downsizer.

## 5. Candidate list

Sourced partly from a Gemini brainstorm (2026-08-15). Ordered by how often the problem actually
comes up in a school show. Nothing below is committed.

### Worth building

| Tool | Engine | Why |
|---|---|---|
| ~~Trim a video~~ | ffmpeg.wasm | **Built 2026-08-15** — see §4.1. |
| **Pull the sound out of a video** | ffmpeg.wasm | Common ask: a sound effect that only exists inside an MP4. Cheap now the engine is in. |
| **Title / slate cards** | Canvas + `FontFace` | Blackouts, act cards, intermission countdowns, surtitles. No file input at all, so nothing can go wrong. Fonts must be bundled — no Google Fonts CDN call (rule 1). |
| **Projector test grid** | Canvas | Pairs directly with the extension's surface warping. Pure generator, tiny. |
| **Split & merge script PDFs** | `pdf-lib` (MIT) | Real stage-management chore, and pdf-lib is small and clean. |

### Maybe

| Tool | Note |
|---|---|
| GIF → MP4 | Real problem (GIFs can't be paused or faded), but rare enough to wait. |
| Black heads & tails padding | Nice polish; the extension's own fades already cover most of it. |
| Transparent PNG / colour keying | Fiddly to make foolproof for a 13-year-old. Tolerance sliders are a rabbit hole. |
| Script watermarker | Easy once pdf-lib is loaded — fold into the PDF tool rather than a separate card. |

### The ffmpeg.wasm decision — MADE 2026-08-15, adopted

Kept below as the record of what was weighed. The outcome and the corrections to it are in
§4.1: single-threaded, lazily loaded, GPL accepted, no COOP/COEP needed.

<details><summary>The original write-up</summary>


Everything in the "worth building" video list wants ffmpeg.wasm, so it is one decision, not four.

**For:** does what no native browser API can (real trimming, remuxing, format conversion), and
it would let the downsizer stop being real-time.

**Against, and these are not small:**
- ~25–30 MB of WASM to download before anything happens. That is a slow first visit on school
  wi-fi, and the page currently loads instantly.
- It needs `SharedArrayBuffer`, which needs COOP/COEP headers site-wide. That is a real hosting
  change and it can break other embeds. (There is a single-thread build that avoids this and is
  slower — probably the right call.)
- Licence: FFmpeg builds are LGPL or GPL depending on what is compiled in. Must ship the LGPL
  build and attribute it properly.
- It has to be self-hosted, not pulled from a CDN, to keep rule 1 honest.

**Suggested order:** load it lazily, only when a tool that needs it is opened, with a plain
"this downloads a 25 MB engine the first time — it's cached after that" message. Build the trimmer
first as the test case; if that lands well, the rest are cheap.

</details>

## 6. Attribution

Vendored third-party code lives in `vendor/`, served from this origin rather than a CDN — that
is what keeps rule 1 honest. Every library gets a line in the page footer and a full entry in a
`NOTICE.md` beside the files.

| Library | Version | Licence | Notice |
|---|---|---|---|
| `@ffmpeg/ffmpeg` | 0.12.15 | MIT | `vendor/ffmpeg/NOTICE.md` |
| `@ffmpeg/core` (FFmpeg, wasm) | 0.12.10 | **GPL-2.0-or-later** | `vendor/ffmpeg/NOTICE.md` |

Because of the core's licence, **the tools page is offered under GPL-2.0-or-later**. The
extension and the browser build ship no FFmpeg and are unaffected.

**Outstanding:** vendor the verbatim GPL v2 text as `vendor/ffmpeg/COPYING.GPLv2.txt` —

    curl -o vendor/ffmpeg/COPYING.GPLv2.txt https://www.gnu.org/licenses/old-licenses/gpl-2.0.txt

The footer currently links to gnu.org instead.

## 7. Tests

`playwright_tests/tools.spec.js`, run with the rest of the suite. `playwright.config.js` now
starts `http-server` on port 8765 first, because the trimmer fetches its engine over HTTP and
`file://` will not serve it.

The trim test builds its own six-second WebM in the browser with `MediaRecorder` rather than
committing a fixture — Playwright's Chromium has no proprietary codecs, so it can neither
write nor read an H.264 MP4. That test is Chromium-only for the same reason; the navigation
tests run everywhere.

Three real bugs came out of writing it, all of which read fine on inspection: `clock(0)`
printing a dash where the start time goes, the worker's relative-URL resolution, and the UMD
worker's stubbed `import()`. A fourth was a weak assertion in the test itself — it checked only
that the marked-time text had *changed*, which passed while the marks were not registering at
all. It now asserts the actual numbers.

## 8. History

- **2026-08-15** — Trimmer built on ffmpeg.wasm (§4.1); GPL accepted and attributed; Playwright
  coverage for the tools page; checker copy corrected where FFmpeg made it untrue.
- **2026-08-15** — Logo links home; explicit home button; "All tools" button in the nav and at the
  foot of every tool; per-tool `document.title`; `TOOLS` became a title map so adding a tool is one
  line. This file created.
- Earlier — tools page added with the media checker, then the video downsizer; one-tool-at-a-time
  hash routing; Tools added to the homepage nav.
