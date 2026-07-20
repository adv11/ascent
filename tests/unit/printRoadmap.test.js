import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

let capturedContent = null;
const close = vi.fn();
const openModal = vi.fn(({ content }) => {
  capturedContent = content;
  return { close };
});

vi.mock('../../src/ui/components/modal.js', () => ({ openModal }));
vi.mock('../../src/data/templates/index.js', () => ({
  getTemplate: id => (id === 'java-backend' ? { name: 'Java Backend Engineer' } : null)
}));

const { triggerRoadmapPrint } = await import('../../src/ui/utils/printRoadmap.js');

function fakeStore() {
  return {
    getSnapshot: () => ({
      activeTemplateId: 'java-backend',
      customRoadmaps: [],
      phases: [{ title: 'Core', priority: 'P0' }],
      allItems: {
        'item-1': {
          id: 'item-1', title: 'Spring Boot basics', phase: 'Core', section: 'Framework',
          priority: 'P1', done: true, notes: 'Secret note', deleted: false,
          resources: [{ label: 'Docs', url: 'https://example.com' }]
        }
      }
    })
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  capturedContent = null;
  document.body.classList.remove('print-mode');
  document.querySelectorAll('.print-roadmap').forEach(node => node.remove());
});

afterEach(() => {
  document.body.classList.remove('print-mode');
  document.querySelectorAll('.print-roadmap').forEach(node => node.remove());
});

describe('triggerRoadmapPrint', () => {
  it('opens a modal with an "Include notes" checkbox, unchecked by default', () => {
    triggerRoadmapPrint(fakeStore());
    expect(openModal).toHaveBeenCalledTimes(1);
    const checkbox = capturedContent.find(node => node.tagName === 'LABEL')?.querySelector('input[type="checkbox"]');
    expect(checkbox.checked).toBe(false);
  });

  it('appends a .print-roadmap node and toggles print-mode when Print is clicked, excluding notes by default', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    triggerRoadmapPrint(fakeStore());

    const printBtn = capturedContent.find(n => n.tagName === 'DIV' && n.className === 'confirm-dialog-actions')
      .querySelector('.btn-primary');
    printBtn.click();

    expect(close).toHaveBeenCalled();
    expect(document.body.classList.contains('print-mode')).toBe(true);
    const printedNode = document.querySelector('.print-roadmap');
    expect(printedNode).not.toBeNull();
    expect(printedNode.textContent).toContain('Spring Boot basics');
    expect(printedNode.textContent).not.toContain('Secret note');
    expect(printSpy).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new Event('afterprint'));
    expect(document.body.classList.contains('print-mode')).toBe(false);
    expect(document.querySelector('.print-roadmap')).toBeNull();
  });

  it('does not tear down the print DOM on a premature afterprint (mobile race) — waits for print media to actually stop matching', () => {
    vi.spyOn(window, 'print').mockImplementation(() => {});
    let printMediaListener = null;
    const mediaQueryList = {
      matches: true,
      addEventListener: (event, fn) => { if (event === 'change') printMediaListener = fn; },
      removeEventListener: vi.fn()
    };
    vi.spyOn(window, 'matchMedia').mockReturnValue(mediaQueryList);

    triggerRoadmapPrint(fakeStore());
    const printBtn = capturedContent.find(n => n.tagName === 'DIV' && n.className === 'confirm-dialog-actions')
      .querySelector('.btn-primary');
    printBtn.click();
    expect(document.body.classList.contains('print-mode')).toBe(true);

    // afterprint fires early, as on Android Chrome, while print media still matches
    window.dispatchEvent(new Event('afterprint'));
    expect(document.body.classList.contains('print-mode')).toBe(true);
    expect(document.querySelector('.print-roadmap')).not.toBeNull();

    // print media genuinely stops matching once the OS print job actually finishes
    mediaQueryList.matches = false;
    printMediaListener({ matches: false });
    expect(document.body.classList.contains('print-mode')).toBe(false);
    expect(document.querySelector('.print-roadmap')).toBeNull();
  });

  it('includes notes when the checkbox is checked before printing', () => {
    vi.spyOn(window, 'print').mockImplementation(() => {});
    triggerRoadmapPrint(fakeStore());

    const checkbox = capturedContent.find(node => node.tagName === 'LABEL')?.querySelector('input[type="checkbox"]');
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));

    const printBtn = capturedContent.find(n => n.tagName === 'DIV' && n.className === 'confirm-dialog-actions')
      .querySelector('.btn-primary');
    printBtn.click();

    expect(document.querySelector('.print-roadmap').textContent).toContain('Secret note');
    window.dispatchEvent(new Event('afterprint'));
  });
});
