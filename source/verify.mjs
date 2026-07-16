// Checks a built file against its source and the pinned libraries.
//
//   node source/verify.mjs 1.1
//
// Answers three questions:
//   1. Is the app code in the built file exactly the app code you edited?
//   2. Is each pasted-in library exactly the published release (plus the two
//      documented tweaks)?
//   3. Does anything still point at the internet?
//
// This exists because the failure it guards against is silent. A stray invisible
// character inside the minified code does not throw an error — it produces a
// corrupted PDF weeks later. Byte comparison is the only honest check.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { LIBS, buildBlock, readLibrary } from './build.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');

const version = process.argv[2];
if (!version) {
  console.error('Usage: node source/verify.mjs <version>   e.g. node source/verify.mjs 1.1');
  process.exit(1);
}

const MARKER = '    <!-- BUILD:LIBRARIES -->';
const src = readFileSync(join(HERE, 'TheatreCuePlayer.html'), 'utf8');
const built = readFileSync(join(REPO, `TheatreCuePlayer_v${version}.html`), 'utf8');

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? '  ok  ' : '  FAIL'}  ${label}${detail ? '  — ' + detail : ''}`);
  if (!ok) failures++;
};

console.log(`\nVerifying TheatreCuePlayer_v${version}.html\n`);

// 1. App code identical: rebuilding from source must reproduce the file exactly.
check('built file == source + libraries, byte for byte', src.replace(MARKER, () => buildBlock()) === built);

// 2. Each library matches its pinned file, as transformed by the documented rules.
const inline = [...built.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
LIBS.forEach(([label, fileName], i) => {
  check(`${label} matches source/libraries/${fileName}`, inline[i] === readLibrary(fileName));
});

// 3. Nothing reaches outward. Google Forms and the licence link are href-only: a
//    person has to click them, so they are not loaded when the page opens.
check('no cdnjs reference', !built.includes('cdnjs.cloudflare.com'));
check('no netlify reference', !built.includes('netlify'));
check('no "internet connection" advice', !built.includes('internet connection'));
check('no external <script src>', !/<script[^>]+src\s*=\s*["']https?:/i.test(built));
check('no external stylesheet', !/<link[^>]+href\s*=\s*["']https?:/i.test(built));

const externalHrefs = [...built.matchAll(/href\s*=\s*["'](https?:\/\/[^"']+)/g)].map((m) => m[1]);
const allowed = (u) => u.includes('docs.google.com/forms') || u.includes('creativecommons.org');
check('only Google Forms + licence links remain', externalHrefs.every(allowed),
  externalHrefs.filter((u) => !allowed(u)).join(', ') || `${externalHrefs.length} allowed links`);

console.log(failures === 0
  ? '\nAll checks passed. Safe to ship.\n'
  : `\n${failures} check(s) FAILED. Do not ship this build.\n`);
process.exit(failures === 0 ? 0 : 1);
