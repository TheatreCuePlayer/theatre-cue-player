# Third-party software vendored here

Not written by Theatre Cue Player. A copy of a published release, served from this origin so
the tools page never sends a file anywhere. Used by the "Make sounds the same volume" tool to
bundle a batch of levelled files into one zip, in browsers that cannot save into a folder.

- **Package:** `fflate` **0.8.3**
- **Licence:** MIT — `LICENSE` in this folder
- **Source:** <https://github.com/101arrowz/fflate>
- **File:** `umd/index.js`, renamed `fflate.min.js`, otherwise unmodified. It is the UMD
  build, loaded by a plain script tag on demand, and sets `window.fflate`.
