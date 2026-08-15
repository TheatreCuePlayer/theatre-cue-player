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

1. **No user file ever leaves the machine.** Not uploaded, not posted, not sent to an API —
   ever, by any tool, including any library added later. That claim is printed on the page and
   it has to stay literally true.

   Fetching *assets the page needs* is a different thing and is allowed (decided 2026-08-15):
   Google Fonts for the slate generator is fine, because a font request carries no user data.
   The rule is about the direction of travel — things may come down to the user, nothing about
   the user goes up. The extension and the browser build are stricter and are unaffected by
   this; do not relax them on the strength of it.
2. **Plain language.** Written for a non-technical teacher and a 13-year-old. No codecs, bitrates
   or container jargon in the visible copy unless the sentence explains itself. Say what to do
   next, not what went wrong internally.
3. **One tool at a time.** The page is hash-routed: `/tools` is the index, `/tools#downsize`
   opens a tool. Not an endless scroll, not separate documents.
4. **Always a way out.** The mark at the top goes home, the "Theatre Cue Player home" button says
   so out loud, and inside a tool there is an "All tools" button at the top and a "Done — back to
   all tools" button at the foot. Nobody should need the browser back button.
5. **Honest about limits.** When a tool can't help, it says so and names something that can
   (CloudConvert, HandBrake). Note that FFmpeg raised the ceiling: the page can now open plenty
   the browser cannot, so do not repeat the old line about a browser only handling what it can
   already decode — it is no longer true.
6. **Vanilla.** No framework, no build step. Same as the extension.

## 3. How the page is wired

Single file, single `<script>`. The only dependency is the FFmpeg engine in `vendor/ffmpeg/`,
reached by dynamic `import()` so the page still loads instantly for anyone who never opens a
tool that needs it.

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
| Make a video loop endlessly | `#loop` | ffmpeg.wasm, `xfade` + `acrossfade` | Rotates the clip around a chosen cut point so the wrap is a continuous cut and the blend lands mid-clip. **Re-encodes** — the only tool here that does. See §4.4. |
| Make a title card | `#slate` | Canvas + Google Fonts | Act titles, blackouts, intermission, warnings, surtitles. Live preview, PNG at projector resolutions. No engine, instant. See §4.3. |
| Get the sound out of a video | `#rip` | ffmpeg.wasm | Copies the audio track out untouched (`-vn -c:a copy`), or re-records as WAV/MP3. Reads the stream first so it can name the codec and detect a silent clip. See §4.2. |
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

**Follow-ups this unlocks** (the 32 MB is already paid for): ~~audio extractor~~ (done, §4.2),
GIF→MP4, and a real converter for the "Won't play" verdict.

**Measured, 2026-08-15 — and it kills one of those follow-ups.** A 1080p re-encode through
`libx264` in the single-threaded wasm core runs at **8.5× realtime** at `-preset veryfast`
(59s to produce a 7-second clip) and 11.6× at `-preset medium`, on a desktop; assume a
classroom machine is two to three times slower again. The downsizer's `MediaRecorder` approach
runs at **1×** realtime, so it is roughly an order of magnitude faster than FFmpeg here.
"Rewrite the downsizer on FFmpeg to escape real time" was listed as a follow-up above and it
was simply wrong — it would make that tool much slower. Leave the downsizer alone.

The corollary: **stream copies are what this engine is good at** (trim, rip — about a second
each), and anything that has to touch pixels is priced per second of output. Check a new
FFmpeg tool against that line before promising it.

### 4.2 The audio ripper

Built 2026-08-15, on the engine the trimmer already paid for.

**Was there something to borrow?** Asked, and looked. There is plenty —
[ffmpeg-web](https://github.com/dinoosauro/ffmpeg-web),
[xsukax-Audio-Converter](https://github.com/xsukax/xsukax-Audio-Converter),
[extract-audio-from-video](https://github.com/CasinoLove/extract-audio-from-video) — but all of
them are *applications*, not components: each ships its own framework and its own UI aimed at
general users. The reusable part of every one of them is FFmpeg, which is already vendored and
credited here. What was borrowed is the approach (copy the track, do not re-encode); what was
written is the ~60 lines of wrapper, which is the part that has to speak to a teacher and
therefore cannot come off a shelf. **Keep applying that test:** borrow engines, write wrappers.

- **Two passes.** `ffmpeg -i input` with no output file makes FFmpeg print the stream list and
  exit non-zero — expected, and caught. The log is parsed for `Stream #x:y: Audio: <codec>`.
  That is the only reliable way to know what the audio is, and the only way to know whether
  there is any: **a silent video is a real case** and gets a plain explanation rather than an
  error.
- **Opus is written to `.ogg`, not `.opus`.** `.ogg` is on the extension's reliable-format
  list and `.opus` is not, so copying to `.opus` would make the checker contradict the ripper.
- **Codecs with no web-playable home** (AC-3, DTS) are converted to WAV instead of copied, and
  the page says why rather than silently doing something different from what was asked.
- **MP3 and WAV are available** — `libmp3lame` and `pcm_s16le` are both in the vendored core
  (verified by inspecting the wasm, not assumed).
- `loadFFmpeg(say)` takes a status callback so each tool owns its own status line and bar. It
  used to write into the trimmer's markup directly; do not reintroduce that.

### 4.3 The slate generator

Built 2026-08-15. First tool here that *makes* something rather than repairing something, and
the first with no file input at all — so there is nothing to probe and no failure mode more
complicated than an empty box.

- **One draw function, two scales.** `drawSlate(ctx, W, H, opts)` sizes everything as a fraction
  of the canvas it is handed, so the on-screen preview and the exported PNG are the same code.
  The preview cannot drift from the file. Preview runs at 960px wide; export runs at the chosen
  resolution. Do not "optimise" this into two code paths.
- **Text is auto-fitted**, shrinking until the widest line fits the margin and the block fits the
  chosen fill fraction. Manual line breaks are honoured; there is no automatic word wrap, because
  a designer choosing where "Two years later" breaks is the point.
- **Google Fonts, loaded on demand** — picking a font fetches that font, nothing is fetched up
  front. Permitted under §2 because a font request carries no user data. **The failure path is
  the important one:** a blocked or offline network is normal in a school, so the tool falls back
  to the system face, says so plainly, and still produces a card. There is a test that routes
  `fonts.googleapis.com` to an abort and asserts a PNG still comes out.
- **Transparent background** is offered and the preview sits on a checkerboard, so "see-through"
  reads as see-through rather than as white.
- **Presets** (blackout, act, intermission, warning, surtitle) exist because a blank box is a
  worse starting point than something to edit.

### 4.4 The seamless looper

Built 2026-08-15, then **rewritten the same day** because the first version solved the wrong
problem. Worth reading before changing it.

**The technique: rotate around a cut point.** The user picks a moment; everything after it plays
first, everything before it plays second.

    source: [   A: 0..C   ][   B: C..L   ]
    output: [   B: C..L   ][   A: 0..C   ]
                           ^ the two ORIGINAL ends meet here, mid-clip, hidden by the blend
    wrap:   last frame of A (just before C) -> first frame of B (at C)
            those were adjacent in the source, so the wrap is a real continuous cut

The point is that the unavoidable discontinuity gets **moved out of the loop seam** and into the
middle of the clip, where a dissolve reads as a deliberate transition. The wrap itself becomes
invisible rather than merely softened.

    [0:v]split[v1][v2];
    [v1]trim=start=C,setpts=PTS-STARTPTS[vb];    # plays first, L-C long
    [v2]trim=end=C,setpts=PTS-STARTPTS[va];      # plays second, C long
    [vb][va]xfade=transition=fade:duration=D:offset=(L-C-D)

plus `[ab][aa]acrossfade=d=D` on the matching `atrim`/`asplit` chain when there is sound —
`acrossfade` overlaps its two inputs itself, so there is no offset to work out there. Output is
`L - D` long. **`xfade`'s offset is measured along `[vb]`**, which is `L-C` long, so the blend
starts `D` before it runs out. That is the easy thing to get wrong.

**The first version crossfaded the tail straight into the head** — equivalent to forcing `C = D`.
It produced a clip that loops, but with a visible dissolve *at* the wrap, every time round. It
is a strictly worse special case of what is here now. Do not "simplify" back to it.

**Verified by decoding the output, not by trusting the duration.** Playwright's Chromium cannot
decode H.264, so FFmpeg was asked to extract stills from its own output: with an 8s clip stamped
with its own timecode and a cut at 4.0s, output t=0 shows `4.0s`, the last frame shows `3.9s`,
and the frame at t=3.4s shows the original `7.4s` dissolving through the original `0`. Length
alone would have passed for a clip that never rotated at all.

- **Constraint is `D < C` and `D < L-C`** — both pieces must outlast the blend. Explained in
  words and the button disables, and it recovers when the cut is moved rather than staying stuck.
- **The cut defaults to halfway**, which is always valid for any offered blend length.
- **The bar shows the rearrangement**, not just a position: the two pieces are tinted and
  labelled "plays first" / "plays second". That picture is doing most of the explaining.
- **This is the only tool here that re-encodes**, priced per the benchmark in §4.1: about a
  minute per seven seconds of 1080p on a desktop. So the UI quotes a time **before** starting,
  recomputes it from real progress once running, and offers 720p as the fast way out. There is a
  test that the estimate appears before the job does. Never replace it with a spinner.
- **The loop preview is the point.** The result plays on repeat above the download button, so
  the join can be judged before anyone commits it to a show.
- `makeCutBar()` and `makeMarkBar()` share `wireScrub()` for the pointer handling; the trimmer
  uses two handles, the looper one.

## 5. Candidate list

Sourced partly from a Gemini brainstorm (2026-08-15). Ordered by how often the problem actually
comes up in a school show. Nothing below is committed.

### Worth building

| Tool | Engine | Why |
|---|---|---|
| ~~Trim a video~~ | ffmpeg.wasm | **Built 2026-08-15** — see §4.1. |
| ~~Pull the sound out of a video~~ | ffmpeg.wasm | **Built 2026-08-15** — see §4.2. |
| ~~Title / slate cards~~ | Canvas + Google Fonts | **Built 2026-08-15** — see §4.3. Fonts are fetched, not bundled: rule 1 was clarified rather than broken. |
| **Projector test grid** | Canvas | Pairs directly with the extension's surface warping. Pure generator, tiny. |
| **Split & merge script PDFs** | `pdf-lib` (MIT) | Real stage-management chore, and pdf-lib is small and clean. |

### ~~Seamless video looper~~ — BUILT 2026-08-15, see §4.4

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

- **2026-08-15** — Looper rewritten (§4.4) to rotate around a user-chosen cut point rather than
  crossfading the tail into the head: the wrap becomes a continuous cut and the dissolve moves
  mid-clip. Verified by decoding frames out of the output.
- **2026-08-15** — Seamless looper first version (§4.4). The mark bar became `makeMarkBar()`,
  shared by the trimmer and the looper instead of copied; pointer handling is in `wireScrub()`.
- **2026-08-15** — Slate generator (§4.3), and rule 1 clarified: no *user file* may leave the
  machine, but fetching assets the page needs (fonts) is fine. Long filenames wrap in the facts
  grid instead of painting over the neighbouring cell.
- **2026-08-15** — Audio ripper (§4.2), sharing the trimmer's engine. Duplicate-id guard added
  to the tests after `t-out` was used twice, which built the trimmer's download link inside a
  drag handle.
- **2026-08-15** — Trimmer built on ffmpeg.wasm (§4.1); GPL accepted and attributed; Playwright
  coverage for the tools page; checker copy corrected where FFmpeg made it untrue.
- **2026-08-15** — Logo links home; explicit home button; "All tools" button in the nav and at the
  foot of every tool; per-tool `document.title`; `TOOLS` became a title map so adding a tool is one
  line. This file created.
- Earlier — tools page added with the media checker, then the video downsizer; one-tool-at-a-time
  hash routing; Tools added to the homepage nav.
