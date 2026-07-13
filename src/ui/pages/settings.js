import { el } from '../dom.js';
import { navigate } from '../router.js';
import { authApi, authErrorMessage } from '../../services/firebase.js';
import { showToast } from '../components/toast.js';
import { createThemeToggle } from '../components/themeToggle.js';
import { createChangelogBell } from '../components/notificationBell.js';
import { createSidebar } from '../components/sidebar.js';
import { createTopbar } from '../components/topbar.js';
import { openDeleteAccountModal } from '../components/deleteAccountModal.js';
import { exportBackupJson } from '../utils/backupActions.js';
import { scorePassword, makePasswordToggle } from '../utils/password.js';
import { isValidEmailFormat, attachFieldValidationIcon } from '../utils/fieldValidation.js';
import { setButtonLoading } from '../utils/buttonLoading.js';
import { getTheme, setTheme, onThemeChange } from '../../services/theme.js';
import { KEYS } from '../../services/localStorageKeys.js';
import { createIcon } from '../components/icons.js';
import { readDefaultFilterPreference } from '../utils/defaultFilterPreference.js';
import { isInstallable, onInstallabilityChange, promptInstall, dismissInstallPrompt } from '../../services/pwaInstall.js';
import { createFeatureBadge, dismissFeatureBadge } from '../components/featureBadge.js';
import { createSelect } from '../components/select.js';

const FILTER_OPTIONS = [
  { value: 'ALL', label: 'All' },
  { value: 'P0', label: 'P0' },
  { value: 'P1', label: 'P1' },
  { value: 'P2', label: 'P2' },
  { value: 'P3', label: 'P3' }
];

// A collapsible "Change X" row shared by the change-email and change-password
// flows below — a button that expands into a form in place, matching the
// issue #16 spec's inline-expand mockup rather than a separate modal.
function buildToggleRow({ label, value, buttonText, buildForm }) {
  const valueEl = el('span', { className: 'settings-row-value', text: value });
  const formSlot = el('div', { className: 'settings-inline-form', hidden: true });
  const toggleBtn = el('button', {
    type: 'button',
    className: 'btn btn-secondary btn-sm',
    text: buttonText,
    onClick: () => {
      const opening = formSlot.hidden;
      formSlot.hidden = !opening;
      toggleBtn.textContent = opening ? 'Cancel' : buttonText;
      if (opening && !formSlot.childNodes.length) formSlot.appendChild(buildForm(() => close()));
    }
  });

  function close() {
    formSlot.hidden = true;
    formSlot.replaceChildren();
    toggleBtn.textContent = buttonText;
  }

  const row = el('div', { className: 'settings-row' }, [
    el('div', { className: 'settings-row-main' }, [
      el('span', { className: 'settings-row-label', text: label }),
      valueEl,
      toggleBtn
    ]),
    formSlot
  ]);

  return { row, valueEl };
}

function buildChangeEmailForm(user, onDone) {
  const message = el('p', { className: 'form-message', text: '' });
  const newEmail = el('input', { className: 'field-input', type: 'email', placeholder: 'new@example.com', autocomplete: 'email' });
  const emailWrap = el('div', { className: 'field-input-wrap' }, [newEmail]);
  const emailValidation = attachFieldValidationIcon(emailWrap);
  const password = el('input', { className: 'field-input', type: 'password', placeholder: 'Confirm your identity', autocomplete: 'current-password' });
  const passwordWrap = el('div', { className: 'field-input-wrap has-toggle' }, [password, makePasswordToggle(password)]);
  const saveBtn = el('button', { type: 'submit', className: 'btn btn-primary btn-sm', text: 'Save new email' });

  newEmail.addEventListener('blur', () => {
    const v = newEmail.value.trim();
    emailValidation.setState(v ? isValidEmailFormat(v) : null);
  });

  async function handleSubmit(e) {
    e.preventDefault();
    message.textContent = '';
    message.className = 'form-message';
    const emailVal = newEmail.value.trim();
    if (!emailVal || !isValidEmailFormat(emailVal)) {
      message.textContent = 'Enter a valid email address.';
      message.className = 'form-message error';
      return;
    }
    if (!password.value) {
      message.textContent = 'Enter your current password to confirm.';
      message.className = 'form-message error';
      return;
    }
    setButtonLoading(saveBtn, true, 'Sending…');
    try {
      await authApi.updateEmail(emailVal, password.value);
      showToast(`Verification sent to ${emailVal}. Your email won't change until verified.`, 'success');
      onDone();
    } catch (error) {
      message.textContent = authErrorMessage(error);
      message.className = 'form-message error';
      setButtonLoading(saveBtn, false);
    }
  }

  return el('form', { className: 'settings-inline-form-body', onSubmit: handleSubmit }, [
    el('label', { className: 'field' }, [el('span', { className: 'field-label', text: 'New email' }), emailWrap]),
    el('label', { className: 'field' }, [el('span', { className: 'field-label', text: 'Current password' }), passwordWrap]),
    message,
    saveBtn
  ]);
}

function buildChangePasswordForm(onDone) {
  const message = el('p', { className: 'form-message', text: '' });
  const currentPassword = el('input', { className: 'field-input', type: 'password', placeholder: 'Current password', autocomplete: 'current-password' });
  const currentWrap = el('div', { className: 'field-input-wrap has-toggle' }, [currentPassword, makePasswordToggle(currentPassword)]);
  const newPassword = el('input', { className: 'field-input', type: 'password', placeholder: 'Minimum 6 characters', autocomplete: 'new-password' });
  const newWrap = el('div', { className: 'field-input-wrap has-toggle' }, [newPassword, makePasswordToggle(newPassword)]);
  const confirmPassword = el('input', { className: 'field-input', type: 'password', placeholder: 'Repeat new password', autocomplete: 'new-password' });
  const confirmWrap = el('div', { className: 'field-input-wrap has-toggle' }, [confirmPassword, makePasswordToggle(confirmPassword)]);
  const confirmError = el('p', { className: 'field-error', text: '' });
  const saveBtn = el('button', { type: 'submit', className: 'btn btn-primary btn-sm', text: 'Save new password' });

  const strengthSegments = [0, 1, 2, 3].map(() => el('div', { className: 'strength-segment' }));
  const strengthMeter = el('div', { className: 'strength-meter', 'aria-hidden': 'true' }, strengthSegments);

  function updateStrength(score) {
    const cls = score <= 1 ? 'weak' : score <= 2 ? 'fair' : 'strong';
    strengthSegments.forEach((seg, i) => {
      seg.className = 'strength-segment' + (i < score ? ` ${cls}` : '');
    });
  }

  function checkConfirmMatch() {
    if (confirmPassword.value && confirmPassword.value !== newPassword.value) {
      confirmError.textContent = 'Passwords do not match.';
      return false;
    }
    confirmError.textContent = '';
    return true;
  }

  newPassword.addEventListener('input', () => {
    updateStrength(scorePassword(newPassword.value));
    if (confirmPassword.value) checkConfirmMatch();
  });
  confirmPassword.addEventListener('input', checkConfirmMatch);

  async function handleSubmit(e) {
    e.preventDefault();
    message.textContent = '';
    message.className = 'form-message';
    if (!currentPassword.value) {
      message.textContent = 'Enter your current password.';
      message.className = 'form-message error';
      return;
    }
    if (scorePassword(newPassword.value) === 0) {
      message.textContent = 'Use at least 6 characters for the new password.';
      message.className = 'form-message error';
      return;
    }
    if (!checkConfirmMatch() || newPassword.value !== confirmPassword.value) {
      confirmError.textContent = 'Passwords do not match.';
      return;
    }
    setButtonLoading(saveBtn, true, 'Saving…');
    try {
      await authApi.updatePassword(newPassword.value, currentPassword.value);
      showToast('Password updated.', 'success');
      onDone();
    } catch (error) {
      message.textContent = authErrorMessage(error);
      message.className = 'form-message error';
      setButtonLoading(saveBtn, false);
    }
  }

  return el('form', { className: 'settings-inline-form-body', onSubmit: handleSubmit }, [
    el('label', { className: 'field' }, [el('span', { className: 'field-label', text: 'Current password' }), currentWrap]),
    el('label', { className: 'field' }, [el('span', { className: 'field-label', text: 'New password' }), newWrap, strengthMeter]),
    el('label', { className: 'field' }, [el('span', { className: 'field-label', text: 'Confirm new password' }), confirmWrap, confirmError]),
    message,
    saveBtn
  ]);
}

function buildProfileSection(user) {
  const { row: emailRow } = buildToggleRow({
    label: 'Email',
    value: user.email || '',
    buttonText: 'Change email',
    buildForm: onDone => buildChangeEmailForm(user, onDone)
  });
  const { row: passwordRow } = buildToggleRow({
    label: 'Password',
    value: '••••••••',
    buttonText: 'Change password',
    buildForm: onDone => buildChangePasswordForm(onDone)
  });
  const verifiedRow = el('div', { className: 'settings-row' }, [
    el('div', { className: 'settings-row-main' }, [
      el('span', { className: 'settings-row-label', text: 'Email verified' }),
      el('span', { className: `settings-row-value ${user.emailVerified ? 'settings-verified' : 'settings-unverified'}` }, [
        createIcon(user.emailVerified ? 'check' : 'warning', { size: 'xs' }),
        user.emailVerified ? ' Verified' : ' Not verified'
      ])
    ])
  ]);

  return el('section', { className: 'settings-section' }, [
    el('h2', { className: 'settings-section-title', text: 'Profile' }),
    emailRow,
    passwordRow,
    verifiedRow
  ]);
}

function buildPreferencesSection() {
  const themeSelect = createSelect(
    [{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }],
    { value: getTheme(), ariaLabel: 'Theme', className: 'settings-select' }
  );
  themeSelect.addEventListener('change', () => setTheme(themeSelect.value));
  const unsubTheme = onThemeChange(theme => { themeSelect.value = theme; });

  const filterSelect = createSelect(FILTER_OPTIONS, {
    value: readDefaultFilterPreference(),
    ariaLabel: 'Default filter',
    className: 'settings-select'
  });
  filterSelect.addEventListener('change', () => {
    localStorage.setItem(KEYS.DEFAULT_FILTER, filterSelect.value);
    showToast('Default filter saved.', 'success');
  });

  const installBtn = el('button', {
    type: 'button',
    className: 'btn btn-secondary btn-sm',
    text: 'Install app',
    onClick: async () => {
      dismissFeatureBadge('pwa-install');
      const outcome = await promptInstall();
      if (outcome === 'accepted') showToast('Ascent installed.', 'success');
      installRow.hidden = !isInstallable();
    }
  });
  const dismissInstallBtn = el('button', {
    type: 'button',
    className: 'btn btn-ghost btn-sm',
    text: 'Dismiss',
    onClick: () => {
      dismissFeatureBadge('pwa-install');
      dismissInstallPrompt();
      installRow.hidden = true;
    }
  });
  const installRow = el('div', { className: 'settings-row', hidden: !isInstallable() }, [
    el('div', { className: 'settings-row-main' }, [
      el('span', { className: 'settings-row-label-group' }, [
        el('span', { className: 'settings-row-label', text: 'Install Ascent' }),
        createFeatureBadge('pwa-install')
      ].filter(Boolean)),
      el('span', { className: 'settings-row-value', text: 'Add Ascent to your device for offline access.' }),
      installBtn,
      dismissInstallBtn
    ])
  ]);
  const unsubInstall = onInstallabilityChange(installable => { installRow.hidden = !installable; });

  const section = el('section', { className: 'settings-section' }, [
    el('h2', { className: 'settings-section-title', text: 'Preferences' }),
    el('div', { className: 'settings-row' }, [
      el('div', { className: 'settings-row-main' }, [
        el('span', { className: 'settings-row-label', text: 'Theme' }),
        themeSelect
      ])
    ]),
    el('div', { className: 'settings-row' }, [
      el('div', { className: 'settings-row-main' }, [
        el('span', { className: 'settings-row-label', text: 'Default filter' }),
        filterSelect
      ])
    ]),
    installRow
  ]);

  section._cleanup = () => {
    unsubTheme();
    unsubInstall();
    themeSelect._cleanup?.();
    filterSelect._cleanup?.();
  };
  return section;
}

function buildDataSection(store) {
  return el('section', { className: 'settings-section' }, [
    el('h2', { className: 'settings-section-title', text: 'Data' }),
    el('div', { className: 'settings-row' }, [
      el('div', { className: 'settings-row-main' }, [
        el('span', { className: 'settings-row-label', text: 'Export your roadmap data' }),
        el('button', {
          type: 'button',
          className: 'btn btn-secondary btn-sm',
          text: 'Export JSON',
          onClick: () => exportBackupJson(store)
        })
      ])
    ])
  ]);
}

function buildDangerZone() {
  return el('section', { className: 'settings-section danger-zone' }, [
    el('h2', { className: 'settings-section-title', text: 'Danger zone' }),
    el('div', { className: 'settings-row' }, [
      el('div', { className: 'settings-row-main' }, [
        el('span', { className: 'settings-row-label', text: 'Delete account' }),
        el('button', {
          type: 'button',
          className: 'btn btn-danger btn-sm',
          text: 'Delete account',
          onClick: () => openDeleteAccountModal()
        })
      ]),
      el('p', { className: 'settings-row-hint', text: 'This permanently deletes your roadmap and account.' })
    ])
  ]);
}

function buildGuestView() {
  return el('div', { className: 'settings-guest-card' }, [
    el('h2', { text: 'Create a free account' }),
    el('p', { text: 'Save your roadmap across devices.' }),
    el('a', { href: '#/signup', className: 'btn btn-primary', text: 'Create account →' })
  ]);
}

export function renderSettings(app, { user, store, dailyTodoStore }) {
  if (!user) {
    navigate('/signin', true);
    return;
  }

  const themeToggleBtn = createThemeToggle();
  const sidebar = createSidebar({
    activeRoute: '/settings',
    user,
    store,
    dailyTodoStore,
    onDeleteAccount: user.isAnonymous ? null : () => openDeleteAccountModal()
  });
  const topbar = createTopbar({
    breadcrumb: 'Settings',
    user,
    syncPill: null,
    themeToggleBtn,
    dailyTodoNavBadge: null,
    notificationBell: createChangelogBell(),
    onToggleMobileSidebar: () => sidebar._toggleMobile()
  });

  let cleanupSections = [];
  const content = user.isAnonymous
    ? buildGuestView()
    : (() => {
        const profile = buildProfileSection(user);
        const preferences = buildPreferencesSection();
        const data = buildDataSection(store);
        const danger = buildDangerZone();
        cleanupSections = [preferences];
        return el('div', { className: 'settings-sections' }, [profile, preferences, data, danger]);
      })();

  const shell = el('div', { className: 'app-shell-2 settings-page fade-in' }, [
    sidebar,
    sidebar._backdrop,
    el('div', { className: 'app-shell-main' }, [
      topbar,
      el('div', { className: 'app-content settings-content' }, [
        el('header', { className: 'settings-header' }, [
          el('h1', { text: 'Settings' })
        ]),
        content
      ])
    ])
  ]);

  app.replaceChildren(shell);

  return () => {
    themeToggleBtn._cleanup?.();
    sidebar._cleanup?.();
    cleanupSections.forEach(section => section._cleanup?.());
  };
}
