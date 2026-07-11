import { describe, it, expect } from 'vitest';
import {
  findRootBlockRanges,
  findColorLiteralViolations,
  findCustomButtonClasses
} from '../../scripts/lint-theme.mjs';

describe('lint-theme: findColorLiteralViolations (issue #116)', () => {
  it('flags a hex color literal with no adjacent intentional comment', () => {
    const css = `:root {\n  --brand: #0f766e;\n}\n.some-class {\n  color: #ff0000;\n}\n`;
    const violations = findColorLiteralViolations(css);
    expect(violations).toHaveLength(1);
    expect(violations[0].line).toBe(5);
  });

  it('does not flag a hex color literal with an adjacent intentional comment', () => {
    const css = `:root {\n  --brand: #0f766e;\n}\n/* intentional: fixed white text on a brand background */\n.some-class {\n  color: #ff0000;\n}\n`;
    expect(findColorLiteralViolations(css)).toHaveLength(0);
  });

  it('does not flag literals inside the :root token blocks', () => {
    const css = `:root {\n  --brand: #0f766e;\n  --danger: #dc2626;\n}\n:root[data-theme='dark'] {\n  --brand: #2dd4bf;\n}\n`;
    expect(findColorLiteralViolations(css)).toHaveLength(0);
  });

  it('does not flag a hex value mentioned only in prose inside a comment', () => {
    const css = `:root {\n  --brand: #0f766e;\n}\n/* some historical note mentioning #ff0000 for context */\n.some-class {\n  color: var(--brand);\n}\n`;
    expect(findColorLiteralViolations(css)).toHaveLength(0);
  });

  it('flags an rgba() literal the same way as a hex literal', () => {
    const css = `:root {\n  --brand: #0f766e;\n}\n.overlay {\n  background: rgba(0, 0, 0, 0.5);\n}\n`;
    const violations = findColorLiteralViolations(css);
    expect(violations).toHaveLength(1);
  });
});

describe('lint-theme: findRootBlockRanges', () => {
  it('finds both the light and dark :root token block ranges', () => {
    const css = `:root {\n  --a: 1;\n}\n.x { color: red; }\n:root[data-theme='dark'] {\n  --a: 2;\n}\n`;
    const lines = css.split('\n');
    const ranges = findRootBlockRanges(lines);
    expect(ranges).toHaveLength(2);
  });
});

describe('lint-theme: findCustomButtonClasses', () => {
  it('extracts a non-.btn custom button class', () => {
    const js = `el('button', {\n  type: 'button',\n  className: 'my-custom-toggle',\n  onClick: () => {}\n});`;
    expect(findCustomButtonClasses(js)).toContain('my-custom-toggle');
  });

  it('skips a button whose class list already includes a .btn family class', () => {
    const js = `el('button', {\n  type: 'button',\n  className: 'btn btn-ghost btn-icon my-toggle',\n  onClick: () => {}\n});`;
    expect(findCustomButtonClasses(js)).toHaveLength(0);
  });

  it('ignores interpolated template-literal segments', () => {
    const js = `el('button', {\n  className: \`heatmap-cell gr-\${row + 1}\`\n});`;
    expect(findCustomButtonClasses(js)).toEqual(['heatmap-cell']);
  });
});
