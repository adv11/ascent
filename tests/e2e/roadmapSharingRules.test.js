import { test, expect } from './fixtures.js';

// Issue #131's explicit testing requirement: "firebase/database.rules.json
// changes need their own test coverage using the Firebase Emulator... an
// unauthenticated read of an existing shareId succeeds; a write attempt to
// an existing shareId by any user (including the original publisher) fails;
// a write attempt to sharedRoadmaps/{shareId}/ownerUid by a non-owner
// fails." This file exercises the deployed rules directly (via the app's
// already-emulator-connected `database` singleton, reached through
// page.evaluate) rather than driving the publish UI — roadmapSharing.test.js
// covers the real publish/view/revoke user flow; this one is a rules-only
// check, closer in spirit to a `@firebase/rules-unit-testing` suite (which
// this repo doesn't otherwise depend on).
const FIREBASE_CONFIGURED = !!process.env.FIREBASE_CONFIGURED;
const DATABASE_SDK_URL = 'https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js';

// Signs a fresh page in as an anonymous guest and resolves once Firebase
// Auth has a real uid — `authApi.onChange` is the same subscription
// main.js itself uses.
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

async function createShare(page, { shareId, ownerUid }) {
  return page.evaluate(async ({ shareId, ownerUid, sdkUrl }) => {
    const { database } = await import('/src/services/firebase.js');
    const { ref, set } = await import(sdkUrl);
    try {
      // Non-empty phases/items deliberately — Realtime Database silently
      // drops an empty array/object on write (there's no way to persist an
      // "empty container" as a real child), so a validate rule that lists
      // 'phases'/'items' in hasChildren([...]) would wrongly reject even a
      // legitimate create whose test payload used [] / {}. See
      // .claude/rules/roadmap-store.md's "Roadmap sharing" section.
      await set(ref(database, `sharedRoadmaps/${shareId}`), {
        schemaVersion: 1,
        ownerUid,
        templateId: 'java-backend',
        title: 'Rules test roadmap',
        phases: [{ title: 'Phase 1', sections: [{ title: 'Section 1' }] }],
        items: { 'item-1': { title: 'Topic 1', phase: 'Phase 1', section: 'Section 1', priority: 'P1', done: false, resources: [] } },
        publishedAt: Date.now()
      });
      return { ok: true };
    } catch (e) {
      return { ok: false, code: e.code || e.message };
    }
  }, { shareId, ownerUid, sdkUrl: DATABASE_SDK_URL });
}

async function readShareExists(page, shareId) {
  return page.evaluate(async ({ shareId, sdkUrl }) => {
    const { database } = await import('/src/services/firebase.js');
    const { ref, get } = await import(sdkUrl);
    try {
      const snap = await get(ref(database, `sharedRoadmaps/${shareId}`));
      return { ok: true, exists: snap.exists() };
    } catch (e) {
      return { ok: false, code: e.code || e.message };
    }
  }, { shareId, sdkUrl: DATABASE_SDK_URL });
}

async function updateShareTitle(page, shareId, title) {
  return page.evaluate(async ({ shareId, title, sdkUrl }) => {
    const { database } = await import('/src/services/firebase.js');
    const { ref, update } = await import(sdkUrl);
    try {
      await update(ref(database, `sharedRoadmaps/${shareId}`), { title });
      return { ok: true };
    } catch (e) {
      return { ok: false, code: e.code || e.message };
    }
  }, { shareId, title, sdkUrl: DATABASE_SDK_URL });
}

async function writeOwnerUid(page, shareId, uid) {
  return page.evaluate(async ({ shareId, uid, sdkUrl }) => {
    const { database } = await import('/src/services/firebase.js');
    const { ref, set } = await import(sdkUrl);
    try {
      await set(ref(database, `sharedRoadmaps/${shareId}/ownerUid`), uid);
      return { ok: true };
    } catch (e) {
      return { ok: false, code: e.code || e.message };
    }
  }, { shareId, uid, sdkUrl: DATABASE_SDK_URL });
}

async function revokeShare(page, shareId) {
  return page.evaluate(async ({ shareId, sdkUrl }) => {
    const { database } = await import('/src/services/firebase.js');
    const { ref, remove } = await import(sdkUrl);
    try {
      await remove(ref(database, `sharedRoadmaps/${shareId}`));
      return { ok: true };
    } catch (e) {
      return { ok: false, code: e.code || e.message };
    }
  }, { shareId, sdkUrl: DATABASE_SDK_URL });
}

test.describe('sharedRoadmaps/{shareId} Firebase rules (issue #131)', () => {
  test('unauthenticated read succeeds; no in-place edit by anyone; only the owner can revoke or is ever accepted as ownerUid', async ({ page, browser }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');

    const ownerUid = await signInGuestAndGetUid(page);
    const shareId = `rules-test-${Date.now()}`;

    const created = await createShare(page, { shareId, ownerUid });
    expect(created.ok, 'owner should be able to create a share tagged with their own uid').toBe(true);

    // Unauthenticated read of an existing shareId succeeds.
    const unauthContext = await browser.newContext();
    await unauthContext.addInitScript(() => { window.__USE_FIREBASE_EMULATOR__ = true; });
    const unauthPage = await unauthContext.newPage();
    await unauthPage.goto('/#/signin');
    const read = await readShareExists(unauthPage, shareId);
    expect(read.ok, 'unauthenticated read of an existing shareId should succeed').toBe(true);
    expect(read.exists).toBe(true);
    await unauthContext.close();

    // A write attempt to an existing shareId fails, even for the original
    // owner — the only allowed follow-up write is a full delete (revoke).
    const ownerOverwrite = await updateShareTitle(page, shareId, 'Changed');
    expect(ownerOverwrite.ok, 'even the owner should not be able to edit an existing snapshot in place').toBe(false);

    // A second, unrelated authenticated user cannot write to
    // sharedRoadmaps/{shareId}/ownerUid, or revoke someone else's link.
    const otherContext = await browser.newContext();
    await otherContext.addInitScript(() => { window.__USE_FIREBASE_EMULATOR__ = true; });
    const otherPage = await otherContext.newPage();
    const otherUid = await signInGuestAndGetUid(otherPage);
    expect(otherUid).not.toBe(ownerUid);

    const otherOwnerUidWrite = await writeOwnerUid(otherPage, shareId, otherUid);
    expect(otherOwnerUidWrite.ok, 'a non-owner should not be able to write sharedRoadmaps/{shareId}/ownerUid').toBe(false);

    const otherDelete = await revokeShare(otherPage, shareId);
    expect(otherDelete.ok, "a non-owner should not be able to revoke someone else's share").toBe(false);

    // A second user also cannot create a *new* share falsely tagged with
    // someone else's uid.
    const forgedShareId = `rules-test-forged-${Date.now()}`;
    const forgedCreate = await createShare(otherPage, { shareId: forgedShareId, ownerUid });
    expect(forgedCreate.ok, "a client should not be able to create a share tagged with someone else's uid").toBe(false);
    await otherContext.close();

    // The original owner can revoke (delete) their own share.
    const ownerDelete = await revokeShare(page, shareId);
    expect(ownerDelete.ok, 'the owner should be able to revoke their own share').toBe(true);

    const readAfterRevoke = await readShareExists(page, shareId);
    expect(readAfterRevoke.ok).toBe(true);
    expect(readAfterRevoke.exists, 'the share should be gone immediately after revoke').toBe(false);
  });
});
