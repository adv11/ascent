export const RESOURCE_LIBRARY = {
  relationsFunctions: [
    { label: 'NCERT Class 12 Maths textbook (official)', url: 'https://ncert.nic.in/textbook.php' },
    { label: 'Khan Academy — Functions', url: 'https://www.khanacademy.org/math/algebra2/x2ec2f6f830c9fb89:functions' }
  ],
  algebra: [
    { label: 'NCERT Class 12 Maths textbook (official)', url: 'https://ncert.nic.in/textbook.php' },
    { label: 'Khan Academy — Matrices', url: 'https://www.khanacademy.org/math/precalculus/x9e81a4f98389efdf:matrices' }
  ],
  calculus: [
    { label: 'Khan Academy — Differential Calculus', url: 'https://www.khanacademy.org/math/differential-calculus' },
    { label: 'Khan Academy — Integral Calculus', url: 'https://www.khanacademy.org/math/integral-calculus' },
    { label: '3Blue1Brown — Essence of Calculus', url: 'https://www.3blue1brown.com/topics/calculus' }
  ],
  vectors3d: [
    { label: '3Blue1Brown — Essence of Linear Algebra', url: 'https://www.3blue1brown.com/topics/linear-algebra' },
    { label: 'Khan Academy — Vectors', url: 'https://www.khanacademy.org/math/precalculus/x9e81a4f98389efdf:vectors' }
  ],
  linearProgramming: [
    { label: 'Khan Academy — Linear Programming', url: 'https://www.khanacademy.org/math/algebra-home/alg-system-of-equations' }
  ],
  probability: [
    { label: 'Khan Academy — Probability', url: 'https://www.khanacademy.org/math/statistics-probability/probability-library' },
    { label: 'Seeing Theory — visual probability', url: 'https://seeing-theory.brown.edu/' }
  ],
  examPrep: [
    { label: 'CBSE official website', url: 'https://www.cbse.gov.in/' },
    { label: 'NCERT official website', url: 'https://ncert.nic.in/' }
  ]
};

export const TOPIC_RESOURCES = {
  "Mean Value Theorems (Rolle's and Lagrange's)": [
    { label: 'Khan Academy — Mean value theorem', url: 'https://www.khanacademy.org/math/ap-calculus-ab/ab-derivatives-analyze-functions/ab-5-2/a/mean-value-theorem-review' }
  ],
  'Fundamental Theorem of Calculus': [
    { label: 'Khan Academy — Fundamental theorem of calculus', url: 'https://www.khanacademy.org/math/ap-calculus-ab/ab-integration-new/ab-6-7/a/fundamental-theorem-of-calculus-review' }
  ],
  "Bayes' Theorem": [
    { label: "Seeing Theory — Bayes' theorem", url: 'https://seeing-theory.brown.edu/bayesian-inference/index.html' }
  ],
  'Binomial Distribution': [
    { label: 'Khan Academy — Binomial distribution', url: 'https://www.khanacademy.org/math/statistics-probability/random-variables-stats-library/binomial-random-variables' }
  ],
  'Dot Product of Vectors': [
    { label: '3Blue1Brown — Dot products intuition', url: 'https://www.3blue1brown.com/lessons/dot-products' }
  ]
};

export const PHASES = [
  {
    title: 'Relations and Functions',
    priority: 'P0',
    resourceKey: 'relationsFunctions',
    sections: [
      {
        title: 'Relations and Functions',
        items: [
          'Types of Relations', 'Types of Functions', 'Composition of Functions', 'Invertible Functions',
          ['Binary Operations', 'P2']
        ]
      },
      {
        title: 'Inverse Trigonometric Functions',
        items: [
          'Domain and Range of Inverse Trigonometric Functions', 'Properties of Inverse Trigonometric Functions',
          ['Graphs of Inverse Trigonometric Functions', 'P2']
        ]
      }
    ]
  },
  {
    title: 'Algebra',
    priority: 'P0',
    resourceKey: 'algebra',
    sections: [
      {
        title: 'Matrices',
        items: [
          'Types of Matrices', 'Matrix Operations', 'Transpose of a Matrix',
          'Symmetric and Skew-Symmetric Matrices', 'Elementary Row and Column Operations',
          ['Invertible Matrices', 'P1']
        ]
      },
      {
        title: 'Determinants',
        items: [
          'Determinants of Square Matrices', 'Properties of Determinants',
          'Area of a Triangle using Determinants', 'Minors and Cofactors', 'Adjoint and Inverse of a Matrix',
          ['Applications of Determinants and Matrices', 'P1'],
          'Solving a System of Linear Equations using Matrices'
        ]
      }
    ]
  },
  {
    title: 'Calculus',
    priority: 'P0',
    resourceKey: 'calculus',
    sections: [
      {
        title: 'Continuity and Differentiability',
        items: [
          'Continuity', 'Differentiability', 'Chain Rule', 'Derivatives of Implicit Functions',
          'Derivatives of Inverse Trigonometric Functions', 'Logarithmic Differentiation',
          'Derivatives of Functions in Parametric Forms', ['Second Order Derivatives', 'P1'],
          ["Mean Value Theorems (Rolle's and Lagrange's)", 'P1']
        ]
      },
      {
        title: 'Applications of Derivatives',
        items: [
          'Rate of Change of Quantities', 'Increasing and Decreasing Functions', 'Tangents and Normals',
          'Approximations', 'Maxima and Minima', ['Second Derivative Test', 'P1']
        ]
      },
      {
        title: 'Integrals',
        items: [
          'Integration as an Inverse Process of Differentiation',
          'Methods of Integration (Substitution, Partial Fractions, By Parts)',
          'Integrals of Some Particular Functions', 'Fundamental Theorem of Calculus',
          'Definite Integrals and Their Properties'
        ]
      },
      {
        title: 'Applications of Integrals',
        items: [
          'Area under Simple Curves', 'Area between Two Curves',
          ['Area of Regions Bounded by Curves and Lines', 'P1']
        ]
      },
      {
        title: 'Differential Equations',
        items: [
          'Order and Degree of a Differential Equation', 'General and Particular Solutions',
          'Formation of a Differential Equation', 'Solution by the Variable Separable Method',
          'Homogeneous Differential Equations', 'Linear Differential Equations'
        ]
      }
    ]
  },
  {
    title: 'Vectors and Three-Dimensional Geometry',
    priority: 'P0',
    resourceKey: 'vectors3d',
    sections: [
      {
        title: 'Vector Algebra',
        items: [
          'Vectors and Scalars', 'Direction Cosines and Direction Ratios', 'Types of Vectors',
          'Addition of Vectors', 'Multiplication of a Vector by a Scalar', 'Position Vector of a Point',
          'Dot Product of Vectors', 'Cross Product of Vectors', ['Scalar Triple Product', 'P2']
        ]
      },
      {
        title: 'Three-Dimensional Geometry',
        items: [
          'Direction Cosines and Direction Ratios of a Line', 'Equation of a Line in Space',
          'Angle Between Two Lines', 'Shortest Distance Between Two Lines',
          'Equation of a Plane (Normal and General Form)', 'Angle Between Two Planes',
          'Distance of a Point from a Plane'
        ]
      }
    ]
  },
  {
    title: 'Linear Programming',
    priority: 'P1',
    resourceKey: 'linearProgramming',
    sections: [
      {
        title: 'Linear Programming',
        items: [
          'Formulating a Linear Programming Problem', 'Graphical Method of Solution',
          'Feasible and Infeasible Regions', 'Optimal Feasible Solutions',
          ['Diet, Manufacturing, and Transportation Problems', 'P2']
        ]
      }
    ]
  },
  {
    title: 'Probability',
    priority: 'P0',
    resourceKey: 'probability',
    sections: [
      {
        title: 'Probability',
        items: [
          'Conditional Probability', 'Multiplication Theorem on Probability', 'Independent Events',
          "Bayes' Theorem", 'Random Variables and Probability Distributions',
          'Mean and Variance of a Random Variable', 'Bernoulli Trials', 'Binomial Distribution'
        ]
      }
    ]
  },
  {
    title: 'Exam Preparation',
    priority: 'P0',
    resourceKey: 'examPrep',
    sections: [
      {
        title: 'Board Exam Preparation',
        items: [
          'NCERT Textbook Exercises', 'Previous Year Question Papers', 'Sample Papers and Mock Tests',
          'Formula Sheet Revision', 'Time Management for Exams', ['Common Mistakes to Avoid', 'P1']
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
