import { test, expect } from './fixtures.js';

// Requires the Firebase Auth/Database emulator (issue #37) for anything past sign-in —
// dashboard-only checks (`.check-actions`, `.check-item`) are skipped without it.
const FIREBASE_CONFIGURED = !!process.env.FIREBASE_CONFIGURED;

test.describe('cross-device / responsive consistency (issue #36)', () => {
  test('viewport meta enables safe-area insets via viewport-fit=cover', async ({ page }) => {
    await page.goto('/#/signin');
    const viewportMeta = page.locator('meta[name="viewport"]');
    await expect(viewportMeta).toHaveAttribute('content', /viewport-fit=cover/);
  });

  test.describe('touch targets meet the ~44px minimum on touch-capable viewports', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

    test('the theme toggle (.btn-icon) is at least 44x44px', async ({ page }) => {
      await page.goto('/#/signin');
      const box = await page.locator('.theme-toggle').boundingBox();
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    });
  });

  test.describe('touch targets are unchanged on non-touch desktop viewports', () => {
    test.use({ viewport: { width: 1440, height: 900 }, hasTouch: false });

    test('the theme toggle (.btn-icon) keeps its compact 36x36px size', async ({ page }) => {
      await page.goto('/#/signin');
      const box = await page.locator('.theme-toggle').boundingBox();
      expect(box.width).toBeLessThan(44);
      expect(box.height).toBeLessThan(44);
    });
  });

  test.describe('dashboard: hover/touch reveal and touch target sizing', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

    test('.check-actions is visible without hovering on a touch-capable device, and checklist rows meet the 44px minimum', async ({ page }) => {
      test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
      await page.goto('/#/signin');
      await page.click('text=Continue as guest');
      await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
      await page.locator('.template-card', { hasText: 'Java Backend Engineer' }).click();
      // pickTemplate() awaits a real switchRoadmap() round trip against the
      // Firebase emulator (seed + first flush + first listener attach) before
      // navigating — under concurrent Playwright workers hitting the same
      // emulator, that round trip (not just rendering) can take longer than
      // a plain render-only wait should need, so this waits on the URL
      // transition first and gives the network-bound step its own timeout.
      await expect(page).toHaveURL(/#\/app/, { timeout: 20_000 });
      await expect(page.locator('.dashboard')).toBeVisible({ timeout: 10_000 });

      const firstRow = page.locator('.check-item').nth(0);
      const opacity = await firstRow.locator('.check-actions').evaluate((el) => getComputedStyle(el).opacity);
      expect(opacity).toBe('1');

      const rowBox = await firstRow.boundingBox();
      expect(rowBox.height).toBeGreaterThanOrEqual(44);
    });
  });

  test.describe('sidebar icon-rail footer (issue #102)', () => {
    async function signInAndReachApp(page) {
      await page.goto('/#/signin');
      await page.click('text=Continue as guest');
      await expect(page).toHaveURL(/#\/onboarding/, { timeout: 10_000 });
      await page.locator('.template-card', { hasText: 'Java Backend Engineer' }).click();
      await expect(page.locator('.app-sidebar')).toBeVisible({ timeout: 10_000 });
    }

    function boxesOverlap(a, b) {
      return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
    }

    // The dev server is a single-threaded `python3 -m http.server` — under
    // concurrent Playwright workers it can be slow to serve app.css, so a
    // bounding-box read can race ahead of the stylesheet actually applying.
    // Wait for the icon-rail's column layout to be computed before asserting
    // on geometry, not just for the elements to exist in the DOM.
    async function waitForRailFooterLayout(page) {
      await page.waitForFunction(() => {
        const footer = document.querySelector('.app-sidebar-footer');
        return footer && getComputedStyle(footer).flexDirection === 'column';
      }, { timeout: 10_000 });
    }

    test.describe('tablet-width automatic icon rail (640-1023px)', () => {
      test.use({ viewport: { width: 800, height: 900 } });

      test('avatar identity and sign-out button do not overlap', async ({ page }) => {
        test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
        await signInAndReachApp(page);
        await waitForRailFooterLayout(page);

        const identityBox = await page.locator('.app-sidebar-identity').boundingBox();
        const signoutBox = await page.locator('.app-sidebar-signout').boundingBox();
        expect(boxesOverlap(identityBox, signoutBox)).toBe(false);
      });

      test('hamburger opens a full drawer with nav labels and the sign-out control reachable', async ({ page }) => {
        test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
        await signInAndReachApp(page);

        await expect(page.locator('.app-topbar-hamburger')).toBeVisible();
        await page.locator('.app-topbar-hamburger').click();
        await expect(page.locator('.app-sidebar')).toHaveClass(/mobile-open/);
        await expect(page.locator('.nav-item-label').first()).toBeVisible();
        await expect(page.locator('.app-sidebar-signout')).toBeVisible();
      });
    });

    test.describe('desktop manual-collapse icon rail (>=1024px)', () => {
      test.use({ viewport: { width: 1440, height: 900 } });

      test('avatar identity and sign-out button do not overlap once collapsed', async ({ page }) => {
        test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
        await signInAndReachApp(page);

        await page.locator('.app-sidebar-collapse-btn').click();
        await expect(page.locator('.app-sidebar')).toHaveClass(/collapsed/);
        await waitForRailFooterLayout(page);

        const identityBox = await page.locator('.app-sidebar-identity').boundingBox();
        const signoutBox = await page.locator('.app-sidebar-signout').boundingBox();
        expect(boxesOverlap(identityBox, signoutBox)).toBe(false);
      });

      test('the account dropdown ("Delete account") is fully visible, not clipped by the sidebar', async ({ page }) => {
        test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
        // The delete-account dropdown only renders for a real (non-anonymous)
        // account (sidebar.js), so this needs an actual sign-up rather than guest.
        await page.goto('/#/signup');
        await page.fill('input[type="email"]', `test-${Date.now()}@example.com`);
        await page.fill('input[placeholder="Minimum 6 characters"]', 'Password123!');
        await page.fill('input[placeholder="Repeat your password"]', 'Password123!');
        await page.click('button:has-text("Create account")');
        await expect(page).toHaveURL(/#\/onboarding/, { timeout: 15_000 });
        await page.locator('.template-card', { hasText: 'Java Backend Engineer' }).click();
        await expect(page.locator('.app-sidebar')).toBeVisible({ timeout: 10_000 });

        await page.locator('.app-sidebar-collapse-btn').click();
        await expect(page.locator('.app-sidebar')).toHaveClass(/collapsed/);
        await page.locator('.app-sidebar-identity').click();

        const menu = page.locator('.dropdown-menu.open, .dropdown.open .dropdown-menu');
        await expect(menu).toBeVisible();
        await expect(menu).toContainText('Delete account');
        // The dev server is a single-threaded `python3 -m http.server` (same
        // caveat as waitForRailFooterLayout above) — under concurrent workers
        // it can be slow enough serving app.css that `.dropdown-menu`'s
        // `position: fixed` rule hasn't applied yet when the box is read,
        // making it fall back to default static block layout (observed as a
        // wildly oversized boundingBox, e.g. height: 6081). Wait for the real
        // CSS to be in effect before trusting the geometry.
        await page.waitForFunction(() => {
          const el = document.querySelector('.dropdown-menu.open');
          return el && getComputedStyle(el).position === 'fixed';
        }, { timeout: 10_000 });
        const menuBox = await menu.boundingBox();
        const viewport = page.viewportSize();
        // Issue #102 follow-up — the menu used to be clipped to the sidebar's
        // own ~64px-wide scroll box (an ancestor `overflow-y: auto` silently
        // clips overflow-x too) and separately could render thousands of
        // pixels off-screen if any ancestor had a lingering non-`none`
        // `transform` (a stray fixed-position containing block). Assert the
        // whole menu box is on-screen, not just that the element exists.
        expect(menuBox.x).toBeGreaterThanOrEqual(0);
        expect(menuBox.y).toBeGreaterThanOrEqual(0);
        expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(viewport.width);
        expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(viewport.height);
      });
    });
  });
});
