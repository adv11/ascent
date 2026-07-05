import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/services/firebase.js', () => ({
  authApi: {
    signIn: vi.fn(),
    guest: vi.fn(),
    sendResetEmail: vi.fn(),
    setPersistence: vi.fn(),
    onChange: vi.fn(),
  },
  authErrorMessage: (e) => e?.message || 'error',
}));

vi.mock('../../src/ui/router.js', () => ({ navigate: vi.fn() }));
vi.mock('../../src/ui/components/toast.js', () => ({ showToast: vi.fn() }));

async function setup() {
  const { authApi } = await import('../../src/services/firebase.js');
  const { renderSignIn } = await import('../../src/ui/pages/signIn.js');
  const app = document.createElement('div');
  document.body.appendChild(app);
  renderSignIn(app, { user: null });
  return { app, authApi };
}

beforeEach(() => {
  vi.resetModules();
  document.body.innerHTML = '';
});

describe('sign-in page — forgot password link', () => {
  it('renders a "Forgot password?" button', async () => {
    const { app } = await setup();
    const btn = app.querySelector('.forgot-link');
    expect(btn).not.toBeNull();
    expect(btn.textContent).toBe('Forgot password?');
  });

  it('shows reset view when "Forgot password?" is clicked', async () => {
    const { app } = await setup();
    app.querySelector('.forgot-link').click();
    const form = app.querySelector('form');
    expect(form).not.toBeNull();
    // submit button now says "Send reset link"
    expect(app.querySelector('[type="submit"]').textContent).toBe('Send reset link');
    // title updated
    const title = app.querySelector('.auth-title');
    expect(title.textContent).toBe('Reset your password');
  });

  it('pre-fills reset email with what was typed in sign-in email field', async () => {
    const { app } = await setup();
    const emailInput = app.querySelector('input[type="email"]');
    emailInput.value = 'pre@example.com';
    app.querySelector('.forgot-link').click();
    const resetEmail = app.querySelector('input[type="email"]');
    expect(resetEmail.value).toBe('pre@example.com');
  });
});

describe('reset view — form submission', () => {
  async function inResetView(prefill = 'user@example.com') {
    const result = await setup();
    const emailInput = result.app.querySelector('input[type="email"]');
    emailInput.value = prefill;
    result.app.querySelector('.forgot-link').click();
    return result;
  }

  it('shows validation error when email is blank', async () => {
    const { app } = await inResetView('');
    const resetEmail = app.querySelector('input[type="email"]');
    resetEmail.value = '';
    app.querySelector('form').requestSubmit();
    const msg = app.querySelector('.form-message');
    expect(msg.textContent).toBe('Enter your email address.');
    expect(msg.classList.contains('error')).toBe(true);
  });

  it('calls sendResetEmail with correct email on submit', async () => {
    const { app, authApi } = await inResetView();
    authApi.sendResetEmail.mockResolvedValue();
    const resetEmail = app.querySelector('input[type="email"]');
    resetEmail.value = 'test@example.com';
    app.querySelector('form').requestSubmit();
    await vi.waitFor(() => expect(authApi.sendResetEmail).toHaveBeenCalledWith('test@example.com'));
  });

  it('shows success state after email is sent', async () => {
    const { app, authApi } = await inResetView();
    authApi.sendResetEmail.mockResolvedValue();
    const resetEmail = app.querySelector('input[type="email"]');
    resetEmail.value = 'user@example.com';
    app.querySelector('form').requestSubmit();
    await vi.waitFor(() => {
      const title = app.querySelector('.auth-title');
      expect(title.textContent).toBe('Check your inbox');
    });
    expect(app.querySelector('.reset-success-msg')).not.toBeNull();
  });

  it('shows success state even when email not found (no account leak)', async () => {
    const { app, authApi } = await inResetView();
    authApi.sendResetEmail.mockRejectedValue({ code: 'auth/user-not-found', message: 'user not found' });
    const resetEmail = app.querySelector('input[type="email"]');
    resetEmail.value = 'nobody@example.com';
    app.querySelector('form').requestSubmit();
    await vi.waitFor(() => {
      const title = app.querySelector('.auth-title');
      expect(title.textContent).toBe('Check your inbox');
    });
  });

  it('shows network error inline and does not advance to success', async () => {
    const { app, authApi } = await inResetView();
    authApi.sendResetEmail.mockRejectedValue({ code: 'auth/network-request-failed', message: 'Network error. Check your connection and try again.' });
    const resetEmail = app.querySelector('input[type="email"]');
    resetEmail.value = 'user@example.com';
    app.querySelector('form').requestSubmit();
    await vi.waitFor(() => {
      const msg = app.querySelector('.form-message');
      expect(msg.textContent).toContain('Network error');
    });
    // Should still show the reset form, not success
    expect(app.querySelector('.reset-success-msg')).toBeNull();
  });
});

describe('reset view — back to sign in', () => {
  it('returns to sign-in form and pre-fills the email typed in the reset field', async () => {
    const { app } = await setup();
    app.querySelector('.forgot-link').click();

    const resetEmail = app.querySelector('input[type="email"]');
    resetEmail.value = 'returned@example.com';

    // click "Back to sign in"
    const backBtn = [...app.querySelectorAll('button')].find(b => b.textContent.includes('Back to sign in'));
    backBtn.click();

    const title = app.querySelector('.auth-title');
    expect(title.textContent).toBe('Welcome back');
    const signInEmail = app.querySelector('input[type="email"]');
    expect(signInEmail.value).toBe('returned@example.com');
  });

  it('back from success state returns to sign-in with the sent email', async () => {
    const { app, authApi } = await setup();
    authApi.sendResetEmail.mockResolvedValue();
    app.querySelector('.forgot-link').click();

    const resetEmail = app.querySelector('input[type="email"]');
    resetEmail.value = 'success@example.com';
    app.querySelector('form').requestSubmit();

    await vi.waitFor(() => {
      expect(app.querySelector('.auth-title').textContent).toBe('Check your inbox');
    });

    const backBtn = [...app.querySelectorAll('button')].find(b => b.textContent.includes('Back to sign in'));
    backBtn.click();

    expect(app.querySelector('.auth-title').textContent).toBe('Welcome back');
    expect(app.querySelector('input[type="email"]').value).toBe('success@example.com');
  });
});

describe('sign-in page — remember me', () => {
  it('renders a "Keep me signed in" checkbox, checked by default', async () => {
    const { app } = await setup();
    const checkbox = app.querySelector('#rememberMe');
    expect(checkbox).not.toBeNull();
    expect(checkbox.type).toBe('checkbox');
    expect(checkbox.checked).toBe(true);
  });

  it('calls setPersistence(true) before signIn when checkbox is checked', async () => {
    const { app, authApi } = await setup();
    authApi.setPersistence.mockResolvedValue();
    authApi.signIn.mockResolvedValue({});

    app.querySelector('input[type="email"]').value = 'user@example.com';
    app.querySelector('input[type="password"]').value = 'password123';
    app.querySelector('form').requestSubmit();

    await vi.waitFor(() => expect(authApi.signIn).toHaveBeenCalled());
    expect(authApi.setPersistence).toHaveBeenCalledWith(true);
    const setPersistenceOrder = authApi.setPersistence.mock.invocationCallOrder[0];
    const signInOrder = authApi.signIn.mock.invocationCallOrder[0];
    expect(setPersistenceOrder).toBeLessThan(signInOrder);
  });

  it('calls setPersistence(false) when checkbox is unchecked', async () => {
    const { app, authApi } = await setup();
    authApi.setPersistence.mockResolvedValue();
    authApi.signIn.mockResolvedValue({});

    const checkbox = app.querySelector('#rememberMe');
    checkbox.checked = false;
    app.querySelector('input[type="email"]').value = 'user@example.com';
    app.querySelector('input[type="password"]').value = 'password123';
    app.querySelector('form').requestSubmit();

    await vi.waitFor(() => expect(authApi.setPersistence).toHaveBeenCalledWith(false));
  });
});
