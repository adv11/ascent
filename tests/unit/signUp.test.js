import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/services/firebase.js', () => ({
  auth: { currentUser: null },
  authApi: {
    signUp: vi.fn(),
    linkGuest: vi.fn(),
    sendVerificationEmail: vi.fn(),
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
    app.querySelector('input[type="password"]').value = 'password123';
    app.querySelector('form').requestSubmit();

    await vi.waitFor(() => expect(authApi.sendVerificationEmail).toHaveBeenCalledOnce());
  });

  it('still navigates to /app if sendVerificationEmail throws', async () => {
    const { app, authApi } = await setup();
    const { navigate } = await import('../../src/ui/router.js');
    authApi.signUp.mockResolvedValue({});
    authApi.sendVerificationEmail.mockRejectedValue(new Error('email send failed'));

    app.querySelector('input[type="email"]').value = 'new@example.com';
    app.querySelector('input[type="password"]').value = 'password123';
    app.querySelector('form').requestSubmit();

    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/app', true));
  });

  it('shows toast with verification mention on success', async () => {
    const { app, authApi, showToast } = await setup();
    authApi.signUp.mockResolvedValue({});
    authApi.sendVerificationEmail.mockResolvedValue();

    app.querySelector('input[type="email"]').value = 'new@example.com';
    app.querySelector('input[type="password"]').value = 'password123';
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
    app.querySelector('input[type="password"]').value = 'password123';
    app.querySelector('form').requestSubmit();

    await vi.waitFor(() => {
      const msg = app.querySelector('.form-message');
      expect(msg.classList.contains('error')).toBe(true);
    });
    expect(authApi.sendVerificationEmail).not.toHaveBeenCalled();
  });
});
