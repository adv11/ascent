import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/services/firebase.js', () => ({
  auth: { currentUser: null },
  authApi: {
    signUp: vi.fn(),
    linkGuest: vi.fn(),
    sendVerificationEmail: vi.fn(),
    guest: vi.fn(),
  },
  authErrorMessage: (e) => e?.message || 'error',
}));

vi.mock('../../src/ui/router.js', () => ({ navigate: vi.fn() }));
vi.mock('../../src/ui/components/toast.js', () => ({ showToast: vi.fn() }));
vi.mock('../../src/ui/components/authShell.js', () => ({
  authShell: ({ children }) => {
    const node = document.createElement('div');
    children.forEach(c => node.appendChild(c));
    return { node, cleanup: vi.fn() };
  }
}));

function fillPasswordFields(app, value) {
  const [pwd, confirm] = app.querySelectorAll('input[type="password"]');
  pwd.value = value;
  confirm.value = value;
}

async function setup() {
  const { authApi } = await import('../../src/services/firebase.js');
  const { renderSignUp } = await import('../../src/ui/pages/signUp.js');
  const { showToast } = await import('../../src/ui/components/toast.js');
  const app = document.createElement('div');
  document.body.appendChild(app);
  renderSignUp(app, { user: null });
  return { app, authApi, showToast };
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  document.body.innerHTML = '';
});

describe('sign-up page — email verification', () => {
  it('calls sendVerificationEmail after successful sign-up', async () => {
    const { app, authApi } = await setup();
    authApi.signUp.mockResolvedValue({});
    authApi.sendVerificationEmail.mockResolvedValue();

    app.querySelector('input[type="email"]').value = 'new@example.com';
    fillPasswordFields(app, 'password123');
    app.querySelector('form').requestSubmit();

    await vi.waitFor(() => expect(authApi.sendVerificationEmail).toHaveBeenCalledOnce());
  });

  it('still navigates to /app if sendVerificationEmail throws', async () => {
    const { app, authApi } = await setup();
    const { navigate } = await import('../../src/ui/router.js');
    authApi.signUp.mockResolvedValue({});
    authApi.sendVerificationEmail.mockRejectedValue(new Error('email send failed'));

    app.querySelector('input[type="email"]').value = 'new@example.com';
    fillPasswordFields(app, 'password123');
    app.querySelector('form').requestSubmit();

    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/app', true));
  });

  it('shows toast with verification mention on success', async () => {
    const { app, authApi, showToast } = await setup();
    authApi.signUp.mockResolvedValue({});
    authApi.sendVerificationEmail.mockResolvedValue();

    app.querySelector('input[type="email"]').value = 'new@example.com';
    fillPasswordFields(app, 'password123');
    app.querySelector('form').requestSubmit();

    await vi.waitFor(() => expect(showToast).toHaveBeenCalled());
    const [msg] = showToast.mock.calls[0];
    expect(msg).toContain('verify');
  });

  it('shows error and does not call sendVerificationEmail when sign-up fails', async () => {
    const { app, authApi } = await setup();
    authApi.signUp.mockRejectedValue({ code: 'auth/email-already-in-use', message: 'already in use' });
    authApi.sendVerificationEmail.mockResolvedValue();

    app.querySelector('input[type="email"]').value = 'taken@example.com';
    fillPasswordFields(app, 'password123');
    app.querySelector('form').requestSubmit();

    await vi.waitFor(() => {
      const msg = app.querySelector('.form-message');
      expect(msg.classList.contains('error')).toBe(true);
    });
    expect(authApi.sendVerificationEmail).not.toHaveBeenCalled();
  });
});

describe('sign-up page — confirm password validation', () => {
  it('shows mismatch error and does not call signUp when passwords differ', async () => {
    const { app, authApi } = await setup();
    authApi.signUp.mockResolvedValue({});

    app.querySelector('input[type="email"]').value = 'test@example.com';
    const [pwd, confirm] = app.querySelectorAll('input[type="password"]');
    pwd.value = 'password123';
    confirm.value = 'different456';
    app.querySelector('form').requestSubmit();

    await vi.waitFor(() => {
      const err = app.querySelector('.field-error');
      expect(err.textContent).toContain('do not match');
    });
    expect(authApi.signUp).not.toHaveBeenCalled();
  });

  it('shows mismatch error inline on confirm input event', async () => {
    const { app } = await setup();
    const [pwd, confirm] = app.querySelectorAll('input[type="password"]');
    pwd.value = 'password123';
    confirm.value = 'nomatch';
    confirm.dispatchEvent(new Event('input'));

    const err = app.querySelector('.field-error');
    expect(err.textContent).toContain('do not match');
  });

  it('clears mismatch error when confirm is corrected', async () => {
    const { app } = await setup();
    const [pwd, confirm] = app.querySelectorAll('input[type="password"]');
    pwd.value = 'password123';
    confirm.value = 'nomatch';
    confirm.dispatchEvent(new Event('input'));
    confirm.value = 'password123';
    confirm.dispatchEvent(new Event('input'));

    const err = app.querySelector('.field-error');
    expect(err.textContent).toBe('');
  });

  it('does not show mismatch error when confirm is empty', async () => {
    const { app } = await setup();
    const [pwd, confirm] = app.querySelectorAll('input[type="password"]');
    pwd.value = 'password123';
    confirm.value = '';
    confirm.dispatchEvent(new Event('input'));

    const err = app.querySelector('.field-error');
    expect(err.textContent).toBe('');
  });
});
