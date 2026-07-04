import { el } from '../dom.js';
import { navigate } from '../router.js';
import { authApi, authErrorMessage } from '../../services/firebase.js';
import { showToast } from '../components/toast.js';
import { authShell } from '../components/authShell.js';

export function renderSignIn(app, { user }) {
  if (user && !user.isAnonymous) {
    navigate('/app', true);
    return;
  }

  const message = el('p', { className: 'form-message', text: '' });
  const email = el('input', { className: 'field-input', type: 'email', placeholder: 'you@example.com', autocomplete: 'username' });
  const password = el('input', { className: 'field-input', type: 'password', placeholder: 'Your password', autocomplete: 'current-password' });
  const submitBtn = el('button', { type: 'submit', className: 'btn btn-primary btn-block', text: 'Sign in' });
  const guestBtn = el('button', { type: 'button', className: 'btn btn-secondary btn-block', text: 'Continue as guest' });

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
    if (!emailVal || !passVal) {
      message.textContent = 'Enter email and password.';
      message.className = 'form-message error';
      return;
    }
    setBusy(true);
    try {
      await authApi.signIn(emailVal, passVal);
      showToast('Signed in. Syncing your roadmap…', 'success');
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
    el('label', { className: 'field' }, [
      el('span', { className: 'field-label', text: 'Password' }),
      password
    ]),
    message,
    submitBtn,
    el('div', { className: 'auth-divider' }, [el('span', { text: 'or' })]),
    guestBtn
  ]);

  const { node, cleanup } = authShell({
    title: 'Welcome back',
    subtitle: 'Sign in to sync your switch-prep roadmap across devices.',
    children: [form],
    footer: el('p', {}, [
      'New here? ',
      el('a', { href: '#/signup', className: 'link', text: 'Create an account' })
    ]),
    footnote: 'Built for Java Spring Boot engineers preparing for product-company switches.'
  });
  app.replaceChildren(node);
  return cleanup;
}
