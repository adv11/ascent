import { describe, it, expect, beforeEach } from 'vitest';
import { openNewRoadmapModal } from '../../src/ui/components/newRoadmapModal.js';

function getOverlay() {
  return document.querySelector('.modal-overlay');
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('openNewRoadmapModal (issue #4)', () => {
  it('resolves { title, description } with both fields trimmed on submit', async () => {
    const promise = openNewRoadmapModal();
    const overlay = getOverlay();
    overlay.querySelector('input').value = '  My Roadmap  ';
    overlay.querySelector('textarea').value = '  Some notes  ';
    overlay.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));

    await expect(promise).resolves.toEqual({ title: 'My Roadmap', description: 'Some notes' });
    expect(getOverlay()).toBeNull();
  });

  it('rejects an empty/whitespace-only title without resolving, and shows an inline error', async () => {
    const promise = openNewRoadmapModal();
    const overlay = getOverlay();
    overlay.querySelector('input').value = '   ';
    overlay.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));

    expect(getOverlay()).toBeTruthy(); // still open
    expect(overlay.querySelector('.form-message').textContent).not.toBe('');

    overlay.querySelector('input').value = 'Now valid';
    overlay.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
    await expect(promise).resolves.toEqual({ title: 'Now valid', description: '' });
  });

  it('resolves null when Cancel is clicked', async () => {
    const promise = openNewRoadmapModal();
    getOverlay().querySelector('button.btn-secondary').click();
    await expect(promise).resolves.toBeNull();
    expect(getOverlay()).toBeNull();
  });

  it('resolves null on Escape', async () => {
    const promise = openNewRoadmapModal();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await expect(promise).resolves.toBeNull();
  });

  it('resolves null on outside click', async () => {
    const promise = openNewRoadmapModal();
    getOverlay().click();
    await expect(promise).resolves.toBeNull();
  });
});
