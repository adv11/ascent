import { describe, it, expect, beforeEach } from 'vitest';
import { renderLanding } from '../../src/ui/pages/landing.js';
import { TEMPLATES } from '../../src/data/templates/index.js';

function setup() {
  const app = document.createElement('div');
  document.body.appendChild(app);
  renderLanding(app);
  return app;
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('landing page', () => {
  it('renders the brand mark and headline', () => {
    const app = setup();
    expect(app.querySelector('.landing-page')).not.toBeNull();
    expect(app.querySelector('.landing-hero-title').textContent).toBe('Engineer your next move.');
  });

  it('links CTAs to sign-up and sign-in routes', () => {
    const app = setup();
    const signUpLinks = [...app.querySelectorAll('a[href="#/signup"]')];
    const signInLinks = [...app.querySelectorAll('a[href="#/signin"]')];
    expect(signUpLinks.length).toBeGreaterThan(0);
    expect(signInLinks.length).toBeGreaterThan(0);
  });

  it('renders a template chip for every starter template, plus a build-your-own chip', () => {
    const app = setup();
    const chips = [...app.querySelectorAll('.landing-template-chip')];
    expect(chips.length).toBe(TEMPLATES.length + 1);
    TEMPLATES.forEach(t => {
      expect(chips.some(c => c.textContent.includes(t.name))).toBe(true);
    });
  });

  it('renders the progress split with a heatmap mock', () => {
    const app = setup();
    expect(app.querySelector('#landing-progress')).not.toBeNull();
    expect(app.querySelectorAll('.landing-heat-cell').length).toBeGreaterThan(0);
  });

  it('renders all four privacy facts', () => {
    const app = setup();
    expect(app.querySelectorAll('.landing-privacy-fact').length).toBe(4);
  });

  it('renders exactly two feature cards', () => {
    const app = setup();
    expect(app.querySelectorAll('.feature-card').length).toBe(2);
  });

  it('renders three how-it-works step cards, numbered 1-3', () => {
    const app = setup();
    const steps = [...app.querySelectorAll('.step-card')];
    expect(steps.length).toBe(3);
    expect(steps.map(s => s.querySelector('.step-card-number').textContent)).toEqual(['1', '2', '3']);
  });

  it('derives the starter-roadmap count from the template registry, not a hardcoded number', () => {
    const app = setup();
    const stat = app.querySelector('.landing-hero-stat').textContent;
    expect(stat).toContain(String(TEMPLATES.length));
  });

  it('links the footer to the developer profile page (issue #414)', () => {
    const app = setup();
    const link = app.querySelector('.landing-footer-link');
    expect(link).not.toBeNull();
    expect(link.getAttribute('href')).toBe('#/creator');
  });

  it('never hardcodes the brand name outside brand.js', () => {
    const app = setup();
    const footerCopy = app.querySelector('.landing-footer-copy').textContent;
    expect(footerCopy).not.toContain('Ascent');
  });

  it('scrolls to the features section when the nav link is clicked', () => {
    const app = setup();
    const featuresSection = app.querySelector('#landing-features');
    let scrolledInto = false;
    featuresSection.scrollIntoView = () => { scrolledInto = true; };
    const featuresLink = [...app.querySelectorAll('.landing-nav-link')].find(b => b.textContent === 'Features');
    featuresLink.click();
    expect(scrolledInto).toBe(true);
  });
});
