import { test, expect } from './fixtures.js';

// Issue #122's explicit testing requirement: extend the rules-emulator test
// coverage `roadmapSharingRules.test.js` established with cases proving each
// new server-side cap (firebase/database.rules.json) actually rejects an
// oversized write and still accepts a compliant one — a `.validate` rule
// that fails to parse silently falls back to the emulator's permissive
// default (see that file's own note on this), so these assert against a
// real emulator instance, not a mocked one.
const FIREBASE_CONFIGURED = !!process.env.FIREBASE_CONFIGURED;
const DATABASE_SDK_URL = 'https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js';

async function signInGuestAndGetUid(page) {
  await page.goto('/#/signin');
  await page.click('text=Continue as guest');
  await expect(page).toHaveURL(/#\/(onboarding|app)/, { timeout: 10_000 });
  return page.evaluate(() => new Promise(async resolve => {
    const { authApi } = await import('/src/services/firebase.js');
    const unsubscribe = authApi.onChange(user => {
      if (user) {
        unsubscribe();
        resolve(user.uid);
      }
    });
  }));
}

// Writes a full { version, items } roadmap payload directly via the
// database SDK, bypassing roadmapStore.js entirely — this is deliberately
// simulating a raw REST/SDK write against a user's own uid-scoped path, the
// exact bypass-the-app-entirely attack issue #122 is about closing.
async function writeRoadmap(page, uid, items) {
  return page.evaluate(async ({ uid, items, sdkUrl }) => {
    const { database } = await import('/src/services/firebase.js');
    const { ref, set } = await import(sdkUrl);
    try {
      await set(ref(database, `users/${uid}/roadmaps/java-backend`), { version: 1, items });
      return { ok: true };
    } catch (e) {
      return { ok: false, code: e.code || e.message };
    }
  }, { uid, items, sdkUrl: DATABASE_SDK_URL });
}

async function writeAtPath(page, path, value) {
  return page.evaluate(async ({ path, value, sdkUrl }) => {
    const { database } = await import('/src/services/firebase.js');
    const { ref, set } = await import(sdkUrl);
    try {
      await set(ref(database, path), value);
      return { ok: true };
    } catch (e) {
      return { ok: false, code: e.code || e.message };
    }
  }, { path, value, sdkUrl: DATABASE_SDK_URL });
}

test.describe('Server-side data-cap Firebase rules (issue #122)', () => {
  test('roadmap items reject an oversized title, resource label/url, and notes; accept a compliant item', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    const uid = await signInGuestAndGetUid(page);

    const oversizedTitle = await writeRoadmap(page, uid, { item1: { title: 'a'.repeat(201) } });
    expect(oversizedTitle.ok, 'a title over 200 chars should be rejected').toBe(false);

    const oversizedLabel = await writeRoadmap(page, uid, {
      item1: { title: 'ok', resources: { 0: { label: 'a'.repeat(121), url: 'https://x.com' } } }
    });
    expect(oversizedLabel.ok, 'a resource label over 120 chars should be rejected').toBe(false);

    const oversizedUrl = await writeRoadmap(page, uid, {
      item1: { title: 'ok', resources: { 0: { label: 'doc', url: `https://x.com/${'a'.repeat(2048)}` } } }
    });
    expect(oversizedUrl.ok, 'a resource url over 2048 chars should be rejected').toBe(false);

    const oversizedNotes = await writeRoadmap(page, uid, { item1: { title: 'ok', notes: 'a'.repeat(5001) } });
    expect(oversizedNotes.ok, 'notes over 5000 chars should be rejected').toBe(false);

    const compliant = await writeRoadmap(page, uid, {
      item1: { title: 'Learn Java', notes: 'short note', resources: { 0: { label: 'Docs', url: 'https://x.com' } } }
    });
    expect(compliant.ok, 'an item within every cap should still succeed').toBe(true);
  });

  test('meta.customRoadmaps rejects an oversized title/description and an out-of-range index; accepts a compliant entry', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    const uid = await signInGuestAndGetUid(page);

    const oversizedTitle = await writeAtPath(page, `users/${uid}/meta/customRoadmaps/0`, {
      id: 'croadmap-1', title: 'a'.repeat(201), createdAt: 1
    });
    expect(oversizedTitle.ok, 'a custom roadmap title over 200 chars should be rejected').toBe(false);

    const oversizedDescription = await writeAtPath(page, `users/${uid}/meta/customRoadmaps/0`, {
      id: 'croadmap-1', title: 'ok', description: 'a'.repeat(1001), createdAt: 1
    });
    expect(oversizedDescription.ok, 'a custom roadmap description over 1000 chars should be rejected').toBe(false);

    const outOfRangeIndex = await writeAtPath(page, `users/${uid}/meta/customRoadmaps/1000`, {
      id: 'croadmap-2', title: 'ok', createdAt: 1
    });
    expect(outOfRangeIndex.ok, 'a customRoadmaps index outside the allowed pattern should be rejected').toBe(false);

    const compliant = await writeAtPath(page, `users/${uid}/meta/customRoadmaps/0`, {
      id: 'croadmap-1', title: 'My roadmap', description: 'short', createdAt: 1
    });
    expect(compliant.ok, 'a compliant custom roadmap entry should still succeed').toBe(true);
  });

  test('activityLog rejects a non-date key and an out-of-range value; accepts a compliant entry', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    const uid = await signInGuestAndGetUid(page);

    const badKey = await writeAtPath(page, `users/${uid}/activityLog/not-a-date`, 5);
    expect(badKey.ok, 'a non-YYYY-MM-DD activityLog key should be rejected').toBe(false);

    const badValue = await writeAtPath(page, `users/${uid}/activityLog/2026-07-16`, 99999);
    expect(badValue.ok, 'an activityLog value outside the allowed range should be rejected').toBe(false);

    const compliant = await writeAtPath(page, `users/${uid}/activityLog/2026-07-16`, 5);
    expect(compliant.ok, 'a compliant activityLog entry should still succeed').toBe(true);
  });

  test('top-level reports/{reportId}.screenshotB64 rejects an oversized value; accepts a compliant one', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    const uid = await signInGuestAndGetUid(page);

    const oversized = await writeAtPath(page, `reports/rules-test-bad-${Date.now()}`, {
      type: 'bug', title: 't', submittedAt: Date.now(), userId: uid, screenshotB64: 'a'.repeat(700001)
    });
    expect(oversized.ok, 'a screenshotB64 over the size cap should be rejected').toBe(false);

    const compliant = await writeAtPath(page, `reports/rules-test-ok-${Date.now()}`, {
      type: 'bug', title: 't', submittedAt: Date.now(), userId: uid, screenshotB64: 'a'.repeat(100)
    });
    expect(compliant.ok, 'a compliant screenshotB64 should still succeed').toBe(true);
  });

  // Issue #188 — sharedRoadmaps/{shareId} is the one publicly-readable path
  // in the app; before this its `items` field had no shape/size validation
  // at all. These cases mirror shareSchema.js's toShareItem() field set
  // (title/phase/section/priority/done/resources) — see
  // roadmapSharingRules.test.js for the ownership/read/revoke rule coverage
  // this file deliberately doesn't duplicate.
  test('sharedRoadmaps/{shareId}/items rejects an oversized/malformed item; accepts a compliant one', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    const uid = await signInGuestAndGetUid(page);
    const baseShare = {
      schemaVersion: 1, ownerUid: uid, templateId: 'java-backend', title: 'Rules test roadmap', publishedAt: Date.now()
    };

    const missingItems = await writeAtPath(page, `sharedRoadmaps/rules-test-missing-items-${Date.now()}`, baseShare);
    expect(missingItems.ok, 'a share published with no items field at all should be rejected').toBe(false);

    const oversizedTitle = await writeAtPath(page, `sharedRoadmaps/rules-test-title-${Date.now()}`, {
      ...baseShare,
      items: { 'item-1': { title: 'a'.repeat(201), phase: 'Phase 1', section: 'Section 1', priority: 'P1', done: false } }
    });
    expect(oversizedTitle.ok, 'a shared item title over 200 chars should be rejected').toBe(false);

    const missingRequiredField = await writeAtPath(page, `sharedRoadmaps/rules-test-shape-${Date.now()}`, {
      ...baseShare,
      items: { 'item-1': { title: 'Topic 1', phase: 'Phase 1', section: 'Section 1' } }
    });
    expect(missingRequiredField.ok, 'a shared item missing priority/done should be rejected').toBe(false);

    const extraField = await writeAtPath(page, `sharedRoadmaps/rules-test-extra-${Date.now()}`, {
      ...baseShare,
      items: { 'item-1': { title: 'Topic 1', phase: 'Phase 1', section: 'Section 1', priority: 'P1', done: false, notes: 'should not be here' } }
    });
    expect(extraField.ok, 'a shared item carrying a field outside the narrow public schema (e.g. notes) should be rejected').toBe(false);

    const oversizedResourceUrl = await writeAtPath(page, `sharedRoadmaps/rules-test-url-${Date.now()}`, {
      ...baseShare,
      items: {
        'item-1': {
          title: 'Topic 1', phase: 'Phase 1', section: 'Section 1', priority: 'P1', done: false,
          resources: { 0: { label: 'Docs', url: `https://x.com/${'a'.repeat(2048)}` } }
        }
      }
    });
    expect(oversizedResourceUrl.ok, 'a shared item resource url over 2048 chars should be rejected').toBe(false);

    const compliant = await writeAtPath(page, `sharedRoadmaps/rules-test-ok-${Date.now()}`, {
      ...baseShare,
      items: {
        'item-1': {
          title: 'Topic 1', phase: 'Phase 1', section: 'Section 1', priority: 'P1', done: false,
          resources: { 0: { label: 'Docs', url: 'https://x.com' } }
        }
      }
    });
    expect(compliant.ok, 'a compliant shared item within every cap should still succeed').toBe(true);
  });
});
