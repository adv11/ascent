export const ROADMAP_VERSION = 3;

export const RESOURCE_LIBRARY = {
  java: [
    { label: 'Oracle Java 21 docs', url: 'https://docs.oracle.com/en/java/javase/21/' },
    { label: 'Virtual threads guide', url: 'https://docs.oracle.com/en/java/javase/21/core/virtual-threads.html' }
  ],
  spring: [
    { label: 'Spring Boot reference', url: 'https://docs.spring.io/spring-boot/docs/current/reference/htmlsingle/' },
    { label: 'Spring Security reference', url: 'https://docs.spring.io/spring-security/reference/' },
    { label: 'Spring AI reference', url: 'https://docs.spring.io/spring-ai/reference/' }
  ],
  microservices: [
    { label: 'Microservices patterns', url: 'https://microservices.io/patterns/' },
    { label: 'Transactional outbox', url: 'https://microservices.io/patterns/data/transactional-outbox.html' }
  ],
  kafka: [
    { label: 'Apache Kafka documentation', url: 'https://kafka.apache.org/documentation/' }
  ],
  redis: [
    { label: 'Redis documentation', url: 'https://redis.io/docs/latest/' }
  ],
  database: [
    { label: 'PostgreSQL docs', url: 'https://www.postgresql.org/docs/current/' },
    { label: 'MongoDB manual', url: 'https://www.mongodb.com/docs/manual/' }
  ],
  security: [
    { label: 'OWASP Top 10', url: 'https://owasp.org/www-project-top-ten/' },
    { label: 'OWASP API Security Top 10', url: 'https://owasp.org/www-project-api-security/' }
  ],
  observability: [
    { label: 'OpenTelemetry docs', url: 'https://opentelemetry.io/docs/' },
    { label: 'Prometheus docs', url: 'https://prometheus.io/docs/introduction/overview/' }
  ],
  genai: [
    { label: 'Spring AI reference', url: 'https://docs.spring.io/spring-ai/reference/' },
    { label: 'OpenAI prompt engineering guide', url: 'https://platform.openai.com/docs/guides/prompt-engineering' },
    { label: 'OpenAI function calling guide', url: 'https://platform.openai.com/docs/guides/function-calling' }
  ],
  systemDesign: [
    { label: 'System Design Primer', url: 'https://github.com/donnemartin/system-design-primer' },
    { label: 'Martin Fowler architecture articles', url: 'https://martinfowler.com/architecture/' }
  ],
  dsa: [
    { label: 'NeetCode roadmap', url: 'https://neetcode.io/roadmap' },
    { label: 'LeetCode problems', url: 'https://leetcode.com/problemset/' }
  ],
  cloud: [
    { label: 'AWS Well-Architected Framework', url: 'https://docs.aws.amazon.com/wellarchitected/latest/framework/welcome.html' },
    { label: 'Kubernetes docs', url: 'https://kubernetes.io/docs/home/' }
  ],
  distributed: [
    { label: 'DDIA — Designing Data-Intensive Applications', url: 'https://dataintensive.net/' },
    { label: 'Jepsen consistency analyses', url: 'https://jepsen.io/analyses' }
  ],
  cicd: [
    { label: 'GitHub Actions docs', url: 'https://docs.github.com/en/actions' },
    { label: 'Trunk-based development', url: 'https://trunkbaseddevelopment.com/' }
  ],
  linux: [
    { label: 'Linux Journey', url: 'https://linuxjourney.com/' },
    { label: 'Brendan Gregg perf tools', url: 'https://www.brendangregg.com/linuxperf.html' }
  ],
  cs: [
    { label: 'Computer Networking: A Top-Down Approach', url: 'https://gaia.cs.umass.edu/kurose_ross/online_lectures.htm' },
    { label: 'HTTP RFC 9110', url: 'https://www.rfc-editor.org/rfc/rfc9110' }
  ],
  interview: [
    { label: 'Exponent system design', url: 'https://www.tryexponent.com/courses/system-design-interviews' },
    { label: 'STAR method guide', url: 'https://capd.mit.edu/resources/the-star-method-for-behavioral-interviews/' }
  ]
};

/** Topic-specific resources keyed by exact item title for richer defaults */
export const TOPIC_RESOURCES = {
  'Virtual Threads': [
    { label: 'JEP 444: Virtual Threads', url: 'https://openjdk.org/jeps/444' },
    { label: 'Inside Java — virtual threads', url: 'https://inside.java/2023/04/19/virtualthreads.html' }
  ],
  'Spring Boot': [
    { label: 'Spring Boot getting started', url: 'https://spring.io/guides/gs/spring-boot/' }
  ],
  'Spring Security': [
    { label: 'Spring Security architecture', url: 'https://docs.spring.io/spring-security/reference/servlet/architecture.html' }
  ],
  'Kafka Architecture': [
    { label: 'Kafka intro (Confluent)', url: 'https://docs.confluent.io/kafka/design/index.html' }
  ],
  'RAG': [
    { label: 'RAG paper (Lewis et al.)', url: 'https://arxiv.org/abs/2005.11401' },
    { label: 'Spring AI RAG guide', url: 'https://docs.spring.io/spring-ai/reference/api/retrieval-augmented-generation.html' }
  ],
  'MCP': [
    { label: 'Model Context Protocol spec', url: 'https://modelcontextprotocol.io/introduction' }
  ],
  'Dynamic Programming': [
    { label: 'NeetCode DP patterns', url: 'https://neetcode.io/roadmap' }
  ],
  'CAP Theorem': [
    { label: 'CAP twelve years later', url: 'https://www.infoq.com/articles/cap-twelve-years-later-how-the-rules-have-changed/' }
  ],
  'Saga Pattern': [
    { label: 'Microservices.io — Saga', url: 'https://microservices.io/patterns/data/saga.html' }
  ],
  'Outbox Pattern': [
    { label: 'Transactional outbox', url: 'https://microservices.io/patterns/data/transactional-outbox.html' }
  ],
  'OpenTelemetry': [
    { label: 'OpenTelemetry Java', url: 'https://opentelemetry.io/docs/languages/java/' }
  ],
  'Testcontainers': [
    { label: 'Testcontainers docs', url: 'https://java.testcontainers.org/' }
  ],
  'Resilience4j': [
    { label: 'Resilience4j docs', url: 'https://resilience4j.readme.io/docs' }
  ],
  'JWT': [
    { label: 'JWT.io intro', url: 'https://jwt.io/introduction' }
  ],
  'OAuth2': [
    { label: 'OAuth 2.0 simplified', url: 'https://aaronparecki.com/oauth-2-simplified/' }
  ],
  'Load Balancer': [
    { label: 'System Design — load balancing', url: 'https://github.com/donnemartin/system-design-primer#load-balancer' }
  ],
  'LangGraph': [
    { label: 'LangGraph docs', url: 'https://langchain-ai.github.io/langgraph/' }
  ],
  'Prompt Injection Defense': [
    { label: 'OWASP LLM Top 10', url: 'https://owasp.org/www-project-top-10-for-large-language-model-applications/' }
  ]
};

export const PHASES = [
  {
    title: 'Core Java',
    priority: 'P0',
    resourceKey: 'java',
    sections: [
      {
        title: 'Java Fundamentals',
        items: [
          'OOP', 'SOLID Principles', 'Collections Framework', 'Generics', 'Exception Handling', 'Enums',
          'Annotations', 'Reflection', 'File I/O', 'NIO', ['Records', 'P1'], ['Sealed Classes', 'P1'],
          ['Pattern Matching for switch and instanceof', 'P1'], ['Text Blocks', 'P2'], ['VarHandles', 'P3']
        ]
      },
      {
        title: 'Functional Programming',
        items: ['Lambda Expressions', 'Functional Interfaces', 'Streams API', 'Collectors', 'Optional', ['CompletableFuture composition', 'P1']]
      },
      {
        title: 'Concurrency',
        items: [
          'Threads', 'Thread Lifecycle', 'Synchronization', 'volatile', 'synchronized', 'Locks', 'ReentrantLock',
          'ReadWriteLock', 'Executor Framework', 'ThreadPoolExecutor', 'CompletableFuture', 'Fork Join Framework',
          'Concurrent Collections', ['Virtual Threads', 'P1'], ['Structured Concurrency', 'P2'], ['Scoped Values', 'P3'],
          ['Backpressure basics', 'P2']
        ]
      },
      {
        title: 'JVM',
        items: [
          'JVM Architecture', 'Class Loading', 'Heap', 'Stack', 'Metaspace', 'Java Memory Model',
          'Garbage Collection', 'G1 GC', 'ZGC Basics', 'JIT Compiler', 'AOT Compilation', 'GraalVM',
          'Native Image', ['JFR and JMC', 'P2'], ['Heap dump analysis', 'P1'], ['Thread dump analysis', 'P1']
        ]
      },
      {
        title: 'Java Versions',
        items: ['Java 8', 'Java 11', 'Java 17', 'Java 21', ['Java 21 language features', 'P1'], ['Migration and compatibility', 'P2']]
      }
    ]
  },
  {
    title: 'Spring and Spring Boot',
    priority: 'P0',
    resourceKey: 'spring',
    sections: [
      { title: 'Spring Core', items: ['IOC', 'Dependency Injection', 'Bean Lifecycle', 'Bean Scopes', 'Configuration', 'Profiles', 'Events', 'AOP'] },
      {
        title: 'Spring Boot',
        items: [
          'Auto Configuration', 'Configuration Properties', 'Validation', 'Exception Handling', 'Logging',
          ['Actuator health and metrics', 'P1'], ['Micrometer integration', 'P1'], ['Graceful shutdown', 'P1'],
          ['Externalized configuration', 'P1'], ['Native image readiness', 'P3']
        ]
      },
      {
        title: 'REST APIs',
        items: [
          'REST Principles', 'CRUD APIs', 'Request Validation', 'Error Handling', 'API Versioning',
          'Pagination', 'Sorting', 'Filtering', 'Idempotency', ['Problem Details RFC 7807', 'P1'],
          ['OpenAPI contracts', 'P1'], ['HATEOAS awareness', 'P3']
        ]
      },
      {
        title: 'Spring Data JPA',
        items: [
          'Entity Mapping', 'Relationships', 'JPQL', 'Native Queries', 'Pagination', 'Specifications',
          'Transactions', 'Optimistic Locking', 'Pessimistic Locking', 'Lazy Loading', 'Eager Loading',
          'N+1 Query Problem', ['Connection Pooling with HikariCP', 'P1'], ['Batching and fetch size', 'P2']
        ]
      },
      {
        title: 'Spring Security',
        items: [
          'Authentication', 'Authorization', 'JWT', 'OAuth2', 'CORS', 'CSRF', 'Password Encoding',
          ['Method security', 'P1'], ['Refresh token rotation', 'P1'], ['Security filter chain', 'P1']
        ]
      },
      {
        title: 'Advanced Spring',
        items: [
          'Spring Cache', 'Spring Scheduler', 'Spring Events', 'AOP', 'OpenAPI and Swagger',
          'Email Integration', ['Spring WebFlux basics', 'P2'], ['Spring AI integration', 'P1'],
          ['Spring Batch basics', 'P3']
        ]
      }
    ]
  },
  {
    title: 'Microservices',
    priority: 'P0',
    resourceKey: 'microservices',
    sections: [
      {
        title: 'Architecture and Patterns',
        items: [
          'Microservice Architecture', 'Domain-Driven Design basics', 'Bounded Contexts', 'API Gateway',
          'BFF pattern', 'Config Server', 'Service Discovery', 'OpenFeign', 'Load Balancer', 'Resilience4j',
          'Circuit Breaker', 'Retry', 'Bulkhead', 'Timeouts', 'Rate Limiting', 'Distributed Transactions',
          'Saga Pattern', 'Outbox Pattern', 'Event Driven Architecture', 'Idempotency', 'gRPC and Protobuf',
          'Twelve-Factor App methodology', 'Contract Testing with Pact', ['Consumer-driven contracts', 'P1'],
          ['Service mesh basics', 'P3']
        ]
      }
    ]
  },
  {
    title: 'Kafka and Messaging',
    priority: 'P0',
    resourceKey: 'kafka',
    sections: [
      {
        title: 'Kafka Core',
        items: [
          'Kafka Architecture', 'Producers', 'Consumers', 'Consumer Groups', 'Partitions', 'Replication',
          'Offsets', 'Ordering', 'Retry', 'Dead Letter Queue', 'Schema Registry', 'At Most Once',
          'At Least Once', 'Exactly Once', 'Idempotent Consumers', ['Transactions', 'P1'],
          ['Compacted topics', 'P2'], ['Kafka Streams basics', 'P2'], ['Kafka vs RabbitMQ vs SQS', 'P2']
        ]
      },
      { title: 'Other Messaging', items: [['RabbitMQ basics', 'P2'], ['AWS SQS and SNS', 'P1'], ['Pub/Sub design tradeoffs', 'P2']] }
    ]
  },
  {
    title: 'Databases',
    priority: 'P0',
    resourceKey: 'database',
    sections: [
      {
        title: 'SQL',
        items: [
          'SQL Basics', 'Joins', 'Group By', 'Window Functions', 'Indexing', 'Normalization', 'Transactions',
          'ACID Properties', 'Isolation Levels', 'Locks', 'Query Optimization', 'Execution Plan',
          ['Partitioning', 'P1'], ['Materialized views', 'P2'], ['Stored Procedures and Triggers', 'P3']
        ]
      },
      {
        title: 'NoSQL',
        items: [
          'MongoDB Basics', 'Cassandra Basics', 'DynamoDB Basics', ['Document modeling', 'P1'],
          ['Wide-column modeling', 'P2'], ['Read/write capacity planning', 'P2']
        ]
      }
    ]
  },
  {
    title: 'Redis and Caching',
    priority: 'P1',
    resourceKey: 'redis',
    sections: [
      { title: 'Redis Core', items: ['Caching', 'TTL', 'Pub/Sub', 'Distributed Lock', 'Session Storage', 'Cache Aside', 'Write Through', 'Write Behind', 'Cache Invalidation', ['Eviction policies', 'P1'], ['Redis Streams', 'P2']] }
    ]
  },
  {
    title: 'Distributed Systems',
    priority: 'P1',
    resourceKey: 'distributed',
    sections: [
      {
        title: 'Core Concepts',
        items: [
          'CAP Theorem', 'Consistency Models', 'Replication', 'Partitioning', 'Sharding',
          ['Consistent Hashing', 'P1'], 'Leader Election', 'Distributed Locks', 'Eventual Consistency',
          ['CQRS', 'P2'], ['Event Sourcing', 'P2'], ['Quorum reads and writes', 'P2']
        ]
      }
    ]
  },
  {
    title: 'CI/CD and Git',
    priority: 'P1',
    resourceKey: 'cicd',
    sections: [
      {
        title: 'Git and Workflow',
        items: [
          'Git basics', 'Branching strategy', 'Merge and rebase', 'Cherry pick', 'Conflict resolution',
          'Pull request hygiene', ['Conventional commits', 'P2'], ['Monorepo vs polyrepo', 'P3']
        ]
      },
      {
        title: 'CI/CD Pipelines',
        items: [
          'GitHub Actions', 'Jenkins basics', 'Pipeline as code', 'Build caching',
          ['Artifact versioning', 'P1'], ['Deployment gates', 'P2'], ['DORA metrics awareness', 'P3']
        ]
      }
    ]
  },
  {
    title: 'Linux and Shell',
    priority: 'P2',
    resourceKey: 'linux',
    sections: [
      {
        title: 'Command Line',
        items: [
          'grep', 'awk', 'sed', 'curl', 'find', 'ps', 'top', 'htop', 'lsof', 'ssh', 'chmod',
          'journalctl', ['strace basics', 'P3'], ['perf and flamegraphs', 'P3']
        ]
      }
    ]
  },
  {
    title: 'CS Fundamentals',
    priority: 'P2',
    resourceKey: 'cs',
    sections: [
      {
        title: 'Foundations',
        items: [
          'Operating Systems basics', 'DBMS basics', 'Computer Networks', 'HTTP', 'HTTPS',
          'REST', ['gRPC basics', 'P2'], 'TCP/IP', 'DNS', ['TLS handshake', 'P2']
        ]
      }
    ]
  },
  {
    title: 'System Design',
    priority: 'P0',
    resourceKey: 'systemDesign',
    sections: [
      {
        title: 'High-Level Design',
        items: [
          'Load Balancer', 'Reverse Proxy', 'CDN', 'API Gateway', 'Database Replication', 'Database Sharding',
          'Caching', 'Message Queues', 'Distributed Cache', 'Rate Limiter', 'URL Shortener',
          'Notification System', 'Chat System', 'News Feed', 'Payment System', 'Design Twitter',
          'Design Uber or Ride-sharing', 'Design Distributed ID Generator', 'Design Search Autocomplete',
          ['Design multi-tenant SaaS', 'P2'], ['Capacity estimation', 'P1'], ['Back-of-envelope math', 'P1']
        ]
      },
      {
        title: 'Low-Level Design',
        items: [
          'SOLID', 'Design Patterns overview', 'Singleton', 'Factory and Abstract Factory', 'Builder',
          'Strategy', 'Observer', 'Decorator', 'Adapter', 'Chain of Responsibility', 'UML', 'Parking Lot',
          'BookMyShow', 'Splitwise', 'Elevator', 'Tic Tac Toe', 'Snake and Ladder', ['Thread-safe LLD', 'P1']
        ]
      }
    ]
  },
  {
    title: 'DSA',
    priority: 'P0',
    resourceKey: 'dsa',
    sections: [
      {
        title: 'Core Patterns',
        items: [
          'Arrays', 'Strings', 'Hashing', 'Linked List', 'Stack', 'Queue', 'Binary Search',
          'Sliding Window', 'Two Pointers', 'Trees', 'BST', 'Heap', 'Trie', 'Graph', 'Greedy',
          'Recursion', 'Backtracking', 'Dynamic Programming', 'Topological Sort', 'Union Find',
          ['Fenwick Tree', 'P2'], ['Segment Tree', 'P2'], ['Sparse Table', 'P3']
        ]
      }
    ]
  },
  {
    title: 'Cloud, Docker, Kubernetes',
    priority: 'P1',
    resourceKey: 'cloud',
    sections: [
      { title: 'Docker', items: ['Docker Basics', 'Dockerfile', 'Images', 'Containers', 'Networks', 'Volumes', 'Docker Compose', 'Multi-stage Build', ['Image scanning', 'P2']] },
      { title: 'Kubernetes', items: ['Pods', 'ReplicaSets', 'Deployments', 'Services', 'ConfigMaps', 'Secrets', 'Ingress', 'Rolling Updates', 'Liveness Probe', 'Readiness Probe', 'Autoscaling', ['Helm basics', 'P2'], ['Resource requests and limits', 'P1']] },
      { title: 'AWS', items: ['IAM', 'EC2', 'S3', 'RDS', 'VPC Basics', 'CloudWatch', 'ECS Basics', 'EKS Basics', 'SQS', 'SNS', 'Lambda Basics', 'Bedrock Basics', ['Cost awareness', 'P2']] }
    ]
  },
  {
    title: 'Testing and Quality',
    priority: 'P1',
    resourceKey: 'spring',
    sections: [
      { title: 'Testing', items: ['JUnit 5', 'Mockito', 'Integration Testing', 'Testcontainers', 'REST Assured', 'Postman', 'WireMock', ['Contract tests', 'P1'], ['Load Testing with JMeter or Gatling', 'P2'], ['Mutation testing', 'P3']] },
      { title: 'Code Quality', items: ['Clean Code', 'Refactoring', 'Static analysis', 'Code reviews', 'Sonar rules', ['Architectural fitness functions', 'P3']] }
    ]
  },
  {
    title: 'Observability and Production Engineering',
    priority: 'P1',
    resourceKey: 'observability',
    sections: [
      {
        title: 'Operations',
        items: [
          'SLF4J', 'Logback', 'ELK Basics', 'Prometheus', 'Grafana', 'OpenTelemetry',
          'Distributed Tracing', 'Health Checks', 'Correlation IDs', 'Feature Flags',
          'Blue-Green Deployment', 'Canary Deployment', 'Graceful Shutdown', 'Retry Policies',
          'Timeout Configuration', 'Circuit Breaker', 'Rate Limiting', 'Log Rotation',
          'Disaster Recovery Basics', ['SLOs and error budgets', 'P1'], ['Runbooks', 'P2'],
          ['Terraform and IaC Basics', 'P2']
        ]
      }
    ]
  },
  {
    title: 'Security',
    priority: 'P1',
    resourceKey: 'security',
    sections: [
      {
        title: 'Application Security',
        items: [
          'HTTPS', 'TLS', 'JWT', 'OAuth2', 'Authentication', 'Authorization', 'OWASP Top 10',
          'OWASP API Security Top 10', 'Secrets Management', 'Input Validation', 'Output Encoding',
          ['Dependency vulnerability scanning', 'P1'], ['Threat modeling', 'P2'], ['Audit logging', 'P2']
        ]
      }
    ]
  },
  {
    title: 'GenAI and Agentic AI',
    priority: 'P1',
    resourceKey: 'genai',
    sections: [
      {
        title: 'LLM Fundamentals',
        items: [
          'Tokens and Tokenization', 'Context Window', 'Temperature / Top-p / Top-k',
          'System vs User vs Assistant roles', 'Streaming Responses', 'Function or Tool Calling',
          'Structured Outputs', ['Embeddings', 'P1'], ['Multimodal basics', 'P3']
        ]
      },
      {
        title: 'Prompt Engineering',
        items: [
          'Prompt Engineering fundamentals', ['Few-shot and zero-shot prompting', 'P1'],
          ['Chain-of-thought prompting', 'P2'], ['Context engineering', 'P1'],
          ['Prompt templates and versioning', 'P2']
        ]
      },
      {
        title: 'RAG and Retrieval',
        items: [
          'Vector Databases', 'RAG', 'Chunking strategy', 'Advanced RAG', 'Hybrid Search',
          'Metadata filtering', 'Reranking', 'RAG Evaluation', 'RAGAS awareness',
          ['Vector DB options: Pinecone / Weaviate / Milvus / pgvector', 'P2'],
          ['Retrieval latency and cost tuning', 'P2']
        ]
      },
      {
        title: 'Agentic AI',
        items: [
          'MCP', 'LangChain', 'LangGraph', 'AI Agents', 'Agent Design Patterns: ReAct and Reflection',
          'Multi-Agent Orchestration', 'CrewAI / AutoGen / LlamaIndex awareness', 'Knowledge Graph',
          'GraphRAG', ['Tool permissioning', 'P1'], ['Human-in-the-loop workflows', 'P2']
        ]
      },
      {
        title: 'AI Ops and Safety',
        items: [
          'LLM Observability and Tracing', 'Prompt Injection Defense', 'Guardrails', 'LLM-as-judge Evaluation',
          'Cost and Latency Optimization', 'Fine-tuning Basics', ['PII handling in AI apps', 'P1'],
          ['Prompt/version management', 'P2']
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
          'Java Interview Questions', 'Spring Boot Interview Questions', 'SQL Interview Questions',
          'Kafka Interview Questions', 'Redis Interview Questions', 'Docker and Kubernetes Questions',
          'AWS Questions', 'GenAI and Agentic AI Interview Questions', 'HLD Mock Interviews',
          'LLD Mock Interviews', 'DSA Revision', 'Resume Preparation', 'LinkedIn Optimization',
          'HR Interview Preparation', 'Salary Negotiation Preparation', 'Behavioral Stories in STAR format',
          ['Project deep dives', 'P0'], ['Incident stories and tradeoffs', 'P1']
        ]
      }
    ]
  },
  {
    title: 'Portfolio Projects',
    priority: 'P0',
    resourceKey: 'spring',
    sections: [
      { title: 'Build at least three', items: ['E-Commerce Platform with Microservices', 'Payment and Wallet Service', 'AI-enabled Backend with Spring AI and RAG', 'Agentic AI project with tool-calling and MCP', ['Real-time notification system', 'P2']] },
      { title: 'Each project should include', items: ['Authentication and Authorization', 'REST APIs', 'SQL Database', 'Redis Cache', 'Kafka Messaging', 'Docker', 'Kubernetes', 'CI/CD', 'Monitoring', 'Unit and Integration Tests', 'API Documentation', 'README with architecture diagram', ['Load test report', 'P2'], ['Threat model notes', 'P2']] }
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
