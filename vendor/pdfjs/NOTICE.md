# Third-party software vendored here

Not written by Theatre Cue Player. Copies of a published release, served from this origin so
the tools page never sends a PDF anywhere. Used by the "Split pages down the middle" tool to
draw the pages on screen — it never writes the output file; `vendor/pdf-lib/` does that.

- **Package:** `pdfjs-dist` **6.4.299**
- **Licence:** Apache-2.0 — `LICENSE` in this folder
- **Source:** <https://github.com/mozilla/pdf.js>

## What was copied, and the one change

| Here | From the npm package | Change |
|---|---|---|
| `pdf.min.js` | `legacy/build/pdf.min.mjs` | renamed `.mjs` → `.js` |
| `pdf.worker.min.js` | `legacy/build/pdf.worker.min.mjs` | renamed `.mjs` → `.js` |
| `wasm/` | `wasm/` | JBIG2, OpenJPEG and QCMS decoders plus their licences; `quickjs-eval.*` left out (PDF scripting, not needed to draw a page) |
| `standard_fonts/` | `standard_fonts/` | none (Foxit and Liberation licences inside) |

**The legacy build, on purpose.** The modern build calls `Map.prototype.getOrInsertComputed`,
which only the newest browsers have: Playwright's Chromium failed on it, and so would a school
Chromebook a few versions behind. The legacy build carries the polyfills. Do not "upgrade" to
the modern build without checking that again.

The rename is because a module script is refused unless the server calls it JavaScript, and not
every static server knows `.mjs`. The contents are byte-identical.

The `wasm/` folder matters more than it looks: a great many PDFs store their pages as JBIG2
(black and white) or JPEG 2000 images, and without these decoders those pages draw blank.

`cmaps/` is not vendored. It is only needed to draw text in CJK fonts that are not embedded;
the split itself never depends on drawing, so the worst case is an odd-looking preview.

## Updating

Re-copy as above, keep the renames, update the version here and in `TOOLS.md` §6.
