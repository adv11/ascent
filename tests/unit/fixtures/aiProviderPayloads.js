// Issue #121 item 2 — cross-provider/edge-case test matrix. Unlike
// chatgptCorruptedPayload.js (a real payload captured live from a reporter's
// ChatGPT session), the payloads below are synthetic — this environment has
// no live access to ChatGPT/Gemini/Claude/Copilot chat sessions to capture
// real output from, so they are deliberately labeled as representative
// shapes, not captured transcripts. What they DO cover, faithfully: the
// structural edge cases item 2 named (a roadmap near the 500-item cap, a
// roadmap where most items carry resources, non-ASCII/unicode titles) plus
// the three item-shape variants the schema itself allows (plain string,
// [title, priority] tuple, and the full object form) mixed together the way
// a real AI response frequently does, since #100's own prompt only asks a
// model to prefer the object form for "most" items, not all.

// A large roadmap deliberately just under the 500-item cap (importValidator.js's
// MAX_ITEMS), with a resource on every object-form item — the two edge cases
// (near-cap size, resource-heavy) compound into the single most
// perf/correctness-sensitive shape a real AI-generated roadmap can produce.
export function buildLargeRoadmapPayload(itemCount = 490) {
  const phases = [];
  let remaining = itemCount;
  let phaseIndex = 0;
  while (remaining > 0) {
    const itemsInThisPhase = Math.min(35, remaining);
    const items = [];
    for (let i = 0; i < itemsInThisPhase; i += 1) {
      items.push({
        title: `Phase ${phaseIndex} topic ${i}`,
        priority: ['P0', 'P1', 'P2', 'P3'][i % 4],
        resources: [
          { label: `Docs ${i}`, url: `https://docs.example.com/phase-${phaseIndex}/topic-${i}` },
          { label: `Video ${i}`, url: `https://videos.example.com/phase-${phaseIndex}/topic-${i}` }
        ]
      });
    }
    phases.push({
      title: `Phase ${phaseIndex}: Large Roadmap Segment`,
      priority: ['P0', 'P1', 'P2', 'P3'][phaseIndex % 4],
      sections: [{ title: `Section ${phaseIndex}`, items }]
    });
    remaining -= itemsInThisPhase;
    phaseIndex += 1;
  }
  return {
    schemaVersion: 1,
    title: 'Large Generated Roadmap (near item cap)',
    phases
  };
}

// Non-ASCII/unicode titles at every level (phase, section, item, resource
// label) — the corruption-detection markers (importValidator.js's
// CORRUPTION_MARKERS, e.g. %22, "title":) are ASCII-specific escape/JSON
// artifacts, so real non-English content must never trip them as a false
// positive. Covers Japanese, Arabic (right-to-left), and accented Latin
// script in the same payload, matching real reported non-English roadmap
// topics.
export const NON_ASCII_PAYLOAD = {
  schemaVersion: 1,
  title: '日本語ロードマップ — Café Résumé Édition',
  phases: [
    {
      title: 'フェーズ1: 基礎 (Fundamentals)',
      priority: 'P0',
      sections: [
        {
          title: 'قسم الأساسيات',
          items: [
            { title: '変数とデータ型を理解する', resources: [{ label: 'ドキュメント', url: 'https://docs.example.com/ja/basics' }] },
            ['تعلم الأساسيات', 'P1'],
            'Étudier les structures de contrôle'
          ]
        }
      ]
    }
  ]
};

// A structurally varied "clean" payload representative of a well-formed AI
// response mixing all three allowed item shapes (plain string, tuple, and
// the resource-bearing object form) in the same section — the schema
// explicitly allows this mix (importPrompt.js's own prompt only asks a
// model to prefer the object form for "most" items), and it is what a
// legitimate response with no copy-corruption artifacts looks like.
export const MIXED_SHAPE_CLEAN_PAYLOAD = {
  schemaVersion: 1,
  title: 'Cloud Infrastructure Fundamentals',
  phases: [
    {
      title: 'Phase 1: Core Concepts',
      priority: 'P0',
      sections: [
        {
          title: 'Compute',
          items: [
            'Understand virtual machines vs. containers',
            ['Learn about serverless functions', 'P1'],
            {
              title: 'Set up your first container',
              priority: 'P0',
              resources: [
                { label: 'Docker docs', url: 'docs.docker.com' },
                { label: 'Official tutorial', url: 'https://www.docker.com/101-tutorial/' }
              ]
            }
          ]
        },
        {
          title: 'Networking',
          items: [
            { title: 'Understand DNS basics', resources: [{ label: 'Cloudflare learning center', url: 'https://www.cloudflare.com/learning/dns/what-is-dns/' }] },
            'Learn about load balancers'
          ]
        }
      ]
    },
    {
      title: 'Phase 2: Going Deeper',
      priority: 'P1',
      sections: [
        { title: 'Storage', items: ['Compare object vs. block storage', ['Understand storage tiers and lifecycle policies', 'P2']] }
      ]
    }
  ]
};
