export const RESOURCE_LIBRARY = {
  fundamentals: [
    { label: 'HubSpot Academy — Marketing courses', url: 'https://academy.hubspot.com/courses' },
    { label: 'Google Digital Garage', url: 'https://learndigital.withgoogle.com/digitalgarage' }
  ],
  branding: [
    { label: 'HubSpot — branding guide', url: 'https://academy.hubspot.com/courses' }
  ],
  content: [
    { label: 'HubSpot Academy — Content Marketing', url: 'https://academy.hubspot.com/courses/content-marketing' }
  ],
  seo: [
    { label: 'Moz — SEO learning center', url: 'https://moz.com/learn/seo' },
    { label: 'Google Search Central', url: 'https://developers.google.com/search/docs/fundamentals/seo-starter-guide' }
  ],
  paidAds: [
    { label: 'Google Ads — Skillshop', url: 'https://skillshop.withgoogle.com/' },
    { label: 'Meta Blueprint', url: 'https://www.facebook.com/business/learn' }
  ],
  social: [
    { label: 'Meta Blueprint', url: 'https://www.facebook.com/business/learn' },
    { label: 'HubSpot Academy — Social Media Marketing', url: 'https://academy.hubspot.com/courses/social-media' }
  ],
  email: [
    { label: 'HubSpot Academy — Email Marketing', url: 'https://academy.hubspot.com/courses/email-marketing' }
  ],
  analytics: [
    { label: 'Google Analytics Academy', url: 'https://analytics.google.com/analytics/academy/' }
  ],
  growth: [
    { label: 'Reforge — growth marketing overview', url: 'https://www.reforge.com/' }
  ],
  product: [
    { label: 'HubSpot — go-to-market resources', url: 'https://academy.hubspot.com/courses' }
  ],
  tools: [
    { label: 'HubSpot Academy — CRM basics', url: 'https://academy.hubspot.com/courses/inbound' }
  ]
};

export const TOPIC_RESOURCES = {
  'Marketing Funnel (AIDA)': [
    { label: 'HubSpot — the marketing funnel explained', url: 'https://academy.hubspot.com/courses/inbound' }
  ],
  'Keyword Research': [
    { label: 'Moz — keyword research guide', url: 'https://moz.com/learn/seo/keyword-research' }
  ],
  'Key Marketing Metrics (CAC, LTV, ROAS)': [
    { label: 'HubSpot — marketing metrics guide', url: 'https://academy.hubspot.com/courses/content-marketing' }
  ],
  'Google Analytics Fundamentals': [
    { label: 'Google Analytics Academy', url: 'https://analytics.google.com/analytics/academy/' }
  ],
  'Marketing Certifications Awareness (Google, HubSpot)': [
    { label: 'HubSpot Academy — certifications', url: 'https://academy.hubspot.com/certifications' }
  ]
};

export const PHASES = [
  {
    title: 'Marketing Fundamentals',
    priority: 'P0',
    resourceKey: 'fundamentals',
    sections: [
      {
        title: 'Core Concepts',
        items: [
          'The Marketing Mix (4 Ps)', 'Target Audience and Segmentation', 'Positioning Statement',
          'Unique Value Proposition', ['Buyer Personas', 'P1'], 'Customer Journey Mapping',
          ['Marketing Funnel (AIDA)', 'P1']
        ]
      },
      {
        title: 'Market Research',
        items: [
          'Primary vs Secondary Research', 'Surveys and Interviews', 'Competitive Analysis',
          ['SWOT Analysis', 'P1'], ['Market Sizing (TAM, SAM, SOM)', 'P2']
        ]
      }
    ]
  },
  {
    title: 'Branding and Positioning',
    priority: 'P1',
    resourceKey: 'branding',
    sections: [
      {
        title: 'Brand Strategy',
        items: [
          'Brand Identity and Voice', 'Brand Positioning', ['Brand Guidelines', 'P2'],
          'Storytelling in Marketing', ['Rebranding Considerations', 'P3']
        ]
      }
    ]
  },
  {
    title: 'Content Marketing',
    priority: 'P0',
    resourceKey: 'content',
    sections: [
      {
        title: 'Content Strategy',
        items: [
          'Content Marketing Strategy', 'Content Calendars', 'Blog Writing Basics',
          ['Content Repurposing', 'P1'], ['Copywriting Fundamentals', 'P1']
        ]
      }
    ]
  },
  {
    title: 'SEO',
    priority: 'P0',
    resourceKey: 'seo',
    sections: [
      {
        title: 'Search Engine Optimization',
        items: [
          'Keyword Research', 'On-Page SEO', ['Off-Page SEO and Backlinks', 'P1'],
          'Technical SEO Basics', ['Local SEO', 'P2'], 'SEO Analytics (Search Console)'
        ]
      }
    ]
  },
  {
    title: 'Paid Advertising',
    priority: 'P1',
    resourceKey: 'paidAds',
    sections: [
      {
        title: 'Search Engine Marketing (SEM/PPC)',
        items: [
          'Google Ads Fundamentals', ['Bidding Strategies', 'P2'], 'Ad Copywriting',
          ['Landing Page Optimization', 'P1'], ['Conversion Rate Optimization', 'P1']
        ]
      },
      {
        title: 'Social Media Advertising',
        items: [
          ['Meta Ads Basics', 'P1'], ['LinkedIn Ads Basics', 'P2'], ['Retargeting Campaigns', 'P1'],
          ['Ad Budgeting and Bidding', 'P2']
        ]
      }
    ]
  },
  {
    title: 'Social Media and Community',
    priority: 'P1',
    resourceKey: 'social',
    sections: [
      {
        title: 'Social Media Marketing',
        items: [
          'Platform Selection Strategy', 'Content Formats (Reels, Stories, Posts)',
          'Posting Cadence and Scheduling', ['Influencer Marketing', 'P2'], 'Community Management',
          ['Social Listening', 'P2']
        ]
      }
    ]
  },
  {
    title: 'Email and Lifecycle Marketing',
    priority: 'P1',
    resourceKey: 'email',
    sections: [
      {
        title: 'Email Marketing',
        items: [
          'Email List Building', 'Email Campaign Design', ['Segmentation and Personalization', 'P1'],
          ['A/B Testing Subject Lines', 'P2'], 'Automation and Drip Campaigns', ['Deliverability Basics', 'P2']
        ]
      }
    ]
  },
  {
    title: 'Marketing Analytics',
    priority: 'P0',
    resourceKey: 'analytics',
    sections: [
      {
        title: 'Data and Measurement',
        items: [
          'Key Marketing Metrics (CAC, LTV, ROAS)', 'Google Analytics Fundamentals',
          ['UTM Tracking', 'P1'], ['Attribution Models', 'P2'], ['A/B Testing Fundamentals', 'P1'],
          'Marketing Dashboards and Reporting'
        ]
      }
    ]
  },
  {
    title: 'Growth Marketing',
    priority: 'P1',
    resourceKey: 'growth',
    sections: [
      {
        title: 'Growth',
        items: [
          ['Growth Loops vs Funnels', 'P2'], ['Referral Programs', 'P2'],
          ['Product-Led Growth Awareness', 'P2'], ['Viral Coefficient Basics', 'P3'],
          ['Experimentation Culture', 'P1']
        ]
      }
    ]
  },
  {
    title: 'Product and Strategic Marketing',
    priority: 'P1',
    resourceKey: 'product',
    sections: [
      {
        title: 'Product Marketing',
        items: [
          ['Go-to-Market Strategy', 'P1'], ['Product Positioning and Messaging', 'P1'],
          ['Competitive Battlecards', 'P2'], ['Pricing Strategy Awareness', 'P2']
        ]
      },
      {
        title: 'Strategy',
        items: [
          ['Marketing Plan Development', 'P1'], ['Budget Allocation Across Channels', 'P2'],
          ['Marketing Team Structures Awareness', 'P3']
        ]
      }
    ]
  },
  {
    title: 'Tools and Career',
    priority: 'P0',
    resourceKey: 'tools',
    sections: [
      {
        title: 'Marketing Tools',
        items: [
          ['CRM Basics (HubSpot / Salesforce Awareness)', 'P2'],
          ['Marketing Automation Platforms Awareness', 'P2'], ['Design Tools Basics (Canva)', 'P2']
        ]
      },
      {
        title: 'Career Preparation',
        items: [
          'Marketing Interview Questions', 'Portfolio and Case Study Building', 'Resume Preparation',
          ['Marketing Certifications Awareness (Google, HubSpot)', 'P2'],
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
