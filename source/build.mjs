// Builds the single shipping HTML file.
//
//   node source/build.mjs 1.1        ->  TheatreCuePlayer_v1.1.html
//
// Takes source/TheatreCuePlayer.html (the file you edit) and pastes the four export
// libraries from source/libraries/ into it, producing one self-contained file that
// needs no internet. Run `node source/verify.mjs 1.1` afterwards to check it.
//
// No npm install, no network. The libraries are committed, so this works offline and
// produces the same bytes on any machine, forever.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');

const version = process.argv[2];
if (!version) {
  console.error('Usage: node source/build.mjs <version>   e.g. node source/build.mjs 1.1');
  process.exit(1);
}

const SRC = join(HERE, 'TheatreCuePlayer.html');
const OUT = join(REPO, `TheatreCuePlayer_v${version}.html`);
const MARKER = '    <!-- BUILD:LIBRARIES -->';

// The source file is CRLF. Emit CRLF around the inserted block so the file stays
// internally consistent and diffs stay small.
const EOL = '\r\n';

// Order matters: jszip -> FileSaver -> jsPDF -> autotable. The autotable plugin
// attaches itself to jsPDF when it runs, so it has to come after it.
export const LIBS = [
  ['jszip 3.10.1', 'jszip-3.10.1.min.js'],
  ['FileSaver.js 2.0.5', 'filesaver-2.0.5.min.js'],
  ['jsPDF 2.5.1 (UMD)', 'jspdf-2.5.1.umd.min.js'],
  ['jspdf-autotable 3.5.31', 'jspdf-autotable-3.5.31.min.js'],
];

// jsPDF's "pdfobjectnewwindow" output mode fetches this at runtime. Theatre Cue
// Player never uses that mode (it only calls output("blob")), so the code is
// unreachable — but the URL is removed anyway so that no reference to an outside
// server survives a search of the shipped file.
export const PDFOBJECT_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdfobject/2.1.1/pdfobject.min.js';
export const PDFOBJECT_OFF = 'pdfobject-cdn-removed-see-comment-above';

// The published library files end with a comment pointing at a .map debug file we
// don't ship. Left in, browser dev tools would go looking for it and 404.
export const stripSourceMap = (code) =>
  code.replace(/\/\/#\s*sourceMappingURL=\S*\s*$/, '')
      .replace(/\/\*#\s*sourceMappingURL=\S*?\*\/\s*$/, '')
      .trimEnd();

export function readLibrary(fileName) {
  let code = readFileSync(join(HERE, 'libraries', fileName), 'utf8');
  if (/<\/script/i.test(code)) {
    throw new Error(`${fileName}: contains </script — it would break out of the inline tag.`);
  }
  code = stripSourceMap(code);
  if (fileName.startsWith('jspdf-2')) {
    const hits = code.split(PDFOBJECT_CDN).length - 1;
    if (hits !== 1) throw new Error(`jsPDF: expected exactly 1 pdfobject CDN URL, found ${hits}.`);
    code = code.split(PDFOBJECT_CDN).join(PDFOBJECT_OFF);
  }
  return code;
}

export function buildBlock() {
  const parts = [
    '    <!-- Export libraries, pasted in by source/build.mjs — do not hand-edit below.',
    '         The page fetches nothing from the network after it loads, so exports cannot',
    '         fail silently behind a school firewall. Versions are pinned and the code is',
    '         byte-for-byte the published releases, with two deliberate exceptions:',
    '           1. Trailing sourceMappingURL comments stripped (.map files are not shipped,',
    '              so dev tools would 404 looking for them).',
    '           2. In jsPDF, the pdfobject CDN URL used by its "pdfobjectnewwindow" output',
    '              mode is replaced with an inert placeholder. That mode is never called —',
    '              this app only uses output("blob") — but the URL is removed so no',
    '              reference to an outside server remains anywhere in this file.',
    '         To change the app, edit source/TheatreCuePlayer.html and rebuild. Editing',
    '         this file directly risks corrupting the minified code below in ways that do',
    '         not error — they just produce broken PDFs later. -->',
  ];
  for (const [label, fileName] of LIBS) {
    parts.push(`    <!-- ${label} -->`, `    <script>${readLibrary(fileName)}</script>`);
  }
  const block = parts.join(EOL);
  if (block.includes('cdnjs.cloudflare.com')) throw new Error('a cdnjs reference survived — aborting.');
  return block;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const html = readFileSync(SRC, 'utf8');
  const hits = html.split(MARKER).length - 1;
  if (hits !== 1) throw new Error(`expected exactly 1 ${MARKER} in source, found ${hits}.`);

  // Replacer function, not a plain string: the minified code contains "$$" and "$&",
  // which String.replace would silently treat as substitution patterns and rewrite.
  writeFileSync(OUT, html.replace(MARKER, () => buildBlock()), 'utf8');

  const kb = (n) => (n / 1024).toFixed(0) + ' KB';
  console.log(`Built ${OUT}`);
  console.log(`  source ${kb(html.length)} -> shipped ${kb(readFileSync(OUT).length)} (one self-contained file)`);
  console.log(`  next: node source/verify.mjs ${version}`);
}
