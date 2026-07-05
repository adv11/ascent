import { el } from '../dom.js';
import { navigate } from '../router.js';
import { auth, authApi, authErrorMessage } from '../../services/firebase.js';
import { showToast } from '../components/toast.js';
import { authShell } from '../components/authShell.js';

export function renderSignUp(app, { user }) {
  if (user && !user.isAnonymous) {
    navigate('/app', true);
    return;
  }

  const message = el('p', { className: 'form-message', text: '' });
  const email = el('input', { className: 'field-input', type: 'email', placeholder: 'you@example.com', autocomplete: 'username' });
  const password = el('input', { className: 'field-input', type: 'password', placeholder: 'Minimum 6 characters', autocomplete: 'new-password' });
  const submitBtn = el('button', { type: 'submit', className: 'btn btn-primary btn-block', text: 'Create account' });

  function setBusy(busy) {
    submitBtn.disabled = busy;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    message.textContent = '';
    message.className = 'form-message';
    const emailVal = email.value.trim();
    const passVal = password.value;
    if (!emailVal || !passVal) {
      message.textContent = 'Enter email and password.';
      message.className = 'form-message error';
      return;
    }
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

  const form = el('form', { className: 'auth-form', onSubmit: handleSubmit }, [
    el('label', { className: 'field' }, [
      el('span', { className: 'field-label', text: 'Email' }),
      email
    ]),
    el('label', { className: 'field' }, [
      el('span', { className: 'field-label', text: 'Password' }),
      password
    ]),
    message,
    submitBtn
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
