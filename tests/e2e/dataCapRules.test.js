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

  test('roadmaps/{templateId}/items rejects a missing/oversized title, a bad priority, and an out-of-range resource index; accepts a compliant item (issue #187)', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    const uid = await signInGuestAndGetUid(page);

    const emptyTitle = await writeAtPath(page, `users/${uid}/roadmaps/java-backend`, {
      version: 1, items: { item1: { title: '' } }
    });
    expect(emptyTitle.ok, 'an empty item title should be rejected').toBe(false);

    const oversizedTitle = await writeAtPath(page, `users/${uid}/roadmaps/java-backend`, {
      version: 1, items: { item1: { title: 'a'.repeat(201) } }
    });
    expect(oversizedTitle.ok, 'an item title over 200 chars should be rejected').toBe(false);

    const badPriority = await writeAtPath(page, `users/${uid}/roadmaps/java-backend`, {
      version: 1, items: { item1: { title: 'Learn Java', priority: 'P9' } }
    });
    expect(badPriority.ok, 'a priority outside P0-P3 should be rejected').toBe(false);

    const outOfRangeResourceIndex = await writeAtPath(page, `users/${uid}/roadmaps/java-backend`, {
      version: 1,
      items: { item1: { title: 'Learn Java', resources: { 100: { label: 'Docs', url: 'https://x.com' } } } }
    });
    expect(outOfRangeResourceIndex.ok, 'a resource index outside the allowed pattern should be rejected').toBe(false);

    const compliant = await writeAtPath(page, `users/${uid}/roadmaps/java-backend`, {
      version: 1,
      items: {
        item1: {
          title: 'Learn Java',
          priority: 'P1',
          done: false,
          resources: { 0: { label: 'Docs', url: 'https://x.com' } }
        }
      }
    });
    expect(compliant.ok, 'a compliant item within every cap should still succeed').toBe(true);
  });

  test('roadmaps/{templateId}/phases rejects an oversized/out-of-range entry; accepts a compliant one; roadmaps/{templateId} rejects an undeclared top-level key (issue #187)', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    const uid = await signInGuestAndGetUid(page);

    // Note: an empty `items: {}` object is silently dropped by Realtime
    // Database on write (documented in .claude/rules/roadmap-store.md's
    // sharedRoadmaps note) — there is no way to persist an "empty container"
    // as a real child node, so a payload using `items: {}` would never
    // actually satisfy the pre-existing `hasChildren(['version', 'items'])`
    // rule at the templateId level. Every payload below uses a non-empty
    // `items` object so that check isn't what's under test here.
    const baseItems = { item1: { title: 'Learn Java' } };

    const oversizedPhaseTitle = await writeAtPath(page, `users/${uid}/roadmaps/java-backend`, {
      version: 1, items: baseItems, phases: { 0: { id: 'phase-1', title: 'a'.repeat(201) } }
    });
    expect(oversizedPhaseTitle.ok, 'a phase title over 200 chars should be rejected').toBe(false);

    const outOfRangePhaseIndex = await writeAtPath(page, `users/${uid}/roadmaps/java-backend`, {
      version: 1, items: baseItems, phases: { 1000: { id: 'phase-1', title: 'Foundations' } }
    });
    expect(outOfRangePhaseIndex.ok, 'a phases index outside the allowed pattern should be rejected').toBe(false);

    const badSectionTitle = await writeAtPath(page, `users/${uid}/roadmaps/java-backend`, {
      version: 1,
      items: baseItems,
      phases: { 0: { id: 'phase-1', title: 'Foundations', sections: { 0: { id: 'section-1', title: '' } } } }
    });
    expect(badSectionTitle.ok, 'an empty section title should be rejected').toBe(false);

    const undeclaredKey = await writeAtPath(page, `users/${uid}/roadmaps/java-backend`, {
      version: 1, items: baseItems, notAField: true
    });
    expect(undeclaredKey.ok, 'an undeclared top-level key should be rejected').toBe(false);

    const compliant = await writeAtPath(page, `users/${uid}/roadmaps/java-backend`, {
      version: 1,
      items: baseItems,
      phases: {
        0: {
          id: 'phase-1',
          title: 'Foundations',
          priority: 'P1',
          sections: { 0: { id: 'section-1', title: 'Core' } }
        }
      }
    });
    expect(compliant.ok, 'a compliant phases entry should still succeed').toBe(true);
  });

  // Issue #348 removed the screenshot feature entirely — screenshotB64 is no
  // longer a recognized field on either reports/{id} path, so any write
  // including it is rejected outright by the $other catch-all, not just
  // capped by size.
  test('top-level reports/{reportId}.screenshotB64 is rejected outright — the field no longer exists', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    const uid = await signInGuestAndGetUid(page);

    const withScreenshot = await writeAtPath(page, `reports/rules-test-bad-${Date.now()}`, {
      type: 'bug', title: 't', submittedAt: Date.now(), userId: uid, screenshotB64: 'a'.repeat(100)
    });
    expect(withScreenshot.ok, 'a screenshotB64 field should be rejected — it no longer exists in the schema').toBe(false);

    const compliant = await writeAtPath(page, `reports/rules-test-ok-${Date.now()}`, {
      type: 'bug', title: 't', submittedAt: Date.now(), userId: uid
    });
    expect(compliant.ok, 'a compliant report with no screenshotB64 should still succeed').toBe(true);
  });

  // Issue #192 — users/{uid}/reports/{reportId} is the per-user mirror of the
  // top-level reports/{reportId} write submitReport() (feedbackStore.js) makes
  // in the same multi-path update; its .validate rule previously only checked
  // hasChildren(['type','title','submittedAt']), missing the type-enum and
  // title-length cap the top-level path already enforces. These cases prove
  // the per-user copy now rejects the same malformed writes and still accepts
  // a legitimate submitReport()-shaped write.
  test('users/{uid}/reports rejects an invalid type/oversized title; accepts a compliant report', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    const uid = await signInGuestAndGetUid(page);

    const invalidType = await writeAtPath(page, `users/${uid}/reports/rules-test-badtype-${Date.now()}`, {
      type: 'not-a-real-type', title: 'A report', submittedAt: Date.now()
    });
    expect(invalidType.ok, 'a report with a type outside bug|feature|feedback should be rejected').toBe(false);

    const oversizedTitle = await writeAtPath(page, `users/${uid}/reports/rules-test-badtitle-${Date.now()}`, {
      type: 'bug', title: 'a'.repeat(121), submittedAt: Date.now()
    });
    expect(oversizedTitle.ok, 'a report title over 120 chars should be rejected').toBe(false);

    const compliant = await writeAtPath(page, `users/${uid}/reports/rules-test-ok-${Date.now()}`, {
      type: 'bug', title: 'A report', submittedAt: Date.now()
    });
    expect(compliant.ok, 'a compliant per-user report should still succeed').toBe(true);
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

  // Issue #275 — three subtrees under users/{uid} (the legacy singular
  // `roadmap/items/{itemId}` path, `dailyTodos/{todoId}`, and
  // `streakFreezes`) were missing the `$other: { ".validate": "false" }`
  // catch-all every sibling subtree (`roadmaps/{templateId}`, `meta`,
  // `sharedRoadmaps/{shareId}/items/{itemId}`) already had, so a field not
  // named in any of their explicit validators could be written with no
  // constraint at all. These cases prove an unexpected extra field on each
  // path is now rejected, and that a real, otherwise-legitimate write
  // (roadmap item toggle, daily-todo create/complete, streak-freeze
  // grant/use) still succeeds unchanged.
  test('users/{uid}/roadmap/items/{itemId} (legacy path) rejects an unexpected extra field; accepts a compliant item', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    const uid = await signInGuestAndGetUid(page);

    const extraField = await writeAtPath(page, `users/${uid}/roadmap`, {
      version: 1, items: { item1: { title: 'Learn Java', done: true } }
    });
    expect(extraField.ok, 'an unvalidated field (done) on the legacy roadmap item path should be rejected').toBe(false);

    const compliant = await writeAtPath(page, `users/${uid}/roadmap`, {
      version: 1,
      items: { item1: { title: 'Learn Java', notes: 'short note', resources: { 0: { label: 'Docs', url: 'https://x.com' } } } }
    });
    expect(compliant.ok, 'a compliant legacy roadmap item write (title/notes/resources only) should still succeed').toBe(true);
  });

  test('users/{uid}/dailyTodos/{todoId} rejects an unexpected extra field; accepts a create and a complete', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    const uid = await signInGuestAndGetUid(page);
    const now = Date.now();

    const extraField = await writeAtPath(page, `users/${uid}/dailyTodos/todo-1`, {
      id: 'todo-1', title: 'Practice DSA', createdAt: now, expiresAt: now + 86400000, done: false, notARealField: 'nope'
    });
    expect(extraField.ok, 'an undeclared dailyTodos field should be rejected').toBe(false);

    const created = await writeAtPath(page, `users/${uid}/dailyTodos/todo-1`, {
      id: 'todo-1', title: 'Practice DSA', createdAt: now, expiresAt: now + 86400000, done: false
    });
    expect(created.ok, 'creating a compliant daily todo should still succeed').toBe(true);

    const completed = await writeAtPath(page, `users/${uid}/dailyTodos/todo-1`, {
      id: 'todo-1', title: 'Practice DSA', createdAt: now, expiresAt: now + 86400000, done: true, doneAt: now
    });
    expect(completed.ok, 'completing a compliant daily todo should still succeed').toBe(true);
  });

  test('users/{uid}/streakFreezes rejects an unexpected extra field; accepts a grant and a use', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    const uid = await signInGuestAndGetUid(page);

    const extraField = await writeAtPath(page, `users/${uid}/streakFreezes`, {
      available: 1, notARealField: 'nope'
    });
    expect(extraField.ok, 'an undeclared streakFreezes field should be rejected').toBe(false);

    const granted = await writeAtPath(page, `users/${uid}/streakFreezes`, {
      available: 1, lastGrantedAt: Date.now()
    });
    expect(granted.ok, 'a compliant streak-freeze grant should still succeed').toBe(true);

    const used = await writeAtPath(page, `users/${uid}/streakFreezes`, {
      available: 0, lastGrantedAt: Date.now(), usedDates: { 0: '2026-07-16' }
    });
    expect(used.ok, 'a compliant streak-freeze use should still succeed').toBe(true);
  });

  // Issue #351 — sharedRoadmaps/{shareId} (the object one level above
  // /items/{itemId}, already covered above) had no $other catch-all of its
  // own, and its `phases` field had zero validation at all. Mirrors the
  // extra-field/compliant-write shape every other #275/#351 case in this
  // file already follows.
  test('sharedRoadmaps/{shareId} rejects an unexpected extra top-level field and a malformed phases entry; accepts a compliant publish with phases', async ({ page }) => {
    test.skip(!FIREBASE_CONFIGURED, 'Requires FIREBASE_CONFIGURED env var — see issue #37');
    const uid = await signInGuestAndGetUid(page);
    const baseShare = {
      schemaVersion: 1, ownerUid: uid, templateId: 'java-backend', title: 'Rules test roadmap', publishedAt: Date.now(),
      items: { 'item-1': { title: 'Topic 1', phase: 'Phase 1', section: 'Section 1', priority: 'P1', done: false } }
    };

    const extraField = await writeAtPath(page, `sharedRoadmaps/rules-test-351-extra-${Date.now()}`, {
      ...baseShare,
      notARealField: 'nope'
    });
    expect(extraField.ok, 'an undeclared top-level field on sharedRoadmaps/{shareId} should be rejected').toBe(false);

    const malformedPhase = await writeAtPath(page, `sharedRoadmaps/rules-test-351-phase-${Date.now()}`, {
      ...baseShare,
      phases: [{ id: 'phase-1', title: 'a'.repeat(201), priority: 'P0', sections: [{ id: 'section-1', title: 'Section 1' }] }]
    });
    expect(malformedPhase.ok, 'an oversized phase title should be rejected').toBe(false);

    const badPriority = await writeAtPath(page, `sharedRoadmaps/rules-test-351-priority-${Date.now()}`, {
      ...baseShare,
      phases: [{ id: 'phase-1', title: 'Phase 1', priority: 'NOPE', sections: [] }]
    });
    expect(badPriority.ok, 'a phase with an invalid priority value should be rejected').toBe(false);

    const compliant = await writeAtPath(page, `sharedRoadmaps/rules-test-351-ok-${Date.now()}`, {
      ...baseShare,
      phases: [{ id: 'phase-1', title: 'Phase 1', priority: 'P0', sections: [{ id: 'section-1', title: 'Section 1' }] }]
    });
    expect(compliant.ok, 'a compliant publish with a real phases array should still succeed').toBe(true);
  });
});
