export const KEYS = {
  THEME: 'ascent-theme',
  // Pre-#58 single-roadmap blob. Never written to anymore — read once by
  // roadmapStore's migration into ROADMAPS, then left in place untouched.
  ROADMAP: 'ascent-roadmap-v3',
  // { [templateId]: { version, dirty, items } } — one entry per started template.
  ROADMAPS: 'ascent-roadmaps-v1',
  UI_STATE: 'ascent-ui-v3',
  ONBOARDING_DONE: 'ascent-onboarding-done',
  // Now means the *active* template id (issue #58) — the one currently displayed.
  TEMPLATE_ID: 'ascent-template-id',
  HIDDEN_TEMPLATES: 'ascent-hidden-templates',
  // Array of { id, title, description, createdAt } — one entry per roadmap the
  // user has created manually (issue #4). Each entry's `id` also appears in
  // KEYS.ROADMAPS/startedTemplateIds like any built-in template id.
  CUSTOM_ROADMAPS: 'ascent-custom-roadmaps-v1'
};

export function verifyDismissedKey(uid) {
  return `ascent-verify-dismissed-${uid}`;
}
