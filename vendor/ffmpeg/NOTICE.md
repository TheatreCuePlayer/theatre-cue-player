# Third-party software vendored here

These files are **not** written by Theatre Cue Player. They are unmodified copies of
published releases, committed to this repository so the tools page can serve them from its
own origin rather than a CDN — which is what lets the page promise that it makes no
third-party network requests with your files.

## `esm/` — ffmpeg.wasm loader

- **Package:** `@ffmpeg/ffmpeg` **0.12.15**
- **Licence:** MIT
- **Source:** <https://github.com/ffmpegwasm/ffmpeg.wasm>
- **Origin of these files:** `node_modules/@ffmpeg/ffmpeg/dist/esm/`, copied verbatim.

## `core/` — FFmpeg itself, compiled to WebAssembly

- **Package:** `@ffmpeg/core` **0.12.10** (single-threaded build)
- **Licence:** **GPL-2.0-or-later** — see <https://www.gnu.org/licenses/old-licenses/gpl-2.0.html>
- **Upstream project:** FFmpeg, <https://ffmpeg.org/>
- **Source:** <https://github.com/ffmpegwasm/ffmpeg.wasm> (build scripts) and
  <https://github.com/FFmpeg/FFmpeg> (the C source it is built from)
- **Origin of these files:** `node_modules/@ffmpeg/core/dist/esm/`, copied verbatim.

### What the GPL means for this page

`ffmpeg-core.wasm` is a GPL build — it is compiled with `--enable-gpl`, which pulls in
GPL-licensed components such as x264. Distributing it means:

1. **The tools page is a combined work and is offered under GPL-2.0-or-later.** The source
   is this repository, which is public: <https://github.com/kevin-patrick/theatre-cue-player>
2. **The files here are unmodified.** No patches have been applied. Anyone wanting the
   corresponding source can obtain the exact published packages above from npm, and FFmpeg's
   own source from the FFmpeg project.
3. **The rest of the site is unaffected.** Only `tools.html` loads this engine. The Theatre
   Cue Player extension and the browser build share no code with it and do not ship FFmpeg.

### Outstanding

A verbatim copy of the GPL v2 text should live beside these files as `COPYING.GPLv2.txt`,
and the tools page footer already links to that path. To add it:

    curl -o vendor/ffmpeg/COPYING.GPLv2.txt https://www.gnu.org/licenses/old-licenses/gpl-2.0.txt

Until that file exists, the footer link will 404 — point it at the gnu.org URL instead if you
would rather not vendor the text.

## Updating

Bump the version, re-copy, and update this file **and** `FF_WASM_SIZE` in `tools.html` — the
progress bar measures against the exact byte size of `core/ffmpeg-core.wasm`
(currently **32,232,419** bytes). `FF_CACHE` is versioned too (`tcp-ffmpeg-core-0.12.10`);
changing it retires everyone's cached copy of the old engine.
