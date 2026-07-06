export const RESOURCE_LIBRARY = {
  htmlCss: [
    { label: 'MDN HTML reference', url: 'https://developer.mozilla.org/en-US/docs/Web/HTML' },
    { label: 'MDN CSS reference', url: 'https://developer.mozilla.org/en-US/docs/Web/CSS' },
    { label: 'CSS Grid garden', url: 'https://cssgridgarden.com/' }
  ],
  javascript: [
    { label: 'MDN JavaScript guide', url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide' },
    { label: 'JavaScript.info', url: 'https://javascript.info/' }
  ],
  typescript: [
    { label: 'TypeScript handbook', url: 'https://www.typescriptlang.org/docs/handbook/intro.html' }
  ],
  react: [
    { label: 'React documentation', url: 'https://react.dev/' },
    { label: 'React Router docs', url: 'https://reactrouter.com/' }
  ],
  styling: [
    { label: 'Tailwind CSS docs', url: 'https://tailwindcss.com/docs' }
  ],
  testing: [
    { label: 'Testing Library docs', url: 'https://testing-library.com/docs/' },
    { label: 'Playwright docs', url: 'https://playwright.dev/' }
  ],
  tooling: [
    { label: 'Vite guide', url: 'https://vite.dev/guide/' },
    { label: 'ESLint docs', url: 'https://eslint.org/docs/latest/' }
  ],
  performance: [
    { label: 'web.dev — Core Web Vitals', url: 'https://web.dev/articles/vitals' },
    { label: 'Lighthouse docs', url: 'https://developer.chrome.com/docs/lighthouse/overview/' }
  ],
  a11y: [
    { label: 'WCAG 2.1 quick reference', url: 'https://www.w3.org/WAI/WCAG21/quickref/' },
    { label: 'ARIA authoring practices', url: 'https://www.w3.org/WAI/ARIA/apg/' }
  ],
  web: [
    { label: 'MDN HTTP overview', url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Overview' }
  ],
  interview: [
    { label: 'Frontend Interview Handbook', url: 'https://www.frontendinterviewhandbook.com/' }
  ]
};

export const PHASES = [
  {
    title: 'HTML & CSS',
    priority: 'P0',
    resourceKey: 'htmlCss',
    sections: [
      {
        title: 'HTML Fundamentals',
        items: [
          'Semantic HTML', 'Forms and Validation', 'Tables', 'Meta Tags', 'SEO Basics',
          ['Accessibility landmarks', 'P1']
        ]
      },
      {
        title: 'CSS Fundamentals',
        items: [
          'Box Model', 'Selectors and Specificity', 'Flexbox', 'CSS Grid', 'Positioning',
          'Responsive Design', 'Media Queries', 'CSS Variables', 'Transitions', 'Animations',
          ['Container Queries', 'P2'], ['CSS Layers and Cascade', 'P2']
        ]
      }
    ]
  },
  {
    title: 'JavaScript',
    priority: 'P0',
    resourceKey: 'javascript',
    sections: [
      {
        title: 'Language Fundamentals',
        items: [
          'Variables and Scope', 'Data Types', 'Functions', 'Closures', 'Hoisting',
          'this Keyword', 'Prototypes and Inheritance', 'ES6+ Syntax', 'Destructuring',
          'Spread and Rest', 'Modules', ['Generators and Iterators', 'P2']
        ]
      },
      {
        title: 'Asynchronous JavaScript',
        items: ['Callbacks', 'Promises', 'Async / Await', 'Event Loop', 'Fetch API', ['AbortController', 'P2']]
      },
      {
        title: 'DOM and Browser APIs',
        items: [
          'DOM Manipulation', 'Event Handling', 'Event Delegation', 'Web Storage',
          'IntersectionObserver', ['Web Workers', 'P2']
        ]
      }
    ]
  },
  {
    title: 'TypeScript',
    priority: 'P1',
    resourceKey: 'typescript',
    sections: [
      {
        title: 'TypeScript Fundamentals',
        items: [
          'Basic Types', 'Interfaces vs Types', 'Generics', 'Union and Intersection Types',
          'Type Narrowing', 'Utility Types', ['Type Guards', 'P1'], ['Declaration Files', 'P3']
        ]
      }
    ]
  },
  {
    title: 'React',
    priority: 'P0',
    resourceKey: 'react',
    sections: [
      {
        title: 'React Core',
        items: [
          'Components and Props', 'State', 'useState', 'useEffect', 'useMemo', 'useCallback',
          'useRef', 'useContext', 'Custom Hooks', 'Component Lifecycle', 'Conditional Rendering',
          'Lists and Keys', ['Error Boundaries', 'P1'], ['Suspense', 'P2']
        ]
      },
      {
        title: 'State Management',
        items: ['Context API', 'Redux Toolkit', 'Zustand', 'React Query', ['Server State vs Client State', 'P1']]
      },
      {
        title: 'Routing',
        items: ['React Router basics', 'Nested Routes', 'Route Guards', ['Data Loaders', 'P2']]
      }
    ]
  },
  {
    title: 'Styling and Design Systems',
    priority: 'P1',
    resourceKey: 'styling',
    sections: [
      { title: 'Styling Approaches', items: ['CSS Modules', 'CSS-in-JS', 'Tailwind CSS', 'Component Libraries', ['Design Tokens', 'P2']] }
    ]
  },
  {
    title: 'Testing',
    priority: 'P1',
    resourceKey: 'testing',
    sections: [
      { title: 'Unit and Component Testing', items: ['Vitest / Jest', 'React Testing Library', 'Mocking', ['Snapshot Testing', 'P2']] },
      { title: 'End-to-End Testing', items: ['Playwright basics', 'Cypress basics', ['Visual Regression Testing', 'P3']] }
    ]
  },
  {
    title: 'Build Tools and Tooling',
    priority: 'P1',
    resourceKey: 'tooling',
    sections: [
      { title: 'Tooling', items: ['Vite', 'Webpack basics', 'Babel', 'ESLint', 'Prettier', 'npm / pnpm', ['Monorepos with Turborepo', 'P3']] }
    ]
  },
  {
    title: 'Performance and Web Vitals',
    priority: 'P1',
    resourceKey: 'performance',
    sections: [
      { title: 'Performance', items: ['Core Web Vitals', 'Lazy Loading', 'Code Splitting', 'Bundle Analysis', 'Image Optimization', ['Lighthouse audits', 'P2']] }
    ]
  },
  {
    title: 'Accessibility',
    priority: 'P1',
    resourceKey: 'a11y',
    sections: [
      { title: 'Accessibility', items: ['WCAG Principles', 'ARIA Roles', 'Keyboard Navigation', 'Screen Reader Testing', 'Color Contrast', ['Focus Management', 'P1']] }
    ]
  },
  {
    title: 'Web and Networking Fundamentals',
    priority: 'P2',
    resourceKey: 'web',
    sections: [
      { title: 'Foundations', items: ['HTTP Basics', 'REST APIs', 'CORS', 'Browser Caching', ['Rendering Pipeline', 'P2']] }
    ]
  },
  {
    title: 'Interview and Career',
    priority: 'P0',
    resourceKey: 'interview',
    sections: [
      {
        title: 'Preparation',
        items: [
          'JavaScript Interview Questions', 'React Interview Questions', 'CSS Interview Questions',
          'Frontend System Design', 'Portfolio Projects', 'Resume Preparation',
          ['Behavioral Stories in STAR format', 'P1']
        ]
      }
    ]
  }
];

export function buildSeedItems() {
  const items = {};
  PHASES.forEach((phase, phaseIndex) => {
    phase.sections.forEach((section, sectionIndex) => {
      section.items.forEach((entry, itemIndex) => {
        const [title, priorityOverride] = Array.isArray(entry) ? entry : [entry, phase.priority];
        const id = `seed-${phaseIndex}-${sectionIndex}-${itemIndex}`;
        const phaseResources = RESOURCE_LIBRARY[phase.resourceKey] || [];
        items[id] = {
          id,
          title,
          phase: phase.title,
          section: section.title,
          priority: priorityOverride || phase.priority,
          done: false,
          custom: false,
          deleted: false,
          resources: [...phaseResources]
        };
      });
    });
  });
  return items;
}
