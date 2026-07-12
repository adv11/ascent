import { el } from '../dom.js';
import { navigate } from '../router.js';
import { authApi, authErrorMessage } from '../../services/firebase.js';
import { showToast } from '../components/toast.js';
import { authShell } from '../components/authShell.js';
import { makePasswordToggle } from '../utils/password.js';
import { isValidEmailFormat, attachFieldValidationIcon } from '../utils/fieldValidation.js';
import { setButtonLoading } from '../utils/buttonLoading.js';
import { createIcon } from '../components/icons.js';

// Split out of buildSignInForm below purely to keep that function under the
// max-lines-per-function threshold (issue #53) — same behavior as before.
async function signInAsGuest(message, setBusy) {
  message.textContent = '';
  setBusy(true);
  try {
    await authApi.guest();
    showToast('Guest session started. Create an account anytime to keep progress.', 'info');
    navigate('/app', true);
  } catch (error) {
    message.textContent = authErrorMessage(error);
    message.className = 'form-message error';
  } finally {
    setBusy(false);
  }
}

// Module-scope (issue #53) — was previously the ~90-line `showSignInView`
// closure body. Returns the sign-in form DOM; `deps.onForgotPassword` and
// `deps.onSignedIn` are the only things the caller needs to wire up (view
// switching and post-auth navigation), everything else (authApi, toast) is
// this module's own top-level import, same as before the extraction.
export function buildSignInForm({ prefillEmail = '', onForgotPassword }) {
  const message = el('p', { className: 'form-message', text: '' });
  const emailInput = el('input', {
    className: 'field-input', type: 'email',
    placeholder: 'you@example.com', autocomplete: 'username'
  });
  const emailWrap = el('div', { className: 'field-input-wrap' }, [emailInput]);
  const emailValidation = attachFieldValidationIcon(emailWrap);
  const passwordInput = el('input', {
    className: 'field-input', type: 'password',
    placeholder: 'Your password', autocomplete: 'current-password'
  });
  const submitBtn = el('button', { type: 'submit', className: 'btn btn-primary btn-block', text: 'Sign in' });
  const guestBtn = el('button', { type: 'button', className: 'btn btn-secondary btn-block', text: 'Continue as guest' });
  const forgotBtn = el('button', { type: 'button', className: 'forgot-link', text: 'Forgot password?' });
  const rememberCheckbox = el('input', { type: 'checkbox', id: 'rememberMe', className: 'remember-checkbox', checked: 'true' });
  rememberCheckbox.checked = true;

  if (prefillEmail) emailInput.value = prefillEmail;

  // Issue #6 Phase 5.3 — only shown after the field has actually been left
  // (never before), and never flags an empty field as invalid — that's what
  // the plain "Enter email and password." submit-time message already covers.
  emailInput.addEventListener('blur', () => {
    const v = emailInput.value.trim();
    emailValidation.setState(v ? isValidEmailFormat(v) : null);
  });

  function setBusy(busy) {
    submitBtn.disabled = busy;
    guestBtn.disabled = busy;
    forgotBtn.disabled = busy;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    message.textContent = '';
    message.className = 'form-message';
    const emailVal = emailInput.value.trim();
    const passVal = passwordInput.value;
    if (!emailVal || !passVal) {
      message.textContent = 'Enter email and password.';
      message.className = 'form-message error';
      return;
    }
    setBusy(true);
    setButtonLoading(submitBtn, true, 'Signing in…');
    try {
      await authApi.setPersistence(rememberCheckbox.checked);
      await authApi.signIn(emailVal, passVal);
      showToast('Signed in. Syncing your roadmap…', 'success');
      navigate('/app', true);
    } catch (error) {
      message.textContent = authErrorMessage(error);
      message.className = 'form-message error';
    } finally {
      setBusy(false);
      setButtonLoading(submitBtn, false);
    }
  }

  guestBtn.addEventListener('click', () => signInAsGuest(message, setBusy));

  forgotBtn.addEventListener('click', () => onForgotPassword(emailInput.value.trim()));

  return el('form', { className: 'auth-form', onSubmit: handleSubmit }, [
    el('label', { className: 'field' }, [
      el('span', { className: 'field-label', text: 'Email' }),
      emailWrap
    ]),
    el('div', { className: 'field' }, [
      el('div', { className: 'field-label-row' }, [
        el('span', { className: 'field-label', text: 'Password' }),
        forgotBtn
      ]),
      el('div', { className: 'field-input-wrap' }, [
        passwordInput,
        makePasswordToggle(passwordInput),
      ]),
    ]),
    el('label', { className: 'remember-row', for: 'rememberMe' }, [
      rememberCheckbox,
      el('span', { className: 'remember-label', text: 'Keep me signed in' })
    ]),
    message,
    submitBtn,
    el('div', { className: 'auth-divider' }, [el('span', { text: 'or' })]),
    guestBtn
  ]);
}

// Module-scope (issue #53) — was previously the ~90-line `showResetView`
// closure body. Returns the reset-request form DOM; `deps.onBack` and
// `deps.onSuccess` are the view-switching callbacks the caller wires up.
export function buildResetForm({ prefillEmail = '', onBack, onSuccess }) {
  const message = el('p', { className: 'form-message', text: '' });
  const resetEmailInput = el('input', {
    className: 'field-input', type: 'email',
    placeholder: 'you@example.com', autocomplete: 'username'
  });
  const sendBtn = el('button', { type: 'submit', className: 'btn btn-primary btn-block', text: 'Send reset link' });
  const backBtn = el('button', { type: 'button', className: 'btn btn-secondary btn-block', text: '← Back to sign in' });

  if (prefillEmail) resetEmailInput.value = prefillEmail;

  function setBusy(busy) {
    sendBtn.disabled = busy;
    backBtn.disabled = busy;
  }

  backBtn.addEventListener('click', () => onBack(resetEmailInput.value.trim()));

  async function handleReset(e) {
    e.preventDefault();
    message.textContent = '';
    message.className = 'form-message';
    const emailVal = resetEmailInput.value.trim();
    if (!emailVal) {
      message.textContent = 'Enter your email address.';
      message.className = 'form-message error';
      return;
    }
    setBusy(true);
    setButtonLoading(sendBtn, true, 'Sending…');
    try {
      await authApi.sendResetEmail(emailVal);
      onSuccess(emailVal);
    } catch (error) {
      // Only surface network errors — never reveal whether an account exists
      if (error?.code === 'auth/network-request-failed') {
        message.textContent = 'Network error. Check your connection and try again.';
        message.className = 'form-message error';
        setBusy(false);
        setButtonLoading(sendBtn, false);
      } else {
        onSuccess(emailVal);
      }
    }
  }

  const form = el('form', { className: 'auth-form', onSubmit: handleReset }, [
    el('label', { className: 'field' }, [
      el('span', { className: 'field-label', text: 'Email' }),
      resetEmailInput
    ]),
    message,
    sendBtn,
    backBtn
  ]);

  return { form, focus: () => resetEmailInput.focus() };
}

export function renderSignIn(app, { user }) {
  if (user && !user.isAnonymous) {
    navigate('/app', true);
    return;
  }

  const bodySlot = el('div', {});

  const { node, cleanup, titleEl, subtitleEl } = authShell({
    title: 'Welcome back',
    subtitle: 'Sign in to sync your roadmap across devices.',
    children: [bodySlot],
    footer: el('p', {}, [
      'New here? ',
      el('a', { href: '#/signup', className: 'link', text: 'Create an account' })
    ]),
    footnote: 'Built for anyone learning, revising, or tracking progress toward a goal.'
  });

  function showSignInView(prefillEmail = '') {
    titleEl.textContent = 'Welcome back';
    subtitleEl.textContent = 'Sign in to sync your roadmap across devices.';
    bodySlot.replaceChildren(buildSignInForm({
      prefillEmail,
      onForgotPassword: email => showResetView(email)
    }));
  }

  function showResetView(prefillEmail = '') {
    titleEl.textContent = 'Reset your password';
    subtitleEl.textContent = "Enter your email and we'll send you a link to set a new one.";
    const { form, focus } = buildResetForm({
      prefillEmail,
      onBack: email => showSignInView(email),
      onSuccess: email => showResetSuccess(email)
    });
    bodySlot.replaceChildren(form);
    focus();
  }

  function showResetSuccess(sentEmail) {
    titleEl.textContent = 'Check your inbox';
    subtitleEl.textContent = '';

    const backBtn = el('button', { type: 'button', className: 'btn btn-secondary btn-block', text: '← Back to sign in' });
    backBtn.addEventListener('click', () => showSignInView(sentEmail));

    bodySlot.replaceChildren(
      el('p', { className: 'reset-success-msg' }, [
        el('span', { className: 'reset-success-icon' }, [createIcon('check', { size: 'xs' })]),
        el('span', { text: `We sent a reset link to ${sentEmail}. The link expires in 1 hour.` })
      ]),
      backBtn
    );
  }

  showSignInView();
  app.replaceChildren(node);
  return cleanup;
}
