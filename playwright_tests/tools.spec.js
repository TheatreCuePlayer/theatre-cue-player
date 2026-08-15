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
  async function makeClip(page, inputId, { seconds = 4, withSound = true, name = 'clip.webm' } = {}) {
    return page.evaluate(async ({ inputId, seconds, withSound, name }) => {
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
          if (t < seconds * 1000) requestAnimationFrame(frame); else done();
        })();
      });
      rec.stop(); await stopped;
      const dt = new DataTransfer();
      dt.items.add(new File(chunks, name, { type: 'video/webm' }));
      const input = document.getElementById(inputId);
      input.files = dt.files;
      input.dispatchEvent(new Event('change'));
    }, { inputId, seconds, withSound, name });
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
    const [markedIn, markedOut] = await page.evaluate(() => [window.tIn, window.tOut]);
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

    const before = await page.evaluate(() => window.tOut);
    await link.click({ modifiers: ['Alt'] });            // Alt-click: registers, skips the download
    expect(await page.evaluate(() => window.tOut)).toBe(before);
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
