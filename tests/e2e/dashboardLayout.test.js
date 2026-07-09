import { test, expect } from './fixtures.js';

// Regression test for issue #65: `.dashboard-content` is a CSS grid with no
// explicit `align-content`, which defaults to `stretch` and distributes any
// leftover container height into its (few) row tracks — massively
// oversizing a lone `.phase-card`/`.phase-manage-row` whenever a filter,
// search, or small custom roadmap leaves few rows on screen. This loads the
// real app.css against minimal markup (same repro used to diagnose the bug)
// so it doesn't depend on Firebase auth/emulator to exercise the real dashboard.
function dashboardMarkup(rowCount) {
  const rows = Array.from({ length: rowCount }, (_, i) => `
    <div class="phase-card">
      <button class="phase-head">
        <span class="phase-index">${String(i + 1).padStart(2, '0')}</span>
        <span class="phase-name">Phase ${i + 1}</span>
        <span class="phase-progress">0%</span>
      </button>
    </div>
  `).join('');
  // Note: the <link> href must be absolute — page.setContent() has no base
  // URL of its own, so a relative href silently fails to load the stylesheet.
  return `<!doctype html>
    <html data-theme="light">
      <head><link rel="stylesheet" href="http://localhost:4173/src/styles/app.css"></head>
      <body>
        <div class="dashboard">
          <div class="dashboard-content">${rows}</div>
        </div>
      </body>
    </html>`;
}

test.describe('dashboard-content grid stretch (issue #65)', () => {
  test('a single phase-card keeps its natural height, not the leftover viewport height', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.setContent(dashboardMarkup(1));
    const box = await page.locator('.phase-card').boundingBox();
    expect(box.height).toBeLessThan(100);
  });

  test('many phase-cards still render at their natural height (no regression)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.setContent(dashboardMarkup(8));
    const box = await page.locator('.phase-card').first().boundingBox();
    expect(box.height).toBeLessThan(100);
  });
});
