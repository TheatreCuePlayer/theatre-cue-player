# How Theatre Cue Player is built

**The app is still one HTML file.** That has not changed and will not change. This
folder is the workshop, not the product. Nothing in here ships.

## Why this folder exists

As of v1.0.0, the four libraries the export features need — JSZip, FileSaver, jsPDF
and jspdf-autotable — are pasted *inside* the app instead of being downloaded from
the internet each time the page opens.

That is the point of v1.0: a school district can block outbound internet traffic and
Export to Zip / Export PDF / Export CSV still work. Before, they broke silently — a
student clicked Export PDF and nothing happened at all.

The cost is that about two thirds of the shipped file is now that borrowed library
code. It is machine-compressed and fragile: invisible characters inside it matter.
Most text editors quietly normalise invisible characters across a whole file when
they save. Do that inside the library code and nothing errors — it just produces a
broken PDF later, which is exactly the kind of failure this project refuses to ship.

So: you edit the app here, and a script produces the shipping file.

## The two files that matter

| File | What it is |
|---|---|
| `source/TheatreCuePlayer.html` | **The app. Edit this one.** ~300 KB, no library code. |
| `TheatreCuePlayer_v<version>.html` (repo root) | The built file that ships. Do not edit. |

## Making a change

```sh
# 1. Edit source/TheatreCuePlayer.html — including the version number, which
#    appears in three places: the header comment, the <title>, and the About box.

# 2. Build the single shipping file.
node source/build.mjs 1.1

# 3. Check it.
node source/verify.mjs 1.1
```

`verify` compares the built file against the source and against the pinned library
files, byte for byte, and fails if anything drifted or if any reference to an outside
server reappeared. If it fails, do not ship the build.

Then test the built file in a browser — including offline, which is the whole point:

```sh
# A Chrome window with no internet, leaving the rest of the computer alone.
"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" ^
  --user-data-dir="%TEMP%\chrome-offline-test" ^
  --proxy-server="127.0.0.1:1" ^
  --no-first-run ^
  "file:///E:/OneDrive/Documents/GitHub/theatre-cue-player/TheatreCuePlayer_v1.1.html"
```

Everything must work in that window except the Google Forms links, which are supposed
to need internet. Then repeat on a Chromebook — that is the actual deployment target.

## Publishing

1. Point the button in `index.html` at the new version.
2. Add the previous version's URL to `_redirects` so old bookmarks keep working
   (302, not 301 — see the comments in that file).
3. Push. Netlify deploys from `main`.

## `source/libraries/` — do not edit

Pinned copies of the four libraries, exactly as published:

| File | Version |
|---|---|
| `jszip-3.10.1.min.js` | 3.10.1 |
| `filesaver-2.0.5.min.js` | 2.0.5 |
| `jspdf-2.5.1.umd.min.js` | 2.5.1 (UMD build) |
| `jspdf-autotable-3.5.31.min.js` | 3.5.31 |

They are committed on purpose: the build then needs no `npm install` and no network,
and it will produce the same bytes on any machine years from now. Load order is fixed
in `build.mjs` — autotable attaches itself to jsPDF, so it must come after it.

`build.mjs` makes exactly two changes to this code, both deliberate and both
explained in a comment in the built file:

1. Trailing `sourceMappingURL` comments are stripped. The `.map` files are not
   shipped, so browser dev tools would 404 looking for them.
2. In jsPDF, one CDN URL is replaced with an inert placeholder. It belongs to jsPDF's
   `pdfobjectnewwindow` output mode, which this app never calls — it only uses
   `output("blob")` — but the URL is removed so that no reference to an outside server
   survives a search of the shipped file. A district IT reviewer should be able to
   search the file and find nothing to ask about.

## To upgrade a library later

Replace the file, rename it to the new version, update the name in `LIBS` in
`build.mjs`, rebuild, verify, and test the exports offline. Nothing else fetches
these, so a version bump is a deliberate act — not something that drifts on its own.
That is the main reason for vendoring them.
