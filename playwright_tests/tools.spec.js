// @ts-check
import { test, expect } from '@playwright/test';

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
    await expect(page.locator('.tool-btn')).toHaveCount(3);
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

  test('a deep link opens the tool directly', async ({ page }) => {
    await page.goto(BASE + '#downsize');
    await expect(page.locator('#view-downsize')).toBeVisible();
    await expect(page.locator('#up-btn')).toBeVisible();
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
    await expect(page.locator('#t-out a.dl')).toBeVisible({ timeout: 150_000 });

    await expect(page.locator('#t-status')).toContainText('Done');
    await expect(page.locator('#t-status')).toContainText('re-encoded');
    await expect(page.locator('#t-out a.dl')).toHaveAttribute('download', /rehearsal-clip-trimmed\.webm/);

    // The result is a real, shorter, playable video — not an empty file.
    const result = await page.evaluate(async () => {
      const href = document.querySelector('#t-out a.dl').href;
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
