import { el } from '../dom.js';
import { navigate } from '../router.js';
import { auth, authApi, authErrorMessage } from '../../services/firebase.js';
import { showToast } from '../components/toast.js';
import { authShell } from '../components/authShell.js';
import { scorePassword, makePasswordToggle } from '../utils/password.js';

export function renderSignUp(app, { user }) {
  if (user && !user.isAnonymous) {
    navigate('/app', true);
    return;
  }

  const message = el('p', { className: 'form-message', text: '' });
  const email = el('input', { className: 'field-input', type: 'email', placeholder: 'you@example.com', autocomplete: 'username' });
  const password = el('input', { className: 'field-input', type: 'password', placeholder: 'Minimum 6 characters', autocomplete: 'new-password' });
  const confirmPassword = el('input', { className: 'field-input', type: 'password', placeholder: 'Repeat your password', autocomplete: 'new-password' });
  const confirmError = el('p', { className: 'field-error', text: '' });
  const submitBtn = el('button', { type: 'submit', className: 'btn btn-primary btn-block', text: 'Create account' });
  const guestBtn = el('button', { type: 'button', className: 'btn btn-secondary btn-block', text: 'Continue as guest' });

  const strengthSegments = [0, 1, 2, 3].map(() => el('div', { className: 'strength-segment' }));
  const strengthMeter = el('div', { className: 'strength-meter', 'aria-hidden': 'true' }, strengthSegments);

  function updateStrength(score) {
    const cls = score <= 1 ? 'weak' : score <= 2 ? 'fair' : 'strong';
    strengthSegments.forEach((seg, i) => {
      seg.className = 'strength-segment' + (i < score ? ` ${cls}` : '');
    });
  }

  function checkConfirmMatch() {
    if (confirmPassword.value && confirmPassword.value !== password.value) {
      confirmError.textContent = 'Passwords do not match.';
      return false;
    }
    confirmError.textContent = '';
    return true;
  }

  password.addEventListener('input', () => {
    updateStrength(scorePassword(password.value));
    if (confirmPassword.value) checkConfirmMatch();
  });

  confirmPassword.addEventListener('input', checkConfirmMatch);

  function setBusy(busy) {
    submitBtn.disabled = busy;
    guestBtn.disabled = busy;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    message.textContent = '';
    message.className = 'form-message';
    const emailVal = email.value.trim();
    const passVal = password.value;
    const confirmVal = confirmPassword.value;
    if (!emailVal || !passVal || !confirmVal) {
      message.textContent = 'Enter email and password.';
      message.className = 'form-message error';
      return;
    }
    if (passVal !== confirmVal) {
      confirmError.textContent = 'Passwords do not match.';
      return;
    }
    confirmError.textContent = '';
    setBusy(true);
    try {
      const current = auth.currentUser;
      if (current?.isAnonymous) {
        await authApi.linkGuest(emailVal, passVal);
      } else {
        await authApi.signUp(emailVal, passVal);
      }
      // Best-effort — don't block sign-up if this fails (e.g. emulator not configured)
      try { await authApi.sendVerificationEmail(); } catch { /* ignore */ }
      showToast('Account created. Check your inbox to verify your email.', 'success');
      navigate('/app', true);
    } catch (error) {
      message.textContent = authErrorMessage(error);
      message.className = 'form-message error';
    } finally {
      setBusy(false);
    }
  }

  guestBtn.addEventListener('click', async () => {
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
  });

  const form = el('form', { className: 'auth-form', onSubmit: handleSubmit }, [
    el('label', { className: 'field' }, [
      el('span', { className: 'field-label', text: 'Email' }),
      email
    ]),
    el('div', { className: 'field' }, [
      el('span', { className: 'field-label', text: 'Create a password' }),
      el('div', { className: 'field-input-wrap' }, [
        password,
        makePasswordToggle(password),
      ]),
      strengthMeter,
    ]),
    el('div', { className: 'field' }, [
      el('span', { className: 'field-label', text: 'Confirm password' }),
      el('div', { className: 'field-input-wrap' }, [
        confirmPassword,
        makePasswordToggle(confirmPassword),
      ]),
      confirmError,
    ]),
    message,
    submitBtn,
    el('div', { className: 'auth-divider' }, [el('span', { text: 'or' })]),
    guestBtn,
  ]);

  const { node, cleanup } = authShell({
    title: 'Create your account',
    subtitle: 'Track Java, Spring Boot, distributed systems, GenAI, and interview prep in one place.',
    children: [form],
    footer: el('p', {}, [
      'Already have an account? ',
      el('a', { href: '#/signin', className: 'link', text: 'Sign in' })
    ]),
    footnote: 'Java · Spring Boot · Microservices · GenAI · System Design'
  });
  app.replaceChildren(node);
  return cleanup;
}
