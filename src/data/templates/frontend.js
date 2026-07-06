export const RESOURCE_LIBRARY = {
  htmlCss: [
    { label: 'MDN HTML reference', url: 'https://developer.mozilla.org/en-US/docs/Web/HTML' },
    { label: 'MDN CSS reference', url: 'https://developer.mozilla.org/en-US/docs/Web/CSS' },
    { label: 'CSS Grid garden', url: 'https://cssgridgarden.com/' },
    { label: 'Flexbox froggy', url: 'https://flexboxfroggy.com/' }
  ],
  javascript: [
    { label: 'MDN JavaScript guide', url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide' },
    { label: 'JavaScript.info', url: 'https://javascript.info/' },
    { label: 'You Don\'t Know JS (book series)', url: 'https://github.com/getify/You-Dont-Know-JS' }
  ],
  typescript: [
    { label: 'TypeScript handbook', url: 'https://www.typescriptlang.org/docs/handbook/intro.html' },
    { label: 'Total TypeScript tips', url: 'https://www.totaltypescript.com/tips' }
  ],
  react: [
    { label: 'React documentation', url: 'https://react.dev/' },
    { label: 'React Router docs', url: 'https://reactrouter.com/' },
    { label: 'TanStack Query docs', url: 'https://tanstack.com/query/latest' },
    { label: 'Next.js documentation', url: 'https://nextjs.org/docs' }
  ],
  styling: [
    { label: 'Tailwind CSS docs', url: 'https://tailwindcss.com/docs' },
    { label: 'BEM methodology', url: 'https://getbem.com/introduction/' },
    { label: 'Storybook docs', url: 'https://storybook.js.org/docs' }
  ],
  testing: [
    { label: 'Testing Library docs', url: 'https://testing-library.com/docs/' },
    { label: 'Vitest docs', url: 'https://vitest.dev/guide/' },
    { label: 'Playwright docs', url: 'https://playwright.dev/' }
  ],
  tooling: [
    { label: 'Vite guide', url: 'https://vite.dev/guide/' },
    { label: 'ESLint docs', url: 'https://eslint.org/docs/latest/' },
    { label: 'Prettier docs', url: 'https://prettier.io/docs/en/' }
  ],
  performance: [
    { label: 'web.dev — Core Web Vitals', url: 'https://web.dev/articles/vitals' },
    { label: 'Lighthouse docs', url: 'https://developer.chrome.com/docs/lighthouse/overview/' },
    { label: 'web.dev — performance patterns', url: 'https://web.dev/explore/fast' }
  ],
  a11y: [
    { label: 'WCAG 2.1 quick reference', url: 'https://www.w3.org/WAI/WCAG21/quickref/' },
    { label: 'ARIA authoring practices', url: 'https://www.w3.org/WAI/ARIA/apg/' },
    { label: 'A11y project checklist', url: 'https://www.a11yproject.com/checklist/' }
  ],
  web: [
    { label: 'MDN HTTP overview', url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Overview' },
    { label: 'OWASP Top 10', url: 'https://owasp.org/www-project-top-ten/' },
    { label: 'How browsers work (HTML5 Rocks)', url: 'https://www.html5rocks.com/en/tutorials/internals/howbrowserswork/' }
  ],
  devops: [
    { label: 'GitHub Actions docs', url: 'https://docs.github.com/en/actions' },
    { label: 'Vercel documentation', url: 'https://vercel.com/docs' }
  ],
  pwa: [
    { label: 'web.dev — Progressive Web Apps', url: 'https://web.dev/explore/progressive-web-apps' },
    { label: 'MDN Service Worker API', url: 'https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API' }
  ],
  systemDesign: [
    { label: 'Frontend System Design (GreatFrontEnd)', url: 'https://www.greatfrontend.com/system-design' },
    { label: 'Micro-frontends (martinfowler.com)', url: 'https://martinfowler.com/articles/micro-frontends.html' }
  ],
  interview: [
    { label: 'Frontend Interview Handbook', url: 'https://www.frontendinterviewhandbook.com/' },
    { label: 'JavaScript interview questions (GreatFrontEnd)', url: 'https://www.greatfrontend.com/questions/javascript-interview-questions' }
  ]
};

export const TOPIC_RESOURCES = {
  'Closures': [
    { label: 'MDN — Closures', url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Closures' }
  ],
  'Event Loop': [
    { label: 'MDN — Event loop', url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Event_loop' },
    { label: 'What the heck is the event loop? (video)', url: 'https://www.youtube.com/watch?v=8aGhZQkoFbQ' }
  ],
  'Flexbox': [
    { label: 'CSS Tricks — A complete guide to Flexbox', url: 'https://css-tricks.com/snippets/css/a-guide-to-flexbox/' }
  ],
  'CSS Grid': [
    { label: 'CSS Tricks — A complete guide to Grid', url: 'https://css-tricks.com/snippets/css/complete-guide-grid/' }
  ],
  'Custom Hooks': [
    { label: 'React docs — Reusing logic with custom Hooks', url: 'https://react.dev/learn/reusing-logic-with-custom-hooks' }
  ],
  'React Query / TanStack Query': [
    { label: 'TanStack Query overview', url: 'https://tanstack.com/query/latest/docs/framework/react/overview' }
  ],
  'Generics': [
    { label: 'TypeScript handbook — Generics', url: 'https://www.typescriptlang.org/docs/handbook/2/generics.html' }
  ],
  'LCP / FID / CLS': [
    { label: 'web.dev — Core Web Vitals', url: 'https://web.dev/articles/vitals' }
  ],
  'WCAG 2.1 Principles': [
    { label: 'W3C — WCAG 2.1 overview', url: 'https://www.w3.org/WAI/standards-guidelines/wcag/' }
  ],
  'Service Workers': [
    { label: 'MDN — Service Worker API', url: 'https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API' }
  ],
  'Transformers': [
    { label: 'React Server Components + Suspense often pair with modern data fetching (see React docs)', url: 'https://react.dev/reference/react/Suspense' }
  ],
  'Micro-frontends': [
    { label: 'Micro-frontends (martinfowler.com)', url: 'https://martinfowler.com/articles/micro-frontends.html' }
  ],
  'GraphQL Basics': [
    { label: 'GraphQL official docs', url: 'https://graphql.org/learn/' }
  ],
  'XSS Prevention': [
    { label: 'OWASP — Cross Site Scripting Prevention Cheat Sheet', url: 'https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html' }
  ]
};

export const PHASES = [
  {
    title: 'HTML & CSS Foundations',
    priority: 'P0',
    resourceKey: 'htmlCss',
    sections: [
      {
        title: 'HTML Fundamentals',
        items: [
          'Semantic HTML', 'HTML Forms', 'Form Validation', 'Tables', 'Meta Tags', 'SEO Basics',
          ['Web Components Basics', 'P2'], ['Custom Elements', 'P2'], ['Shadow DOM', 'P3']
        ]
      },
      {
        title: 'Accessibility in Markup',
        items: ['ARIA Roles', 'Landmarks', 'Alt Text Best Practices', ['Accessible Forms', 'P1'], ['Focus Order', 'P1']]
      },
      {
        title: 'CSS Fundamentals',
        items: [
          'Selectors and Specificity', 'Box Model', 'Cascade and Inheritance', 'Units (px, em, rem, vw, vh)',
          'Pseudo-classes and Pseudo-elements', ['Custom Properties (CSS Variables)', 'P1']
        ]
      },
      {
        title: 'Layout',
        items: ['Flexbox', 'CSS Grid', 'Positioning', ['Multi-column Layout', 'P2'], ['Subgrid', 'P3']]
      },
      {
        title: 'Responsive Design',
        items: [
          'Media Queries', 'Mobile-first Design', ['Container Queries', 'P2'], ['Fluid Typography', 'P2'],
          'Responsive Images (srcset and picture)'
        ]
      },
      {
        title: 'Advanced CSS',
        items: [
          'Transitions', 'Animations', 'Transforms', ['CSS Layers and Cascade', 'P2'],
          [':has() Selector', 'P3'], ['CSS Nesting', 'P3']
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
          'Variables and Scope', 'Data Types', 'Type Coercion', 'Operators', 'Control Flow', 'Functions',
          'Arrow Functions', ['Closures', 'P0'], ['Hoisting', 'P1'], 'this Keyword',
          ['Prototypes and Inheritance', 'P1'], 'Classes', ['Symbols', 'P3'], ['Iterators and Generators', 'P2']
        ]
      },
      {
        title: 'ES6+ Features',
        items: [
          'Destructuring', 'Spread and Rest Operators', 'Template Literals', 'Default Parameters',
          ['Optional Chaining', 'P1'], ['Nullish Coalescing', 'P1'], 'Modules (import/export)'
        ]
      },
      {
        title: 'Asynchronous JavaScript',
        items: [
          'Callbacks', 'Promises', 'Async/Await', ['Event Loop', 'P0'], 'Microtasks vs Macrotasks',
          'Fetch API', ['AbortController', 'P2'], ['Web Workers', 'P2']
        ]
      },
      {
        title: 'DOM and Browser APIs',
        items: [
          'DOM Traversal and Manipulation', 'Event Handling', 'Event Delegation', 'Event Bubbling and Capturing',
          'Web Storage (localStorage and sessionStorage)', ['IntersectionObserver', 'P2'],
          ['MutationObserver', 'P3'], ['ResizeObserver', 'P3'], 'History API'
        ]
      },
      {
        title: 'Error Handling and Debugging',
        items: ['try/catch/finally', 'Custom Errors', ['Debugging with DevTools', 'P1'], ['Source Maps', 'P2']]
      }
    ]
  },
  {
    title: 'TypeScript',
    priority: 'P1',
    resourceKey: 'typescript',
    sections: [
      {
        title: 'Fundamentals',
        items: [
          'Basic Types', 'Interfaces', 'Type Aliases', ['Interfaces vs Types', 'P1'], 'Function Types',
          'Enums', ['Literal Types', 'P2']
        ]
      },
      {
        title: 'Advanced Types',
        items: [
          'Generics', 'Union and Intersection Types', ['Type Narrowing', 'P1'], ['Type Guards', 'P1'],
          ['Mapped Types', 'P2'], ['Conditional Types', 'P2'], ['Utility Types', 'P1']
        ]
      },
      {
        title: 'Tooling',
        items: ['tsconfig.json', ['Declaration Files', 'P3'], ['Strict Mode', 'P1'], ['Type-only Imports', 'P3']]
      }
    ]
  },
  {
    title: 'React',
    priority: 'P0',
    resourceKey: 'react',
    sections: [
      {
        title: 'Core Concepts',
        items: [
          'JSX', 'Components and Props', 'State', ['Component Lifecycle', 'P1'], 'Conditional Rendering',
          'Lists and Keys', ['Composition vs Inheritance', 'P2'], ['Fragments and Portals', 'P2']
        ]
      },
      {
        title: 'Hooks',
        items: [
          'useState', 'useEffect', 'useRef', 'useMemo', 'useCallback', 'useContext', 'useReducer',
          ['Custom Hooks', 'P0'], ['useLayoutEffect', 'P2'], ['Rules of Hooks', 'P1']
        ]
      },
      {
        title: 'State Management',
        items: [
          'Context API', ['Redux Toolkit', 'P1'], ['Zustand', 'P2'], ['React Query / TanStack Query', 'P1'],
          ['Server State vs Client State', 'P1'], ['Jotai / Recoil Awareness', 'P3']
        ]
      },
      {
        title: 'Routing',
        items: [
          ['React Router Basics', 'P1'], ['Nested and Dynamic Routes', 'P1'],
          ['Route Guards / Protected Routes', 'P1'], ['Data Loaders', 'P2']
        ]
      },
      {
        title: 'Forms',
        items: [
          ['Controlled vs Uncontrolled Components', 'P1'], ['Form Validation', 'P1'],
          ['React Hook Form', 'P2'], ['Formik Awareness', 'P3']
        ]
      },
      {
        title: 'Performance and Advanced Patterns',
        items: [
          ['React.memo', 'P1'], ['Code Splitting with React.lazy', 'P1'], ['Error Boundaries', 'P1'],
          ['Suspense', 'P2'], ['Render Props', 'P3'], ['Higher-Order Components', 'P3']
        ]
      },
      {
        title: 'Server-Side Rendering',
        items: [
          ['Next.js Basics', 'P1'], ['Static vs Server Rendering', 'P2'], ['Hydration', 'P2'],
          ['React Server Components Awareness', 'P3']
        ]
      }
    ]
  },
  {
    title: 'Styling and Design Systems',
    priority: 'P1',
    resourceKey: 'styling',
    sections: [
      {
        title: 'CSS Architecture',
        items: [
          'BEM Methodology', ['CSS Modules', 'P1'], ['Utility-first CSS (Tailwind)', 'P1'],
          ['CSS-in-JS (styled-components / Emotion)', 'P2']
        ]
      },
      {
        title: 'Design Systems',
        items: [
          ['Component Libraries (MUI / Chakra / shadcn)', 'P1'], ['Design Tokens', 'P2'],
          ['Theming and Dark Mode', 'P1'], ['Storybook', 'P2']
        ]
      }
    ]
  },
  {
    title: 'Testing',
    priority: 'P1',
    resourceKey: 'testing',
    sections: [
      {
        title: 'Unit and Component Testing',
        items: [
          ['Jest / Vitest Basics', 'P0'], ['React Testing Library', 'P0'], ['Mocking', 'P1'],
          ['Snapshot Testing', 'P2'], ['Test Coverage', 'P2']
        ]
      },
      {
        title: 'Integration and E2E Testing',
        items: [
          ['Playwright Basics', 'P1'], ['Cypress Basics', 'P2'], ['Testing User Flows', 'P1'],
          ['Visual Regression Testing', 'P3']
        ]
      },
      {
        title: 'Accessibility Testing',
        items: [['axe-core', 'P2'], ['Keyboard Navigation Testing', 'P1'], ['Screen Reader Testing', 'P2']]
      }
    ]
  },
  {
    title: 'Build Tools and Tooling',
    priority: 'P1',
    resourceKey: 'tooling',
    sections: [
      {
        title: 'Bundlers and Compilers',
        items: [['Vite', 'P0'], ['Webpack Basics', 'P1'], ['Babel', 'P1'], ['esbuild / SWC Awareness', 'P3']]
      },
      {
        title: 'Package Management',
        items: [
          ['npm / pnpm / yarn', 'P1'], ['Semantic Versioning', 'P2'], ['Lockfiles', 'P2'],
          ['Monorepos (Turborepo / Nx)', 'P3']
        ]
      },
      {
        title: 'Code Quality',
        items: [['ESLint', 'P1'], ['Prettier', 'P1'], ['Husky and Git Hooks', 'P2'], ['Conventional Commits', 'P3']]
      }
    ]
  },
  {
    title: 'Performance',
    priority: 'P1',
    resourceKey: 'performance',
    sections: [
      {
        title: 'Core Web Vitals',
        items: [['LCP / FID / CLS', 'P0'], ['INP', 'P2'], ['Lighthouse Audits', 'P1']]
      },
      {
        title: 'Loading Performance',
        items: [
          ['Code Splitting', 'P1'], ['Lazy Loading', 'P1'], ['Preloading and Prefetching', 'P2'],
          ['Image Optimization', 'P1'], ['Font Loading Strategies', 'P2']
        ]
      },
      {
        title: 'Runtime Performance',
        items: [
          ['Rendering Pipeline (Reflow / Repaint)', 'P2'], ['Debouncing and Throttling', 'P1'],
          ['Memoization', 'P1'], ['Virtualization for Long Lists', 'P2']
        ]
      }
    ]
  },
  {
    title: 'Accessibility',
    priority: 'P1',
    resourceKey: 'a11y',
    sections: [
      {
        title: 'Standards and Guidelines',
        items: [
          ['WCAG 2.1 Principles', 'P0'], ['Semantic HTML for Accessibility', 'P1'],
          ['ARIA Roles and Attributes', 'P1']
        ]
      },
      {
        title: 'Practical Accessibility',
        items: [
          ['Keyboard Navigation', 'P1'], ['Focus Management', 'P1'], ['Color Contrast', 'P1'],
          ['Screen Reader Basics', 'P2'], ['Accessible Forms', 'P1']
        ]
      }
    ]
  },
  {
    title: 'Web and Networking Fundamentals',
    priority: 'P2',
    resourceKey: 'web',
    sections: [
      {
        title: 'Networking',
        items: [
          ['HTTP / HTTPS Basics', 'P1'], ['REST APIs', 'P1'], ['GraphQL Basics', 'P2'], ['WebSockets', 'P2'],
          ['CORS', 'P1'], ['Caching Strategies', 'P2']
        ]
      },
      {
        title: 'Browser Fundamentals',
        items: [
          ['Browser Rendering Engine', 'P2'], ['Critical Rendering Path', 'P2'], ['Same-Origin Policy', 'P2']
        ]
      },
      {
        title: 'Security',
        items: [
          ['XSS Prevention', 'P1'], ['CSRF Basics', 'P2'], ['Content Security Policy', 'P2'],
          ['Secure Cookies', 'P3']
        ]
      }
    ]
  },
  {
    title: 'Deployment and DevOps',
    priority: 'P2',
    resourceKey: 'devops',
    sections: [
      {
        title: 'CI/CD',
        items: [
          ['GitHub Actions Basics', 'P2'], ['Automated Testing in CI', 'P2'], ['Preview Deployments', 'P3']
        ]
      },
      {
        title: 'Hosting',
        items: [
          ['Static Hosting (Vercel / Netlify)', 'P2'], ['CDNs', 'P2'], ['Environment Variables', 'P2'],
          ['Feature Flags', 'P3']
        ]
      }
    ]
  },
  {
    title: 'Progressive Web Apps and Mobile',
    priority: 'P2',
    resourceKey: 'pwa',
    sections: [
      {
        title: 'PWA',
        items: [
          ['Service Workers', 'P2'], ['Web App Manifest', 'P2'], ['Offline Support', 'P3'],
          ['Push Notifications', 'P3']
        ]
      },
      {
        title: 'Responsive and Cross-Device',
        items: [['Touch Events', 'P2'], ['Viewport Meta Tag', 'P1'], ['Cross-browser Testing', 'P2']]
      }
    ]
  },
  {
    title: 'Frontend System Design',
    priority: 'P1',
    resourceKey: 'systemDesign',
    sections: [
      {
        title: 'Architecture',
        items: [
          ['Component-Driven Architecture', 'P1'], ['Micro-frontends', 'P2'],
          ['State Management Architecture', 'P1'], ['Client-Server Data Flow', 'P1'],
          ['Design System Architecture', 'P2']
        ]
      }
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
          'Frontend System Design Interviews', 'Coding Challenges (DOM Manipulation)', 'Portfolio Projects',
          'Resume Preparation', ['Behavioral Stories in STAR format', 'P1']
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
        const topicResources = TOPIC_RESOURCES[title] || [];
        const mergedResources = [...topicResources];
        phaseResources.forEach(r => {
          if (!mergedResources.some(m => m.url === r.url)) mergedResources.push(r);
        });
        items[id] = {
          id,
          title,
          phase: phase.title,
          section: section.title,
          priority: priorityOverride || phase.priority,
          done: false,
          custom: false,
          deleted: false,
          resources: mergedResources
        };
      });
    });
  });
  return items;
}
