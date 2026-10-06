// @ts-check
import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * Tools page: the ways out, and the trimmer end to end.
 *
 * The trim test builds its own video in the browser rather than committing a fixture:
 * Playwright's Chromium ships without the proprietary codecs, so it can neither make nor
 * read an H.264 MP4. It makes a WebM instead, which exercises exactly the same path —
 * probe, mark in/out, load the wasm engine, stream copy, read the result back.
 */

const BASE = 'http://127.0.0.1:8765/tools.html';

test.describe('tools page', () => {
  test('the index offers a way home, and no way "up" until you are in a tool', async ({ page }) => {
    await page.goto(BASE);
    // Every tool the router knows about has a card, and every card points at a real tool.
    // Asserted against the router rather than a hardcoded count, so adding a tool does not
    // fail this test for the wrong reason.
    const { known, cards } = await page.evaluate(() => ({
      known: Object.keys(window.TOOLS),
      cards: [...document.querySelectorAll('.tool-btn')].map(b => b.dataset.tool),
    }));
    expect(cards.slice().sort()).toEqual(known.slice().sort());
    await expect(page.locator('.home-link')).toHaveAttribute('href', '/');
    await expect(page.locator('.pagenav a.navbtn')).toHaveAttribute('href', '/');
    await expect(page.locator('#up-btn')).toBeHidden();
    await expect(page).toHaveTitle('Tools — Theatre Cue Player');
  });

  test('opening a tool shows both ways back, and each one works', async ({ page }) => {
    await page.goto(BASE);
    await page.locator('.tool-btn[data-tool="trim"]').click();

    await expect(page.locator('#view-trim')).toBeVisible();
    await expect(page.locator('#view-index')).toBeHidden();
    await expect(page.locator('#up-btn')).toBeVisible();
    await expect(page).toHaveTitle('Trim a video — Theatre Cue Player');
    expect(new URL(page.url()).hash).toBe('#trim');

    // 1. the nav button
    await page.locator('#up-btn').click();
    await expect(page.locator('#view-index')).toBeVisible();
    await expect(page.locator('#up-btn')).toBeHidden();

    // 2. the button at the foot of the tool
    await page.locator('.tool-btn[data-tool="trim"]').click();
    await page.locator('#view-trim .exit-row .to-index').click();
    await expect(page.locator('#view-index')).toBeVisible();

    // 3. the breadcrumb, which show() rebuilds every time
    await page.locator('.tool-btn[data-tool="check"]').click();
    await page.locator('#crumb .to-index').click();
    await expect(page.locator('#view-index')).toBeVisible();
    await expect(page).toHaveTitle('Tools — Theatre Cue Player');
  });

  test('no two elements share an id', async ({ page }) => {
    // Worth a test of its own: the trimmer's results box and its end-trim handle were both
    // id="t-out", so getElementById returned the handle and the download link was built
    // inside a 16px drag control. Nothing threw, and a visibility assertion still passed.
    await page.goto(BASE);
    const dupes = await page.evaluate(() => {
      const seen = new Map();
      for (const el of document.querySelectorAll('[id]')) {
        seen.set(el.id, (seen.get(el.id) || 0) + 1);
      }
      return [...seen].filter(([, n]) => n > 1).map(([id]) => id);
    });
    expect(dupes).toEqual([]);
  });

  /** Builds a WebM in the page and hands it to a file input. withSound=false makes a silent one. */
  async function makeClip(page, inputId, { seconds = 4, withSound = true, name = 'clip.webm', stamped = false } = {}) {
    return page.evaluate(async ({ inputId, seconds, withSound, name, stamped }) => {
      const canvas = document.createElement('canvas');
      canvas.width = 320; canvas.height = 240;
      const ctx = canvas.getContext('2d');
      const stream = canvas.captureStream(30);
      if (withSound) {
        const ac = new AudioContext();
        const osc = ac.createOscillator();
        const dest = ac.createMediaStreamDestination();
        osc.frequency.value = 440; osc.connect(dest); osc.start();
        dest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
      }
      const rec = new MediaRecorder(stream, { mimeType: 'video/webm' });
      const chunks = [];
      rec.ondataavailable = e => e.data.size && chunks.push(e.data);
      const stopped = new Promise(r => { rec.onstop = r; });
      rec.start();
      const start = performance.now();
      await new Promise(done => {
        (function frame() {
          const t = performance.now() - start;
          ctx.fillStyle = `hsl(${(t / 20) % 360} 70% 45%)`; ctx.fillRect(0, 0, 320, 240);
          if (stamped) {                       // seconds on screen, so a rotation is visible
            ctx.fillStyle = '#fff'; ctx.font = 'bold 90px sans-serif';
            ctx.fillText((t / 1000).toFixed(1), 30, 150);
          }
          if (t < seconds * 1000) requestAnimationFrame(frame); else done();
        })();
      });
      rec.stop(); await stopped;
      const dt = new DataTransfer();
      dt.items.add(new File(chunks, name, { type: 'video/webm' }));
      const input = document.getElementById(inputId);
      input.files = dt.files;
      input.dispatchEvent(new Event('change'));
    }, { inputId, seconds, withSound, name, stamped });
  }

  test('pulls the sound out of a video', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'needs MediaRecorder to build its own fixture');
    test.setTimeout(180_000);
    await page.goto(BASE + '#rip');
    await makeClip(page, 'r-file', { name: 'storm-effect.webm' });

    await expect(page.locator('#r-panel')).toBeVisible({ timeout: 20_000 });
    await page.locator('#r-go').click();
    await expect(page.locator('#r-result a.dl')).toBeVisible({ timeout: 150_000 });

    // A copy, named for what was actually inside — MediaRecorder writes Opus, which the page
    // deliberately puts in .ogg rather than .opus so it matches the extension's reliable list.
    await expect(page.locator('#r-status')).toContainText('Opus');
    await expect(page.locator('#r-status')).toContainText('copied out, not re-recorded');
    await expect(page.locator('#r-result a.dl')).toHaveAttribute('download', 'storm-effect.ogg');

    const audio = await page.evaluate(async () => {
      const blob = await (await fetch(document.querySelector('#r-result a.dl').href)).blob();
      const el = document.createElement('audio');
      el.src = URL.createObjectURL(blob);
      const dur = await new Promise(r => {
        el.onloadedmetadata = () => r(el.duration);
        el.onerror = () => r(-1);
        setTimeout(() => r(-2), 8000);
      });
      return { size: blob.size, duration: dur };
    });
    expect(audio.size).toBeGreaterThan(1000);
    expect(audio.duration).toBeGreaterThan(1);      // real, playable audio — not an empty file
  });

  test('rotates the clip around the cut point and blends the old ends mid-clip', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'needs MediaRecorder to build its own fixture');
    test.setTimeout(300_000);
    page.on('console', m => { if (m.type() === 'error') console.log('PAGE ERROR:', m.text()); });

    await page.goto(BASE + '#loop');
    // The fixture counts seconds on screen, so the output's opening frame proves the rotation.
    await makeClip(page, 'p-file', { seconds: 8, name: 'campfire.webm', stamped: true });
    await expect(page.locator('#p-panel')).toBeVisible({ timeout: 20_000 });

    // A time estimate is quoted BEFORE anything starts. This tool can run for minutes and must
    // never do that behind a silent spinner.
    await expect(page.locator('#p-estimate')).toContainText('start and end at');
    await expect(page.locator('#p-estimate')).toContainText('blend will land');

    await page.locator('#p-fade').selectOption('1');
    const { dur, cut } = await page.evaluate(() => ({
      dur: window.pInfo.duration, cut: window.pBarCtl.get(),
    }));
    expect(cut).toBeGreaterThan(dur / 2 - 0.3);      // defaults to halfway
    expect(cut).toBeLessThan(dur / 2 + 0.3);

    await page.locator('#p-go').click();
    await expect(page.locator('#p-result video.loop-preview')).toBeVisible({ timeout: 240_000 });
    await expect(page.locator('#p-status')).toContainText('Done in');
    await expect(page.locator('#p-status')).toContainText('starts and ends on what was');

    const made = await page.evaluate(async () => {
      const blob = await (await fetch(document.querySelector('#p-result a.dl').href)).blob();
      const v = document.createElement('video');
      v.src = URL.createObjectURL(blob);
      const d = await new Promise(r => {
        v.onloadedmetadata = () => r(v.duration);
        v.onerror = () => r(-1);
        setTimeout(() => r(-2), 10000);
      });
      return { size: blob.size, duration: d, type: blob.type };
    });
    expect(made.type).toBe('video/mp4');
    expect(made.size).toBeGreaterThan(1000);
    // Length contract: the whole clip, minus one blend.
    expect(made.duration).toBeGreaterThan(dur - 1 - 0.6);
    expect(made.duration).toBeLessThan(dur - 1 + 0.6);

    // The preview loops. If it does not, nobody can judge the join before downloading.
    await expect(page.locator('#p-result video.loop-preview')).toHaveJSProperty('loop', true);
    await expect(page.locator('#p-result a.dl')).toHaveAttribute('download', 'campfire-loop.mp4');
  });

  test('the cut point drives the output, and both halves must beat the blend', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'needs MediaRecorder to build its own fixture');
    test.setTimeout(120_000);
    await page.goto(BASE + '#loop');
    await makeClip(page, 'p-file', { seconds: 6, name: 'tiny.webm' });
    await expect(page.locator('#p-panel')).toBeVisible({ timeout: 20_000 });

    // Drag the cut hard against the end: the short piece is then thinner than the blend.
    await page.locator('#p-track').scrollIntoViewIfNeeded();   // it sits below the fold
    const box = await page.locator('#p-track').boundingBox();
    await page.mouse.move(box.x + box.width * 0.97, box.y + box.height / 2);
    await page.mouse.down(); await page.mouse.up();
    await expect(page.locator('#p-estimate')).toContainText('Move the cut, or shorten the blend');
    await expect(page.locator('#p-go')).toBeDisabled();

    // Recovers by moving the cut, rather than staying stuck.
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2);
    await page.mouse.down(); await page.mouse.up();
    await expect(page.locator('#p-estimate')).toContainText('start and end at');
    await expect(page.locator('#p-go')).toBeEnabled();

    // The bar shows the rearrangement: the piece after the cut is labelled as playing first.
    await expect(page.locator('#p-partB')).toContainText('plays first');
    await expect(page.locator('#p-partA')).toContainText('plays second');
  });

  test('a long filename wraps instead of landing on top of the size', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'needs MediaRecorder to build its own fixture');
    test.setTimeout(120_000);
    await page.goto(BASE + '#rip');
    await makeClip(page, 'r-file', {
      seconds: 2,
      // No spaces on purpose. A name with spaces wraps on its own; it is the unbroken run —
      // the way exports and phone cameras actually name things — that overflows the column.
      name: 'Act2_Scene4_thunderstorm_with_distant_church_bells_FINAL_v3_donotdelete.webm',
    });
    await expect(page.locator('#r-panel')).toBeVisible({ timeout: 20_000 });

    // Measure content against box, NOT bounding boxes against each other. The grid keeps each
    // cell exactly where it belongs; it is the TEXT that paints outside its cell and over the
    // neighbour, which no getBoundingClientRect comparison can see. Unfixed, the File cell here
    // is 257px wide holding 517px of filename.
    const spills = await page.locator('#r-facts .fact').evaluateAll(els => els
      .map(e => ({ text: e.textContent.slice(0, 24), over: e.scrollWidth - e.clientWidth }))
      .filter(x => x.over > 1));
    expect(spills).toEqual([]);
  });

  test('a silent video is explained, not reported as a failure', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'needs MediaRecorder to build its own fixture');
    test.setTimeout(180_000);
    await page.goto(BASE + '#rip');
    await makeClip(page, 'r-file', { withSound: false, name: 'silent.webm' });

    await expect(page.locator('#r-panel')).toBeVisible({ timeout: 20_000 });
    await page.locator('#r-go').click();
    await expect(page.locator('#r-status')).toContainText('no sound in this video', { timeout: 150_000 });
    await expect(page.locator('#r-status')).toContainText('Nothing has gone wrong');
    await expect(page.locator('#r-go')).toBeEnabled();
  });

  test('the slate exports a real PNG at the chosen size', async ({ page }) => {
    await page.goto(BASE + '#slate');
    await page.locator('#s-text').fill('Act Two\nTwo years later');
    await page.locator('#s-res').selectOption('1280x720');

    // The preview must not be blank — it is the thing people judge the tool by.
    const inked = await page.evaluate(() => {
      const c = document.getElementById('s-canvas');
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let lit = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 3] > 200) lit++;
      return lit;
    });
    expect(inked).toBeGreaterThan(500);         // real light-coloured text on a dark card

    const download = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#s-go').click(),
    ]).then(([d]) => d);
    expect(download.suggestedFilename()).toBe('Act Two 1280x720.png');

    // Decode what was actually saved, rather than trusting the button.
    const saved = await page.evaluate(async () => {
      const blob = await (await fetch(document.querySelector('#s-result a.dl').href)).blob();
      const bmp = await createImageBitmap(blob);
      return { type: blob.type, w: bmp.width, h: bmp.height, size: blob.size };
    });
    expect(saved).toMatchObject({ type: 'image/png', w: 1280, h: 720 });
    expect(saved.size).toBeGreaterThan(1000);
  });

  test('a blocked font network still produces a card', async ({ page }) => {
    // A school network that blocks Google is the normal case, not the edge case. The tool has
    // to degrade to the system face and say so — never fail, never silently lie to the preview.
    await page.route('https://fonts.googleapis.com/**', r => r.abort());
    await page.goto(BASE + '#slate');
    await page.locator('#s-font').selectOption('Cinzel');

    await expect(page.locator('#s-status')).toContainText('Could not fetch Cinzel');
    await expect(page.locator('#s-status')).toContainText('still works');

    const download = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#s-go').click(),
    ]).then(([d]) => d);
    expect(download.suggestedFilename()).toContain('.png');
  });

  test('an empty slate is a plain colour card, not a crash', async ({ page }) => {
    await page.goto(BASE + '#slate');
    await page.locator('#s-presets [data-preset="blackout"]').click();
    await expect(page.locator('#s-text')).toHaveValue('');
    const black = await page.evaluate(() => {
      const c = document.getElementById('s-canvas');
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      for (let i = 0; i < d.length; i += 4) if (d[i] || d[i + 1] || d[i + 2]) return false;
      return true;
    });
    expect(black).toBe(true);
  });

  /* The PDF splitter builds its fixture in the page with the vendored pdf-lib, for the same
     reason the video tests build theirs: nothing to commit, and the sheet layout is known
     exactly. A portrait cover, three two-up sheets with a fold at 53% (deliberately not the
     middle), and one sheet stored portrait with /Rotate 90 so it DISPLAYS two-up. */
  async function dropTwoUp(page, name, foldAt) {
    await page.evaluate(async ({ name, foldAt }) => {
      const { PDFDocument, StandardFonts, rgb, degrees } = await import('/vendor/pdf-lib/pdf-lib.esm.min.js');
      const doc = await PDFDocument.create();
      const font = await doc.embedFont(StandardFonts.Helvetica);
      doc.addPage([612, 792]).drawText('COVER', { x: 200, y: 400, size: 48, font });
      const gut = 792 * foldAt;
      for (let s = 0; s < 3; s++) {
        const p = doc.addPage([792, 612]);
        for (const x0 of [0, gut]) {
          for (let i = 0; i < 20; i++) p.drawText('Lorem ipsum dolor sit amet ' + i, { x: x0 + 40, y: 520 - i * 22, size: 11, font });
        }
        p.drawLine({ start: { x: gut, y: 0 }, end: { x: gut, y: 612 }, thickness: 3, color: rgb(0.3, 0.3, 0.3) });
      }
      const r = doc.addPage([612, 792]);
      r.setRotation(degrees(90));
      const bytes = await doc.save();
      const dt = new DataTransfer();
      dt.items.add(new File([bytes], name, { type: 'application/pdf' }));
      const input = document.getElementById('sp-file');
      input.files = dt.files;
      input.dispatchEvent(new Event('change'));
    }, { name, foldAt });
  }

  test('splits two-up PDF pages losslessly, at the fold it finds', async ({ page }) => {
    await page.goto(BASE + '#split');
    await dropTwoUp(page, 'sheets.pdf', 0.53);
    await expect(page.locator('#sp-status')).toContainText('Layered', { timeout: 20000 });
    await expect(page.locator('#sp-facts')).toContainText('4 of 5');

    // The fold is found, not assumed to be the middle.
    const frac = await page.evaluate(() => window.spFrac);
    expect(Math.abs(frac - 0.53)).toBeLessThan(0.01);

    await page.locator('#sp-go').click();
    await expect(page.locator('#sp-status')).toContainText('5 sheets in, 9 pages out', { timeout: 20000 });
    await expect(page.locator('#sp-result a.dl')).toHaveAttribute('download', 'sheets-split.pdf');

    // Read the boxes back out of what was saved, rather than trusting the status line.
    const boxes = await page.evaluate(async () => {
      const { PDFDocument } = await import('/vendor/pdf-lib/pdf-lib.esm.min.js');
      const bytes = await (await fetch(document.querySelector('#sp-result a.dl').href)).arrayBuffer();
      const d = await PDFDocument.load(bytes);
      return d.getPages().map(p => {
        const c = p.getCropBox(), m = p.getMediaBox();
        return { x: Math.round(c.x), y: Math.round(c.y), w: Math.round(c.width), h: Math.round(c.height),
                 mw: Math.round(m.width), rot: p.getRotation().angle };
      });
    });
    const cut = Math.round(792 * frac);
    expect(boxes[0]).toMatchObject({ w: 612, h: 792 });                  // the cover, left whole
    expect(boxes[1]).toMatchObject({ x: 0, w: cut, h: 612, mw: cut });   // left half first
    expect(boxes[2]).toMatchObject({ x: cut, w: 792 - cut, h: 612 });
    // The rotated sheet: "across" on screen is up the page in the file, so it is cut along y.
    expect(boxes[7]).toMatchObject({ y: 0, w: 612, h: cut, rot: 90 });
    expect(boxes[8]).toMatchObject({ y: cut, w: 612, h: 792 - cut, rot: 90 });

    // The check-it-before-you-print preview actually drew.
    await expect(page.locator('#sp-thumbs canvas')).toHaveCount(4);
  });

  test('right-half-first puts the halves the other way round', async ({ page }) => {
    await page.goto(BASE + '#split');
    await dropTwoUp(page, 'sheets.pdf', 0.5);
    await expect(page.locator('#sp-status')).toContainText('Layered', { timeout: 20000 });
    await page.locator('#sp-order').selectOption('rl');
    await expect(page.locator('#sp-tagL')).toHaveText('2nd');
    await page.locator('#sp-go').click();
    await expect(page.locator('#sp-status')).toContainText('pages out', { timeout: 20000 });
    const xs = await page.evaluate(async () => {
      const { PDFDocument } = await import('/vendor/pdf-lib/pdf-lib.esm.min.js');
      const bytes = await (await fetch(document.querySelector('#sp-result a.dl').href)).arrayBuffer();
      return (await PDFDocument.load(bytes)).getPages().slice(1, 3).map(p => Math.round(p.getCropBox().x));
    });
    expect(xs[0]).toBeGreaterThan(0);          // right half first
    expect(xs[1]).toBe(0);
  });

  test('a second PDF dropped mid-load replaces the first instead of hanging', async ({ page }) => {
    // Two loads used to share one pdf.js document, and one would clean up a page the other was
    // still drawing, which froze the tool on "1 of N" for good.
    await page.goto(BASE + '#split');
    await dropTwoUp(page, 'first.pdf', 0.5);
    await dropTwoUp(page, 'second.pdf', 0.53);
    await expect(page.locator('#sp-status')).toContainText('Layered', { timeout: 20000 });
    await expect(page.locator('#sp-facts')).toContainText('second.pdf');
  });

  test('a file that is not a PDF is turned away plainly', async ({ page }) => {
    await page.goto(BASE + '#split');
    await page.locator('#sp-file').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
    await expect(page.locator('#sp-status')).toContainText('not a PDF');
  });

  /* The cleaner's fixture is a grubby scanned page drawn in the page itself: beige paper, a
     shadow down the left edge, a black border down the right one, grey text ending in full
     stops, a dark photo with lighter detail in it, three isolated specks of dust and a red
     underline. Embedded as a JPEG, like a real scan, with an invisible OCR-style text layer
     over it. `tilt` draws the whole sheet that many degrees crooked (downhill to the right). */
  async function dropGrubby(page, tilt = 0) {
    await page.evaluate(async (tilt) => {
      const W = 1700, H = 2200, c = document.createElement('canvas'); c.width = W; c.height = H;
      const x = c.getContext('2d');
      x.fillStyle = '#e6d9b2'; x.fillRect(0, 0, W, H);
      x.save();
      x.translate(W / 2, H / 2); x.rotate(tilt * Math.PI / 180); x.translate(-W / 2, -H / 2);
      x.fillStyle = '#3a3630'; x.font = '34px serif';
      for (let i = 0; i < 20; i++) x.fillText('The quick brown fox jumps over the lazy dog.', 160, 200 + i * 48);
      x.restore();
      const g = x.createLinearGradient(0, 0, 220, 0);
      g.addColorStop(0, 'rgba(60,50,30,.55)'); g.addColorStop(1, 'rgba(60,50,30,0)');
      x.fillStyle = g; x.fillRect(0, 0, 220, H);
      x.fillStyle = '#141414'; x.fillRect(1650, 0, 50, H);                       // black border
      x.fillStyle = '#4a4a4a'; x.fillRect(300, 1300, 600, 400);
      x.fillStyle = '#777777'; x.fillRect(400, 1400, 200, 150);
      x.fillStyle = '#2a2a2a'; [[1300, 1250], [1450, 1900], [200, 2050]].forEach(([a, b]) => x.fillRect(a, b, 4, 4));
      x.fillStyle = '#c8281e'; x.fillRect(1000, 1300, 400, 12);
      const jpg = new Uint8Array(await (await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9))).arrayBuffer());
      const { PDFDocument, StandardFonts, TextRenderingMode } = await import('/vendor/pdf-lib/pdf-lib.esm.min.js');
      const doc = await PDFDocument.create();
      const im = await doc.embedJpg(jpg);
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const p = doc.addPage([612, 792]);
      p.drawImage(im, { x: 0, y: 0, width: 612, height: 792 });
      p.drawText('The quick brown fox', { x: 58, y: 720, size: 12, font, renderMode: TextRenderingMode.Invisible });
      const dt = new DataTransfer();
      dt.items.add(new File([await doc.save()], 'grubby.pdf', { type: 'application/pdf' }));
      const input = document.getElementById('w-file');
      input.files = dt.files;
      input.dispatchEvent(new Event('change'));
    }, tilt);
    await expect(page.locator('#w-pagelabel')).toContainText('Page 1 of 1', { timeout: 20000 });
    // The label reads "Page 1 of 1 — drawing…" while the preview is still being drawn, so wait
    // for that to go too — measuring the preview before it existed made one test flaky.
    await expect(page.locator('#w-pagelabel')).not.toContainText('drawing', { timeout: 20000 });
    await expect(page.locator('#w-go')).toBeEnabled();
  }

  /* Run the clean, then read the result back: the page drawn at 200 dpi (the fixture's own
     scale, so every probe lands where it was drawn), its text layer, and its skew. */
  async function cleanAndRead(page, mode, straight = true) {
    await page.locator('#w-mode').selectOption(mode);
    await page.locator('#w-straight').setChecked(straight);
    await page.locator('#w-go').click();
    await expect(page.locator('#w-status')).toContainText('Done', { timeout: 60000 });
    await expect(page.locator('#w-result a.dl')).toHaveAttribute('download', 'grubby-clean.pdf');
    return page.evaluate(async () => {
      const bytes = new Uint8Array(await (await fetch(document.querySelector('#w-result a.dl').href)).arrayBuffer());
      const doc = await window.pdfTask(window.spPdfjs, bytes).promise;
      const pg = await doc.getPage(1);
      // Read the text with the stream reader, not getTextContent(): that iterates a
      // ReadableStream with for-await, which WebKit cannot do.
      const reader = pg.streamTextContent().getReader(), items = [];
      for (let r = await reader.read(); !r.done; r = await reader.read()) items.push(...r.value.items);
      const text = items.filter(t => t.str && t.str.trim());
      const c = await window.spRender(doc, 1, 1700);
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height);
      const at = (x, y) => { const i = (y * d.width + x) * 4; return [d.data[i], d.data[i + 1], d.data[i + 2]]; };
      const darkest = (x0, y0, x1, y1) => {
        let m = 255;
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) m = Math.min(m, at(x, y)[0]);
        return m;
      };
      const m = document.createElement('canvas').getContext('2d'); m.font = '34px serif';
      const stop = 160 + Math.round(m.measureText('The quick brown fox jumps over the lazy dog').width);
      let between = 0;
      for (let i = 0; i < d.data.length; i += 4) if (d.data[i] > 8 && d.data[i] < 247) between++;
      const bw = new ImageData(new Uint8ClampedArray(d.data), d.width, d.height);
      window.whitenPixels(bw, 200, { white: 0.5, ink: 0.35, mode: 'bw', speck: 1, borders: true });
      const t = text[0] && text[0].transform;
      return {
        paper: at(1400, 600)[0], shadow: at(30, 1000)[0], border: at(1680, 1000)[0],
        text: darkest(160, 170, 400, 205), stop: darkest(stop, 190, stop + 10, 202),
        specks: Math.min(...[[1302, 1252], [1452, 1902], [202, 2052]].map(([x, y]) => at(x, y)[0])),
        photo: at(350, 1350)[0], detail: at(500, 1470)[0], red: at(1200, 1306),
        greyShare: between / (d.data.length / 4),
        words: text.map(t => t.str).join(' '),
        textTurn: t ? Math.atan2(t[1], t[0]) * 180 / Math.PI : null,
        skewAfter: window.findSkew(bw),
      };
    });
  }

  test('whitens grubby paper and keeps the text, the full stops and the picture', async ({ page }) => {
    await page.goto(BASE + '#whiten');
    await dropGrubby(page);
    const r = await cleanAndRead(page, 'gray');
    expect(r.paper).toBeGreaterThanOrEqual(250);       // beige paper is now white
    expect(r.shadow).toBeGreaterThanOrEqual(240);      // and so is the shadowed edge
    expect(r.border).toBeGreaterThanOrEqual(240);      // and the black border is gone
    expect(r.text).toBeLessThan(60);                   // grey print is now black
    expect(r.stop).toBeLessThan(80);                   // full stops are not mistaken for dust
    expect(r.specks).toBeGreaterThanOrEqual(250);      // isolated specks are
    // The photo is not bleached to white, and its lighter detail stays lighter.
    expect(r.photo).toBeLessThan(90);
    expect(r.detail - r.photo).toBeGreaterThan(40);
  });

  test('the searchable text layer survives cleaning', async ({ page }) => {
    await page.goto(BASE + '#whiten');
    await dropGrubby(page);
    const r = await cleanAndRead(page, 'gray');
    expect(r.words).toContain('The quick brown fox');
    expect(Math.abs(r.textTurn)).toBeLessThan(0.01);   // a straight page is not turned
    await expect(page.locator('#w-status')).toContainText('Any searchable text is still there');
  });

  test('a crooked page is straightened, and its text layer turns with it', async ({ page }) => {
    await page.goto(BASE + '#whiten');
    await dropGrubby(page, 2);
    await expect(page.locator('#w-pagelabel')).toContainText(/straightened by (1\.9|2\.0|2\.1)°/);
    const r = await cleanAndRead(page, 'gray');
    expect(Math.abs(r.skewAfter)).toBeLessThan(0.3);   // the lines are level now
    // The page was turned anticlockwise by the skew, and the invisible words went with it —
    // they still sit over the picture of the words.
    expect(r.textTurn).toBeGreaterThan(1.7);
    expect(r.textTurn).toBeLessThan(2.3);
    expect(r.words).toContain('The quick brown fox');
    await expect(page.locator('#w-status')).toContainText('1 page straightened');
  });

  test('keep-the-colours leaves a red mark red', async ({ page }) => {
    await page.goto(BASE + '#whiten');
    await dropGrubby(page);
    const r = await cleanAndRead(page, 'color');
    expect(r.paper).toBeGreaterThanOrEqual(250);
    expect(r.red[0]).toBeGreaterThan(150);
    expect(r.red[1]).toBeLessThan(110);
  });

  test('black and white really is only black and white', async ({ page }) => {
    await page.goto(BASE + '#whiten');
    await dropGrubby(page);
    const r = await cleanAndRead(page, 'bw');
    expect(r.greyShare).toBeLessThan(0.01);            // a few edge pixels from drawing it back
    expect(r.paper).toBe(255);
    expect(r.text).toBe(0);
  });

  test('a page with no scanned picture is left alone', async ({ page }) => {
    await page.goto(BASE + '#whiten');
    await page.evaluate(async () => {
      const { PDFDocument, StandardFonts, rgb } = await import('/vendor/pdf-lib/pdf-lib.esm.min.js');
      const doc = await PDFDocument.create();
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const p = doc.addPage([612, 792]);
      p.drawRectangle({ x: 0, y: 0, width: 612, height: 792, color: rgb(0.9, 0.85, 0.7) });
      p.drawText('Typed, not scanned', { x: 72, y: 700, size: 18, font });
      const dt = new DataTransfer();
      dt.items.add(new File([await doc.save()], 'typed.pdf', { type: 'application/pdf' }));
      const input = document.getElementById('w-file');
      input.files = dt.files;
      input.dispatchEvent(new Event('change'));
    });
    await expect(page.locator('#w-pagelabel')).toContainText('no scanned picture', { timeout: 20000 });
    await page.locator('#w-go').click();
    await expect(page.locator('#w-status')).toContainText('1 page had no scanned picture', { timeout: 20000 });
  });

  test('the preview updates when a slider moves', async ({ page }) => {
    await page.goto(BASE + '#whiten');
    await dropGrubby(page);
    const sum = () => page.evaluate(() => {
      const c = document.getElementById('w-after');
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let t = 0; for (let i = 0; i < d.length; i += 4) t += d[i];
      return t;
    });
    const before = await sum();
    await page.locator('#w-ink').fill('100');
    // Polled, not a fixed wait: under a full parallel run the redraw can take longer than 400 ms.
    await expect.poll(sum, { timeout: 10000 }).toBeLessThan(before);   // darker text, less light
  });

  /* The leveller's fixtures are tones written as WAV by the page's own encoder, so their
     loudness is known exactly: a stereo sine of amplitude A measures 20·log10(A) LUFS. */
  async function dropSounds(page, specs) {
    // Playwright's WebKit on Windows is built without Web Audio at all (real Safari has it), so
    // there is nothing for the leveller to run on there.
    test.skip(await page.evaluate(() => typeof OfflineAudioContext === 'undefined'),
      'this WebKit build has no Web Audio');
    await page.evaluate((specs) => {
      const files = specs.map(sp => {
        if (sp.text) return new File([sp.text], sp.name, { type: 'text/plain' });
        const n = Math.round(sp.rate * (sp.secs + (sp.padS || 0) + (sp.padE || 0)));
        const a = Math.round(sp.rate * (sp.padS || 0)), b = Math.round(sp.rate * ((sp.padS || 0) + sp.secs));
        const chs = [0, 1].map(() => {
          const x = new Float32Array(n);
          for (let i = a; i < b; i++) x[i] = sp.amp * Math.sin(2 * Math.PI * (sp.freq || 440) * i / sp.rate);
          if (sp.bang) for (let i = a + sp.rate; i < a + sp.rate + 40; i++) x[i] = i % 2 ? 0.94 : -0.94;
          return x;
        });
        return new File([window.encodeWav(chs, sp.rate, 16, false)], sp.name, { type: 'audio/wav' });
      });
      const dt = new DataTransfer();
      files.forEach(f => dt.items.add(f));
      const input = document.getElementById('n-file');
      input.files = dt.files;
      input.dispatchEvent(new Event('change'));
    }, specs);
    await expect(page.locator('#n-status')).toContainText('Measured', { timeout: 20000 });
  }

  /* Save, then open every file that came out and measure it. Several files come back as a zip
     (in Chromium the main button would open a folder picker, so the zip button is used). */
  async function saveAndMeasure(page) {
    const zipBtn = page.locator('#n-zip');
    await (await zipBtn.isVisible() ? zipBtn : page.locator('#n-go')).click();
    await expect(page.locator('#n-status')).toContainText('Done', { timeout: 30000 });
    return page.evaluate(async () => {
      const href = document.querySelector('#n-result a.dl').href;
      const bytes = new Uint8Array(await (await fetch(href)).arrayBuffer());
      const files = bytes[0] === 0x50 && bytes[1] === 0x4b
        ? window.fflate.unzipSync(bytes)
        : { [document.querySelector('#n-result a.dl').download]: bytes };
      const out = {};
      for (const [name, b] of Object.entries(files)) {
        const d = await window.nDecode(new File([b], name)), chs = window.nChannels(d.buf);
        out[name] = { rate: d.buf.sampleRate, secs: d.buf.duration, lufs: window.loudness(chs, d.rate),
                      peak: window.dB(window.peakOf(chs)), samples: Array.from(chs[0].slice(0, 20000)) };
      }
      return out;
    });
  }

  test('the loudness meter reads the broadcast calibration tones correctly', async ({ page }) => {
    await page.goto(BASE + '#level');
    const r = await page.evaluate(() => {
      const sine = (amp, chans) => chans.map(on => {
        const x = new Float32Array(48000 * 5);
        if (on) for (let i = 0; i < x.length; i++) x[i] = amp * Math.sin(2 * Math.PI * 997 * i / 48000);
        return x;
      });
      return { stereo: window.loudness(sine(0.1, [1, 1]), 48000), oneSide: window.loudness(sine(1, [1, 0]), 48000) };
    });
    expect(Math.abs(r.stereo - -20)).toBeLessThan(0.05);      // -20 dBFS sine on both sides
    expect(Math.abs(r.oneSide - -3.01)).toBeLessThan(0.05);   // BS.1770's own reference figure
  });

  test('levels a batch to one loudness, at each file\'s own sample rate', async ({ page }) => {
    await page.goto(BASE + '#level');
    await dropSounds(page, [
      { name: 'quiet.wav', rate: 44100, secs: 3, amp: 0.025, padS: 1, padE: 1 },
      { name: 'loud.wav', rate: 48000, secs: 3, amp: 0.35 },
      { name: 'notes.txt', text: 'not a sound' },
    ]);
    await expect(page.locator('#n-status')).toContainText('1 other file was not sound');
    await expect(page.locator('#n-list tr')).toHaveCount(2);
    const out = await saveAndMeasure(page);
    expect(Math.abs(out['quiet.wav'].lufs - -18)).toBeLessThan(0.1);
    expect(Math.abs(out['loud.wav'].lufs - -18)).toBeLessThan(0.1);
    expect(out['quiet.wav'].rate).toBe(44100);                // not quietly resampled to 48 kHz
    expect(out['quiet.wav'].secs).toBeCloseTo(5, 2);          // silence left alone unless asked
    expect(out['quiet.wav'].peak).toBeLessThanOrEqual(-1);
  });

  test('a quiet file with one loud bang is not distorted, and the limiter is opt-in', async ({ page }) => {
    await page.goto(BASE + '#level');
    await dropSounds(page, [{ name: 'bang.wav', rate: 48000, secs: 4, amp: 0.018, bang: true }]);
    // Off by default: turning it up would push the bang past the top, so it is left alone and
    // the table says why.
    await expect(page.locator('#n-limit')).not.toBeChecked();
    await expect(page.locator('#n-list')).toContainText('Left at the same level');
    await expect(page.locator('#n-list')).toContainText('Hold down loud moments');
    await page.locator('#n-limit').check();
    await expect(page.locator('#n-list')).toContainText(/Turn up \d/);
    const out = await saveAndMeasure(page);
    const f = out['bang.wav'];
    expect(f.peak).toBeLessThanOrEqual(-0.99);                // held at the ceiling, not clipped
    await expect(page.locator('#n-list')).toContainText('Saved: now');
  });

  test('silence is trimmed only when asked, and the level is measured after the trim', async ({ page }) => {
    await page.goto(BASE + '#level');
    await dropSounds(page, [{ name: 'quiet.wav', rate: 44100, secs: 3, amp: 0.025, padS: 1, padE: 1 }]);
    await page.locator('#n-trimstart').check();
    await page.locator('#n-trimend').check();
    await expect(page.locator('#n-list')).toContainText('of silence off the start');
    const out = await saveAndMeasure(page);
    const f = out['quiet.wav'];
    expect(f.secs).toBeGreaterThan(3.05);                     // 10 ms kept before, 100 ms after
    expect(f.secs).toBeLessThan(3.15);
    expect(Math.abs(f.lufs - -18)).toBeLessThan(0.1);
  });

  test('a file already at the level comes back sample for sample', async ({ page }) => {
    await page.goto(BASE + '#level');
    // 1 kHz, where the loudness weighting is neutral: amplitude 0.126 reads -18.0 LUFS.
    await dropSounds(page, [{ name: 'fine.wav', rate: 48000, secs: 2, amp: 0.126, freq: 997 }]);
    await expect(page.locator('#n-list')).toContainText('Already there');
    const before = await page.evaluate(async () => {
      const d = await window.nDecode(window.nItems[0].file);
      return Array.from(d.buf.getChannelData(0).slice(0, 20000));
    });
    const out = await saveAndMeasure(page);
    expect(out['fine.wav'].samples).toEqual(before);
  });

  test('one file opens a before-and-after preview', async ({ page }) => {
    await page.goto(BASE + '#level');
    await dropSounds(page, [{ name: 'quiet.wav', rate: 44100, secs: 3, amp: 0.025, padS: 1 }]);
    await expect(page.locator('#n-preview')).toBeVisible();
    await expect(page.locator('#n-play-a')).toBeVisible();
    await expect(page.locator('#n-play-b')).toBeVisible();
    const ink = (id) => page.evaluate((id) => {
      const c = document.getElementById(id), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 1] > 150 && d[i + 2] < 80) n++;
      return n;
    }, id);
    const a = await ink('n-wave-a'), b = await ink('n-wave-b');
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a * 2);                         // turned up 15 dB: a much taller wave
  });

  test('the limiter explainer opens on focus as well as hover, and never ticks the box', async ({ page }) => {
    // A tablet has no hover, so the explainer has to open for a tap or the Tab key too. It sits
    // outside the checkbox's label, so opening it must not switch the limiter on.
    await page.goto(BASE + '#level');
    await page.evaluate(() => { document.getElementById('n-panel').hidden = false; });
    const tip = page.locator('#n-limit-tip');
    await expect(tip).toBeHidden();
    await page.locator('.tip > button').focus();
    await expect(tip).toBeVisible();
    await expect(tip).toContainText('limiter');
    await expect(tip).toContainText('compressor');
    await page.locator('.tip > button').click();
    await expect(page.locator('#n-limit')).not.toBeChecked();
  });

  test('a deep link opens the tool directly', async ({ page }) => {
    await page.goto(BASE + '#downsize');
    await expect(page.locator('#view-downsize')).toBeVisible();
    await expect(page.locator('#up-btn')).toBeVisible();
  });

  test('opened from disk, it blames the right thing', async ({ page, browserName }) => {
    // Opening tools.html by double-clicking it means the engine fetch fails with a bare
    // "Failed to fetch", which reads as "your video is broken". It is not: every video fails
    // that way. The page has to say so itself rather than send someone hunting through codecs.
    test.skip(browserName !== 'chromium', 'one browser is enough to prove the message');
    const url = 'file:///' + path.resolve('tools.html').replace(/\\/g, '/') + '#trim';
    await page.goto(url);
    await expect(page.locator('#t-warn')).toContainText('open straight from a file on disk');
    await expect(page.locator('#t-warn')).toContainText('Nothing is wrong with your video');
  });

  test('trims a video without re-encoding it', async ({ page, browserName }) => {
    // Chromium only, and not a cop-out: this test has to MAKE its video, and MediaRecorder
    // writing WebM is only dependable in Chromium. The trimmer itself is not Chrome-only.
    test.skip(browserName !== 'chromium', 'needs MediaRecorder to build its own fixture');
    test.setTimeout(180_000);
    page.on('console', m => { if (m.type() === 'error') console.log('PAGE ERROR:', m.text()); });

    await page.goto(BASE + '#trim');

    // Build a 6-second clip in the page and hand it to the file input.
    await page.evaluate(async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 320; canvas.height = 240;
      const ctx = canvas.getContext('2d');
      const stream = canvas.captureStream(30);
      const rec = new MediaRecorder(stream, { mimeType: 'video/webm' });
      const chunks = [];
      rec.ondataavailable = e => e.data.size && chunks.push(e.data);
      const stopped = new Promise(r => { rec.onstop = r; });
      rec.start();
      const start = performance.now();
      await new Promise(done => {
        (function frame() {
          const t = performance.now() - start;
          ctx.fillStyle = `hsl(${(t / 20) % 360} 70% 45%)`;
          ctx.fillRect(0, 0, 320, 240);
          ctx.fillStyle = '#fff'; ctx.font = '40px sans-serif';
          ctx.fillText((t / 1000).toFixed(1) + 's', 20, 130);
          if (t < 6000) requestAnimationFrame(frame); else done();
        })();
      });
      rec.stop();
      await stopped;
      const file = new File(chunks, 'rehearsal-clip.webm', { type: 'video/webm' });
      const dt = new DataTransfer();
      dt.items.add(file);
      const input = document.getElementById('t-file');
      input.files = dt.files;
      input.dispatchEvent(new Event('change'));
    });

    // The clip loads and the whole thing is selected to start with.
    await expect(page.locator('#t-panel')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('#t-times')).toContainText('0:00.0 →');

    // Mark in and out by dragging the handles to roughly 25% and 75% of the bar.
    await page.locator('#t-track').scrollIntoViewIfNeeded();   // it sits below the fold
    const box = await page.locator('#t-track').boundingBox();
    await page.mouse.move(box.x + box.width * 0.25, box.y + box.height / 2);
    await page.mouse.down(); await page.mouse.up();
    await page.mouse.move(box.x + box.width * 0.75, box.y + box.height / 2);
    await page.mouse.down(); await page.mouse.up();

    // Assert the real numbers: an earlier version of this test only checked the text had
    // changed, which let a bug through where the marks never registered at all.
    const [markedIn, markedOut] = await page.evaluate(() => [window.tBarCtl.getIn(), window.tBarCtl.getOut()]);
    expect(markedIn).toBeGreaterThan(1.2);
    expect(markedIn).toBeLessThan(1.8);
    expect(markedOut).toBeGreaterThan(4.2);
    expect(markedOut).toBeLessThan(4.8);

    // Trim. This downloads the 32 MB engine from the local server on the way through.
    await page.locator('#t-go').click();
    await expect(page.locator('#t-result a.dl')).toBeVisible({ timeout: 150_000 });

    await expect(page.locator('#t-status')).toContainText('Done');
    await expect(page.locator('#t-status')).toContainText('re-encoded');

    // The download link must sit in the results area, clear of the timeline — and clicking it
    // must not move the trim. It once landed inside the end handle, where pressing it dragged
    // the end point instead of downloading anything.
    const link = page.locator('#t-result a.dl');
    const [linkBox, trackBox] = [await link.boundingBox(), await page.locator('#t-track').boundingBox()];
    expect(linkBox.y).toBeGreaterThan(trackBox.y + trackBox.height);
    expect(linkBox.width).toBeGreaterThan(120);          // not squeezed into a 16px handle

    const before = await page.evaluate(() => window.tBarCtl.getOut());
    await link.click({ modifiers: ['Alt'] });            // Alt-click: registers, skips the download
    expect(await page.evaluate(() => window.tBarCtl.getOut())).toBe(before);
    await expect(page.locator('#t-result a.dl')).toHaveAttribute('download', /rehearsal-clip-trimmed\.webm/);

    // The result is a real, shorter, playable video — not an empty file.
    const result = await page.evaluate(async () => {
      const href = document.querySelector('#t-result a.dl').href;
      const blob = await (await fetch(href)).blob();
      const v = document.createElement('video');
      v.src = URL.createObjectURL(blob);
      const dur = await new Promise(r => {
        v.onloadedmetadata = () => r(v.duration);
        v.onerror = () => r(-1);
        setTimeout(() => r(-2), 8000);
      });
      return { size: blob.size, duration: dur };
    });
    expect(result.size).toBeGreaterThan(1000);
    // ~3s was marked out of a 6s clip, but the result is legitimately longer than that: a
    // stream copy can only start on a keyframe, and MediaRecorder writes very few of them —
    // in this fixture, one at the start — so the beginning snaps back. What is guaranteed is
    // that the tail was cut, and that the page OWNS UP to the difference rather than hiding it.
    expect(result.duration).toBeGreaterThan(2);
    expect(result.duration).toBeLessThan(5.5);
    await expect(page.locator('#t-status')).toContainText('the nearest one');
  });
});
