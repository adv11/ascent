import { describe, it, expect } from 'vitest';
import { createNotificationBadge } from '../../src/ui/components/notificationBadge.js';

describe('createNotificationBadge', () => {
  it('renders a plain dot when count is 0/omitted', () => {
    const node = createNotificationBadge();
    expect(node.className).toBe('notification-badge notification-badge-dot');
    expect(node.textContent).toBe('');
  });

  it('renders the exact count when under the max', () => {
    const node = createNotificationBadge(7);
    expect(node.textContent).toBe('7');
    expect(node.className).toBe('notification-badge');
  });

  it('caps display at "max+" when count exceeds max', () => {
    const node = createNotificationBadge(150, { max: 99 });
    expect(node.textContent).toBe('99+');
  });
});
