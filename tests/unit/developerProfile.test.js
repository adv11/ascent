import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderDeveloperProfile } from '../../src/ui/pages/developerProfile.js';
import { DEVELOPER_PROFILE } from '../../src/data/developerProfile.js';

function setup() {
  const app = document.createElement('div');
  document.body.appendChild(app);
  renderDeveloperProfile(app);
  return app;
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('developer profile page', () => {
  it('renders the profile name, tagline, and bio', () => {
    const app = setup();
    expect(app.querySelector('.developer-profile-name').textContent).toBe(DEVELOPER_PROFILE.name);
    expect(app.querySelector('.developer-profile-tagline').textContent).toBe(DEVELOPER_PROFILE.tagline);
    expect(app.querySelector('.developer-profile-bio').textContent).toBe(DEVELOPER_PROFILE.bio);
  });

  it('renders every link from DEVELOPER_PROFILE.links', () => {
    const app = setup();
    const cards = [...app.querySelectorAll('.developer-profile-link-card')];
    expect(cards.length).toBe(DEVELOPER_PROFILE.links.length);
    DEVELOPER_PROFILE.links.forEach(link => {
      const card = cards.find(c => c.getAttribute('href') === link.url);
      expect(card, `no card found for ${link.label}`).toBeTruthy();
      expect(card.querySelector('.developer-profile-link-label').textContent).toBe(link.label);
    });
  });

  it('opens every link in a new tab with rel="noopener noreferrer"', () => {
    const app = setup();
    const cards = [...app.querySelectorAll('.developer-profile-link-card')];
    cards.forEach(card => {
      expect(card.getAttribute('target')).toBe('_blank');
      expect(card.getAttribute('rel')).toBe('noopener noreferrer');
    });
  });

  it('renders the mailto: email link (allowed alongside http/https for this page only)', () => {
    const app = setup();
    const emailCard = [...app.querySelectorAll('.developer-profile-link-card')]
      .find(c => c.getAttribute('href')?.startsWith('mailto:'));
    expect(emailCard).toBeTruthy();
  });

  it('drops a link whose url fails validation instead of rendering an unsafe href', async () => {
    vi.resetModules();
    vi.doMock('../../src/data/developerProfile.js', () => ({
      DEVELOPER_PROFILE: {
        name: 'Test Dev',
        tagline: 'Tagline',
        bio: 'Bio.',
        links: [
          { id: 'safe', label: 'Safe', url: 'https://example.com', icon: 'globe' },
          { id: 'unsafe', label: 'Unsafe', url: 'javascript:alert(1)', icon: 'link' }
        ]
      }
    }));
    const { renderDeveloperProfile: renderWithBadLink } = await import('../../src/ui/pages/developerProfile.js');
    const app = document.createElement('div');
    document.body.appendChild(app);
    renderWithBadLink(app);
    const cards = [...app.querySelectorAll('.developer-profile-link-card')];
    expect(cards.length).toBe(1);
    expect(cards[0].getAttribute('href')).toBe('https://example.com');
    vi.doUnmock('../../src/data/developerProfile.js');
    vi.resetModules();
  });

  it('never hardcodes the brand name outside brand.js', () => {
    const app = setup();
    const footerCopy = app.querySelector('.landing-footer-copy').textContent;
    expect(footerCopy).not.toContain('Ascent');
  });

  it('renders inside the shared landing-page shell', () => {
    const app = setup();
    expect(app.querySelector('.developer-profile-page')).not.toBeNull();
  });
});
