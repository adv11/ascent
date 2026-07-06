export const RESOURCE_LIBRARY = {
  python: [
    { label: 'Python official docs', url: 'https://docs.python.org/3/' },
    { label: 'Real Python tutorials', url: 'https://realpython.com/' },
    { label: 'NumPy documentation', url: 'https://numpy.org/doc/stable/' },
    { label: 'pandas documentation', url: 'https://pandas.pydata.org/docs/' }
  ],
  math: [
    { label: '3Blue1Brown — Essence of Linear Algebra', url: 'https://www.3blue1brown.com/topics/linear-algebra' },
    { label: 'Khan Academy — Multivariable Calculus', url: 'https://www.khanacademy.org/math/multivariable-calculus' }
  ],
  stats: [
    { label: 'Seeing Theory — visual probability & stats', url: 'https://seeing-theory.brown.edu/' },
    { label: 'StatQuest (YouTube)', url: 'https://www.youtube.com/@statquest' }
  ],
  dataWrangling: [
    { label: 'pandas documentation', url: 'https://pandas.pydata.org/docs/' },
    { label: 'Kaggle — Data Cleaning course', url: 'https://www.kaggle.com/learn/data-cleaning' }
  ],
  ml: [
    { label: 'scikit-learn user guide', url: 'https://scikit-learn.org/stable/user_guide.html' },
    { label: 'Google Machine Learning Crash Course', url: 'https://developers.google.com/machine-learning/crash-course' },
    { label: 'XGBoost documentation', url: 'https://xgboost.readthedocs.io/en/stable/' }
  ],
  deepLearning: [
    { label: 'PyTorch tutorials', url: 'https://pytorch.org/tutorials/' },
    { label: 'Deep Learning Book (Goodfellow et al.)', url: 'https://www.deeplearningbook.org/' },
    { label: 'TensorFlow documentation', url: 'https://www.tensorflow.org/learn' }
  ],
  nlp: [
    { label: 'Hugging Face NLP course', url: 'https://huggingface.co/learn/nlp-course' },
    { label: 'Hugging Face Transformers docs', url: 'https://huggingface.co/docs/transformers/index' }
  ],
  cv: [
    { label: 'OpenCV documentation', url: 'https://docs.opencv.org/4.x/' },
    { label: 'PyTorch Vision (torchvision) docs', url: 'https://pytorch.org/vision/stable/index.html' }
  ],
  sql: [
    { label: 'PostgreSQL docs', url: 'https://www.postgresql.org/docs/current/' },
    { label: 'Mode SQL tutorial', url: 'https://mode.com/sql-tutorial/' }
  ],
  dataEngineering: [
    { label: 'Apache Airflow docs', url: 'https://airflow.apache.org/docs/' },
    { label: 'Apache Spark documentation', url: 'https://spark.apache.org/docs/latest/' }
  ],
  mlops: [
    { label: 'MLOps guide (Google Cloud)', url: 'https://cloud.google.com/architecture/mlops-continuous-delivery-and-automation-pipelines-in-machine-learning' },
    { label: 'MLflow docs', url: 'https://mlflow.org/docs/latest/index.html' },
    { label: 'Docker documentation', url: 'https://docs.docker.com/' }
  ],
  visualization: [
    { label: 'Matplotlib documentation', url: 'https://matplotlib.org/stable/index.html' },
    { label: 'Plotly Python docs', url: 'https://plotly.com/python/' }
  ],
  cloud: [
    { label: 'AWS SageMaker documentation', url: 'https://docs.aws.amazon.com/sagemaker/' }
  ],
  ethics: [
    { label: 'Google — Responsible AI practices', url: 'https://ai.google/responsibility/responsible-ai-practices/' },
    { label: 'SHAP documentation', url: 'https://shap.readthedocs.io/en/latest/' }
  ],
  interview: [
    { label: 'StrataScratch practice problems', url: 'https://www.stratascratch.com/' }
  ]
};

export const TOPIC_RESOURCES = {
  'Gradient Descent Intuition': [
    { label: '3Blue1Brown — Gradient descent, how neural networks learn', url: 'https://www.3blue1brown.com/lessons/gradient-descent' }
  ],
  'Bayes Theorem': [
    { label: 'Seeing Theory — Bayesian inference', url: 'https://seeing-theory.brown.edu/bayesian-inference/index.html' }
  ],
  'Central Limit Theorem': [
    { label: 'Seeing Theory — CLT', url: 'https://seeing-theory.brown.edu/probability-distributions/index.html' }
  ],
  'Precision/Recall/F1': [
    { label: 'scikit-learn — precision, recall, F-measure', url: 'https://scikit-learn.org/stable/modules/model_evaluation.html#precision-recall-f-measure-metrics' }
  ],
  'Transformers': [
    { label: 'The Illustrated Transformer', url: 'http://jalammar.github.io/illustrated-transformer/' },
    { label: 'Attention Is All You Need (paper)', url: 'https://arxiv.org/abs/1706.03762' }
  ],
  'Attention Mechanism': [
    { label: 'The Illustrated Transformer', url: 'http://jalammar.github.io/illustrated-transformer/' }
  ],
  'PyTorch Basics': [
    { label: 'PyTorch — 60 minute blitz', url: 'https://pytorch.org/tutorials/beginner/deep_learning_60min_blitz.html' }
  ],
  'Window Functions': [
    { label: 'PostgreSQL — Window Functions', url: 'https://www.postgresql.org/docs/current/tutorial-window.html' }
  ],
  'Model Monitoring and Drift Detection': [
    { label: 'Evidently AI — ML monitoring guide', url: 'https://www.evidentlyai.com/ml-in-production/model-monitoring' }
  ],
  'Explainability (SHAP/LIME)': [
    { label: 'SHAP documentation', url: 'https://shap.readthedocs.io/en/latest/' }
  ],
  'A/B Testing Design': [
    { label: 'Trustworthy Online Controlled Experiments (book site)', url: 'https://www.exp-platform.com/' }
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
          'Data Types', 'Control Flow', 'Functions', 'List, Dict, and Set Comprehensions',
          ['Generators', 'P2'], ['Decorators', 'P2'], 'Error Handling', ['Type Hints', 'P2'],
          'Virtual Environments and pip'
        ]
      },
      {
        title: 'Core Libraries',
        items: [
          'NumPy Arrays', ['Broadcasting', 'P1'], 'pandas DataFrames', ['Vectorized Operations', 'P1'],
          ['GroupBy Operations', 'P1'], ['Merging and Joining DataFrames', 'P1'], 'Matplotlib', 'Seaborn',
          ['Plotly Basics', 'P2'], 'Jupyter Notebooks'
        ]
      }
    ]
  },
  {
    title: 'Mathematics for Machine Learning',
    priority: 'P0',
    resourceKey: 'math',
    sections: [
      {
        title: 'Linear Algebra',
        items: [
          'Vectors and Matrices', 'Matrix Multiplication', ['Eigenvalues and Eigenvectors', 'P1'],
          ['Singular Value Decomposition', 'P2'], ['Norms', 'P2']
        ]
      },
      {
        title: 'Calculus',
        items: ['Derivatives and Gradients', ['Partial Derivatives', 'P1'], ['Chain Rule', 'P1'], ['Gradient Descent Intuition', 'P0']]
      },
      {
        title: 'Probability',
        items: ['Probability Basics', ['Conditional Probability', 'P1'], 'Bayes Theorem', ['Random Variables', 'P1'], 'Probability Distributions']
      }
    ]
  },
  {
    title: 'Statistics',
    priority: 'P0',
    resourceKey: 'stats',
    sections: [
      {
        title: 'Descriptive and Inferential Statistics',
        items: [
          'Mean, Median, Mode, Variance', ['Skewness and Kurtosis', 'P2'], 'Hypothesis Testing',
          'p-values and Statistical Significance', ['Confidence Intervals', 'P1'], ['t-tests and ANOVA', 'P1'],
          ['Chi-Square Tests', 'P2'], 'Correlation vs Causation', ['Central Limit Theorem', 'P1']
        ]
      },
      {
        title: 'Experimentation',
        items: [
          ['A/B Testing Design', 'P1'], ['Sample Size Calculation', 'P2'], ['Statistical Power', 'P2'],
          ['Multiple Testing Correction', 'P3']
        ]
      }
    ]
  },
  {
    title: 'Data Wrangling and EDA',
    priority: 'P0',
    resourceKey: 'dataWrangling',
    sections: [
      {
        title: 'Data Cleaning',
        items: [
          'Handling Missing Data', ['Outlier Detection', 'P1'], 'Data Type Conversion',
          ['Deduplication', 'P1'], ['Data Validation', 'P2']
        ]
      },
      {
        title: 'Exploratory Data Analysis',
        items: [
          ['Univariate Analysis', 'P1'], ['Bivariate and Multivariate Analysis', 'P1'],
          ['Correlation Analysis', 'P1'], ['Data Visualization for EDA', 'P1'], ['Feature Distributions', 'P2']
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
          'Linear Regression', 'Logistic Regression', ['Regularization (L1 and L2)', 'P1'], 'Decision Trees',
          'Random Forests', 'Gradient Boosting (XGBoost / LightGBM)', 'Support Vector Machines',
          'k-Nearest Neighbors', ['Naive Bayes', 'P2']
        ]
      },
      {
        title: 'Unsupervised Learning',
        items: ['k-Means Clustering', 'Hierarchical Clustering', ['DBSCAN', 'P2'], 'PCA', ['t-SNE and UMAP', 'P2'], ['Anomaly Detection', 'P2']]
      },
      {
        title: 'Feature Engineering',
        items: [
          ['Feature Scaling', 'P1'], ['Encoding Categorical Variables', 'P1'], ['Feature Selection', 'P1'],
          ['Handling Imbalanced Data', 'P1'], ['Feature Interaction Terms', 'P2']
        ]
      },
      {
        title: 'Model Evaluation and Tuning',
        items: [
          'Train/Test/Validation Split', 'Cross-Validation', 'Confusion Matrix', ['Precision/Recall/F1', 'P0'],
          'ROC and AUC', ['Bias-Variance Tradeoff', 'P1'], 'Hyperparameter Tuning (Grid / Random Search)',
          ['Bayesian Optimization', 'P3']
        ]
      }
    ]
  },
  {
    title: 'Deep Learning',
    priority: 'P1',
    resourceKey: 'deepLearning',
    sections: [
      {
        title: 'Neural Network Fundamentals',
        items: [
          'Perceptrons and Multi-Layer Perceptrons', 'Backpropagation', 'Activation Functions', 'Loss Functions',
          'Optimizers (SGD / Adam)', ['Overfitting and Dropout', 'P1'], ['Batch Normalization', 'P2'],
          ['Weight Initialization', 'P2']
        ]
      },
      {
        title: 'Architectures',
        items: [
          'Convolutional Neural Networks', 'Recurrent Neural Networks and LSTMs', ['Transformers', 'P0'],
          ['Attention Mechanism', 'P1'], ['Transfer Learning', 'P1'], ['Autoencoders', 'P2'],
          ['GANs Awareness', 'P3']
        ]
      },
      {
        title: 'Frameworks',
        items: [
          ['PyTorch Basics', 'P1'], ['TensorFlow / Keras Basics', 'P2'], ['Training Loops', 'P1'],
          ['GPU Acceleration Basics', 'P2']
        ]
      }
    ]
  },
  {
    title: 'Natural Language Processing',
    priority: 'P1',
    resourceKey: 'nlp',
    sections: [
      {
        title: 'NLP Fundamentals',
        items: [
          ['Tokenization', 'P1'], ['Stemming and Lemmatization', 'P2'], ['Bag of Words and TF-IDF', 'P1'],
          ['Word Embeddings (Word2Vec / GloVe)', 'P1'], ['Named Entity Recognition', 'P2'],
          ['Sentiment Analysis', 'P2']
        ]
      },
      {
        title: 'Modern NLP',
        items: [
          ['Transformer-based Language Models', 'P1'], ['Fine-tuning Pretrained Models', 'P1'],
          ['Retrieval-Augmented Generation', 'P2'], ['Prompt Engineering', 'P2']
        ]
      }
    ]
  },
  {
    title: 'Computer Vision',
    priority: 'P2',
    resourceKey: 'cv',
    sections: [
      {
        title: 'CV Fundamentals',
        items: [
          ['Image Preprocessing', 'P2'], ['Convolution and Pooling', 'P2'], ['Object Detection Basics', 'P2'],
          ['Image Segmentation Basics', 'P3'], ['Data Augmentation', 'P2']
        ]
      }
    ]
  },
  {
    title: 'SQL and Databases',
    priority: 'P0',
    resourceKey: 'sql',
    sections: [
      {
        title: 'SQL',
        items: [
          'SQL Basics (SELECT, WHERE, ORDER BY)', 'Joins', 'Aggregations and GROUP BY',
          ['Window Functions', 'P1'], 'Subqueries', ['Common Table Expressions', 'P1'],
          ['Query Optimization', 'P2'], ['Indexing Basics', 'P2']
        ]
      },
      {
        title: 'Databases',
        items: [['Relational vs NoSQL', 'P1'], ['Data Warehousing Concepts', 'P2'], ['Star and Snowflake Schemas', 'P2']]
      }
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
          ['ETL vs ELT', 'P1'], ['Batch vs Streaming Processing', 'P2'], ['Apache Airflow Basics', 'P2'],
          ['Data Quality Checks', 'P2'], ['Data Lakes vs Data Warehouses', 'P2']
        ]
      },
      {
        title: 'Big Data',
        items: [
          ['Distributed Computing Concepts', 'P2'], ['Apache Spark Basics', 'P2'],
          ['Hadoop Ecosystem Awareness', 'P3'], ['Partitioning Strategies', 'P3']
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
          'Model Serialization (pickle / ONNX)', ['Model Serving APIs', 'P1'],
          ['Containerizing ML Models with Docker', 'P1'], ['Experiment Tracking (MLflow)', 'P1'],
          ['Model Versioning', 'P1'], ['CI/CD for ML', 'P2'], ['Model Monitoring and Drift Detection', 'P1'],
          ['Feature Stores', 'P3']
        ]
      }
    ]
  },
  {
    title: 'Data Visualization and Communication',
    priority: 'P1',
    resourceKey: 'visualization',
    sections: [
      {
        title: 'Visualization',
        items: [
          ['Choosing the Right Chart Type', 'P1'],
          ['Dashboarding (Tableau / Power BI / Looker Awareness)', 'P2'], ['Storytelling with Data', 'P1'],
          ['Interactive Visualization (Plotly / D3 Awareness)', 'P2']
        ]
      }
    ]
  },
  {
    title: 'Cloud and ML Platforms',
    priority: 'P2',
    resourceKey: 'cloud',
    sections: [
      {
        title: 'Cloud ML',
        items: [
          ['AWS SageMaker Awareness', 'P2'], ['Google Vertex AI Awareness', 'P3'],
          ['Compute vs Storage Basics', 'P2'], ['Cost Awareness for ML Workloads', 'P2']
        ]
      }
    ]
  },
  {
    title: 'Ethics and Responsible AI',
    priority: 'P2',
    resourceKey: 'ethics',
    sections: [
      {
        title: 'Responsible AI',
        items: [
          ['Bias and Fairness in ML', 'P1'], ['Data Privacy Basics', 'P1'], ['Explainability (SHAP/LIME)', 'P2'],
          ['Model Cards and Documentation', 'P3']
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
          'SQL Interview Questions', 'ML Case Study Interviews', 'Statistics Interview Questions',
          'Take-home Assignment Practice', 'Coding for Data Science (Python and pandas)',
          'Portfolio Projects', 'Resume Preparation', ['Behavioral Stories in STAR format', 'P1']
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
