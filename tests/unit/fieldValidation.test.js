import { describe, it, expect, beforeEach } from 'vitest';
import { isValidEmailFormat, attachFieldValidationIcon } from '../../src/ui/utils/fieldValidation.js';

describe('isValidEmailFormat', () => {
  it('accepts a well-formed email', () => {
    expect(isValidEmailFormat('user@example.com')).toBe(true);
  });

  it('rejects a missing @', () => {
    expect(isValidEmailFormat('userexample.com')).toBe(false);
  });

  it('rejects a missing domain dot', () => {
    expect(isValidEmailFormat('user@example')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isValidEmailFormat('')).toBe(false);
  });

  it('rejects a string with whitespace', () => {
    expect(isValidEmailFormat('user @example.com')).toBe(false);
  });
});

describe('attachFieldValidationIcon', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  function makeWrap() {
    const wrap = document.createElement('div');
    document.body.appendChild(wrap);
    return wrap;
  }

  // issue #136 Phase 2 follow-up — the icon is now a createIcon() svg, not
  // text, so these assert on child-node presence rather than glyph text.
  it('renders no icon before setState is ever called with a value', () => {
    const wrap = makeWrap();
    attachFieldValidationIcon(wrap);
    expect(wrap.querySelector('.field-validation-icon').children.length).toBe(0);
  });

  it('setState(true) shows a green checkmark', () => {
    const wrap = makeWrap();
    const { setState } = attachFieldValidationIcon(wrap);
    setState(true);
    const icon = wrap.querySelector('.field-validation-icon');
    expect(icon.querySelector('svg')).not.toBeNull();
    expect(icon.classList.contains('valid')).toBe(true);
  });

  it('setState(false) shows a red close mark', () => {
    const wrap = makeWrap();
    const { setState } = attachFieldValidationIcon(wrap);
    setState(false);
    const icon = wrap.querySelector('.field-validation-icon');
    expect(icon.querySelector('svg')).not.toBeNull();
    expect(icon.classList.contains('invalid')).toBe(true);
  });

  it('setState(null) clears the icon back to empty', () => {
    const wrap = makeWrap();
    const { setState } = attachFieldValidationIcon(wrap);
    setState(true);
    setState(null);
    const icon = wrap.querySelector('.field-validation-icon');
    expect(icon.children.length).toBe(0);
    expect(icon.classList.contains('valid')).toBe(false);
    expect(icon.classList.contains('invalid')).toBe(false);
  });
});
