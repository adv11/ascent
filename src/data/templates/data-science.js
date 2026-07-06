export const RESOURCE_LIBRARY = {
  python: [
    { label: 'Python official docs', url: 'https://docs.python.org/3/' },
    { label: 'Real Python tutorials', url: 'https://realpython.com/' }
  ],
  stats: [
    { label: 'Seeing Theory — visual probability & stats', url: 'https://seeing-theory.brown.edu/' },
    { label: 'StatQuest (YouTube)', url: 'https://www.youtube.com/@statquest' }
  ],
  ml: [
    { label: 'scikit-learn user guide', url: 'https://scikit-learn.org/stable/user_guide.html' },
    { label: 'Google Machine Learning Crash Course', url: 'https://developers.google.com/machine-learning/crash-course' }
  ],
  deepLearning: [
    { label: 'PyTorch tutorials', url: 'https://pytorch.org/tutorials/' },
    { label: 'Deep Learning Book (Goodfellow et al.)', url: 'https://www.deeplearningbook.org/' }
  ],
  sql: [
    { label: 'PostgreSQL docs', url: 'https://www.postgresql.org/docs/current/' },
    { label: 'Mode SQL tutorial', url: 'https://mode.com/sql-tutorial/' }
  ],
  dataEngineering: [
    { label: 'pandas documentation', url: 'https://pandas.pydata.org/docs/' },
    { label: 'Apache Airflow docs', url: 'https://airflow.apache.org/docs/' }
  ],
  mlops: [
    { label: 'MLOps guide (Google Cloud)', url: 'https://cloud.google.com/architecture/mlops-continuous-delivery-and-automation-pipelines-in-machine-learning' },
    { label: 'MLflow docs', url: 'https://mlflow.org/docs/latest/index.html' }
  ],
  visualization: [
    { label: 'Matplotlib documentation', url: 'https://matplotlib.org/stable/index.html' }
  ],
  interview: [
    { label: 'StrataScratch practice problems', url: 'https://www.stratascratch.com/' }
  ]
};

export const PHASES = [
  {
    title: 'Python for Data Science',
    priority: 'P0',
    resourceKey: 'python',
    sections: [
      {
        title: 'Language Fundamentals',
        items: [
          'Data Types', 'Control Flow', 'Functions', 'List and Dict Comprehensions',
          'Error Handling', 'Virtual Environments', ['Decorators', 'P2'], ['Type Hints', 'P2']
        ]
      },
      {
        title: 'Core Libraries',
        items: ['NumPy Arrays', 'pandas DataFrames', 'Vectorized Operations', 'Matplotlib', 'Seaborn', ['Jupyter Notebooks', 'P1']]
      }
    ]
  },
  {
    title: 'Statistics and Probability',
    priority: 'P0',
    resourceKey: 'stats',
    sections: [
      {
        title: 'Foundations',
        items: [
          'Descriptive Statistics', 'Probability Distributions', 'Bayes Theorem', 'Hypothesis Testing',
          'p-values and Confidence Intervals', 'Correlation vs Causation', ['A/B Testing', 'P1'],
          ['Central Limit Theorem', 'P1']
        ]
      }
    ]
  },
  {
    title: 'Machine Learning Fundamentals',
    priority: 'P0',
    resourceKey: 'ml',
    sections: [
      {
        title: 'Supervised Learning',
        items: [
          'Linear Regression', 'Logistic Regression', 'Decision Trees', 'Random Forests',
          'Gradient Boosting', 'Support Vector Machines', 'k-Nearest Neighbors',
          ['Feature Engineering', 'P1'], ['Regularization', 'P1']
        ]
      },
      {
        title: 'Unsupervised Learning',
        items: ['k-Means Clustering', 'Hierarchical Clustering', 'PCA', ['DBSCAN', 'P2']]
      },
      {
        title: 'Model Evaluation',
        items: ['Train/Test Split', 'Cross-Validation', 'Confusion Matrix', 'ROC and AUC', 'Bias-Variance Tradeoff', ['Hyperparameter Tuning', 'P1']]
      }
    ]
  },
  {
    title: 'Deep Learning',
    priority: 'P1',
    resourceKey: 'deepLearning',
    sections: [
      {
        title: 'Neural Networks',
        items: [
          'Perceptrons', 'Backpropagation', 'Activation Functions', 'Loss Functions',
          'Optimizers', 'Overfitting and Dropout', ['Batch Normalization', 'P2']
        ]
      },
      {
        title: 'Architectures',
        items: ['CNNs', 'RNNs and LSTMs', 'Transformers', ['Transfer Learning', 'P1'], ['Attention Mechanism', 'P1']]
      }
    ]
  },
  {
    title: 'SQL and Databases',
    priority: 'P0',
    resourceKey: 'sql',
    sections: [
      { title: 'SQL', items: ['SQL Basics', 'Joins', 'Aggregations', 'Window Functions', 'Subqueries', 'Query Optimization', ['CTEs', 'P1']] }
    ]
  },
  {
    title: 'Data Engineering',
    priority: 'P1',
    resourceKey: 'dataEngineering',
    sections: [
      {
        title: 'Data Pipelines',
        items: [
          'Data Cleaning', 'ETL vs ELT', 'Data Warehousing Basics', 'Batch vs Streaming',
          ['Apache Airflow basics', 'P2'], ['Data Quality Checks', 'P2']
        ]
      }
    ]
  },
  {
    title: 'MLOps and Deployment',
    priority: 'P1',
    resourceKey: 'mlops',
    sections: [
      {
        title: 'Productionizing Models',
        items: [
          'Model Serialization', 'Model Serving APIs', 'Experiment Tracking', 'Model Versioning',
          'Monitoring and Drift Detection', ['CI/CD for ML', 'P2'], ['Feature Stores', 'P3']
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
          'SQL Interview Questions', 'ML Case Studies', 'Statistics Interview Questions',
          'Take-home Assignment Practice', 'Portfolio Projects', 'Resume Preparation',
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
