const LOADERS = {
  'java-backend': () => import('./java-backend.js'),
  frontend: () => import('./frontend.js'),
  'data-science': () => import('./data-science.js'),
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
    id: 'frontend',
    name: 'Frontend Developer',
    description: 'HTML, CSS, JavaScript, TypeScript, React, testing, tooling, performance, and accessibility.',
    icon: '🖥'
  },
  {
    id: 'data-science',
    name: 'Data Scientist',
    description: 'Python, statistics, ML fundamentals, deep learning, SQL, data engineering, and MLOps.',
    icon: '📊'
  },
  {
    id: 'blank',
    name: 'Start blank',
    description: 'Four empty phases to fill however you like.',
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
