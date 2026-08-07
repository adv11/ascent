import { el } from '../dom.js';
import { navigate } from '../router.js';
import { authApi, authErrorMessage } from '../../services/firebase.js';
import { showToast } from '../components/toast.js';
import { createSidebar } from '../components/sidebar.js';
import { createTopbar } from '../components/topbar.js';
import { createGuestBanner } from '../components/guestBanner.js';
import { createBottomNav } from '../components/bottomNav.js';
import { openDeleteAccountModal } from '../components/deleteAccountModal.js';
import { openFeedbackModal } from '../components/feedbackModal.js';
import { openMyReports } from '../components/myReports.js';
import { exportBackupJson } from '../utils/backupActions.js';
import { scorePassword, makePasswordToggle } from '../utils/password.js';
import { isValidEmailFormat, attachFieldValidationIcon } from '../utils/fieldValidation.js';
import { setButtonLoading } from '../utils/buttonLoading.js';
import { getTheme, setTheme, onThemeChange } from '../../services/theme.js';
import { KEYS } from '../../services/localStorageKeys.js';
import { createIcon } from '../components/icons.js';
import { readDefaultFilterPreference } from '../utils/defaultFilterPreference.js';
import { isInstallable, onInstallabilityChange, promptInstall } from '../../services/pwaInstall.js';
import { createFeatureBadge, dismissFeatureBadge } from '../components/featureBadge.js';
import { createSelect } from '../components/select.js';
import { priorityLabel } from '../utils/priorityLabels.js';
import { createTabs } from '../components/tabs.js';
import { getTextSize, setTextSize, getAnimationsOff, setAnimationsOff } from '../../services/uiPreferences.js';

const TEXT_SIZE_OPTIONS = [
  { value: 'default', label: 'Default' },
  { value: 'large', label: 'Large' },
  { value: 'largest', label: 'Largest' }
];

const FILTER_OPTIONS = [
  { value: 'ALL', label: 'All' },
  { value: 'P0', label: priorityLabel('P0') },
  { value: 'P1', label: priorityLabel('P1') },
  { value: 'P2', label: priorityLabel('P2') },
  { value: 'P3', label: priorityLabel('P3') }
];

// A small exclusive-choice segmented control (design-system.md §5's `.seg`/
// `.seg-item`, this its first real call site — same "built, not yet wired
// into a page" precedent tabs.js itself was in before this issue). Not a
// full component module since this page is the only caller; `onChange`
// fires with the newly selected value.
function buildSegmentedControl(options, { value, ariaLabel, onChange }) {
  let current = value;
  const buttons = options.map(opt => el('button', {
    type: 'button',
    className: 'seg-item',
    'aria-selected': String(opt.value === current),
    text: opt.label,
    onClick: () => {
      if (opt.value === current) return;
      current = opt.value;
      buttons.forEach((btn, i) => btn.setAttribute('aria-selected', String(options[i].value === current)));
      onChange(current);
    }
  }));
  return el('div', { className: 'seg', role: 'radiogroup', 'aria-label': ariaLabel }, buttons);
}

// A checkbox-driven toggle switch (`.switch`/`.switch-input`/`.switch-track`,
// app.css, this page's first real call site) — `role="switch"` plus the
// existing `checked`/`change` checkbox contract, so callers wire it exactly
// like `animationsOffCheckbox` used to be wired as a plain checkbox.
function buildSwitch({ id, checked }) {
  const input = el('input', { type: 'checkbox', id, role: 'switch', className: 'switch-input' });
  input.checked = checked;
  const track = el('span', { className: 'switch-track', 'aria-hidden': 'true' });
  const wrap = el('span', { className: 'switch' }, [input, track]);
  return { wrap, input };
}

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

function buildChangeNameForm(user, valueEl, onDone) {
  const message = el('p', { className: 'form-message', text: '' });
  const nameInput = el('input', {
    className: 'field-input',
    type: 'text',
    placeholder: 'Your name',
    autocomplete: 'name',
    value: user.displayName || ''
  });
  const saveBtn = el('button', { type: 'submit', className: 'btn btn-primary btn-sm', text: 'Save name' });

  async function handleSubmit(e) {
    e.preventDefault();
    message.textContent = '';
    message.className = 'form-message';
    const nameVal = nameInput.value.trim();
    if (!nameVal) {
      message.textContent = 'Enter a name.';
      message.className = 'form-message error';
      return;
    }
    setButtonLoading(saveBtn, true, 'Saving…');
    try {
      await authApi.updateProfile(nameVal);
      user.displayName = nameVal;
      valueEl.textContent = nameVal;
      showToast('Name updated.', 'success');
      onDone();
    } catch (error) {
      message.textContent = authErrorMessage(error);
      message.className = 'form-message error';
      setButtonLoading(saveBtn, false);
    }
  }

  return el('form', { className: 'settings-inline-form-body', onSubmit: handleSubmit }, [
    el('label', { className: 'field' }, [el('span', { className: 'field-label', text: 'Name' }), nameInput]),
    message,
    saveBtn
  ]);
}

function buildProfileSection(user) {
  const { row: nameRow, valueEl: nameValueEl } = buildToggleRow({
    label: 'Name',
    value: user.displayName || 'Not set',
    buttonText: 'Change name',
    buildForm: onDone => buildChangeNameForm(user, nameValueEl, onDone)
  });
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
    el('h2', { className: 'settings-section-title', text: 'Account' }),
    el('p', { className: 'settings-section-subtitle', text: 'Your name, email, and password.' }),
    nameRow,
    emailRow,
    passwordRow,
    verifiedRow
  ]);
}

function buildInstallRow() {
  const installBtn = el('button', {
    type: 'button',
    className: 'btn btn-secondary btn-sm',
    text: 'Install app',
    onClick: async () => {
      dismissFeatureBadge('pwa-install');
      setButtonLoading(installBtn, true, 'Installing…');
      const outcome = await promptInstall();
      setButtonLoading(installBtn, false);
      if (outcome === 'accepted') {
        showToast('Ascent installed.', 'success');
      } else if (outcome === 'unavailable' || outcome === null) {
        showToast('Could not open the install dialog. Reload the page and try again.', 'error');
      }
      installRow.hidden = !isInstallable();
    }
  });
  const installRow = el('div', { className: 'settings-row', hidden: !isInstallable() }, [
    el('div', { className: 'settings-row-main' }, [
      el('span', { className: 'settings-row-label-group' }, [
        el('span', { className: 'settings-row-label', text: 'Install Ascent' }),
        createFeatureBadge('pwa-install')
      ].filter(Boolean)),
      el('span', { className: 'settings-row-value', text: 'Add Ascent to your device for offline access.' }),
      installBtn
    ])
  ]);
  const unsubInstall = onInstallabilityChange(installable => { installRow.hidden = !installable; });
  return { installRow, unsubInstall };
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

  const textSizeControl = buildSegmentedControl(TEXT_SIZE_OPTIONS, {
    value: getTextSize(),
    ariaLabel: 'Text size',
    onChange: size => {
      setTextSize(size);
      showToast('Text size saved.', 'success');
    }
  });

  const { wrap: animationsOffSwitch, input: animationsOffCheckbox } = buildSwitch({
    id: 'animationsOff',
    checked: getAnimationsOff()
  });
  animationsOffCheckbox.addEventListener('change', () => {
    setAnimationsOff(animationsOffCheckbox.checked);
    showToast(animationsOffCheckbox.checked ? 'Animations turned off.' : 'Animations turned on.', 'success');
  });

  const { installRow, unsubInstall } = buildInstallRow();

  const section = el('section', { className: 'settings-section' }, [
    el('h2', { className: 'settings-section-title', text: 'Preferences' }),
    el('p', { className: 'settings-section-subtitle', text: 'How Ascent looks and what it shows you first.' }),
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
    el('div', { className: 'settings-row' }, [
      el('div', { className: 'settings-row-main' }, [
        el('span', { className: 'settings-row-label-group' }, [
          el('span', { className: 'settings-row-label', text: 'Text size' }),
        ]),
        el('span', { className: 'settings-row-value', text: 'Makes every label and topic bigger, across the whole app.' })
      ]),
      textSizeControl
    ]),
    el('div', { className: 'settings-row' }, [
      el('div', { className: 'settings-row-main' }, [
        el('label', { className: 'settings-row-label-group', for: 'animationsOff' }, [
          el('span', { className: 'settings-row-label', text: 'Animations' })
        ]),
        animationsOffSwitch
      ]),
      el('p', { className: 'settings-row-hint', text: 'Turn off if movement on screen bothers you.' })
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

// Issue #498 — the other entry point for feedback/reports, replacing
// feedbackWidget.js's floating trigger (removed with this issue). Both this
// and sidebar.js's account-menu item open the identical feedbackModal.js.
function buildSupportSection(user) {
  return el('section', { className: 'settings-section' }, [
    el('h2', { className: 'settings-section-title', text: 'Support' }),
    el('p', { className: 'settings-section-subtitle', text: 'Tell us what broke or what would help.' }),
    el('div', { className: 'settings-row' }, [
      el('div', { className: 'settings-row-main' }, [
        el('span', { className: 'settings-row-label', text: 'Send feedback' }),
        el('button', {
          type: 'button',
          className: 'btn btn-secondary btn-sm',
          text: 'Send feedback',
          onClick: () => openFeedbackModal({ user })
        })
      ])
    ]),
    el('div', { className: 'settings-row' }, [
      el('div', { className: 'settings-row-main' }, [
        el('span', { className: 'settings-row-label', text: 'My reports' }),
        el('button', {
          type: 'button',
          className: 'btn btn-secondary btn-sm',
          text: 'My reports',
          onClick: () => openMyReports({ user })
        })
      ])
    ])
  ]);
}

function buildDataSection(store) {
  return el('section', { className: 'settings-section' }, [
    el('h2', { className: 'settings-section-title', text: 'Your data' }),
    el('p', { className: 'settings-section-subtitle', text: 'Export a backup of your roadmap data.' }),
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
    el('h2', { className: 'settings-section-title', text: 'Delete account' }),
    el('p', { className: 'settings-section-subtitle', text: 'Permanently delete your account and roadmap data.' }),
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

  const onDeleteAccount = user.isAnonymous ? null : () => openDeleteAccountModal();
  const sidebar = createSidebar({
    activeRoute: '/settings',
    user,
    store,
    dailyTodoStore,
    onDeleteAccount
  });
  const topbar = createTopbar({
    breadcrumb: 'Settings',
    user,
    store,
    dailyTodoStore,
    onDeleteAccount
  });
  const guestBanner = createGuestBanner(user);
  const bottomNav = createBottomNav({ activeRoute: '/settings' });

  let cleanupSections = [];
  const content = user.isAnonymous
    ? buildGuestView()
    : (() => {
        const profile = buildProfileSection(user);
        const preferences = buildPreferencesSection();
        const support = buildSupportSection(user);
        const data = buildDataSection(store);
        const danger = buildDangerZone();
        cleanupSections = [preferences];
        const tabs = createTabs({
          items: [
            { id: 'account', label: 'Account', panel: profile },
            { id: 'preferences', label: 'Preferences', panel: preferences },
            { id: 'support', label: 'Support', panel: support },
            { id: 'data', label: 'Your data', panel: data },
            { id: 'delete', label: 'Delete account', panel: danger }
          ]
        });
        return el('div', { className: 'settings-tabs' }, [tabs]);
      })();

  const shell = el('div', { className: 'app-shell-2 settings-page fade-in' }, [
    sidebar,
    el('div', { className: 'app-shell-main' }, [
      topbar,
      el('div', { className: 'app-content settings-content' }, [
        guestBanner,
        el('header', { className: 'settings-header' }, [
          el('h1', { text: 'Settings' })
        ]),
        content
      ])
    ]),
    bottomNav
  ]);

  app.replaceChildren(shell);

  return () => {
    sidebar._cleanup?.();
    topbar._cleanup?.();
    bottomNav._cleanup?.();
    cleanupSections.forEach(section => section._cleanup?.());
  };
}
