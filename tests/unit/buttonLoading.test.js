import { describe, it, expect, beforeEach } from 'vitest';
import { setButtonLoading } from '../../src/ui/utils/buttonLoading.js';

describe('setButtonLoading', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  function makeButton(label) {
    const btn = document.createElement('button');
    btn.textContent = label;
    document.body.appendChild(btn);
    return btn;
  }

  it('disables the button and shows a spinner + loading label while loading', () => {
    const btn = makeButton('Sign in');
    setButtonLoading(btn, true, 'Signing in…');
    expect(btn.disabled).toBe(true);
    expect(btn.querySelector('.btn-spinner')).not.toBeNull();
    expect(btn.textContent).toContain('Signing in…');
  });

  it('restores the original label and re-enables the button when loading ends', () => {
    const btn = makeButton('Sign in');
    setButtonLoading(btn, true, 'Signing in…');
    setButtonLoading(btn, false);
    expect(btn.disabled).toBe(false);
    expect(btn.textContent).toBe('Sign in');
    expect(btn.querySelector('.btn-spinner')).toBeNull();
  });

  it('restores the correct original label across repeated loading/idle toggles', () => {
    const btn = makeButton('Create account');
    setButtonLoading(btn, true, 'Creating account…');
    setButtonLoading(btn, false);
    setButtonLoading(btn, true, 'Creating account…');
    setButtonLoading(btn, false);
    expect(btn.textContent).toBe('Create account');
  });
});
