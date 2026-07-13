import { describe, it, expect } from 'vitest';
import { buildTodosIcs } from '../../src/core/dailyTodo/icsExport.js';

const NOW = 1700000000000;

function todo(overrides = {}) {
  return {
    id: 'todo-1',
    title: 'Review Spring Boot notes',
    createdAt: NOW - 60 * 60 * 1000,
    expiresAt: NOW + 60 * 60 * 1000,
    done: false,
    ...overrides
  };
}

describe('buildTodosIcs', () => {
  it('produces a valid VCALENDAR wrapping one VEVENT per active todo', () => {
    const ics = buildTodosIcs([todo()], NOW);
    expect(ics).toMatch(/^BEGIN:VCALENDAR\r\n/);
    expect(ics).toMatch(/VERSION:2\.0\r\n/);
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('END:VEVENT');
    expect(ics.trim().endsWith('END:VCALENDAR')).toBe(true);
  });

  it('derives DTSTART/DTEND from expiresAt as a 15-minute block', () => {
    const ics = buildTodosIcs([todo({ expiresAt: NOW + 60 * 60 * 1000 })], NOW);
    const dtstartMatch = ics.match(/DTSTART:(\d{8}T\d{6}Z)/);
    const dtendMatch = ics.match(/DTEND:(\d{8}T\d{6}Z)/);
    expect(dtstartMatch).not.toBeNull();
    expect(dtendMatch).not.toBeNull();
    const parseIcs = str => Date.UTC(
      +str.slice(0, 4), +str.slice(4, 6) - 1, +str.slice(6, 8),
      +str.slice(9, 11), +str.slice(11, 13), +str.slice(13, 15)
    );
    expect(parseIcs(dtendMatch[1])).toBe(NOW + 60 * 60 * 1000);
    expect(parseIcs(dtstartMatch[1])).toBe(NOW + 60 * 60 * 1000 - 15 * 60 * 1000);
  });

  it('gives each todo a stable UID derived from its id', () => {
    const ics = buildTodosIcs([todo({ id: 'todo-abc' })], NOW);
    expect(ics).toContain('UID:todo-abc@ascent-app.local');
  });

  it('excludes done todos', () => {
    const ics = buildTodosIcs([todo({ done: true })], NOW);
    expect(ics).not.toContain('BEGIN:VEVENT');
  });

  it('excludes expired (missed) todos', () => {
    const ics = buildTodosIcs([todo({ expiresAt: NOW - 1000 })], NOW);
    expect(ics).not.toContain('BEGIN:VEVENT');
  });

  it('folds a long title across multiple lines per RFC 5545', () => {
    const longTitle = 'A'.repeat(120);
    const ics = buildTodosIcs([todo({ title: longTitle })], NOW);
    const summaryLine = ics.split('\r\n').find(line => line.startsWith('SUMMARY:'));
    expect(summaryLine.length).toBeLessThanOrEqual(75);
    expect(ics).toContain(`SUMMARY:${'A'.repeat(67)}`);
  });

  it('escapes commas, semicolons, and newlines in the title', () => {
    const ics = buildTodosIcs([todo({ title: 'Buy milk, eggs; and bread\nfor breakfast' })], NOW);
    expect(ics).toContain('SUMMARY:Buy milk\\, eggs\\; and bread\\nfor breakfast');
  });

  it('produces an empty calendar (no VEVENT) for an empty todo list', () => {
    const ics = buildTodosIcs([], NOW);
    expect(ics).not.toContain('BEGIN:VEVENT');
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('END:VCALENDAR');
  });
});
