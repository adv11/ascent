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
    icon: '☕'
  },
  {
    id: 'genai-agentic-ai',
    name: 'GenAI / Agentic AI Engineer',
    description: 'LLM fundamentals, prompt engineering, RAG, agents, frameworks, fine-tuning, evaluation, safety, and interview prep.',
    icon: '🤖'
  },
  {
    id: 'frontend',
    name: 'Frontend Developer',
    description: 'HTML, CSS, JavaScript, TypeScript, React, testing, tooling, performance, accessibility, system design, and interview prep.',
    icon: '🖥'
  },
  {
    id: 'data-science',
    name: 'Data Scientist',
    description: 'Python, math and statistics, ML, deep learning, NLP, SQL, data engineering, MLOps, and interview prep.',
    icon: '📊'
  },
  {
    id: 'math-grade12',
    name: '12th Grade Mathematics',
    description: 'Relations and functions, algebra, calculus, vectors and 3D geometry, linear programming, probability, and exam prep.',
    icon: '📐'
  },
  {
    id: 'piano',
    name: 'Learning Piano',
    description: 'Reading music, technique, scales and chords, repertoire, sight-reading, ear training, and performance skills.',
    icon: '🎹'
  },
  {
    id: 'marketing',
    name: 'Marketing',
    description: 'Fundamentals, branding, content and SEO, paid ads, social and email marketing, analytics, growth, and career prep.',
    icon: '📈'
  },
  {
    id: 'blank',
    name: 'Start blank',
    description: 'Four empty phases to fill however you like — build your own roadmap manually or with AI.',
    icon: '✦'
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
