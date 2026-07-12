// 'blank' is deliberately NOT in TEMPLATES below anymore (retired — see the
// "Manual roadmap creation" / "Create your own roadmap" convention in
// CLAUDE.md: it's a strict subset of a custom roadmap, which is fully
// editable instead of fixed-Learn/Practice/Build/Review). It stays in
// LOADERS and blank.js stays in the repo purely so roadmapStore.js's one-time
// setUser() migration can still load its PHASES/buildSeedItems shape for any
// account that started it before this retirement.
const LOADERS = {
  'java-backend': () => import('./java-backend.js'),
  frontend: () => import('./frontend.js'),
  'data-science': () => import('./data-science.js'),
  'genai-agentic-ai': () => import('./genai-agentic-ai.js'),
  'math-grade12': () => import('./math-grade12.js'),
  piano: () => import('./piano.js'),
  marketing: () => import('./marketing.js'),
  blank: () => import('./blank.js')
};

export const TEMPLATES = [
  {
    id: 'java-backend',
    name: 'Java Backend Engineer',
    description: 'Java, Spring Boot, microservices, Kafka, Redis, system design, GenAI, DSA, and interview prep.',
    // issue #136 Phase 2 — was the '☕' emoji; now a decorativeIcon.js name
    // (rendered via createDecorativeIcon(), Phosphor Duotone). Every id below
    // is deliberately also its own decorativeIcon.js key.
    icon: 'java-backend'
  },
  {
    id: 'genai-agentic-ai',
    name: 'GenAI / Agentic AI Engineer',
    description: 'LLM fundamentals, prompt engineering, RAG, agents, frameworks, fine-tuning, evaluation, safety, and interview prep.',
    icon: 'genai-agentic-ai'
  },
  {
    id: 'frontend',
    name: 'Frontend Developer',
    description: 'HTML, CSS, JavaScript, TypeScript, React, testing, tooling, performance, accessibility, system design, and interview prep.',
    icon: 'frontend'
  },
  {
    id: 'data-science',
    name: 'Data Scientist',
    description: 'Python, math and statistics, ML, deep learning, NLP, SQL, data engineering, MLOps, and interview prep.',
    icon: 'data-science'
  },
  {
    id: 'math-grade12',
    name: '12th Grade Mathematics',
    description: 'Relations and functions, algebra, calculus, vectors and 3D geometry, linear programming, probability, and exam prep.',
    icon: 'math-grade12'
  },
  {
    id: 'piano',
    name: 'Learning Piano',
    description: 'Reading music, technique, scales and chords, repertoire, sight-reading, ear training, and performance skills.',
    icon: 'piano'
  },
  {
    id: 'marketing',
    name: 'Marketing',
    description: 'Fundamentals, branding, content and SEO, paid ads, social and email marketing, analytics, growth, and career prep.',
    icon: 'marketing'
  }
].map(template => ({
  ...template,
  buildItems: () => LOADERS[template.id]().then(m => m.buildSeedItems())
}));

export function getTemplate(id) {
  return TEMPLATES.find(t => t.id === id) || TEMPLATES[0];
}

export function buildSeedItems(templateId) {
  return getTemplate(templateId).buildItems();
}

export async function getTemplatePhases(templateId) {
  const mod = await LOADERS[getTemplate(templateId).id]();
  return mod.PHASES;
}

// Not part of the live registry — `getTemplate('blank')` deliberately falls
// back to TEMPLATES[0] like any other unrecognized id now that 'blank' is
// retired. This bypasses that fallback to load blank.js's own PHASES/seed
// directly, only ever used as a fallback source by roadmapStore.js's
// one-time migration when a 'blank' account's stored roadmap is missing
// `phases` (pre-dates issue #4's PR #60, which started always persisting it).
export async function getLegacyBlankTemplateData() {
  const mod = await LOADERS.blank();
  return { baseItems: mod.buildSeedItems(), phases: mod.PHASES };
}
