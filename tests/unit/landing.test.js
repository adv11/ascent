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
