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
| Shrink a video | `#downsize` | Canvas + `MediaRecorder` | Real-time encode (a 2-min clip takes 2 min) — the UI says so. MP4 when the browser can write it, WebM otherwise. Only works on files the browser can already decode. |

## 5. Candidate list

Sourced partly from a Gemini brainstorm (2026-08-15). Ordered by how often the problem actually
comes up in a school show. Nothing below is committed.

### Worth building

| Tool | Engine | Why |
|---|---|---|
| **Trim a video** | ffmpeg.wasm, stream copy (`-c copy`) | The most-wanted one. Lossless and instant — no real-time wait like the downsizer. Cuts heads and tails off a clip. |
| **Pull the sound out of a video** | ffmpeg.wasm | Common ask: a sound effect that only exists inside an MP4. |
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

### The ffmpeg.wasm decision — not yet made

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

## 6. Attribution

The page currently uses no third-party code. The moment it does, the footer gets an attribution
line naming each library and its licence, and this section lists them.

Planned wording once libraries land:

> Theatre Cue Player Tools are open-source utilities built for live performance.
> Powered by FFmpeg.wasm (LGPL), pdf-lib (MIT). No files are uploaded or stored — everything runs
> on your own machine.

## 7. History

- **2026-08-15** — Logo links home; explicit home button; "All tools" button in the nav and at the
  foot of every tool; per-tool `document.title`; `TOOLS` became a title map so adding a tool is one
  line. This file created.
- Earlier — tools page added with the media checker, then the video downsizer; one-tool-at-a-time
  hash routing; Tools added to the homepage nav.
