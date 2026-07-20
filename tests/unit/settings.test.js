import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KEYS } from '../../src/services/localStorageKeys.js';

vi.mock('../../src/services/firebase.js', () => ({
  authApi: {
    updateEmail: vi.fn(),
    updatePassword: vi.fn(),
    updateProfile: vi.fn(),
    deleteAccount: vi.fn(),
  },
  authErrorMessage: e => e?.message || 'error',
  database: {},
  firebaseClock: vi.fn(),
}));
// settings.js pulls in sidebar.js -> myReports.js (issue #9) -> feedbackStore.js,
// which imports the Firebase Realtime Database SDK directly — same CDN-URL
// stub tests/unit/storage/adapterFactory.test.js established.
vi.mock('https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js', () => ({
  ref: vi.fn(), push: vi.fn(), update: vi.fn(), onValue: vi.fn(), off: vi.fn(),
}));

vi.mock('../../src/ui/router.js', () => ({ navigate: vi.fn() }));

function fakeStore() {
  return { getSnapshot: () => ({ dirty: false, activeTemplateId: 'java-backend', items: {} }) };
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  document.body.innerHTML = '';
  localStorage.clear();
  document.documentElement.dataset.theme = 'light';
});

async function freshSettings(user) {
  const { renderSettings } = await import('../../src/ui/pages/settings.js');
  const app = document.createElement('div');
  document.body.appendChild(app);
  renderSettings(app, { user, store: fakeStore() });
  return app;
}

describe('renderSettings — guest view (issue #16)', () => {
  it('shows only the "Create a free account" card, no profile/danger-zone', async () => {
    const app = await freshSettings({ isAnonymous: true, uid: 'guest-1' });
    expect(app.querySelector('.settings-guest-card')).not.toBeNull();
    expect(app.querySelector('.settings-section')).toBeNull();
  });
});

describe('renderSettings — signed-in view (issue #16)', () => {
  const user = { isAnonymous: false, uid: 'u1', email: 'jane@example.com', emailVerified: false };

  it('renders Profile, Preferences, Data, and Danger zone sections', async () => {
    const app = await freshSettings(user);
    const titles = Array.from(app.querySelectorAll('.settings-section-title')).map(el => el.textContent);
    expect(titles).toEqual(['Profile', 'Preferences', 'Data', 'Danger zone']);
  });

  it('shows the current email and an unverified badge', async () => {
    const app = await freshSettings(user);
    const values = Array.from(app.querySelectorAll('.settings-row-value')).map(el => el.textContent);
    expect(values).toContain('jane@example.com');
    expect(app.querySelector('.settings-unverified')).not.toBeNull();
  });

  it('shows "Not set" when there is no display name yet', async () => {
    const app = await freshSettings(user);
    const values = Array.from(app.querySelectorAll('.settings-row-value')).map(el => el.textContent);
    expect(values).toContain('Not set');
  });

  it('expanding "Change name" and submitting calls authApi.updateProfile and updates the row value', async () => {
    const { authApi } = await import('../../src/services/firebase.js');
    authApi.updateProfile.mockResolvedValue();
    const app = await freshSettings(user);
    const toggleBtn = Array.from(app.querySelectorAll('button')).find(b => b.textContent === 'Change name');
    toggleBtn.click();
    app.querySelector('.settings-inline-form-body input[type="text"]').value = 'Jane Doe';
    app.querySelector('.settings-inline-form-body').requestSubmit();
    await vi.waitFor(() => expect(authApi.updateProfile).toHaveBeenCalledWith('Jane Doe'));
    await vi.waitFor(() => {
      const values = Array.from(app.querySelectorAll('.settings-row-value')).map(el => el.textContent);
      expect(values).toContain('Jane Doe');
    });
  });

  it('expanding "Change email" and submitting calls authApi.updateEmail', async () => {
    const { authApi } = await import('../../src/services/firebase.js');
    authApi.updateEmail.mockResolvedValue();
    const app = await freshSettings(user);
    const toggleBtn = Array.from(app.querySelectorAll('button')).find(b => b.textContent === 'Change email');
    toggleBtn.click();
    app.querySelector('.settings-inline-form-body input[type="email"]').value = 'new@example.com';
    app.querySelector('.settings-inline-form-body input[type="password"]').value = 'secret123';
    app.querySelector('.settings-inline-form-body').requestSubmit();
    await vi.waitFor(() => expect(authApi.updateEmail).toHaveBeenCalledWith('new@example.com', 'secret123'));
  });

  it('expanding "Change password" and submitting calls authApi.updatePassword', async () => {
    const { authApi } = await import('../../src/services/firebase.js');
    authApi.updatePassword.mockResolvedValue();
    const app = await freshSettings(user);
    const toggleBtn = Array.from(app.querySelectorAll('button')).find(b => b.textContent === 'Change password');
    toggleBtn.click();
    const inputs = app.querySelectorAll('.settings-inline-form-body input[type="password"]');
    inputs[0].value = 'oldpass1';
    inputs[1].value = 'newpass123';
    inputs[2].value = 'newpass123';
    app.querySelector('.settings-inline-form-body').requestSubmit();
    await vi.waitFor(() => expect(authApi.updatePassword).toHaveBeenCalledWith('newpass123', 'oldpass1'));
  });

  it('mismatched confirm password blocks submit', async () => {
    const { authApi } = await import('../../src/services/firebase.js');
    const app = await freshSettings(user);
    const toggleBtn = Array.from(app.querySelectorAll('button')).find(b => b.textContent === 'Change password');
    toggleBtn.click();
    const inputs = app.querySelectorAll('.settings-inline-form-body input[type="password"]');
    inputs[0].value = 'oldpass1';
    inputs[1].value = 'newpass123';
    inputs[2].value = 'doesnotmatch';
    app.querySelector('.settings-inline-form-body').requestSubmit();
    expect(authApi.updatePassword).not.toHaveBeenCalled();
    expect(app.querySelector('.field-error').textContent).toBe('Passwords do not match.');
  });

  it('changing the default filter select persists it to localStorage', async () => {
    const app = await freshSettings(user);
    const filterSelect = app.querySelectorAll('.settings-select')[1];
    filterSelect.value = 'P1';
    filterSelect.dispatchEvent(new Event('change'));
    expect(localStorage.getItem(KEYS.DEFAULT_FILTER)).toBe('P1');
  });

  it('changing the theme select updates the app theme', async () => {
    const app = await freshSettings(user);
    const { getTheme } = await import('../../src/services/theme.js');
    const themeSelect = app.querySelectorAll('.settings-select')[0];
    themeSelect.value = 'dark';
    themeSelect.dispatchEvent(new Event('change'));
    expect(getTheme()).toBe('dark');
  });

  it('the "Install Ascent" row is hidden until beforeinstallprompt fires, then dismiss hides it again (issue #19)', async () => {
    const app = await freshSettings(user);
    const installRow = Array.from(app.querySelectorAll('.settings-row')).find(row => row.textContent.includes('Install Ascent'));
    expect(installRow.hidden).toBe(true);

    const event = new Event('beforeinstallprompt', { cancelable: true });
    event.prompt = vi.fn();
    event.userChoice = Promise.resolve({ outcome: 'dismissed' });
    window.dispatchEvent(event);
    expect(installRow.hidden).toBe(false);

    const dismissBtn = Array.from(installRow.querySelectorAll('button')).find(b => b.textContent === 'Dismiss');
    dismissBtn.click();
    expect(installRow.hidden).toBe(true);
  });
});
