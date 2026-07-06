export const RESOURCE_LIBRARY = {
  llmFund: [
    { label: 'OpenAI — prompt engineering guide', url: 'https://platform.openai.com/docs/guides/prompt-engineering' },
    { label: 'Anthropic — Claude documentation', url: 'https://docs.claude.com/en/docs/intro' },
    { label: 'Hugging Face — NLP course', url: 'https://huggingface.co/learn/nlp-course' }
  ],
  promptEng: [
    { label: 'Prompt Engineering Guide', url: 'https://www.promptingguide.ai/' },
    { label: 'Anthropic — prompt engineering overview', url: 'https://docs.claude.com/en/docs/build-with-claude/prompt-engineering/overview' }
  ],
  rag: [
    { label: 'RAG paper (Lewis et al.)', url: 'https://arxiv.org/abs/2005.11401' },
    { label: 'Pinecone — RAG learning center', url: 'https://www.pinecone.io/learn/retrieval-augmented-generation/' },
    { label: 'LlamaIndex documentation', url: 'https://docs.llamaindex.ai/en/stable/' }
  ],
  agents: [
    { label: 'ReAct paper (Yao et al.)', url: 'https://arxiv.org/abs/2210.03629' },
    { label: 'LangGraph documentation', url: 'https://langchain-ai.github.io/langgraph/' },
    { label: 'Anthropic — building effective agents', url: 'https://www.anthropic.com/research/building-effective-agents' }
  ],
  frameworks: [
    { label: 'LangChain documentation', url: 'https://python.langchain.com/docs/introduction/' },
    { label: 'LlamaIndex documentation', url: 'https://docs.llamaindex.ai/en/stable/' },
    { label: 'CrewAI documentation', url: 'https://docs.crewai.com/' }
  ],
  finetuning: [
    { label: 'Hugging Face — fine-tuning guide', url: 'https://huggingface.co/docs/transformers/training' },
    { label: 'LoRA paper (Hu et al.)', url: 'https://arxiv.org/abs/2106.09685' }
  ],
  evaluation: [
    { label: 'RAGAS documentation', url: 'https://docs.ragas.io/en/stable/' },
    { label: 'OpenAI Evals', url: 'https://github.com/openai/evals' }
  ],
  safety: [
    { label: 'OWASP Top 10 for LLM Applications', url: 'https://owasp.org/www-project-top-10-for-large-language-model-applications/' },
    { label: 'Anthropic — Constitutional AI', url: 'https://www.anthropic.com/research/constitutional-ai-harmlessness-from-ai-feedback' }
  ],
  knowledgeGraph: [
    { label: 'Neo4j — GraphRAG guide', url: 'https://neo4j.com/developer-blog/what-is-graphrag/' }
  ],
  deployment: [
    { label: 'OpenAI API reference', url: 'https://platform.openai.com/docs/api-reference' },
    { label: 'Vercel AI SDK docs', url: 'https://sdk.vercel.ai/docs' }
  ],
  interview: [
    { label: 'GreatFrontEnd — AI/LLM interview prep', url: 'https://www.greatfrontend.com/' },
    { label: 'Exponent — AI/ML interview prep', url: 'https://www.tryexponent.com/' }
  ]
};

export const TOPIC_RESOURCES = {
  'RAG': [
    { label: 'RAG paper (Lewis et al.)', url: 'https://arxiv.org/abs/2005.11401' }
  ],
  'MCP (Model Context Protocol)': [
    { label: 'Model Context Protocol spec', url: 'https://modelcontextprotocol.io/introduction' }
  ],
  'Prompt Injection Defense': [
    { label: 'OWASP LLM Top 10', url: 'https://owasp.org/www-project-top-10-for-large-language-model-applications/' }
  ],
  'LangGraph': [
    { label: 'LangGraph docs', url: 'https://langchain-ai.github.io/langgraph/' }
  ],
  'Agent Design Patterns (ReAct, Reflection)': [
    { label: 'ReAct paper', url: 'https://arxiv.org/abs/2210.03629' },
    { label: 'Anthropic — building effective agents', url: 'https://www.anthropic.com/research/building-effective-agents' }
  ],
  'Fine-tuning Basics': [
    { label: 'Hugging Face fine-tuning guide', url: 'https://huggingface.co/docs/transformers/training' }
  ],
  'LoRA and QLoRA': [
    { label: 'LoRA paper', url: 'https://arxiv.org/abs/2106.09685' }
  ],
  'GraphRAG': [
    { label: 'Neo4j GraphRAG guide', url: 'https://neo4j.com/developer-blog/what-is-graphrag/' }
  ],
  'Tool / Function Calling': [
    { label: 'OpenAI — function calling guide', url: 'https://platform.openai.com/docs/guides/function-calling' }
  ],
  'Context Window': [
    { label: 'Anthropic — context windows', url: 'https://docs.claude.com/en/docs/build-with-claude/context-windows' }
  ]
};

export const PHASES = [
  {
    title: 'LLM Fundamentals',
    priority: 'P0',
    resourceKey: 'llmFund',
    sections: [
      {
        title: 'Core Concepts',
        items: [
          'Tokens and Tokenization', 'Context Window', 'Embeddings', 'Temperature, Top-p, and Top-k',
          'System vs User vs Assistant Roles', 'Streaming Responses', 'Structured Outputs',
          ['Multimodal Basics', 'P1']
        ]
      },
      {
        title: 'Model Landscape',
        items: [
          'Open vs Closed Models', 'Model Sizes and Tradeoffs', ['Model Cards', 'P2'],
          ['Quantization', 'P2'], ['Distillation', 'P3']
        ]
      }
    ]
  },
  {
    title: 'Prompt Engineering',
    priority: 'P0',
    resourceKey: 'promptEng',
    sections: [
      {
        title: 'Fundamentals',
        items: [
          'Prompt Engineering Fundamentals', 'Zero-shot and Few-shot Prompting',
          'Chain-of-Thought Prompting', 'Role Prompting', ['Self-Consistency', 'P2'], ['ReAct Prompting', 'P1']
        ]
      },
      {
        title: 'Practical Techniques',
        items: [
          'Context Engineering', 'Prompt Templates and Versioning',
          ['Structured Output Prompting (JSON mode)', 'P1'], ['Prompt Injection Awareness', 'P1']
        ]
      }
    ]
  },
  {
    title: 'RAG and Retrieval',
    priority: 'P0',
    resourceKey: 'rag',
    sections: [
      {
        title: 'Fundamentals',
        items: ['Vector Databases', 'Embeddings for Retrieval', 'Chunking Strategy', 'Basic RAG Pipeline']
      },
      {
        title: 'Advanced RAG',
        items: [
          'Hybrid Search', 'Metadata Filtering', 'Reranking', ['Query Rewriting', 'P1'],
          ['Parent-Child Chunking', 'P2'], 'RAG Evaluation', ['RAGAS Awareness', 'P2']
        ]
      },
      {
        title: 'Vector Database Options',
        items: [
          ['Pinecone / Weaviate / Milvus / pgvector Awareness', 'P2'],
          ['Retrieval Latency and Cost Tuning', 'P2']
        ]
      }
    ]
  },
  {
    title: 'Agentic AI',
    priority: 'P0',
    resourceKey: 'agents',
    sections: [
      {
        title: 'Agent Fundamentals',
        items: [
          'AI Agents', 'Tool / Function Calling', 'Agent Design Patterns (ReAct, Reflection)',
          ['Planning and Task Decomposition', 'P1']
        ]
      },
      {
        title: 'Multi-Agent Systems',
        items: [
          'Multi-Agent Orchestration', ['CrewAI / AutoGen Awareness', 'P2'],
          ['Agent Communication Protocols', 'P2'], ['Human-in-the-loop Workflows', 'P1']
        ]
      },
      {
        title: 'Tooling and Protocols',
        items: ['MCP (Model Context Protocol)', 'Tool Permissioning', ['Sandboxing Tool Execution', 'P2']]
      }
    ]
  },
  {
    title: 'Frameworks and Ecosystem',
    priority: 'P1',
    resourceKey: 'frameworks',
    sections: [
      {
        title: 'Orchestration Frameworks',
        items: [
          'LangChain', 'LangGraph', ['LlamaIndex Awareness', 'P1'], ['Semantic Kernel Awareness', 'P3'],
          ['Vercel AI SDK Awareness', 'P3']
        ]
      }
    ]
  },
  {
    title: 'Fine-tuning and Model Customization',
    priority: 'P1',
    resourceKey: 'finetuning',
    sections: [
      {
        title: 'Fine-tuning',
        items: [
          'Fine-tuning Basics', ['LoRA and QLoRA', 'P2'], ['RLHF Awareness', 'P2'],
          ['Instruction Tuning', 'P2'], ['Dataset Curation for Fine-tuning', 'P2']
        ]
      }
    ]
  },
  {
    title: 'Evaluation and Observability',
    priority: 'P1',
    resourceKey: 'evaluation',
    sections: [
      {
        title: 'Evaluating LLM Applications',
        items: [
          'LLM-as-judge Evaluation', 'LLM Observability and Tracing', ['Golden Datasets', 'P2'],
          ['A/B Testing LLM Outputs', 'P2'], ['Cost and Latency Optimization', 'P1']
        ]
      }
    ]
  },
  {
    title: 'AI Safety and Guardrails',
    priority: 'P1',
    resourceKey: 'safety',
    sections: [
      {
        title: 'Safety and Responsible AI',
        items: [
          'Prompt Injection Defense', 'Guardrails', ['Jailbreak Awareness', 'P2'],
          'PII Handling in AI Apps', ['Content Moderation', 'P2'], ['Red Teaming LLM Apps', 'P2']
        ]
      }
    ]
  },
  {
    title: 'Knowledge Graphs and Advanced Retrieval',
    priority: 'P2',
    resourceKey: 'knowledgeGraph',
    sections: [
      {
        title: 'Graph-based Retrieval',
        items: ['Knowledge Graph', 'GraphRAG', ['Ontology Basics', 'P3']]
      }
    ]
  },
  {
    title: 'Deployment and Production',
    priority: 'P1',
    resourceKey: 'deployment',
    sections: [
      {
        title: 'Shipping AI Applications',
        items: [
          'Serving LLM Applications', ['API Rate Limiting and Retries', 'P2'],
          ['Caching LLM Responses', 'P2'], ['Streaming UI Patterns', 'P2'], ['Model/Prompt Versioning', 'P1']
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
          'GenAI and Agentic AI Interview Questions', 'System Design for AI Applications',
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
