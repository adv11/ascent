export const KEYS = {
  THEME: 'ascent-theme',
  ROADMAP: 'ascent-roadmap-v3',
  UI_STATE: 'ascent-ui-v3',
  ONBOARDING_DONE: 'ascent-onboarding-done',
  TEMPLATE_ID: 'ascent-template-id',
  HIDDEN_TEMPLATES: 'ascent-hidden-templates'
};

export function verifyDismissedKey(uid) {
  return `ascent-verify-dismissed-${uid}`;
}
